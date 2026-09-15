class PluginBase {
  constructor(opts = {}) {
    this.opts = opts;
    this._name = this.constructor.name || 'PluginBase';
  }
  name() {
    return this._name;
  }
  get opts_() {
    return this.opts;
  }
  async onBrowserLaunch() {}
  async onBrowser() {}
  async onContext() {}
  async onPageCreated() {}
}

module.exports = PluginBase;