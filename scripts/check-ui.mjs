import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3107";
const PORT = 9335;
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
    return () => {
      const current = this.listeners.get(method) ?? [];
      this.listeners.set(
        method,
        current.filter((item) => item !== fn)
      );
    };
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

const profile = await fs.mkdtemp(path.join(os.tmpdir(), "draftly-check-"));
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
for (let i = 0; i < 80; i++) {
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
if (!cdp) throw new Error("no chrome");

const errors = [];
cdp.on("Runtime.exceptionThrown", (event) =>
  errors.push(event.exceptionDetails?.exception?.description ?? "exception")
);
cdp.on("Runtime.consoleAPICalled", (event) => {
  if (event.type === "error")
    errors.push(event.args.map((arg) => arg.value ?? arg.description).join(" "));
});
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

async function go(route) {
  await cdp.send("Page.navigate", { url: `${BASE}${route}` });
  await sleep(800);
}
async function center(selector) {
  return cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
}
async function mouse(x, y) {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
    pointerType: "mouse",
  });
}

const results = {};
await go("/");
results.home = await cdp.eval(`(() => ({
  tabs: document.querySelectorAll('[data-testid^="tab-"]').length,
  tools: document.querySelectorAll('[data-testid^="tool-"]').length,
  overflow: document.documentElement.scrollWidth - innerWidth,
  title: document.querySelector('h1')?.innerText,
  font: getComputedStyle(document.querySelector('h1')).fontFamily,
  theme: document.documentElement.dataset.theme
}))()`);

const tab = await center('[data-testid="tab-humanize"]');
await mouse(tab.x, tab.y);
await sleep(450);
results.tabHover = await cdp.eval(`(() => {
  const tab = document.querySelector('[data-testid="tab-humanize"]');
  const preview = tab.closest('.folder-tab-wrap').querySelector('.tab-preview');
  const style = getComputedStyle(preview);
  const r = preview.getBoundingClientRect();
  return { opacity: style.opacity, visibility: style.visibility, width: r.width, text: preview.innerText };
})()`);

const themeBtn = await center(".home-topbar .theme-toggle");
await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: themeBtn.x,
  y: themeBtn.y,
  button: "left",
  clickCount: 1,
});
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: themeBtn.x,
  y: themeBtn.y,
  button: "left",
  clickCount: 1,
});
await sleep(180);
results.wipeDuring = await cdp.eval(`(() => {
  const wipe = document.querySelector('.theme-wipe');
  return wipe ? { className: wipe.className, active: wipe.dataset.active, rect: wipe.getBoundingClientRect().toJSON() } : null;
})()`);
await sleep(900);
results.afterTheme = await cdp.eval(`({
  theme: document.documentElement.dataset.theme,
  stored: localStorage.getItem('draftly-theme'),
  wipe: Boolean(document.querySelector('.theme-wipe'))
})`);

await go("/polisher");
const menu = await center(".app-menu-button");
await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: menu.x,
  y: menu.y,
  button: "left",
  clickCount: 1,
});
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: menu.x,
  y: menu.y,
  button: "left",
  clickCount: 1,
});
await sleep(500);
results.drawer = await cdp.eval(`(() => {
  const drawer = document.querySelector('.folder-drawer');
  const nav = drawer?.querySelectorAll('nav a').length;
  return drawer ? {
    width: drawer.getBoundingClientRect().width,
    ratio: drawer.getBoundingClientRect().width / innerWidth,
    nav,
    active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
    overflow: document.documentElement.scrollWidth - innerWidth
  } : null;
})()`);

await cdp.eval("document.querySelector('.folder-drawer .app-icon-link')?.click(); true");
await sleep(300);
results.drawerClosed = await cdp.eval(
  "Boolean(document.querySelector('.folder-drawer'))"
);

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await go("/");
results.mobile = await cdp.eval(`(() => ({
  overflow: document.documentElement.scrollWidth - innerWidth,
  tabs: [...document.querySelectorAll('.folder-tab')].map((el) => ({ text: el.innerText.trim(), w: el.getBoundingClientRect().width })),
  cta: document.querySelector('[data-testid="home-cta"]')?.getBoundingClientRect().toJSON(),
  cards: [...document.querySelectorAll('.service-card')].map((el) => getComputedStyle(el.parentElement).position)
}))()`);

console.log(JSON.stringify({ results, errors }, null, 2));
cdp.ws.close();
chrome.kill();
await fs.rm(profile, { recursive: true, force: true }).catch(() => {});