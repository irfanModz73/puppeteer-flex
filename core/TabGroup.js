class TabGroup {
  constructor(name, id) {
    this.name = name;
    this.id = id;
    this._pages = new Set();
  }
  add(page) {
    if (page) this._pages.add(page);
    return this;
  }
  remove(page) {
    this._pages.delete(page);
    return this;
  }
  has(page) {
    return this._pages.has(page);
  }
  pages() {
    return [...this._pages];
  }
  async close() {
    for (const page of this._pages) {
      try {
        if (!page.isClosed()) await page.close();
      } catch (_) {}
    }
    this._pages.clear();
  }
  get size() {
    return this._pages.size;
  }
}

module.exports = TabGroup;