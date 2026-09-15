const fs = require('fs');
const path = require('path');

async function exportData(page, type = 'network', filePath) {
  let client = null;
  try {
    client =
      page.devtools && page.devtools.session
        ? page.devtools.session
        : await page.target().createCDPSession();
  } catch (_) {
    throw new Error('CDP session not available');
  }

  const network = [];
  const console_ = [];

  const netH = (e) => {
    network.push({
      timestamp: Date.now(),
      requestId: e.requestId,
      url: e.request ? e.request.url : undefined,
      method: e.request ? e.request.method : undefined,
      headers: e.request ? e.request.headers : undefined,
      resourceType: e.type,
      status: e.response ? e.response.status : undefined,
      mimeType: e.response ? e.response.mimeType : undefined,
      encodedDataLength: e.encodedDataLength,
    });
  };

  const conH = (e) => {
    console_.push({
      timestamp: Date.now(),
      type: e.type,
      text: e.args
        ? e.args.map((a) => a.value || a.description || '').join(' ')
        : '',
    });
  };

  try {
    await client.send('Network.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable').catch(() => {});
    client.on('Network.requestWillBeSent', netH);
    client.on('Network.responseReceived', netH);
    client.on('Network.loadingFinished', netH);
    client.on('Runtime.consoleAPICalled', conH);
    client.on('Log.entryAdded', (e) => {
      console_.push({
        timestamp: Date.now(),
        type: e.entry.level,
        text: e.entry.text,
        source: e.entry.source,
      });
    });
    await new Promise((r) => setTimeout(r, 3000));
  } catch (_) {}

  const result = {};
  if (type === 'network' || type === 'both') result.network = network;
  if (type === 'console' || type === 'both') result.console = console_;

  const target = filePath || path.resolve(`./exports/${type}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(result, null, 2));
  return target;
}

module.exports = { export: exportData };