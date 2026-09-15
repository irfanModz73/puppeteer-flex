const fs = require('fs');
const path = require('path');

const DOWNLOAD_HOSTS = [
  'mediafire.com',
  'mediafireusercontent.com',
  'drive.google.com',
  'docs.google.com',
  'mega.nz',
  'mega.io',
  'zippyshare.com',
  '4shared.com',
  'dropbox.com',
  'dl.dropboxusercontent.com',
  'onedrive.live.com',
  '1drv.ms',
];

function isDownloadHost(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DOWNLOAD_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch (_) {
    return false;
  }
}

class MediafireHandler {
  constructor(page, options = {}) {
    this.page = page;
    this.downloadsPath = path.resolve(options.downloadsPath || './downloads');
    this.items = [];
    this.client = null;
    this._attached = false;
  }

  async attach() {
    if (this._attached) return;
    this._attached = true;

    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }

    try {
      this.client = await this.page.target().createCDPSession();
      await this.client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadsPath,
      });
      await this.client.send('Network.enable');
    } catch (_) {}

    if (this.client) {
      this.client.on('Network.responseReceived', (event) => {
        try {
          const url = event.response && event.response.url;
          const headers = event.response && event.response.headers;
          if (!url || !headers) return;

          const cd =
            headers['content-disposition'] ||
            headers['Content-Disposition'] ||
            '';
          const isAtt = cd.toLowerCase().includes('attachment');
          const isHost = isDownloadHost(url);

          if (isAtt || isHost) {
            const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
            const filename = m
              ? decodeURIComponent(m[1])
              : `download-${Date.now()}.bin`;
            const item = {
              url,
              suggestedFilename: filename,
              path: path.join(this.downloadsPath, filename),
              timestamp: new Date().toISOString(),
              status: 'detected',
              mimeType: event.response.mimeType,
              fromHost: isHost,
              requestId: event.requestId,
            };
            if (!this.items.some((x) => x.url === url)) this.items.push(item);
          }
        } catch (_) {}
      });

      this.client.on('Network.loadingFinished', (event) => {
        try {
          const m = this.items.find(
            (x) => x.requestId === event.requestId && x.status === 'detected'
          );
          if (m) m.status = 'completed';
        } catch (_) {}
      });
    }

    try {
      this.page.on('response', (res) => {
        try {
          const h = res.headers();
          const cd =
            h['content-disposition'] || h['Content-Disposition'] || '';
          if (!cd.toLowerCase().includes('attachment')) return;
          const url = res.url();
          const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
          const filename = m
            ? decodeURIComponent(m[1])
            : `download-${Date.now()}.bin`;
          if (!this.items.some((x) => x.url === url)) {
            this.items.push({
              url,
              suggestedFilename: filename,
              path: path.join(this.downloadsPath, filename),
              timestamp: new Date().toISOString(),
              status: 'detected',
              fromHost: isDownloadHost(url),
            });
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  list() {
    return [...this.items];
  }
  getByFilename(name) {
    return this.items.find((i) => i.suggestedFilename === name) || null;
  }
  async waitFor(filename, timeout = 120000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = this.items.find(
        (i) => i.suggestedFilename === filename && i.status === 'completed'
      );
      if (found) return found;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Download timeout: ${filename}`);
  }
  clear() {
    this.items = [];
  }
}

module.exports = MediafireHandler;