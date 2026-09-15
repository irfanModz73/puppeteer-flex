const fs = require('fs');
const path = require('path');

class IndexedDBManager {
  async list(page) {
    if (!page) return [];
    try {
      return await page.evaluate(async () => {
        if (!indexedDB.databases) return [];
        const dbs = await indexedDB.databases();
        const out = [];
        for (const info of dbs) {
          if (!info.name) continue;
          const db = await new Promise((res) => {
            const r = indexedDB.open(info.name);
            r.onsuccess = () => res(r.result);
            r.onerror = () => res(null);
          });
          if (!db) continue;
          out.push({
            name: info.name,
            version: info.version,
            stores: Array.from(db.objectStoreNames),
          });
          db.close();
        }
        return out;
      });
    } catch (_) {
      return [];
    }
  }

  async get(page) {
    if (!page) return {};
    try {
      return await page.evaluate(async () => {
        const result = {};
        try {
          if (!indexedDB.databases) return result;
          const dbs = await indexedDB.databases();
          for (const info of dbs) {
            const name = info.name;
            if (!name) continue;
            const db = await new Promise((res, rej) => {
              const r = indexedDB.open(name);
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            });
            result[name] = {};
            for (const storeName of Array.from(db.objectStoreNames)) {
              const data = await new Promise((res, rej) => {
                const tx = db.transaction(storeName, 'readonly');
                const s = tx.objectStore(storeName);
                const out = { rows: [], keys: [] };
                const r = s.getAll();
                const kr = s.getAllKeys();
                r.onsuccess = () => (out.rows = r.result);
                kr.onsuccess = () => (out.keys = kr.result);
                tx.oncomplete = () => res(out);
                tx.onerror = () => rej(tx.error);
              });
              result[name][storeName] = data;
            }
            db.close();
          }
        } catch (_) {}
        return result;
      });
    } catch (_) {
      return {};
    }
  }

  async set(page, data) {
    if (!page) return false;
    try {
      await page.evaluate(async (payload) => {
        try {
          for (const name of Object.keys(payload)) {
            const stores = payload[name];
            const db = await new Promise((res, rej) => {
              const r = indexedDB.open(name);
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            });
            for (const storeName of Object.keys(stores)) {
              if (!db.objectStoreNames.contains(storeName)) continue;
              const d = stores[storeName];
              await new Promise((res, rej) => {
                const tx = db.transaction(storeName, 'readwrite');
                const s = tx.objectStore(storeName);
                s.clear();
                const keys = d.keys || [];
                const rows = d.rows || [];
                for (let i = 0; i < rows.length; i++) {
                  if (keys[i] !== undefined) s.put(rows[i], keys[i]);
                  else s.put(rows[i]);
                }
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
              });
            }
            db.close();
          }
        } catch (_) {}
        return true;
      }, data || {});
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
    if (!fs.existsSync(resolved)) throw new Error(`IndexedDB file not found: ${resolved}`);
    const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    await this.set(page, data);
    return true;
  }
}

module.exports = IndexedDBManager;