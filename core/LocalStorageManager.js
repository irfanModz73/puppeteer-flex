const fs = require('fs');
const path = require('path');

class LocalStorageManager {
  async get(page) {
    if (!page) return {};
    try {
      return await page.evaluate(() => {
        const d = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) d[k] = localStorage.getItem(k);
          }
        } catch (_) {}
        return d;
      });
    } catch (_) {
      return {};
    }
  }

  async set(page, data) {
    if (!page) return false;
    try {
      await page.evaluate((p) => {
        try {
          for (const [k, v] of Object.entries(p)) localStorage.setItem(k, String(v));
        } catch (_) {}
      }, data || {});
      return true;
    } catch (_) {
      return false;
    }
  }

  async clear(page) {
    if (!page) return false;
    try {
      await page.evaluate(() => {
        try {
          localStorage.clear();
        } catch (_) {}
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  async save(filePath, page) {
    const data = await this.get(page);
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(data, null, 2));
    return resolved;
  }

  async load(filePath, page) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) throw new Error(`LocalStorage file not found: ${resolved}`);
    const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    await this.set(page, data);
    return Object.keys(data).length;
  }
}

module.exports = LocalStorageManager;