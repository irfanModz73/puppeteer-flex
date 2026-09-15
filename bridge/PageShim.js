function create(page) {
  if (page._flexShimAttached) return page;
  page._flexShimAttached = true;

  if (!page.waitForTimeout) {
    page.waitForTimeout = (ms) => new Promise((r) => setTimeout(r, ms));
  }

  if (!page.waitForLoadState) {
    page.waitForLoadState = async (state = 'load') => {
      const map = {
        load: 'load',
        domcontentloaded: 'domcontentloaded',
        networkidle: 'networkidle0',
      };
      return page.waitForNavigation({ waitUntil: map[state] || 'load' });
    };
  }

  if (!page.addInitScript) {
    page.addInitScript = async (script) => {
      const content =
        typeof script === 'function'
          ? `(${script.toString()})()`
          : script && script.content
          ? script.content
          : String(script);
      await page.evaluateOnNewDocument(content);
    };
  }

  if (!page.route) {
    page._flexRoutes = [];
    page.route = async (pattern, handler) => {
      page._flexRoutes.push({ pattern, handler });
      if (!page._flexInterceptionEnabled) {
        page._flexInterceptionEnabled = true;
        await page.setRequestInterception(true);
        page.on('request', async (req) => {
          const url = req.url();
          let matched = null;
          for (const r of page._flexRoutes) {
            if (typeof r.pattern === 'string') {
              const clean = r.pattern.replace('**/', '').replace('*', '');
              if (r.pattern === '**/*' || url.includes(clean)) {
                matched = r;
                break;
              }
            } else if (r.pattern instanceof RegExp) {
              if (r.pattern.test(url)) {
                matched = r;
                break;
              }
            }
          }
          if (matched) {
            const shim = {
              continue: (o) => req.continue(o),
              abort: (e) => req.abort(e),
              fulfill: (r) =>
                req.respond({
                  status: r.status || 200,
                  headers: r.headers || {},
                  body: r.body || '',
                  contentType: r.contentType,
                }),
              request: () => ({
                url: () => url,
                method: () => req.method(),
                headers: () => req.headers(),
                resourceType: () => req.resourceType(),
              }),
            };
            try {
              await matched.handler(shim, shim.request());
            } catch (_) {
              try {
                await req.continue();
              } catch (_) {}
            }
          } else {
            try {
              await req.continue();
            } catch (_) {}
          }
        });
      }
    };
    page.unroute = async (pattern) => {
      if (!pattern) page._flexRoutes = [];
      else page._flexRoutes = page._flexRoutes.filter((r) => r.pattern !== pattern);
    };
  }

  if (!page.callApi) {
    page.callApi = async (url, method = 'GET', body = null, headers = {}) => {
      const res = await page.evaluate(
        async (u, m, b, h) => {
          try {
            const opts = { method: m, headers: h };
            if (b) {
              opts.body = typeof b === 'string' ? b : JSON.stringify(b);
              if (!opts.headers['Content-Type'])
                opts.headers['Content-Type'] = 'application/json';
            }
            const r = await fetch(u, opts);
            let data = null;
            const ct = r.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              data = await r.json();
            } else {
              data = await r.text();
            }
            return { status: r.status, ok: r.ok, headers: [...r.headers.entries()], data };
          } catch (e) {
            return { error: e.message };
          }
        },
        url,
        method,
        body,
        headers
      );
      console.log('[puppeteer-flex] callApi:', url, method, res.status || 'ERR');
      return res;
    };
  }

  return page;
}

module.exports = { create };