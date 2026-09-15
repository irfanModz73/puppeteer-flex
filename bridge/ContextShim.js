function create(incognitoContext, browser) {
  return {
    _puppeteer: incognitoContext,
    _browser: browser,
    async newPage() {
      return await incognitoContext.newPage();
    },
    async pages() {
      return incognitoContext.pages();
    },
    async close() {
      return incognitoContext.close();
    },
    async cookies() {
      const pages = incognitoContext.pages();
      if (pages.length === 0) return [];
      return await pages[0].cookies();
    },
    async addCookies(cookies) {
      const pages = incognitoContext.pages();
      if (pages.length === 0) return;
      for (const c of cookies) {
        try {
          await pages[0].setCookie(c);
        } catch (_) {}
      }
    },
    async clearCookies() {
      const pages = incognitoContext.pages();
      for (const p of pages) {
        try {
          const client = await p.target().createCDPSession();
          await client.send('Network.clearBrowserCookies');
        } catch (_) {}
      }
    },
    async grantPermissions(permissions, opts = {}) {
      try {
        if (incognitoContext.overridePermissions) {
          await incognitoContext.overridePermissions(
            opts.origin || '*',
            permissions
          );
        }
      } catch (_) {}
    },
    async clearPermissions() {
      try {
        if (incognitoContext.clearPermissionOverrides) {
          await incognitoContext.clearPermissionOverrides();
        }
      } catch (_) {}
    },
    async setExtraHTTPHeaders(headers) {
      const pages = incognitoContext.pages();
      for (const p of pages) {
        try {
          await p.setExtraHTTPHeaders(headers);
        } catch (_) {}
      }
    },
  };
}

module.exports = { create };