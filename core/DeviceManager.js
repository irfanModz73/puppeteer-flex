const crypto = require('crypto');

class DeviceManager {
  constructor(page) {
    this.page = page;
    this._attached = false;
  }

  async attach() {
    if (this._attached) return;
    this._attached = true;

    this.page.createDevice = () => this.createDevice();
  }

  createDevice() {
    const deviceId = crypto.randomBytes(4).toString('hex');

    const browser = this.page._browserRef || null;
    if (browser && browser._puppeteerFlex) {
      browser._puppeteerFlex.deviceId = deviceId;
    }

    try {
      const ctx = this.page.context ? this.page.context() : null;
      if (ctx) ctx.deviceId = deviceId;
    } catch (_) {}

    this.page._deviceId = deviceId;
    return deviceId;
  }
}

module.exports = DeviceManager;