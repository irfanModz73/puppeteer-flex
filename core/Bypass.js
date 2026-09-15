const fs = require('fs');
const path = require('path');

async function bypass(page, url, options = {}) {
  if (!page) throw new Error('page required');
  const waitMs = options.waitMs !== undefined ? options.waitMs : 3000;
  const scroll = options.scroll !== false;
  const savePath = options.savePath || path.resolve('./stealed_source.html');

  try {
    await page.goto(url, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: options.timeout || 60000,
    });
  } catch (_) {}

  await new Promise((r) => setTimeout(r, 1000));

  if (scroll) {
    try {
      await page.evaluate(async () => {
        await new Promise((res) => {
          let total = 0;
          const d = 300;
          const t = setInterval(() => {
            window.scrollBy(0, d);
            total += d;
            if (total >= document.body.scrollHeight) {
              clearInterval(t);
              res();
            }
          }, 100);
        });
      });
    } catch (_) {}
  }

  await new Promise((r) => setTimeout(r, waitMs));

  let html = '';
  try {
    html = await page.content();
  } catch (_) {}

  try {
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, html);
  } catch (_) {}

  return html;
}

function attach(page) {
  if (!page || page._bypassAttached) return;
  page._bypassAttached = true;
  page.bypass = async (url, options = {}) => bypass(page, url, options);
}

module.exports = { bypass, attach };