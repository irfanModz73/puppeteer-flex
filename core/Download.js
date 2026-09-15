const fs = require('fs');
const path = require('path');
const MediafireHandler = require('./MediafireHandler');

class Download {
  constructor(downloadsPath = './downloads') {
    this.downloadsPath = path.resolve(downloadsPath);
    this.items = [];
    this.attached = new WeakSet();
    this.listeners = [];
    this.handlers = new Map();
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }
  }

  attachPage(page) {
    if (!page || this.attached.has(page)) return;
    this.attached.add(page);

    try {
      const client = page._client ? page._client() : null;
      if (client) {
        client
          .send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.downloadsPath,
          })
          .catch(() => {});
      }
    } catch (_) {}

    const handler = new MediafireHandler(page, {
      downloadsPath: this.downloadsPath,
    });
    this.handlers.set(page, handler);
    handler.attach().catch(() => {});

    page.on('response', async (res) => {
      try {
        const headers = res.headers();
        const cd = headers['content-disposition'] || '';
        if (!cd.includes('attachment')) return;
        const url = res.url();
        const m = cd.match(/filename="?([^"]+)"?/);
        const filename = m ? m[1] : `download-${Date.now()}`;
        const target = path.join(this.downloadsPath, filename);
        const item = {
          url,
          suggestedFilename: filename,
          path: target,
          timestamp: new Date().toISOString(),
          status: 'detected',
        };
        this.items.push(item);
        for (const fn of this.listeners) {
          try {
            fn(item);
          } catch (_) {}
        }
      } catch (_) {}
    });
  }

  onDownload(fn) {
    this.listeners.push(fn);
    return this;
  }

  list() {
    const mediafire = [];
    for (const h of this.handlers.values()) {
      mediafire.push(...h.list());
    }
    return [...this.items, ...mediafire];
  }

  getByFilename(name) {
    return this.list().find((i) => i.suggestedFilename === name) || null;
  }

  async waitFor(filename, timeout = 120000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = this.getByFilename(filename);
      if (found && found.status === 'completed') return found;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Download timeout: ${filename}`);
  }

  clear() {
    this.items = [];
    for (const h of this.handlers.values()) h.clear();
  }

  getHandler(page) {
    return this.handlers.get(page) || null;
  }
}

module.exports = Download;
