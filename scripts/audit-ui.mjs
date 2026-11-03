import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3107";
const PORT = 9339;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (event) => this.handle(event.data));
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new CDP(ws);
  }
  handle(raw) {
    const message = JSON.parse(raw);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
      return;
    }
    const listeners = this.listeners.get(message.method);
    if (listeners) for (const fn of [...listeners]) fn(message.params);
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    const list = this.listeners.get(method) ?? [];
    list.push(fn);
    this.listeners.set(method, list);
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text
      );
    }
    return result.result.value;
  }
}

const profile = await fs.mkdtemp(path.join(os.tmpdir(), "draftly-audit-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--window-size=1440,1000",
  "about:blank",
]);
let cdp;
for (let i = 0; i < 100; i++) {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await response.json();
    const page = targets.find((target) => target.type === "page");
    if (page) {
      cdp = await CDP.connect(page.webSocketDebuggerUrl);
      break;
    }
  } catch {}
  await sleep(150);
}
if (!cdp) throw new Error("Chrome did not expose a page target");

const errors = [];
cdp.on("Runtime.exceptionThrown", (event) =>
  errors.push(
    event.exceptionDetails?.exception?.description ??
      event.exceptionDetails?.text ??
      "exception"
  )
);
cdp.on("Runtime.consoleAPICalled", (event) => {
  if (event.type === "error") {
    errors.push(event.args.map((arg) => arg.value ?? arg.description).join(" "));
  }
});
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");

async function viewport(width, height, mobile = false) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
}
async function go(route) {
  await cdp.send("Page.navigate", { url: `${BASE}${route}` });
  await sleep(900);
}
async function click(selector) {
  const box = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`missing ${selector}`);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
}
async function pageFacts() {
  return cdp.eval(`(() => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const white = [...document.querySelectorAll('*')].filter((el) => {
      if (!visible(el)) return false;
      const bg = getComputedStyle(el).backgroundColor;
      const r = el.getBoundingClientRect();
      return bg === 'rgb(255, 255, 255)' && r.width * r.height > 18000;
    }).slice(0, 8).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 100), area: Math.round(el.getBoundingClientRect().width * el.getBoundingClientRect().height) }));
    const smallTargets = [...document.querySelectorAll('button, a[role=button], a.app-icon-link, .theme-toggle, .app-menu-button')].filter((el) => {
      if (!visible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
    }).slice(0, 10).map((el) => ({ tag: el.tagName, text: el.textContent.trim().slice(0, 24), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), html: el.outerHTML.slice(0, 220) }));
    const h1 = document.querySelector('h1');
    return {
      path: location.pathname,
      title: document.title,
      lang: document.documentElement.lang,
      theme: document.documentElement.dataset.theme,
      h1: h1?.innerText ?? null,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      overflow: document.documentElement.scrollWidth - innerWidth,
      whiteSurfaces: white,
      smallTargets,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      textColor: getComputedStyle(document.body).color,
      height: document.documentElement.scrollHeight,
    };
  })()`);
}

await viewport(1440, 1000);
const report = { desktop: {}, tablet: {}, mobile: {}, dark: {}, flows: {}, errors };

const routes = [
  "/",
  "/polisher",
  "/humanize",
  "/translate",
  "/grammar",
  "/ai-detector",
  "/tools/style-profile",
  "/academic",
  "/feedback",
  "/settings",
  "/privacy",
  "/terms",
];
for (const route of routes) {
  await go(route);
  report.desktop[route] = await pageFacts();
}

await go("/");
report.flows.homeLayout = await cdp.eval(`(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) };
  };
  const scroll = rect('.scroll-indicator');
  const label = rect('.folder-pocket-label');
  return {
    tabs: rect('.folder-tabs-row'),
    body: rect('.folder-body'),
    content: rect('.folder-content'),
    pocket: rect('.folder-pocket'),
    scroll,
    label,
    scrollLabelOverlap: Boolean(scroll && label && !(scroll.x + scroll.w < label.x || label.x + label.w < scroll.x || scroll.y + scroll.h < label.y || label.y + label.h < scroll.y)),
    heroHeight: Math.round(document.querySelector('.folder-hero').getBoundingClientRect().height),
    viewport: innerHeight,
    doc: {
      stackTop: Math.round(document.querySelector('[data-testid="service-stack"]').getBoundingClientRect().top + scrollY),
      stackBottom: Math.round(document.querySelector('[data-testid="service-stack"]').getBoundingClientRect().bottom + scrollY),
      feedbackTop: Math.round(document.querySelector('.home-feedback').getBoundingClientRect().top + scrollY),
      feedbackHeight: Math.round(document.querySelector('.home-feedback').getBoundingClientRect().height),
      footerTop: Math.round(document.querySelector('.home-footer').getBoundingClientRect().top + scrollY),
      pageHeight: document.documentElement.scrollHeight,
    },
  };
})()`);
await cdp.eval(`(() => {
  const shells = [...document.querySelectorAll('.service-card-shell')];
  const target = shells.at(-1).getBoundingClientRect().top + scrollY - 154;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, target);
  return true;
})()`);
await sleep(400);
report.flows.serviceEnd = await cdp.eval(`(() => {
  const cards = [...document.querySelectorAll('.service-card')];
  return {
    scrollY: Math.round(scrollY),
    tops: cards.map((el) => Math.round(el.getBoundingClientRect().top)),
    stuck: [...document.querySelectorAll('.service-card-shell')].map((el) => el.dataset.stuck),
    lastBottom: Math.round(cards.at(-1).getBoundingClientRect().bottom),
    viewport: innerHeight,
  };
})()`);

await go("/tools/style-profile");
report.flows.styleGrid = await cdp.eval(`(() => {
  const layout = document.querySelector('.style-layout');
  const main = document.querySelector('.style-main');
  const children = [...main.children].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const aside = document.querySelector('.style-layout > aside').getBoundingClientRect();
  return {
    columns: getComputedStyle(layout).gridTemplateColumns,
    mainDisplay: getComputedStyle(main).display,
    children,
    aside: { x: Math.round(aside.x), y: Math.round(aside.y), w: Math.round(aside.width) },
  };
})()`);

await go("/academic");
await cdp.eval(`(() => {
  const t = document.querySelector('[data-testid="academic-input"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(t, '测试清空');
  t.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(250);
await cdp.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '清空')?.click()`);
await sleep(300);
report.flows.modal = await cdp.eval(`(() => {
  const panel = document.querySelector('.modal-panel');
  const r = panel?.getBoundingClientRect();
  return {
    open: Boolean(panel),
    role: panel?.getAttribute('role'),
    modal: panel?.getAttribute('aria-modal'),
    title: panel?.querySelector('h2')?.innerText,
    width: r ? Math.round(r.width) : null,
    active: document.activeElement?.textContent?.trim(),
    bodyOverflow: document.body.style.overflow,
  };
})()`);
await cdp.send("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "Escape",
  code: "Escape",
  windowsVirtualKeyCode: 27,
});
await cdp.send("Input.dispatchKeyEvent", {
  type: "keyUp",
  key: "Escape",
  code: "Escape",
  windowsVirtualKeyCode: 27,
});
await sleep(250);
report.flows.modalClosedByEscape = await cdp.eval(
  `!document.querySelector('.modal-panel')`
);
await cdp.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '清空')?.click()`);
await sleep(250);
await cdp.eval(`[...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent.includes('清空文本'))?.click()`);
await sleep(250);
report.flows.modalConfirm = await cdp.eval(`({
  closed: !document.querySelector('.modal-panel'),
  text: document.querySelector('[data-testid="academic-input"]')?.value,
})`);

await go("/polisher");
await click(".app-menu-button");
await sleep(500);
report.flows.drawer = await cdp.eval(`(() => {
  const d = document.querySelector('.folder-drawer');
  const r = d.getBoundingClientRect();
  return {
    open: Boolean(d),
    width: Math.round(r.width),
    navCount: d.querySelectorAll('nav a').length,
    activeElement: document.activeElement?.getAttribute('aria-label'),
    bodyOverflow: document.body.style.overflow,
  };
})()`);
await cdp.send("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "Escape",
  code: "Escape",
  windowsVirtualKeyCode: 27,
});
await cdp.send("Input.dispatchKeyEvent", {
  type: "keyUp",
  key: "Escape",
  code: "Escape",
  windowsVirtualKeyCode: 27,
});
await sleep(350);
report.flows.drawerClosed = await cdp.eval(
  `!document.querySelector('.folder-drawer')`
);

await go("/admin/login");
report.desktop["/admin/login"] = await pageFacts();
report.flows.adminLogin = await cdp.eval(`(() => {
  const brand = document.querySelector('.admin-login-brand');
  const headline = document.querySelector('.admin-login-headline');
  return {
    columns: getComputedStyle(document.querySelector('.admin-login-shell')).gridTemplateColumns,
    brand: brand ? { bg: getComputedStyle(brand).backgroundColor, color: getComputedStyle(headline).color, x: Math.round(brand.getBoundingClientRect().x), w: Math.round(brand.getBoundingClientRect().width) } : null,
    headline: headline?.innerText,
    formBg: getComputedStyle(document.querySelector('.admin-login-form')).backgroundColor,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
})()`);

await go("/");
await cdp.eval(`localStorage.setItem('draftly.uiLocale','en')`);
await cdp.send("Page.reload");
await sleep(900);
await cdp.eval(`document.querySelector('[data-testid="tab-humanize"]')?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))`);
await sleep(250);
report.flows.englishTabPreview = await cdp.eval(`(() => {
  const preview = document.querySelector('[data-testid="tab-humanize"]').closest('.folder-tab-wrap').querySelector('.tab-preview');
  return { text: preview.innerText, link: preview.querySelector('a')?.innerText };
})()`);
await cdp.eval(`localStorage.setItem('draftly.uiLocale','zh')`);

await viewport(390, 844, true);
await go("/");
report.mobile.home = await pageFacts();
report.mobile.homeLayout = await cdp.eval(`(() => ({
  tabRows: new Set([...document.querySelectorAll('.folder-tab')].map((el) => Math.round(el.getBoundingClientRect().top))).size,
  tabSizes: [...document.querySelectorAll('.folder-tab')].slice(0, 2).map((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }),
  topbarTargets: [...document.querySelectorAll('.home-topbar .theme-toggle, .app-icon-link, .app-menu-button')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, cls: String(el.className).slice(0, 50), w: Math.round(r.width), h: Math.round(r.height) };
  }),
  cardPositions: [...document.querySelectorAll('.service-card-shell')].map((el) => getComputedStyle(el).position),
  cta: document.querySelector('[data-testid="home-cta"]')?.getBoundingClientRect().toJSON(),
}))()`);

for (const route of ["/polisher", "/tools/style-profile", "/academic", "/feedback"]) {
  await go(route);
  report.mobile[route] = await pageFacts();
}

await go("/admin/login");
report.mobile["/admin/login"] = await pageFacts();
report.flows.mobileAdmin = await cdp.eval(`(() => {
  const brand = document.querySelector('.admin-login-brand');
  return {
    columns: getComputedStyle(document.querySelector('.admin-login-shell')).gridTemplateColumns,
    brandH: Math.round(brand.getBoundingClientRect().height),
    headlineVisible: getComputedStyle(document.querySelector('.admin-login-headline')).display,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
})()`);

for (const [width, height] of [
  [1024, 768],
  [768, 1024],
]) {
  const key = `${width}x${height}`;
  await viewport(width, height);
  await go("/");
  const facts = await pageFacts();
  const layout = await cdp.eval(`(() => {
    const tabs = [...document.querySelectorAll('.folder-tab')];
    const rows = [...new Set(tabs.map((el) => Math.round(el.getBoundingClientRect().top)))];
    return {
      tabRows: rows.length,
      tabsPerRow: tabs.filter((el) => Math.round(el.getBoundingClientRect().top) === rows[0]).length,
      tabMinH: Math.min(...tabs.map((el) => el.getBoundingClientRect().height)),
      cardPositions: [...document.querySelectorAll('.service-card-shell')].map((el) => getComputedStyle(el).position),
      hero: Math.round(document.querySelector('.folder-hero').getBoundingClientRect().height),
    };
  })()`);
  report.tablet[key] = { facts, ...layout };

  await go("/tools/style-profile");
  report.tablet[`${key}/style`] = {
    facts: await pageFacts(),
    grid: await cdp.eval(`(() => {
      const layout = document.querySelector('.style-layout');
      const main = document.querySelector('.style-main');
      return {
        columns: getComputedStyle(layout).gridTemplateColumns,
        mainDisplay: main ? getComputedStyle(main).display : null,
      };
    })()`),
  };

  await go("/polisher");
  await click(".app-menu-button");
  await sleep(500);
  report.tablet[`${key}/drawer`] = await cdp.eval(`(() => {
    const d = document.querySelector('.folder-drawer');
    const r = d.getBoundingClientRect();
    return { open: Boolean(d), width: Math.round(r.width), viewport: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(400);
}

await viewport(1440, 1000);
await go("/");
await cdp.eval(`localStorage.setItem('draftly-theme','dark')`);
for (const route of [
  "/",
  "/polisher",
  "/tools/style-profile",
  "/academic",
  "/feedback",
  "/settings",
]) {
  await go(route);
  report.dark[route] = await pageFacts();
}

console.log(JSON.stringify(report, null, 2));
cdp.ws.close();
chrome.kill();
await fs.rm(profile, { recursive: true, force: true }).catch(() => {});