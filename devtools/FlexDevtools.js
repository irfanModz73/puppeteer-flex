const DevtoolsUIServer = require('./DevtoolsUIServer');
const WSProxy = require('./WSProxy');
const DevtoolsRecorder = require('./DevtoolsRecorder');
const DevtoolsExport = require('./DevtoolsExport');

class FlexDevtools {
  constructor(options = {}) {
    this.port = options.port || 0;
    this.host = options.host || '127.0.0.1';
    this.record = options.record === true;
    this.wsProxy = new WSProxy({ port: 0, host: this.host });
    this.uiServer = new DevtoolsUIServer({ port: this.port, host: this.host });
    this.url = null;
    this.wsUrl = null;
    this._targets = new Map();
  }

  async attach(browser) {
    this.wsUrl = await this.wsProxy.start();
    this.uiServer.wsProxyUrl = this.wsUrl;
    this.url = await this.uiServer.start();

    const attachToPage = async (page) => await this._attachPage(page);

    try {
      browser.on('targetcreated', async (target) => {
        try {
          if (target.type() === 'page') {
            const p = await target.page();
            if (p) await attachToPage(p);
          }
        } catch (_) {}
      });
    } catch (_) {}

    try {
      const pages = await browser.pages();
      for (const p of pages) await attachToPage(p);
    } catch (_) {}
  }

  async _attachPage(page) {
    if (!page || page._flexDevtoolsAttached) return;
    page._flexDevtoolsAttached = true;

    let client = null;
    try {
      client = await page.target().createCDPSession();
    } catch (_) {}
    if (!client) return;

    page.devtools = page.devtools || {};
    page.devtools.send = (m, p) => client.send(m, p);
    page.devtools.detach = () => client.detach();
    page.devtools.session = client;
    page.devtools.export = async (type, path) =>
      DevtoolsExport.export(page, type, path);

    if (this.record) DevtoolsRecorder.attach(page);

    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const handler = (m, p) => client.send(m, p);
    const info = this.wsProxy.register(handler);

    const target = {
      id,
      url: page.url(),
      title: '',
      wsUrl: info.url,
      sessionId: info.id,
      page,
    };
    this._targets.set(id, target);
    this._refreshTargets();

    page.devtools.remoteId = id;
    page.devtools.remoteWsUrl = info.url;
    page.devtools.remoteUIUrl = this.url;

    page.on('framenavigated', () => {
      const t = this._targets.get(id);
      if (t) {
        t.url = page.url();
        this._refreshTargets();
      }
    });

    page.on('close', () => {
      this.wsProxy.unregister(info.id);
      this._targets.delete(id);
      this._refreshTargets();
    });
  }

  _refreshTargets() {
    this.uiServer.setTargets(
      Array.from(this._targets.values()).map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        wsUrl: t.wsUrl,
      }))
    );
  }

  getUIUrl() {
    return this.url;
  }
  getWsUrl() {
    return this.wsUrl;
  }
  async stop() {
    try {
      await this.uiServer.stop();
    } catch (_) {}
    try {
      await this.wsProxy.stop();
    } catch (_) {}
  }
}

module.exports = FlexDevtools;