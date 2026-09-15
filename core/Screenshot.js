const fs = require('fs');
const path = require('path');
const os = require('os');

function attach(page) {
  if (!page || page._screenshotAttached) return;
  page._screenshotAttached = true;

  const orig = page.screenshot.bind(page);

  const wrapped = async (options = {}) => {
    if (options && (options.type === 'single' || options.type === 'group')) {
      return handleTyped(page, options);
    }
    return orig(options);
  };

  wrapped.tab = async (tab, options = {}) => {
    const target = await resolveTab(page, tab);
    if (!target) throw new Error(`Tab not found: ${tab}`);
    return target.screenshot({
      fullPage: options.fullScreen === true,
      path: options.path,
    });
  };

  page.screenshot = wrapped;

  page.screenshotByRole = async (role) => {
    return screenshotByRole(page, role);
  };
}

async function resolveTab(page, tab) {
  if (!tab) return null;
  if (typeof tab === 'object' && typeof tab.screenshot === 'function') return tab;
  const browser = await page.browser();
  const pages = await browser.pages();
  if (typeof tab === 'string') {
    for (const p of pages) if (p._tabName === tab) return p;
    const m = tab.match(/^tab-?(\d+)$/i);
    if (m) {
      const i = parseInt(m[1], 10);
      if (pages[i]) return pages[i];
    }
    for (const p of pages) if (p.url().includes(tab)) return p;
  }
  return null;
}

async function handleTyped(page, options) {
  const type = options.type;
  if (type === 'single') {
    const target = options.tab ? await resolveTab(page, options.tab) : page;
    if (!target) throw new Error(`Tab not found: ${options.tab}`);
    const out = options.path || `./screenshot-${Date.now()}.png`;
    await target.screenshot({
      fullPage: options.fullScreen === true,
      path: out,
    });
    return out;
  }
  if (type === 'group') {
    if (options.tab !== 'auto') throw new Error("type 'group' requires tab: 'auto'");
    const browser = await page.browser();
    const flex = browser && browser._puppeteerFlex ? browser._puppeteerFlex : null;
    if (!flex || !flex.tabManager) throw new Error('TabManager not available');
    let tg = null;
    for (const g of flex.tabManager.groups.values()) {
      if (g.has(page)) {
        tg = g;
        break;
      }
    }
    if (!tg) for (const g of flex.tabManager.groups.values()) { tg = g; break; }
    if (!tg) throw new Error('No tab group found');
    const pagesInGroup = tg.pages();
    if (pagesInGroup.length === 0) throw new Error('Tab group is empty');
    const out = options.path || `./screenshot-group-${Date.now()}.png`;
    const shots = [];
    for (const p of pagesInGroup) {
      try {
        const b = await p.screenshot({
          fullPage: options.fullScreen === true,
          encoding: 'base64',
        });
        shots.push(b);
      } catch (_) {}
    }
    if (shots.length === 0) throw new Error('Failed to capture any tab in group');
    const stitched = await stitch(browser, shots);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(path.resolve(out), stitched);
    return out;
  }
  throw new Error(`Unknown screenshot type: ${type}`);
}

async function screenshotByRole(page, role) {
  const roleSelectors = {
    button: 'button, [role="button"], input[type="button"], input[type="submit"]',
    link: 'a, [role="link"]',
    textbox: 'input[type="text"], input[type="email"], textarea, [role="textbox"]',
    checkbox: 'input[type="checkbox"], [role="checkbox"]',
    radio: 'input[type="radio"], [role="radio"]',
    combobox: 'select, [role="combobox"]',
    heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
    img: 'img, [role="img"]',
    dialog: 'dialog, [role="dialog"]',
    navigation: 'nav, [role="navigation"]',
    main: 'main, [role="main"]',
    banner: 'header, [role="banner"]',
    contentinfo: 'footer, [role="contentinfo"]',
    form: 'form, [role="form"]',
    search: '[role="search"]',
  };

  let selector = roleSelectors[role] || `[role="${role}"]`;

  let handles = await page.$$(selector);
  if (handles.length === 0) {
    handles = await page.$$(role);
  }

  if (handles.length === 0) throw new Error(`No element found for role: ${role}`);

  const h = handles[0];
  const box = await h.boundingBox();
  if (!box) throw new Error(`Element has no boundingBox: ${role}`);

  return await page.screenshot({
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
  });
}

async function stitch(browser, base64Shots) {
  const cols = Math.ceil(Math.sqrt(base64Shots.length));
  const rows = Math.ceil(base64Shots.length / cols);
  const tileW = 800;
  const tileH = 600;
  const gap = 10;
  const totalW = cols * tileW + (cols + 1) * gap;
  const totalH = rows * tileH + (rows + 1) * gap;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#1e1e1e}
    .grid{display:grid;grid-template-columns:repeat(${cols},${tileW}px);grid-gap:${gap}px;padding:${gap}px;width:${totalW}px}
    .tile{width:${tileW}px;height:${tileH}px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center}
    .tile img{max-width:100%;max-height:100%;object-fit:contain}
  </style></head><body><div class="grid">${base64Shots
    .map((b) => `<div class="tile"><img src="data:image/png;base64,${b}"></div>`)
    .join('')}</div></body></html>`;

  const tmp = path.join(os.tmpdir(), `puppeteer-flex-stitch-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);

  const page = await browser.newPage();
  try {
    await page.setViewport({ width: totalW, height: totalH });
    await page.goto(`file://${tmp}`, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    const b = await page.screenshot({ fullPage: true, encoding: 'base64' });
    return Buffer.from(b, 'base64');
  } finally {
    try {
      await page.close();
    } catch (_) {}
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

module.exports = { attach };