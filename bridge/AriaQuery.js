const { Locator } = require('./LocatorShim');

const ARIA_ROLE_MAP = {
  button: 'button, [role="button"], input[type="button"], input[type="submit"]',
  link: 'a, [role="link"]',
  textbox:
    'input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="url"], input:not([type]), textarea, [role="textbox"]',
  checkbox: 'input[type="checkbox"], [role="checkbox"]',
  radio: 'input[type="radio"], [role="radio"]',
  combobox: 'select, [role="combobox"]',
  heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
  img: 'img, [role="img"]',
  list: 'ul, ol, [role="list"]',
  listitem: 'li, [role="listitem"]',
  table: 'table, [role="table"]',
  row: 'tr, [role="row"]',
  cell: 'td, [role="cell"], [role="gridcell"]',
  dialog: 'dialog, [role="dialog"]',
  navigation: 'nav, [role="navigation"]',
  main: 'main, [role="main"]',
  banner: 'header, [role="banner"]',
  contentinfo: 'footer, [role="contentinfo"]',
  form: 'form, [role="form"]',
  search: '[role="search"]',
  menu: '[role="menu"], menu',
  menuitem: '[role="menuitem"]',
  tab: '[role="tab"]',
  tabpanel: '[role="tabpanel"]',
  tooltip: '[role="tooltip"]',
  alert: '[role="alert"]',
  status: '[role="status"]',
  progressbar: 'progress, [role="progressbar"]',
  slider: 'input[type="range"], [role="slider"]',
  spinbutton: 'input[type="number"], [role="spinbutton"]',
  switch: '[role="switch"]',
  tree: '[role="tree"]',
  treeitem: '[role="treeitem"]',
};

function buildRoleSelector(role) {
  return ARIA_ROLE_MAP[role] || `[role="${role}"]`;
}

function attachAriaQuery(page) {
  if (!page || page._ariaAttached) return;
  page._ariaAttached = true;

  page.getByRole = (role, opts = {}) => {
    const sel = buildRoleSelector(role);
    const loc = new Locator(page, sel);
    if (opts.name) loc._ariaName = opts.name;
    return loc;
  };

  page.getByText = (text, opts = {}) => {
    const esc = String(text).replace(/"/g, '\\"');
    const sel = opts.exact ? `text="${esc}"` : `:has-text("${esc}")`;
    return new Locator(page, `*${sel}`);
  };

  page.getByLabel = (label) => {
    const esc = String(label).replace(/"/g, '\\"');
    return new Locator(
      page,
      `[aria-label="${esc}"], label:has-text("${esc}") + input, label:has-text("${esc}") input, label:has-text("${esc}") textarea, label:has-text("${esc}") select`
    );
  };

  page.getByPlaceholder = (text) => {
    const esc = String(text).replace(/"/g, '\\"');
    return new Locator(page, `[placeholder="${esc}"], [placeholder*="${esc}"]`);
  };

  page.getByTestId = (id) => {
    const esc = String(id).replace(/"/g, '\\"');
    return new Locator(
      page,
      `[data-testid="${esc}"], [data-test-id="${esc}"], [data-test="${esc}"]`
    );
  };

  page.getByAltText = (text) => {
    const esc = String(text).replace(/"/g, '\\"');
    return new Locator(page, `img[alt*="${esc}"]`);
  };

  page.getByTitle = (text) => {
    const esc = String(text).replace(/"/g, '\\"');
    return new Locator(page, `[title*="${esc}"]`);
  };
}

module.exports = { attachAriaQuery, buildRoleSelector };