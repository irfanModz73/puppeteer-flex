const BrowserShim = require('./BrowserShim');

function wrapBrowser(puppeteerBrowser, options = {}) {
  const wrapped = BrowserShim.create(puppeteerBrowser);
  wrapped._puppeteer = puppeteerBrowser;
  wrapped._flexOptions = options;
  return wrapped;
}

module.exports = { wrapBrowser };