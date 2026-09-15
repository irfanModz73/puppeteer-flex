async function applyPage(page) {
  try {
    const client = await page.target().createCDPSession();
    await client.send('Page.setBypassCSP', { enabled: true }).catch(() => {});
  } catch (_) {}

  try {
    await page.setRequestInterception(true);
    page.on('response', (res) => {
      try {
        const h = res.headers();
        if (h['content-security-policy']) delete h['content-security-policy'];
        if (h['content-security-policy-report-only'])
          delete h['content-security-policy-report-only'];
      } catch (_) {}
    });
  } catch (_) {}
}

async function applyContext(ctx) {
  const pages = ctx.pages();
  for (const p of pages) await applyPage(p);
}

module.exports = { applyPage, applyContext };