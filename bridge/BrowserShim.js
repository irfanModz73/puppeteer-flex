const ContextShim = require('./ContextShim');

function makeDefaultContext(browser) {
  return {
    _isDefault: true,
    _browser: browser,
    async newPage() {
      return await browser.newPage();
    },
    async pages() {
      return await browser.pages();
    },
    async close() {
      const pages = await browser.pages();
      for (const p of pages) {
        try {
          if (!p.isClosed()) await p.close();
        } catch (_) {}
      }
    },
    async cookies() {
      const pages = await browser.pages();
      if (pages.length === 0) return [];
      return await pages[0].cookies();
    },
    async addCookies(cookies) {
      const pages = await browser.pages();
      if (pages.length === 0) return;
      for (const c of cookies) {
        try {
          await pages[0].setCookie(c);
        } catch (_) {}
      }
    },
    async clearCookies() {
      const pages = await browser.pages();
      for (const p of pages) {
        try {
          const client = await p.target().createCDPSession();
          await client.send('Network.clearBrowserCookies');
        } catch (_) {}
      }
    },
  };
}

function create(browser) {
  const shim = {
    _puppeteer: browser,
    async newContext() {
      const fn =
        typeof browser.createBrowserContext === 'function'
          ? browser.createBrowserContext.bind(browser)
          : typeof browser.createIncognitoBrowserContext === 'function'
          ? browser.createIncognitoBrowserContext.bind(browser)
          : null;
      if (!fn) throw new Error('Browser context API not supported');
      const ctx = await fn();
      return ContextShim.create(ctx, browser);
    },
    async newPage() {
      return await browser.newPage();
    },
    contexts() {
      return [makeDefaultContext(browser)];
    },
    async close() {
      return await browser.close();
    },
    async version() {
      return await browser.version();
    },
    async userAgent() {
      return await browser.userAgent();
    },
    createTab: browser.createTab,
    deleteTab: browser.deleteTab,
    listTabs: browser.listTabs,
    createGroup: browser.createGroup,
    getGroup: browser.getGroup,
    incognito: browser.incognito,
    devtoolsUrl: browser.devtoolsUrl,
    wsEndpoint: browser.wsEndpoint,
    history: browser.history,
    downloads: browser.downloads,
    devtools: browser.devtools,
  };

  Object.defineProperty(shim, 'cookies', {
    get() {
      return {
        async get(urls) {
          const pages = await browser.pages();
          if (pages.length === 0) return [];
          if (urls) return await pages[0].cookies(...urls);
          return await pages[0].cookies();
        },
        async set(cookies) {
          const pages = await browser.pages();
          if (pages.length === 0) return false;
          for (const c of cookies) {
            try {
              await pages[0].setCookie(c);
            } catch (_) {}
          }
          return true;
        },
        async clear() {
          const pages = await browser.pages();
          for (const p of pages) {
            try {
              const client = await p.target().createCDPSession();
              await client.send('Network.clearBrowserCookies');
            } catch (_) {}
          }
          return true;
        },
      };
    },
    configurable: true,
  });

  return shim;
}

module.exports = { create, makeDefaultContext };