const fs = require('fs');

class History {
  constructor() {
    this.entries = [];
    this.attached = new WeakSet();
  }

  attachPage(page) {
    if (!page || this.attached.has(page)) return;
    this.attached.add(page);

    const record = async () => {
      try {
        const url = page.url();
        if (!url || url === 'about:blank') return;
        let title = '';
        try {
          title = await page.title();
        } catch (_) {}
        const last = this.entries[this.entries.length - 1];
        if (last && last.url === url) return;
        this.entries.push({
          url,
          title,
          timestamp: new Date().toISOString(),
          pageId: page._guid || (page._guid = History._guid()),
        });
      } catch (_) {}
    };

    try {
      page.on('framenavigated', record);
    } catch (_) {}

    try {
      page.on('load', record);
    } catch (_) {}

    try {
      page.on('domcontentloaded', record);
    } catch (_) {}

    record().catch(() => {});
  }

  getAll() {
    return [...this.entries];
  }

  getByPage(page) {
    const id = page && page._guid;
    if (!id) return [];
    return this.entries.filter((e) => e.pageId === id);
  }

  getByUrl(substring) {
    return this.entries.filter((e) => e.url.includes(substring));
  }

  clear() {
    this.entries = [];
  }

  export(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.entries, null, 2));
    return filePath;
  }

  static _guid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

module.exports = History;
