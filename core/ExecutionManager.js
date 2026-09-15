class ExecutionManager {
  constructor(page) {
    this.page = page;
    this._attached = false;
    this._pending = new Set();
  }

  async attach() {
    if (this._attached) return;
    this._attached = true;

    this.page.waitForExecution = async (opt = {}) => {
      const timeout = opt.timeout || 30000;
      const start = Date.now();

      while (Date.now() - start < timeout) {
        if (opt.url) {
          if (await this._checkUrl(opt.url)) return true;
        }
        if (opt.js) {
          if (await this._checkJs(opt.js)) return true;
        }
        if (opt.event) {
          if (await this._checkEvent(opt.event)) return true;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      return false;
    };

    this.page.executeOnDocument = async (opts = {}) => {
      const type = opts.type || 'auto';
      const code = opts.code;
      const time = opts.time || 0;
      const isWait = opts.isWait !== false;

      if (!code) throw new Error('code required');

      const runner = async () => {
        if (time > 0) await new Promise((r) => setTimeout(r, time));
        try {
          if (typeof code === 'function') {
            return await this.page.evaluate(code);
          }
          return await this.page.evaluate(new Function(code));
        } catch (err) {
          return { error: err.message };
        }
      };

      if (type === 'flex') {
        try {
          const browser = await this.page.browser();
          const flex = browser && browser._puppeteerFlex;
          if (flex && flex.mode === 'puppeteer') {
            if (isWait) return await runner();
            runner().catch(() => {});
            return true;
          }
          return isWait ? await runner() : (runner().catch(() => {}), true);
        } catch (_) {
          return isWait ? await runner() : true;
        }
      }

      if (isWait) return await runner();
      runner().catch(() => {});
      return true;
    };
  }

  async _checkUrl(pattern) {
    try {
      const url = this.page.url();
      if (typeof pattern === 'string') {
        if (pattern === '**/*') return true;
        const clean = pattern.replace('**/', '').replace('*', '');
        return url.includes(clean);
      }
      if (pattern instanceof RegExp) return pattern.test(url);
    } catch (_) {}
    return false;
  }

  async _checkJs(expr) {
    try {
      return await this.page.evaluate((e) => {
        try {
          return !!eval(e);
        } catch (_) {
          return false;
        }
      }, expr);
    } catch (_) {
      return false;
    }
  }

  async _checkEvent(event) {
    if (event === 'networkidle') {
      try {
        await this.page.waitForLoadState('networkidle');
        return true;
      } catch (_) {
        return false;
      }
    }
    if (event === 'load' || event === 'domcontentloaded') {
      try {
        await this.page.waitForLoadState(event);
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

module.exports = ExecutionManager;