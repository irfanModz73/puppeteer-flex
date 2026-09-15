const VALID_TYPES = new Set([
  'document',
  'stylesheet',
  'image',
  'media',
  'font',
  'script',
  'texttrack',
  'xhr',
  'fetch',
  'eventsource',
  'websocket',
  'manifest',
  'other',
]);

async function applyPage(page, types) {
  if (!Array.isArray(types) || types.length === 0) return;
  const set = new Set(types.filter((t) => VALID_TYPES.has(t)));
  if (set.size === 0) return;

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        if (set.has(req.resourceType())) req.abort().catch(() => {});
        else req.continue().catch(() => {});
      } catch (_) {}
    });
  } catch (_) {}
}

async function applyContext(ctx, types) {
  const pages = ctx.pages();
  for (const p of pages) await applyPage(p, types);
}

module.exports = { applyPage, applyContext, VALID_TYPES };