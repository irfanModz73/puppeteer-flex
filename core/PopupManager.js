class PopupManager {
  constructor(page) {
    this.page = page;
    this.popups = [];
    this._attached = false;
    this._closed = false;
  }

  async attach() {
    if (this._attached) return;
    this._attached = true;

    const browser = await this.page.browser();

    const handleTarget = async (target) => {
      try {
        if (target.type() !== 'page') return;
        const newPage = await target.page();
        if (!newPage) return;
        if (newPage === this.page) return;

        const url = newPage.url();

        this.popups.push({
          page: newPage,
          url,
          timestamp: new Date().toISOString(),
        });

        if (this._closed) {
          try {
            await newPage.close();
          } catch (_) {}
        }
      } catch (_) {}
    };

    try {
      browser.on('targetcreated', handleTarget);
    } catch (_) {}

    try {
      this.page.on('popup', (popup) => {
        const url = popup.url();
        this.popups.push({
          page: popup,
          url,
          timestamp: new Date().toISOString(),
        });
        if (this._closed) {
          popup.close().catch(() => {});
        }
      });
    } catch (_) {}

    this.page.close = this._wrapClose(this.page.close.bind(this.page));
    this.page.show = (arg) => this.show(arg);
    this.page.getPopups = () => [...this.popups];
  }

  _wrapClose(origClose) {
    const self = this;
    return async function (arg, ...rest) {
      if (arg === true) {
        self._closed = true;
        for (const p of self.popups) {
          try {
            if (p.page && !p.page.isClosed()) await p.page.close();
          } catch (_) {}
        }
        self.popups = [];
      }
      return await origClose(...rest);
    };
  }

  async show() {
    if (this.popups.length === 0) return [];
    const urls = [];
    for (const p of this.popups) {
      try {
        const url = p.page && !p.page.isClosed() ? p.page.url() : p.url;
        urls.push(url);
      } catch (_) {
        urls.push(p.url);
      }
    }
    console.log('[puppeteer-flex] Popups:');
    for (const u of urls) {
      console.log('  -', u);
    }
    return urls;
  }

  list() {
    return this.popups.map((p) => p.url);
  }
}

module.exports = PopupManager;