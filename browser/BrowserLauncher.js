const path = require('path');
const fs = require('fs');
const ChromePathResolver = require('./ChromePathResolver');
const ProfileBridge = require('./ProfileBridge');

const History = require('../core/History');
const Download = require('../core/Download');
const TabManager = require('../core/TabManager');
const NoRedirect = require('../core/NoRedirect');
const BlockCSP = require('../core/BlockCSP');
const ResourceBlocker = require('../core/ResourceBlocker');
const HeaderIsolator = require('../core/HeaderIsolator');
const Screenshot = require('../core/Screenshot');
const Bypass = require('../core/Bypass');
const FlexDevtools = require('../devtools/FlexDevtools');
const PopupManager = require('../core/PopupManager');
const TrackerBlocker = require('../core/TrackerBlocker');
const ExecutionManager = require('../core/ExecutionManager');
const DeviceManager = require('../core/DeviceManager');
const PageShim = require('../bridge/PageShim');
const { attachLocator } = require('../bridge/LocatorShim');
const { attachAriaQuery } = require('../bridge/AriaQuery');

const STEALTH_INIT_SCRIPT = `
  (() => {
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: () => false,
        configurable: true,
      });
    } catch (_) {}

    try {
      const uaData = {
        brands: [
          { brand: 'Chromium', version: '131' },
          { brand: 'Google Chrome', version: '131' },
          { brand: 'Not_A Brand', version: '24' },
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: function () {
          return Promise.resolve({
            brands: this.brands,
            mobile: this.mobile,
            platform: this.platform,
            architecture: 'x86',
            bitness: '64',
            fullVersionList: [
              { brand: 'Chromium', version: '131.0.0.0' },
              { brand: 'Google Chrome', version: '131.0.0.0' },
              { brand: 'Not_A Brand', version: '24.0.0.0' },
            ],
            model: '',
            platformVersion: '15.0.0',
            uaFullVersion: '131.0.0.0',
            wow64: false,
          });
        },
      };
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: () => uaData,
        configurable: true,
      });
    } catch (_) {}

    try {
      Object.defineProperty(Navigator.prototype, 'platform', {
        get: () => 'Win32',
        configurable: true,
      });
    } catch (_) {}

    try {
      Object.defineProperty(Navigator.prototype, 'vendor', {
        get: () => 'Google Inc.',
        configurable: true,
      });
    } catch (_) {}

    try {
      Object.defineProperty(Navigator.prototype, 'deviceMemory', {
        get: () => 8,
        configurable: true,
      });
    } catch (_) {}

    try {
      Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true,
      });
    } catch (_) {}

    try {
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (p) {
        if (p === 37445) return 'Google Inc. (Intel)';
        if (p === 37446)
          return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return getParam.call(this, p);
      };
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParam2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (p) {
          if (p === 37445) return 'Google Inc. (Intel)';
          if (p === 37446)
            return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
          return getParam2.call(this, p);
        };
      }
    } catch (_) {}

    try {
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 32,
        configurable: true,
      });
      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 32,
        configurable: true,
      });
    } catch (_) {}

    try {
      if (!navigator.connection) {
        Object.defineProperty(Navigator.prototype, 'connection', {
          get: () => ({
            downlink: 10,
            effectiveType: '4g',
            rtt: 50,
            saveData: false,
            onchange: null,
            addEventListener: function () {},
            removeEventListener: function () {},
          }),
          configurable: true,
        });
      }
    } catch (_) {}
  })();
`;

function parseCustomArgs(rawArgs = []) {
  const flags = { keepIsolateHeaders: false, noRedirect: false };
  const cleanArgs = [];
  for (const arg of rawArgs) {
    if (arg === '--keep-isolate-headers') flags.keepIsolateHeaders = true;
    else if (arg === '--no-redirect') flags.noRedirect = true;
    else cleanArgs.push(arg);
  }
  return { cleanArgs, flags };
}

class BrowserLauncher {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.devtools = null;
    this.mode = options.activePlaywright === true ? 'playwright' : 'puppeteer';
    this.pageManagers = new WeakMap();
  }

  async launch() {
    if (this.mode === 'playwright') return await this._launchPlaywright();
    return await this._launchPuppeteer();
  }

  async _launchPlaywright() {
    const opts = this.options;
    const { chromium } = require('playwright-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');

    const plugins = [];
    if (opts.noStealth !== true && opts.playwrightStealth !== false) {
      plugins.push(StealthPlugin());
    }
    if (Array.isArray(opts.playwrightPlugin)) {
      for (const p of opts.playwrightPlugin) plugins.push(p);
    }
    for (const p of plugins) chromium.use(p);

    const chromePath = ChromePathResolver.resolve(opts);
    const profile = ProfileBridge.resolve(opts.profile, opts.userDataDir);
    const rawArgs = Array.isArray(opts.args) ? opts.args : [];
    const { cleanArgs, flags } = parseCustomArgs(rawArgs);

    const launchOptions = {
      headless: opts.headless !== undefined ? opts.headless : false,
      args: cleanArgs,
      executablePath: chromePath,
      acceptDownloads: true,
    };
    if (profile.userDataDir) launchOptions.userDataDir = profile.userDataDir;

    let browser;
    if (profile.userDataDir) {
      browser = await chromium.launchPersistentContext(
        profile.userDataDir,
        launchOptions
      );
    } else {
      browser = await chromium.launch(launchOptions);
    }

    browser._puppeteerFlex = {
      options: opts,
      flags,
      mode: 'playwright',
    };

    return await this._wireBrowser(browser, flags, opts);
  }

  async _launchPuppeteer() {
    const opts = this.options;
    const chromePath = ChromePathResolver.resolve(opts);
    const rawArgs = Array.isArray(opts.args) ? opts.args : [];
    const { cleanArgs, flags } = parseCustomArgs(rawArgs);
    const profile = ProfileBridge.resolve(opts.profile, opts.userDataDir);

    const launchConfig = {
      headless: opts.headless !== undefined ? opts.headless : false,
      turnstile: opts.turnstile !== false,
      fingerprint: opts.fingerprint !== false,
      defaultViewport: opts.defaultViewport || null,
      args: cleanArgs,
      customConfig: {
        chromePath,
        userDataDir: profile.userDataDir || undefined,
        ...((opts.customConfig) || {}),
      },
    };
    if (profile.userDataDir) launchConfig.userDataDir = profile.userDataDir;

    const { connect } = require('puppeteer-real-browser');
    const result = await connect(launchConfig);
    const browser = result.browser;

    browser._puppeteerFlex = {
      options: opts,
      flags,
      mode: 'puppeteer',
    };

    const wired = await this._wireBrowser(browser, flags, opts);
    if (result.page) await this._attachPageHelpers(result.page, flags, opts);
    return wired;
  }

  async _wireBrowser(browser, flags, opts) {
    const history = new History();
    const downloads = new Download(opts.downloadsPath || './downloads');

    browser.history = history;
    browser.downloads = downloads;

    browser.createTab = async (url, context) => {
      let target = null;
      if (context && typeof context.newPage === 'function') {
        target = await context.newPage();
      } else if (typeof browser.newPage === 'function') {
        target = await browser.newPage();
      } else if (typeof browser.pages === 'function') {
        const pages = await browser.pages();
        target = pages[0] || null;
      }
      if (target && url) {
        await target
          .goto(url, { waitUntil: 'domcontentloaded' })
          .catch(() => {});
      }
      if (target) await this._attachPageHelpers(target, flags, opts);
      return target;
    };

    browser.deleteTab = async (target) => {
      if (!target) return false;
      try {
        if (!target.isClosed()) await target.close();
        return true;
      } catch (_) {
        return false;
      }
    };

    browser.listTabs = async () => {
      if (typeof browser.pages === 'function') return await browser.pages();
      return [];
    };

    const tabManager = new TabManager(browser, history);
    browser.createGroup = (name) => tabManager.createGroup(name);
    browser.getGroup = (name) => tabManager.getGroup(name);

    if (opts.devtools === true) {
      const devtools = new FlexDevtools({
        remote: true,
        port: opts.remotePort || 0,
        host: opts.remoteHost || '127.0.0.1',
        record: opts.recordDevtools === true,
      });
      await devtools.attach(browser);
      browser.devtoolsUrl = () => devtools.getUIUrl();
      browser.wsEndpoint = () => devtools.getWsUrl();
      browser.devtools = devtools;
      this.devtools = devtools;
    }

    if (typeof browser.newPage === 'function') {
      const origNewPage = browser.newPage.bind(browser);
      browser.newPage = async (pageOpts = {}) => {
        const newPage = await origNewPage(pageOpts);
        await this._attachPageHelpers(newPage, flags, opts);
        return newPage;
      };
    }

    if (typeof browser.createBrowserContext === 'function') {
      const origCtx = browser.createBrowserContext.bind(browser);
      browser.createBrowserContext = async () => {
        const ctx = await origCtx();
        if (ctx && typeof ctx.newPage === 'function') {
          const origCtxNewPage = ctx.newPage.bind(ctx);
          ctx.newPage = async (pageOpts = {}) => {
            const newPage = await origCtxNewPage(pageOpts);
            await this._attachPageHelpers(newPage, flags, opts);
            return newPage;
          };
        }
        return ctx;
      };
      browser.createIncognitoBrowserContext = browser.createBrowserContext;
    }

    browser.incognito = async () => {
      if (typeof browser.createBrowserContext === 'function') {
        return await browser.createBrowserContext();
      }
      if (typeof browser.createIncognitoBrowserContext === 'function') {
        return await browser.createIncognitoBrowserContext();
      }
      throw new Error('Incognito not supported');
    };

    try {
      if (typeof browser.on === 'function') {
        browser.on('page', async (page) => {
          await this._attachPageHelpers(page, flags, opts);
          if (this.mode === 'playwright') {
            await this._attachPlaywrightDownload(page, opts);
          }
        });
      }
    } catch (_) {}

    if (typeof browser.pages === 'function') {
      const pages = await browser.pages();
      for (const p of pages) {
        await this._attachPageHelpers(p, flags, opts);
        if (this.mode === 'playwright') {
          await this._attachPlaywrightDownload(p, opts);
        }
      }
    }

    return browser;
  }

  async _attachPlaywrightDownload(page, opts) {
    if (!page || page._pwDownloadAttached) return;
    page._pwDownloadAttached = true;

    try {
      page.on('download', async (dl) => {
        try {
          const suggested = dl.suggestedFilename();
          const target = path.resolve(
            opts.downloadsPath || './downloads',
            suggested
          );
          fs.mkdirSync(path.dirname(target), { recursive: true });
          await dl.saveAs(target);
        } catch (_) {}
      });
    } catch (_) {}
  }

  _getManagers(page) {
    if (this.pageManagers.has(page)) return this.pageManagers.get(page);
    const managers = {
      popup: new PopupManager(page),
      tracker: new TrackerBlocker(page, this.options),
      execution: new ExecutionManager(page),
      device: new DeviceManager(page),
    };
    this.pageManagers.set(page, managers);
    return managers;
  }

  async _attachPageHelpers(page, flags, opts = {}) {
    if (!page || page._flexAttached) return;
    page._flexAttached = true;

    if (typeof page.waitForTimeout !== 'function') {
      page.waitForTimeout = (ms) => new Promise((r) => setTimeout(r, ms));
    }

    if (typeof page.waitForLoadState !== 'function') {
      page.waitForLoadState = async (state = 'load') => {
        const stateMap = {
          load: 'load',
          domcontentloaded: 'domcontentloaded',
          networkidle: 'networkidle0',
        };
        return page.waitForNavigation({
          waitUntil: stateMap[state] || 'load',
        });
      };
    }

    if (typeof page.addInitScript !== 'function') {
      page.addInitScript = async (script) => {
        const content =
          typeof script === 'function'
            ? `(${script.toString()})()`
            : script && script.content
            ? script.content
            : String(script);
        await page.evaluateOnNewDocument(content);
      };
    }

    try {
      await page.setViewport({ width: 1920, height: 1080 });
    } catch (_) {}

    try {
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: path.resolve(opts.downloadsPath || './downloads'),
      });
    } catch (_) {}

    try {
      await page.evaluateOnNewDocument(STEALTH_INIT_SCRIPT);
    } catch (_) {}

    if (!page.__browser) {
      try {
        page.__browser = await page.browser();
      } catch (_) {}
    }
    const parentBrowser = page.__browser;
    const flex = parentBrowser && parentBrowser._puppeteerFlex;

    if (flex && flex.history) flex.history.attachPage(page);
    if (flex && flex.downloads) flex.downloads.attachPage(page);

    NoRedirect.attach(page);
    if (flags.noRedirect) page.setNoRedirect(true);

    if (opts.recordDevtools) {
      const DevtoolsRecorder = require('../devtools/DevtoolsRecorder');
      DevtoolsRecorder.attach(page);
    }

    if (flags.keepIsolateHeaders) await HeaderIsolator.applyPage(page);

    Screenshot.attach(page);

    if (opts.blockCSP === true) await BlockCSP.applyPage(page);

    if (Array.isArray(opts.blockResource) && opts.blockResource.length > 0) {
      await ResourceBlocker.applyPage(page, opts.blockResource);
    }

    PageShim.create(page);

    Bypass.attach(page);
    attachLocator(page);
    attachAriaQuery(page);

    const managers = this._getManagers(page);
    await managers.popup.attach();
    await managers.tracker.attach();
    await managers.execution.attach();
    await managers.device.attach();
  }

  async close() {
    if (this.devtools) {
      try {
        await this.devtools.stop();
      } catch (_) {}
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (_) {}
    }
  }
}

module.exports = BrowserLauncher;
