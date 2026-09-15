const BrowserLauncher = require('./browser/BrowserLauncher');

function createBrowserObject(useDevtools) {
  return {
    async launch(options = {}) {
      const opts = { ...options };
      if (useDevtools) opts.devtools = true;
      const launcher = new BrowserLauncher(opts);
      return await launcher.launch();
    },
    async launchPersistentContext(userDataDir, options = {}) {
      return this.launch({ ...options, userDataDir, persistCookies: true });
    },
  };
}

const Browser = createBrowserObject(false);
const flex = createBrowserObject(true);

module.exports = { Browser, flex };