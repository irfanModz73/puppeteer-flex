const _pageRoutes = new WeakMap();

function attach(page) {
  if (!page || page._noRedirectAttached) return;
  page._noRedirectAttached = true;
  page._noRedirectEnabled = false;

  page.setNoRedirect = (enabled = true) => {
    page._noRedirectEnabled = !!enabled;
    if (page._noRedirectEnabled) {
      NoRedirect._enableForPage(page);
    } else {
      NoRedirect._disableForPage(page);
    }
  };

  page.on('close', () => NoRedirect._disableForPage(page));
}

function _enableForPage(page) {
  if (_pageRoutes.has(page)) return;
  _pageRoutes.set(page, true);

  const install = async () => {
    try {
      const client = await page.target().createCDPSession();
      await client.send('Fetch.enable', {
        patterns: [{ urlPattern: '*', requestStage: 'Request' }],
      });

      client.on('Fetch.requestPaused', async (event) => {
        if (!page._noRedirectEnabled) {
          try {
            await client.send('Fetch.continueRequest', {
              requestId: event.requestId,
            });
          } catch (_) {}
          return;
        }

        try {
          const resp = await client.send('Fetch.getResponseBody', {
            requestId: event.requestId,
          });
          await client.send('Fetch.continueRequest', {
            requestId: event.requestId,
          });
        } catch (_) {
          try {
            await client.send('Fetch.continueRequest', {
              requestId: event.requestId,
            });
          } catch (_) {}
        }
      });
    } catch (_) {}
  };

  install().catch(() => {});
}

function _disableForPage(page) {
  _pageRoutes.delete(page);
  page._noRedirectEnabled = false;
}

const NoRedirect = { attach, _enableForPage, _disableForPage };

module.exports = NoRedirect;