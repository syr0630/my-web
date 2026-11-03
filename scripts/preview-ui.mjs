import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3107";
const OUT = path.resolve("D:\\dsh\\draftly-ui");
const PORT = 9334;

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
  close() {
    this.ws.close();
  }
}

await fs.mkdir(OUT, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "draftly-preview-"));
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
  } catch {
    // Chrome is still starting.
  }
  await sleep(150);
}
if (!cdp) throw new Error("Could not connect to Chrome");

const errors = [];
cdp.on("Runtime.exceptionThrown", (event) => {
  errors.push(event.exceptionDetails?.exception?.description ?? "exception");
});
cdp.on("Runtime.consoleAPICalled", (event) => {
  if (event.type === "error") {
    errors.push(event.args.map((arg) => arg.value ?? arg.description).join(" "));
  }
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
  await sleep(900);
  await cdp.eval("document.fonts.ready.then(() => true)");
}

async function shot(name, { full = false } = {}) {
  let clip;
  if (full) {
    const metrics = await cdp.send("Page.getLayoutMetrics");
    const size = metrics.cssContentSize;
    clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
  }
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: full,
    ...(clip ? { clip } : {}),
  });
  const file = path.join(OUT, `${name}.png`);
  await fs.writeFile(file, Buffer.from(data, "base64"));
  console.log(file);
}

async function setTheme(theme) {
  await cdp.eval(
    `localStorage.setItem("draftly-theme", ${JSON.stringify(theme)}); document.documentElement.dataset.theme = ${JSON.stringify(
      theme
    )}; true`
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(700);
}

await go("/");
await shot("home-light");
await shot("home-light-full", { full: true });
await cdp.eval("window.scrollTo(0, 740)");
await sleep(400);
await shot("home-services-light");
await cdp.eval("window.scrollTo(0, 1500)");
await sleep(400);
await shot("home-services-light-2");

await setTheme("dark");
await go("/");
await shot("home-dark");
await cdp.eval("window.scrollTo(0, 740)");
await sleep(400);
await shot("home-services-dark");

await setTheme("light");
for (const [route, name] of [
  ["/polisher", "polisher"],
  ["/translate", "translate"],
  ["/grammar", "grammar"],
  ["/ai-detector", "detector"],
  ["/tools/style-profile", "style"],
  ["/academic", "academic"],
  ["/feedback", "feedback"],
  ["/settings", "settings"],
]) {
  await go(route);
  await shot(`${name}-light`);
  await shot(`${name}-light-full`, { full: true });
}

await go("/polisher");
await cdp.eval("document.querySelector('.app-menu-button').click(); true");
await sleep(600);
await shot("drawer-light");

await setTheme("dark");
await go("/");
await shot("home-dark-2");
await go("/polisher");
await shot("polisher-dark");
await cdp.eval("document.querySelector('.app-menu-button').click(); true");
await sleep(600);
await shot("drawer-dark");

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await setTheme("light");
await go("/");
await shot("home-mobile");
await cdp.eval("window.scrollTo(0, 500)");
await sleep(400);
await shot("home-mobile-services");

console.log("errors", JSON.stringify(errors, null, 2));
cdp.close();
chrome.kill();
await fs.rm(profile, { recursive: true, force: true }).catch(() => {});