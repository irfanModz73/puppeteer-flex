const HEADER_KEYS = [
  'accept',
  'accept-language',
  'accept-encoding',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'upgrade-insecure-requests',
];

const DEFAULT_HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'sec-ch-ua':
    '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

async function applyPage(page) {
  try {
    await page.setExtraHTTPHeaders(DEFAULT_HEADERS);
  } catch (_) {}

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const headers = { ...req.headers() };
        for (const k of HEADER_KEYS) {
          if (DEFAULT_HEADERS[k] !== undefined) headers[k] = DEFAULT_HEADERS[k];
        }
        const reqUrl = req.url();
        const frameUrl = req.frame() ? req.frame().url() : '';
        if (frameUrl && reqUrl) {
          try {
            const ro = new URL(reqUrl).origin;
            const po = new URL(frameUrl).origin;
            if (ro !== po) {
              delete headers['origin'];
              headers['referer'] = frameUrl;
            }
          } catch (_) {}
        }
        req.continue({ headers }).catch(() => {});
      } catch (_) {
        try {
          req.continue();
        } catch (_) {}
      }
    });
  } catch (_) {}
}

module.exports = { applyPage, DEFAULT_HEADERS, HEADER_KEYS };