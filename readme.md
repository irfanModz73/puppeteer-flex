# puppeteer-flex

Puppeteer + Playwright hybrid framework built around a real browser environment, with remote DevTools, Playwright-style locators, browser management utilities, and stealth support.

[![npm version](https://img.shields.io/badge/npm-v2.1.0-blue.svg)](https://www.npmjs.com/)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![playwright](https://img.shields.io/badge/playwright-1.62.1-45ba4b.svg)](https://playwright.dev/)
[![puppeteer](https://img.shields.io/badge/puppeteer-23.x-40b5a4.svg)](https://pptr.dev/)

---

## Features

* **Dual Engine** — Use Puppeteer and Playwright through the same framework.
* **Real Browser Stealth** — Built around `puppeteer-real-browser` and `puppeteer-extra-plugin-stealth`.
* **Hybrid Mode** — Switch between Puppeteer and Playwright using `activePlaywright`.
* **Remote DevTools** — Access a browser-based DevTools interface through CDP.
* **DevTools Recorder** — Record browser screencasts to `.webm` using FFmpeg.
* **Network & Console Export** — Export captured network and console data to JSON.
* **Playwright-style Locators** — Includes `locator()`, `getByRole()`, `getByText()`, `getByLabel()`, and more.
* **Human Mouse** — Bezier-based mouse movement with configurable timing.
* **Download Manager** — Built-in handlers for MediaFire, Google Drive, Mega, and Dropbox.
* **Protected Page Bypass** — Fetch protected sources and save the resulting HTML.
* **Storage Managers** — Save and restore LocalStorage and IndexedDB data.
* **Device ID Generator** — Generate an 8-character cryptographic device identifier.
* **Tracker Blocking** — Block known advertising and redirect domains.
* **Role-based Screenshots** — Capture elements using CSS and ARIA roles.
* **Tabs & Browser State** — Tab groups, history, incognito mode, and downloads.
* **Chrome Profiles** — Load existing Chrome profiles or custom user data directories.

---

## Installation

Install from npm:

```bash
npm install puppeteer-flex
```

Or clone the repository:

```bash
git clone https://github.com/yourname/puppeteer-flex.git
cd puppeteer-flex
npm install
```

### Dependencies

The project is built around:

* `puppeteer ^23`
* `puppeteer-real-browser ^1.4`
* `playwright ^1.62`
* `playwright-extra ^4.3`
* `puppeteer-extra-plugin-stealth ^2.11`
* `ws ^8`

### FFmpeg

FFmpeg is optional and is required for DevTools recording.

**Debian / Ubuntu**

```bash
apt install -y ffmpeg
```

**macOS**

```bash
brew install ffmpeg
```

---

## Quick Start

### Puppeteer Mode

```js
const { Browser } = require('puppeteer-flex');

const browser = await Browser.launch({
  headless: false,
  turnOffAutomation: true,
});

const page = await browser.createTab('https://example.com');

console.log(await page.title());

await browser.close();
```

### Puppeteer + DevTools

Enable the built-in DevTools server and recorder:

```js
const { flex } = require('puppeteer-flex');

const browser = await flex.launch({
  headless: false,
  turnOffAutomation: true,
  devtools: true,
  recordDevtools: true,
});

console.log('DevTools UI:', browser.devtoolsUrl());
console.log('WS Endpoint:', browser.wsEndpoint());

const page = await browser.createTab('https://bot.sannysoft.com');

await page.waitForTimeout(5000);

await browser.close();
```

### Playwright Hybrid Mode

Set `activePlaywright` to `true` to use the Playwright engine and API:

```js
const { Browser } = require('puppeteer-flex');

const browser = await Browser.launch({
  activePlaywright: true,
  playwrightStealth: true,
  headless: false,
  turnOffAutomation: true,
});

const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://example.com');
```

---

## Launch Options

| Option              | Type             | Default       | Description                                  |
| ------------------- | ---------------- | ------------- | -------------------------------------------- |
| `headless`          | boolean          | `false`       | Run in headless or headed mode               |
| `activePlaywright`  | boolean          | `false`       | Use the Playwright engine and API            |
| `playwrightStealth` | boolean          | `true`        | Enable stealth support in Playwright mode    |
| `playwrightPlugin`  | array            | `[]`          | Additional Playwright plugins                |
| `noStealth`         | boolean          | `false`       | Disable stealth support                      |
| `turnOffAutomation` | boolean          | —             | Disable common browser automation flags      |
| `optimazeRam`       | boolean          | —             | Reserved for future memory optimization      |
| `devtools`          | boolean          | `false`       | Enable the remote DevTools UI                |
| `recordDevtools`    | boolean          | `false`       | Automatically attach the DevTools recorder   |
| `defaultViewport`   | object           | `null`        | Set the default viewport                     |
| `downloadsPath`     | string           | `./downloads` | Download directory                           |
| `profile`           | string / boolean | —             | Chrome profile name or absolute path         |
| `userDataDir`       | string           | —             | Custom Chrome user data directory            |
| `args`              | array            | `[]`          | Additional Chromium arguments                |
| `executablePath`    | string           | `auto`        | Chromium / Chrome executable path            |
| `remotePort`        | number           | `0`           | DevTools UI port                             |
| `remoteHost`        | string           | `127.0.0.1`   | DevTools UI host                             |
| `blockCSP`          | boolean          | `false`       | Disable Content-Security-Policy restrictions |
| `blockResource`     | array            | `[]`          | Resource types to block                      |

### Custom Chromium Arguments

| Argument                 | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `--keep-isolate-headers` | Isolate Origin and Referer headers per context |
| `--no-redirect`          | Automatically block redirects                  |

---

## API Reference

### Browser

```js
browser.createTab(url, context?)
browser.deleteTab(page)
browser.listTabs()

browser.createGroup(name)
browser.getGroup(name)

browser.incognito()

browser.devtoolsUrl()
browser.wsEndpoint()

browser.history
browser.downloads
browser.cookies
browser.devtools
```

### Page

```js
page.goto(url, opts)
page.waitForTimeout(ms)
page.waitForLoadState('load' | 'domcontentloaded' | 'networkidle')

page.addInitScript(fn | string)

page.route(pattern, handler)
page.unroute(pattern?)

page.setNoRedirect(true | false)

page.human.move(x, y)
page.human.click(selector)
page.human.type(selector, text)
page.human.scroll(amount)

page.bypass(url, { waitMs, scroll, savePath })
page.callApi(url, method, body, headers)

page.createDevice()

page.show(popup)
page.close(true)

page.blockTrack(true)

page.waitForExecution({
  url,
  js,
  event,
  timeout
})

page.executeOnDocument({
  type: 'auto' | 'flex',
  code,
  time,
  isWait
})
```

### Locators

```js
page.locator(selector)

page.getByRole(role, { name })
page.getByText(text)
page.getByLabel(label)
page.getByPlaceholder(text)
page.getByTestId(id)
page.getByAltText(text)
page.getByTitle(text)
```

Locator methods:

```js
locator.click()
locator.fill(value)
locator.type(value)
locator.press(key)

locator.check()
locator.uncheck()

locator.hover()
locator.focus()

locator.selectOption(value)

locator.textContent()
locator.innerText()
locator.innerHTML()
locator.inputValue()

locator.getAttribute(name)

locator.isVisible()
locator.isEnabled()
locator.isChecked()

locator.count()
locator.boundingBox()
locator.screenshot()

locator.waitFor({ state, timeout })

locator.all()
locator.allTextContents()

locator.first()
locator.last()
locator.nth(i)

locator.filter({ hasText })
locator.locator(sub)
```

---

## Screenshots

### Basic Screenshot

```js
await page.screenshot({
  path: 'ss.png',
  fullPage: true,
});
```

### Screenshot From Another Tab

```js
await page.screenshot.tab(otherPage, {
  path: 'tab.png',
});
```

### Single Tab / Full Screen

```js
await page.screenshot({
  type: 'single',
  tab: page,
  fullScreen: true,
  path: 'single.png',
});
```

### Tab Groups

```js
const group = browser.createGroup('kerja');

group.add(tab1);
group.add(tab2);

await page.screenshot({
  type: 'group',
  tab: 'auto',
  fullScreen: false,
  path: 'group.png',
});
```

### Screenshot by Role

Capture elements using CSS and ARIA roles:

```js
await page.screenshotByRole('button');
```

---

## DevTools

The built-in DevTools interface exposes the browser through CDP.

```js
browser.devtoolsUrl();
browser.wsEndpoint();
```

Send CDP commands directly:

```js
await browser.devtools.send(
  'Runtime.evaluate',
  {
    expression: 'navigator.userAgent',
  }
);
```

### Export Network and Console Data

```js
await browser.devtools.export(
  'network',
  './net.json'
);

await browser.devtools.export(
  'console',
  './con.json'
);
```

### DevTools Recorder

```js
await browser.devtools.recorder.start({
  outputPath: './rec.webm',
});

await browser.devtools.recorder.stop();
```

---

## Storage Managers

LocalStorage and IndexedDB can be persisted and restored between browser sessions.

```js
const LocalStorageManager =
  require('puppeteer-flex/core/LocalStorageManager');

const IndexedDBManager =
  require('puppeteer-flex/core/IndexedDBManager');
```

### LocalStorage

```js
const ls = new LocalStorageManager();

await ls.save('./ls.json', page);
await ls.load('./ls.json', page);
```

### IndexedDB

```js
const idb = new IndexedDBManager();

await idb.save('./idb.json', page);
await idb.load('./idb.json', page);
```

---

## Testing

The built-in test script can be used against browser fingerprinting and automation detection pages.

```bash
node 772.js
```

Example test output:

```text
===== sannysoft =====
passed           : 28/31

===== rebrowser =====
  dummyFn
  sourceUrlLeak
  mainWorldExecution
  runtimeEnableLeak
  exposeFunctionLeak
  navigatorWebdriver
  viewport
  pwInitScripts
  bypassCsp
  useragent
```

`mainWorldExecution` is currently affected by a fundamental Puppeteer/Playwright limitation and requires `rebrowser-patches` to address.

---

## DevTools UI

Start the browser with:

```js
devtools: true
```

The DevTools UI will be available at:

```text
http://127.0.0.1:PORT
```

The interface currently provides:

* Active target listing
* Chrome DevTools frontend access
* CDP session ping
* Automatic refresh every 3 seconds

---

## Project Structure

```text
puppeteer-flex/
├── package.json
├── index.js
│
├── browser/
│   ├── BrowserLauncher.js
│   ├── ChromePathResolver.js
│   └── ProfileBridge.js
│
├── bridge/
│   ├── PlaywrightBridge.js
│   ├── BrowserShim.js
│   ├── ContextShim.js
│   ├── PageShim.js
│   ├── RouteShim.js
│   ├── LocatorShim.js
│   └── AriaQuery.js
│
├── core/
│   ├── History.js
│   ├── Download.js
│   ├── MediafireHandler.js
│   ├── TabGroup.js
│   ├── TabManager.js
│   ├── Incognito.js
│   ├── NoRedirect.js
│   ├── BlockCSP.js
│   ├── ResourceBlocker.js
│   ├── HeaderIsolator.js
│   ├── Screenshot.js
│   ├── LocalStorageManager.js
│   ├── IndexedDBManager.js
│   ├── Bypass.js
│   ├── PopupManager.js
│   ├── TrackerBlocker.js
│   ├── ExecutionManager.js
│   └── DeviceManager.js
│
├── devtools/
│   ├── FlexDevtools.js
│   ├── DevtoolsUIServer.js
│   ├── WSProxy.js
│   ├── DevtoolsRecorder.js
│   └── DevtoolsExport.js
│
└── plugins/
    └── PluginBase.js
```

---

## Architecture

```text
                       puppeteer-flex
                             |
              +--------------+--------------+
              |                             |
   activePlaywright: false       activePlaywright: true
              |                             |
      puppeteer-real-browser       playwright-extra
              |                    + stealth plugin
              |                             |
              +-------------+---------------+
                            |
                +-----------v------------+
                | PageShim / LocatorShim |
                | Bypass / Mediafire     |
                | Popup / Tracker / Exec |
                +------------------------+
```

The framework uses two execution paths:

* **Puppeteer mode** — powered by `puppeteer-real-browser`.
* **Playwright mode** — powered by `playwright-extra` with stealth support.

Both paths are exposed through the framework's bridge and shim layers.

---

## Known Limitations

| Feature                    | Status                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `mainWorldExecution`       | Not currently supported due to a Puppeteer/Playwright limitation |
| `context.storageState()`   | Not translated                                                   |
| `context.tracing`          | Not translated                                                   |
| WebGL on Xvfb without GPU  | May return `Canvas has no webgl context`                         |
| `page.exposeFunction` leak | Not triggered by default                                         |

For `mainWorldExecution`, use `rebrowser-patches` if the feature is required.

---

## Troubleshooting

### `CHROME_PATH` Not Set

Set the Chrome/Chromium executable manually:

```bash
export CHROME_PATH=/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome
```

Or specify `executablePath` when launching the browser.

### DevTools Port Conflict

Let the operating system select an available port:

```js
launch({
  remotePort: 0,
});
```

### Recorder Fails With `Invalid image format`

Install FFmpeg:

```bash
apt install -y ffmpeg
```

### Running Headless With Xvfb

```bash
xvfb-run -a \
  --server-args="-screen 0 1920x1080x24" \
  node 772.js
```

---

## License

MIT © 2026

---

## Credits

This project uses and builds on the following projects:

* [puppeteer-real-browser](https://github.com/zfcsoftware/puppeteer-real-browser)
* [playwright-extra](https://github.com/berstend/puppeteer-extra/tree/master/packages/playwright-extra)
* [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
* Playwright
* Puppeteer
* Chrome DevTools Protocol

---

## Star History

If you find `puppeteer-flex` useful, consider giving the repository a star.

```text
┌─────────────────────────────┐
│      Made by irfan          │
└─────────────────────────────┘
```
