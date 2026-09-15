const fs = require('fs');
const path = require('path');
const os = require('os');

function findPlaywrightChromium() {
  const cacheRoots = [];
  if (process.platform === 'linux') {
    cacheRoots.push(
      path.join(os.homedir(), '.cache', 'ms-playwright'),
      '/root/.cache/ms-playwright'
    );
  } else if (process.platform === 'darwin') {
    cacheRoots.push(
      path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
    );
  } else if (process.platform === 'win32') {
    cacheRoots.push(path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'));
  }

  const binNames = {
    linux: 'chrome',
    darwin: 'Chromium.app/Contents/MacOS/Chromium',
    win32: 'chrome.exe',
  };
  const bin = binNames[process.platform] || 'chrome';

  for (const root of cacheRoots) {
    if (!fs.existsSync(root)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith('chromium')) continue;
      const candidates = [
        path.join(root, entry, 'chrome-linux', bin),
        path.join(root, entry, bin),
        path.join(root, entry, 'chrome-win', bin),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  }
  return null;
}

function findPlaywrightExecutablePath() {
  try {
    const { chromium } = require('playwright');
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_) {}
  return null;
}

function findSystemChrome() {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(
      process.env.LOCALAPPDATA || '',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe'
    ),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function resolve(options = {}) {
  if (options.executablePath && fs.existsSync(options.executablePath)) {
    process.env.CHROME_PATH = options.executablePath;
    return options.executablePath;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  let resolved = null;
  if (options.preferPlaywright !== false) {
    resolved = findPlaywrightExecutablePath();
    if (!resolved) resolved = findPlaywrightChromium();
  }
  if (!resolved) resolved = findSystemChrome();
  if (!resolved) {
    throw new Error(
      'No Chromium/Chrome found. Install Playwright (`npm install playwright && npx playwright install chromium`) or set executablePath.'
    );
  }
  process.env.CHROME_PATH = resolved;
  return resolved;
}

module.exports = {
  resolve,
  findPlaywrightChromium,
  findPlaywrightExecutablePath,
  findSystemChrome,
};