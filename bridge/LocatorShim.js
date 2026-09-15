class Locator {
  constructor(page, selector, options = {}) {
    this._page = page;
    this._selector = selector;
    this._index = options.index !== undefined ? options.index : null;
    this._hasText = options.hasText || null;
    this._nth = null;
    this._first = false;
    this._last = false;
    this._ariaName = null;
    this._options = options;
  }
  locator(sub) {
    return new Locator(this._page, `${this._selector} ${sub}`, {
      hasText: this._hasText,
    });
  }
  first() {
    const l = new Locator(this._page, this._selector, this._options);
    l._first = true;
    return l;
  }
  last() {
    const l = new Locator(this._page, this._selector, this._options);
    l._last = true;
    return l;
  }
  nth(i) {
    const l = new Locator(this._page, this._selector, this._options);
    l._nth = i;
    return l;
  }
  filter(opts = {}) {
    return new Locator(this._page, this._selector, {
      hasText: opts.hasText || this._hasText,
      index: this._index,
    });
  }
  async _resolveHandles() {
    let handles = await this._page.$$(this._selector);
    if (this._ariaName) {
      const target = String(this._ariaName).toLowerCase();
      const f = [];
      for (const h of handles) {
        try {
          const info = await h.evaluate((el) => ({
            text: (el.innerText || el.textContent || '').trim(),
            ariaLabel: el.getAttribute('aria-label') || '',
            title: el.getAttribute('title') || '',
            placeholder: el.getAttribute('placeholder') || '',
            alt: el.getAttribute('alt') || '',
            value: el.value || '',
          }));
          const c = [
            info.text,
            info.ariaLabel,
            info.title,
            info.placeholder,
            info.alt,
            info.value,
          ]
            .filter(Boolean)
            .map((s) => s.toLowerCase());
          if (c.some((x) => x === target || x.includes(target))) f.push(h);
        } catch (_) {}
      }
      handles = f;
    }
    if (this._hasText) {
      const f = [];
      for (const h of handles) {
        try {
          const text = await h.evaluate(
            (el) => el.innerText || el.textContent || ''
          );
          if (text.includes(this._hasText)) f.push(h);
        } catch (_) {}
      }
      handles = f;
    }
    if (this._index !== null && this._index !== undefined) {
      handles = handles[this._index] ? [handles[this._index]] : [];
    }
    if (this._first) handles = handles.length > 0 ? [handles[0]] : [];
    if (this._last) handles = handles.length > 0 ? [handles[handles.length - 1]] : [];
    if (this._nth !== null && this._nth !== undefined) {
      handles = handles[this._nth] ? [handles[this._nth]] : [];
    }
    return handles;
  }
  async _resolveOne() {
    const h = await this._resolveHandles();
    if (h.length === 0) throw new Error(`Locator not found: ${this._selector}`);
    return h[0];
  }
  async click(opts = {}) {
    (await this._resolveOne()).click(opts);
  }
  async dblclick(opts = {}) {
    (await this._resolveOne()).click({ clickCount: 2, ...opts });
  }
  async fill(v) {
    const h = await this._resolveOne();
    await h.click({ clickCount: 3 });
    await h.evaluate((el) => (el.value = ''));
    await h.type(String(v));
  }
  async type(v, o = {}) {
    (await this._resolveOne()).type(String(v), o);
  }
  async press(k) {
    const h = await this._resolveOne();
    await h.focus();
    await this._page.keyboard.press(k);
  }
  async check() {
    const h = await this._resolveOne();
    if (!(await h.evaluate((el) => el.checked))) await h.click();
  }
  async uncheck() {
    const h = await this._resolveOne();
    if (await h.evaluate((el) => el.checked)) await h.click();
  }
  async selectOption(v) {
    (await this._resolveOne()).select(String(v));
  }
  async hover() {
    (await this._resolveOne()).hover();
  }
  async focus() {
    (await this._resolveOne()).focus();
  }
  async scrollIntoViewIfNeeded() {
    (await this._resolveOne()).evaluate((el) =>
      el.scrollIntoView({ block: 'center' })
    );
  }
  async textContent() {
    return (await this._resolveOne()).evaluate((el) => el.textContent);
  }
  async innerText() {
    return (await this._resolveOne()).evaluate((el) => el.innerText);
  }
  async innerHTML() {
    return (await this._resolveOne()).evaluate((el) => el.innerHTML);
  }
  async inputValue() {
    return (await this._resolveOne()).evaluate((el) => el.value);
  }
  async getAttribute(n) {
    return (await this._resolveOne()).evaluate((el, x) => el.getAttribute(x), n);
  }
  async isVisible() {
    const h = await this._resolveHandles();
    if (h.length === 0) return false;
    return h[0].evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        s.visibility !== 'hidden' &&
        s.display !== 'none'
      );
    });
  }
  async isEnabled() {
    return (await this._resolveOne()).evaluate((el) => !el.disabled);
  }
  async isChecked() {
    return (await this._resolveOne()).evaluate((el) => el.checked);
  }
  async count() {
    return (await this._resolveHandles()).length;
  }
  async boundingBox() {
    return (await this._resolveOne()).boundingBox();
  }
  async screenshot(opts = {}) {
    return (await this._resolveOne()).screenshot(opts);
  }
  async waitFor(opts = {}) {
    const t = opts.timeout || 30000;
    const s = opts.state || 'visible';
    const start = Date.now();
    while (Date.now() - start < t) {
      try {
        const h = await this._resolveHandles();
        if (h.length === 0) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        if (s === 'attached') return;
        const vis = await h[0].evaluate((el) => {
          const c = getComputedStyle(el);
          return (
            el.offsetWidth > 0 &&
            el.offsetHeight > 0 &&
            c.visibility !== 'hidden' &&
            c.display !== 'none'
          );
        });
        if (s === 'visible' && vis) return;
        if (s === 'hidden' && !vis) return;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Locator waitFor timeout: ${this._selector}`);
  }
  async all() {
    const h = await this._resolveHandles();
    return h.map(() => new Locator(this._page, this._selector, this._options));
  }
  async allTextContents() {
    const h = await this._resolveHandles();
    const out = [];
    for (const x of h) {
      try {
        out.push(await x.evaluate((el) => el.textContent));
      } catch (_) {
        out.push('');
      }
    }
    return out;
  }
  async evaluate(fn, ...args) {
    return (await this._resolveOne()).evaluate(fn, ...args);
  }
}

function attachLocator(page) {
  if (!page || page._locatorAttached) return;
  page._locatorAttached = true;
  page.locator = (sel) => new Locator(page, sel);
}

module.exports = { Locator, attachLocator };