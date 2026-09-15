async function createIncognito(browser) {
  if (!browser) throw new Error('createIncognito requires a browser instance');
  if (typeof browser.createBrowserContext === 'function') {
    return browser.createBrowserContext();
  }
  if (typeof browser.createIncognitoBrowserContext === 'function') {
    return browser.createIncognitoBrowserContext();
  }
  throw new Error('Incognito not supported by this browser');
}

module.exports = { createIncognito };