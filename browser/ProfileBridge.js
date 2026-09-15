const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PROFILE_ROOTS = {
  linux: ['~/.config/google-chrome', '~/.config/chromium'],
  darwin: [
    '~/Library/Application Support/Google/Chrome',
    '~/Library/Application Support/Chromium',
  ],
  win32: [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data'),
  ],
};

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

function detectProfiles() {
  const roots = CHROME_PROFILE_ROOTS[process.platform] || [];
  const found = [];
  for (const root of roots) {
    const expanded = expandHome(root);
    if (!fs.existsSync(expanded)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(expanded);
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (entry === 'Default' || entry.startsWith('Profile ')) {
        found.push({
          name: entry,
          root: expanded,
          path: path.join(expanded, entry),
        });
      }
    }
  }
  return found;
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'Cache' ||
        entry.name === 'Code Cache' ||
        entry.name === 'GPUCache'
      )
        continue;
      copyDirRecursive(srcPath, dstPath);
    } else if (entry.isFile()) {
      try {
        fs.copyFileSync(srcPath, dstPath);
      } catch (_) {}
    }
  }
}

function resolve(profileOption, userDataDir) {
  if (userDataDir)
    return { userDataDir: path.resolve(userDataDir), type: 'custom' };
  if (!profileOption) return { userDataDir: null, type: 'none' };

  if (profileOption === true || profileOption === 'default') {
    const profiles = detectProfiles();
    const def = profiles.find((p) => p.name === 'Default') || profiles[0];
    if (!def) return { userDataDir: null, type: 'none' };
    const tmp = fs.mkdtempSync(
      path.join(os.tmpdir(), 'puppeteer-flex-profile-')
    );
    copyDirRecursive(def.path, path.join(tmp, 'Default'));
    return { userDataDir: tmp, type: 'copied', source: def.path };
  }

  if (typeof profileOption === 'string') {
    if (profileOption.startsWith('/') || profileOption.match(/^[A-Z]:\\/)) {
      if (!fs.existsSync(profileOption)) {
        throw new Error(`Profile path not found: ${profileOption}`);
      }
      const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), 'puppeteer-flex-profile-')
      );
      copyDirRecursive(profileOption, path.join(tmp, 'Default'));
      return { userDataDir: tmp, type: 'copied', source: profileOption };
    }
    const profiles = detectProfiles();
    const byName = profiles.find((p) => p.name === profileOption);
    if (!byName) throw new Error(`Profile not found: ${profileOption}`);
    const tmp = fs.mkdtempSync(
      path.join(os.tmpdir(), 'puppeteer-flex-profile-')
    );
    copyDirRecursive(byName.path, path.join(tmp, 'Default'));
    return { userDataDir: tmp, type: 'copied', source: byName.path };
  }

  return { userDataDir: null, type: 'none' };
}

module.exports = { resolve, detectProfiles };