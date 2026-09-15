const TabGroup = require('./TabGroup');

class TabManager {
  constructor(browser, history) {
    this.browser = browser;
    this.history = history;
    this.groups = new Map();
    this._counter = 0;
  }
  async createTab(url, context) {
    let target = null;
    if (context && typeof context.newPage === 'function') {
      target = await context.newPage();
    } else {
      target = await this.browser.newPage();
    }
    if (url) {
      await target.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    return target;
  }
  async deleteTab(page) {
    if (!page) return false;
    try {
      if (!page.isClosed()) await page.close();
      return true;
    } catch (_) {
      return false;
    }
  }
  async listTabs() {
    return await this.browser.pages();
  }
  createGroup(name) {
    const id = `group-${++this._counter}`;
    const g = new TabGroup(name || id, id);
    this.groups.set(g.name, g);
    return g;
  }
  getGroup(name) {
    return this.groups.get(name) || null;
  }
}

module.exports = TabManager;