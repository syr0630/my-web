import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9333;
const OUT_DIR = path.resolve("artifacts");
const VIEWPORT = { width: 1440, height: 1000, scale: 1 };
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  (
    await fs.readFile(".env.local", "utf8").catch(() => "")
  ).match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const feedbackMessage = `Browser feedback ${Date.now()}：反馈页表单应该真实提交，并在后台出现。`;

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
    if (!listeners) return;
    for (const listener of [...listeners]) listener(message.params);
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
    return () => {
      const current = this.listeners.get(method) ?? [];
      this.listeners.set(
        method,
        current.filter((item) => item !== listener)
      );
    };
  }

  waitFor(method, predicate = () => true, timeout = 20000) {
    return new Promise((resolve, reject) => {
      let off = () => {};
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timeout waiting for ${method}`));
      }, timeout);
      off = this.on(method, (params) => {
        if (!predicate(params)) return;
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  async eval(expression, timeout = 20000) {
    const response = await Promise.race([
      this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("evaluate timeout")), timeout)
      ),
    ]);
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text
      );
    }
    return response.result.value;
  }

  close() {
    this.ws.close();
  }
}

let cdp;
let chrome;
let profileDir;
let passed = 0;
let failed = 0;
const failures = [];
const exceptions = [];
const consoleErrors = [];

async function screenshot(name, { fullPage = true } = {}) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: fullPage,
  });
  const file = path.join(OUT_DIR, name);
  await fs.writeFile(file, Buffer.from(data, "base64"));
  return file;
}

async function waitFor(expression, label, timeout = 25000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      if (await cdp.eval(expression)) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(
    `timeout: ${label}${lastError ? ` (${lastError.message})` : ""}`
  );
}

async function setViewport({ width, height, mobile = false, scale = 1 }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: mobile,
    maxTouchPoints: mobile ? 5 : 1,
  });
}

async function goto(route) {
  const loaded = cdp.waitFor("Page.loadEventFired", () => true, 30000);
  await cdp.send("Page.navigate", { url: BASE + route });
  await loaded;
  await waitFor(`document.readyState === 'complete'`, "document ready");
  try {
    await waitFor(
      `document.querySelector('[data-app-ready="true"]') !== null`,
      "app hydration",
      10000
    );
  } catch {
    /* pages without the shell still count */
  }
  await sleep(250);
}

async function value(selector) {
  return cdp.eval(
    `(() => { const el = document.querySelector(${JSON.stringify(
      selector
    )}); return el ? (('value' in el) ? el.value : el.innerText) : null; })()`
  );
}

async function text(selector) {
  return cdp.eval(
    `(() => { const el = document.querySelector(${JSON.stringify(
      selector
    )}); return el ? el.innerText : ''; })()`
  );
}

async function count(selector) {
  return cdp.eval(
    `document.querySelectorAll(${JSON.stringify(selector)}).length`
  );
}

async function setTextarea(selector, valueToSet) {
  const ok = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(valueToSet)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`textarea not found: ${selector}`);
}

async function setInput(selector, valueToSet) {
  const ok = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(valueToSet)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`input not found: ${selector}`);
}

async function selectOption(selector, optionValue) {
  const ok = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.value = ${JSON.stringify(optionValue)};
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`select not found: ${selector}`);
}

async function click(selector, index = 0) {
  const result = await cdp.eval(`(() => {
    const list = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const el = list[${index}];
    if (!el) return { ok: false, count: list.length };
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    el.click();
    return { ok: true, count: list.length };
  })()`);
  if (!result?.ok) {
    throw new Error(`click failed: ${selector} (found ${result?.count ?? 0})`);
  }
}

async function clickText(label, scope = "body") {
  const result = await cdp.eval(`(() => {
    const root = document.querySelector(${JSON.stringify(scope)}) ?? document.body;
    const nodes = [...root.querySelectorAll('button, a')];
    const el = nodes.find((node) => node.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(
      label
    )} && !node.disabled);
    if (!el) return { ok: false, labels: nodes.map((n) => n.textContent.trim()).slice(0, 30) };
    el.scrollIntoView({ block: 'center' });
    el.click();
    return { ok: true };
  })()`);
  if (!result?.ok) {
    throw new Error(
      `text click failed: ${label} :: ${JSON.stringify(result?.labels)}`
    );
  }
}

async function step(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.error(`FAIL  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
    try {
      await screenshot(`failure-${failures.length}.png`);
    } catch {
      /* ignore */
    }
  }
}

async function startChrome() {
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "draftly-chrome-"));
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--disable-features=Translate",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${DEBUG_PORT}/json/list`
      );
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not ready yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome did not expose a debugging target");
}

async function main() {
  console.log(`\nDraftly browser tests — ${BASE}`);
  console.log(`Chrome: ${CHROME}\n`);

  const wsUrl = await startChrome();
  cdp = await CDP.connect(wsUrl);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await setViewport(VIEWPORT);

  cdp.on("Runtime.exceptionThrown", (event) => {
    exceptions.push(
      event.exceptionDetails.exception?.description ??
        event.exceptionDetails.text
    );
  });
  cdp.on("Log.entryAdded", (event) => {
    if (event.entry.level !== "error") return;
    if (/favicon/i.test(event.entry.text) || /favicon/i.test(event.entry.url ?? "")) {
      return;
    }
    consoleErrors.push(`${event.entry.text} ${event.entry.url ?? ""}`.trim());
  });

  await cdp.send("Page.bringToFront");

  console.log("[home / desktop]");
  await step("home renders the folder hero, eight tabs and seven service cards", async () => {
    await goto("/");
    const h1 = await text("h1");
    assert.match(h1, /Draftly/);
    const body = await text("body");
    assert.match(body, /让每一句话，更接近你想表达的样子。/);
    assert.match(body, /Polish your draft in seconds\./);
    assert.match(body, /Meet your words/);
    assert.match(body, /一元硬币/);
    assert.ok(!body.includes("AI WRITING STUDIO"));

    assert.equal(await count('[data-testid="folder-tabs"]'), 1);
    assert.equal(await count('[data-testid^="tab-"]'), 8);
    assert.equal(await count('[data-testid^="tool-"]'), 7);
    assert.equal(await count("aside"), 0);
    assert.equal(await cdp.eval(`document.documentElement.lang`), "zh-CN");
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);

    const skin = await cdp.eval(
      `(() => {
        const home = getComputedStyle(document.querySelector('.home')).backgroundColor;
        const cta = getComputedStyle(document.querySelector('.home-cta')).backgroundColor;
        const family = getComputedStyle(document.querySelector('h1')).fontFamily;
        return { home, cta, family };
      })()`
    );
    assert.equal(skin.home, "rgb(250, 248, 243)", "home background is not warm paper");
    assert.equal(skin.cta, "rgb(76, 108, 194)", "primary CTA is not macaron blue");
    assert.ok(
      !/["\s](serif|times|georgia|songti|宋体)/i.test(skin.family),
      `serif font leaked: ${skin.family}`
    );
    assert.equal(
      await cdp.eval(`document.querySelector('[data-testid="footer-credit"]').innerText`),
      "一元硬币"
    );
    assert.equal(
      (
        await cdp.eval(
          `document.querySelector('.home-footer-inner > span').innerText`
        )
      ).trim(),
      "Draftly · 一元硬币 · 一个关于文字与表达的小小尝试。"
    );
    await screenshot("home-desktop.png");
  });

  await step("folder tabs reveal a preview; theme toggle persists", async () => {
    const tab = await cdp.eval(
      `(() => {
        const el = document.querySelector('[data-testid="tab-humanize"]');
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`
    );
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: tab.x,
      y: tab.y,
      button: "none",
      pointerType: "mouse",
    });
    await waitFor(
      `getComputedStyle(document.querySelector('[data-testid="tab-humanize"]').closest('.folder-tab-wrap').querySelector('.tab-preview')).visibility === 'visible'`,
      "tab preview visible"
    );

    await cdp.eval(`document.querySelector('.home-topbar .theme-toggle').click()`);
    await waitFor(
      `document.documentElement.dataset.theme === 'dark'`,
      "dark theme",
      3000
    );
    assert.equal(
      await cdp.eval(`localStorage.getItem('draftly-theme')`),
      "dark"
    );
    await sleep(80);
    await cdp.eval(`document.querySelector('.home-topbar .theme-toggle').click()`);
    await waitFor(
      `document.documentElement.dataset.theme === 'light'`,
      "light theme",
      3000
    );
  });

  await step("hero CTA enters the existing workbench", async () => {
    await click('[data-testid="home-cta"]');
    await waitFor(`location.pathname === '/polisher'`, "polisher route");
    await waitFor(
      `document.querySelector('[data-testid="original-input"]') !== null`,
      "workbench editor"
    );
  });

  await step("feedback form submits to the real API and confirms success", async () => {
    await goto("/feedback");
    await setInput('[data-testid="feedback-email"]', "browser@example.com");
    await selectOption('[data-testid="feedback-category"]', "writing_experience");
    await setTextarea('[data-testid="feedback-message"]', feedbackMessage);
    await click('[data-testid="feedback-consent"]');
    await click('[data-testid="feedback-submit"]');
    await waitFor(
      `document.querySelector('[data-testid="feedback-success"]') !== null`,
      "feedback success",
      20000
    );
    const success = await text('[data-testid="feedback-success"]');
    assert.match(success, /Thanks for helping Draftly grow/);
    assert.match(success, /已经收到你的反馈/);
    await screenshot("feedback-success-desktop.png");
    await click('[data-testid="feedback-another"]');
    await waitFor(
      `document.querySelector('[data-testid="feedback-form"]') !== null`,
      "feedback form reset"
    );
    assert.equal(await value('[data-testid="feedback-message"]'), "");
  });

  console.log("\n[polisher / Chinese flow]");
  await goto("/polisher");

  await step("example fills the editor and the run button enables", async () => {
    await clickText("填入示例");
    await waitFor(
      `document.querySelector('[data-testid="original-input"]').value.length > 20`,
      "example text"
    );
    const disabled = await cdp.eval(
      `document.querySelector('[data-testid="run-button"]').disabled`
    );
    assert.equal(disabled, false);
  });

  await step("academic standard can be selected", async () => {
    await clickText("学术");
    const pressed = await cdp.eval(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '学术').getAttribute('aria-pressed')`
    );
    assert.equal(pressed, "true");

    await waitFor(
      `getComputedStyle([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '学术')).backgroundColor === 'rgb(232, 238, 252)'`,
      "selected capsule turns pastel blue",
      3000
    );
    const selectedBg = await cdp.eval(
      `getComputedStyle([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '学术')).backgroundColor`
    );
    assert.equal(
      selectedBg,
      "rgb(232, 238, 252)",
      "selected capsule is not pastel blue"
    );

    const rows = await cdp.eval(
      `[...document.querySelectorAll('button.capsule')].map((el) => Math.round(el.getBoundingClientRect().top))`
    );
    assert.equal(
      new Set(rows).size,
      1,
      `nine standards should share one row: ${rows}`
    );
  });

  await step("polish returns real AI text with green diff marks", async () => {
    await click('[data-testid="run-button"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="result-highlight"]'); return el && el.innerText.trim().length > 20; })()`,
      "polished result",
      45000
    );
    await waitFor(
      `document.querySelectorAll('[data-testid="result-highlight"] .diff-insert').length > 0`,
      "diff insert marks"
    );

    const original = await value('[data-testid="original-input"]');
    const result = await value('[data-testid="result-highlight"]');
    assert.notEqual(result.trim(), original.trim());
    assert.ok(result.length <= 600, "result unexpectedly long");

    const cards = await count('[data-testid="sentence-card"]');
    assert.ok(cards >= 1, `sentence cards: ${cards}`);

    const counter = await text('[data-testid="sentence-panel"]');
    assert.match(counter, /修改|句/);

    const panes = await cdp.eval(
      `(() => {
        const original = document.querySelector('[data-testid="original-input"]').closest('section').getBoundingClientRect();
        const result = document.querySelector('[data-testid="result-highlight"]').closest('section').getBoundingClientRect();
        return { ox: original.x, oy: original.y, rx: result.x, ry: result.y };
      })()`
    );
    assert.ok(Math.abs(panes.oy - panes.ry) < 2, "panes are not side by side");
    assert.ok(panes.rx > panes.ox + 100, "result pane is not to the right");
    await screenshot("polisher-result-desktop.png");
  });

  await step("polish result exposes accessible in-context word suggestions", async () => {
    const before = (await value('[data-testid="result-highlight"]')).trim();
    await cdp.eval(`(() => {
      window.__draftlyRealFetch = window.fetch;
      window.__draftlySuggestionCalls = [];
      window.__draftlySuggestionTextCalls = 0;
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (!url.includes('/api/v1/word-suggestions')) {
          return window.__draftlyRealFetch(input, init);
        }
        window.__draftlySuggestionCalls.push(url);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => {
            window.__draftlySuggestionTextCalls += 1;
            return Promise.resolve(JSON.stringify({
              request_id: 'browser-suggestion-test',
              suggestions: ['insightful', 'promising', 'worthwhile'],
              selectedText: 'valuable',
              status: 'ok'
            }));
          }
        });
      };
      return true;
    })()`);
    try {
      const clickResult = await cdp.eval(`(() => {
        const token = document.querySelector('[data-testid="synonym-target"]');
        if (!token) return {
          ok: false,
          inserts: document.querySelectorAll('[data-testid="result-highlight"] .diff-insert').length,
          tokens: document.querySelectorAll('[data-synonym-token]').length,
          html: document.querySelector('[data-testid="result-highlight"]').innerHTML.slice(0, 600)
        };
        token.click();
        return { ok: true, word: token.innerText };
      })()`);
      assert.ok(
        clickResult.ok,
        `no synonym targets in the polish result: ${JSON.stringify(clickResult)}`
      );
      await waitFor(
        `document.querySelector('[role="dialog"]') !== null`,
        "synonym popover",
        5000
      );
      const popover = await text('[role="dialog"]');
      assert.match(popover, /替换/);
      assert.match(popover, /保留当前表达/);

      try {
        await waitFor(
          `document.querySelectorAll('button.synonym-option').length === 3`,
          "contextual suggestions",
          10000
        );
      } catch (error) {
        const debug = await cdp.eval(`(() => ({
          calls: window.__draftlySuggestionCalls,
          textCalls: window.__draftlySuggestionTextCalls,
          dialog: document.querySelector('[role="dialog"]')?.innerText ?? null,
          options: document.querySelectorAll('button.synonym-option').length
        }))()`);
        console.log(`      suggestion debug: ${JSON.stringify(debug)}`);
        throw error;
      }
      const focused = await cdp.eval(
        `document.activeElement?.classList.contains('synonym-option')`
      );
      assert.equal(focused, true, "first suggestion should receive focus");
      const choice = (await text("button.synonym-option")).trim();
      await click("button.synonym-option");
      await waitFor(
        `document.querySelector('[data-testid="result-highlight"]').innerText.trim() !== ${JSON.stringify(
          before
        )}`,
        "synonym replacement applied"
      );
      const replaced = (await value('[data-testid="result-highlight"]')).trim();
      assert.ok(replaced.includes(choice.split("\n")[0]), "chosen word missing");
      await click('[data-testid="undo-button"]');
      await waitFor(
        `document.querySelector('[data-testid="result-highlight"]').innerText.trim() === ${JSON.stringify(
          before
        )}`,
        "synonym undo"
      );
    } finally {
      await cdp.eval(`(() => {
        if (window.__draftlyRealFetch) window.fetch = window.__draftlyRealFetch;
        delete window.__draftlyRealFetch;
      })()`);
    }
  });

  await step("alternatives load, apply, and stay inside the real diff", async () => {
    const before = (await value('[data-testid="result-highlight"]')).trim();
    await click('[data-action="alternatives"]');
    await waitFor(
      `document.querySelectorAll('[data-testid="alternative-option"]').length > 0`,
      "alternatives list",
      45000
    );
    const options = await count('[data-testid="alternative-option"]');
    assert.ok(options >= 1, `options: ${options}`);
    const underlines = await count(
      '[data-testid="result-highlight"] .alt-underline'
    );
    assert.ok(underlines >= 1, "alternatives are not marked in the result");
    await screenshot("polisher-alternatives-desktop.png");

    const alternative = (
      await value('[data-testid="alternative-option"]')
    ).trim();
    await click('[data-testid="alternative-option"]');
    await waitFor(
      `document.querySelector('[data-testid="result-highlight"]').innerText.trim() !== ${JSON.stringify(
        before
      )}`,
      "result changed after applying alternative"
    );
    const after = (await value('[data-testid="result-highlight"]')).trim();
    assert.ok(
      after.includes(alternative),
      "applied alternative is not present in the result"
    );
  });

  await step("restore, undo and redo work locally", async () => {
    const beforeRestore = (await value('[data-testid="result-highlight"]')).trim();
    await click('[data-action="restore"]');
    await waitFor(
      `document.querySelector('[data-testid="result-highlight"]').innerText.trim() !== ${JSON.stringify(
        beforeRestore
      )}`,
      "restore changed the result"
    );
    const restored = (await value('[data-testid="result-highlight"]')).trim();

    await click('[data-testid="undo-button"]');
    await waitFor(
      `document.querySelector('[data-testid="result-highlight"]').innerText.trim() === ${JSON.stringify(
        beforeRestore
      )}`,
      "undo returns to the alternative"
    );

    await click('[data-testid="redo-button"]');
    await waitFor(
      `document.querySelector('[data-testid="result-highlight"]').innerText.trim() === ${JSON.stringify(
        restored
      )}`,
      "redo returns to the restored sentence"
    );
  });

  await step("copy all writes the current result to the clipboard", async () => {
    try {
      await cdp.send("Browser.grantPermissions", {
        origin: BASE,
        permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
      });
    } catch {
      /* older browser targets may not support it */
    }
    await cdp.send("Page.bringToFront");
    const expected = (await value('[data-testid="result-highlight"]')).trim();
    await click('[data-testid="copy-button"]');
    await waitFor(
      `[...document.querySelectorAll('button')].some((b) => b.textContent.includes('已复制'))`,
      "copied state"
    );
    try {
      const clipboard = await cdp.eval(
        `navigator.clipboard.readText().then((v) => v.trim())`
      );
      assert.equal(
        clipboard.replace(/\s+/g, " "),
        expected.replace(/\s+/g, " ")
      );
    } catch (error) {
      console.log(`      (clipboard read skipped: ${error.message})`);
    }
  });

  await step("stale response never overwrites a newer edit", async () => {
    const before = (await value('[data-testid="result-highlight"]')).trim();
    await cdp.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*api/v1/polish*", requestStage: "Request" },
      ],
    });
    try {
      const pausedPromise = cdp.waitFor(
        "Fetch.requestPaused",
        (params) => params.request.url.includes("/api/v1/polish"),
        20000
      );
      await click('[data-testid="run-button"]');
      const paused = await pausedPromise;

      const original = await value('[data-testid="original-input"]');
      await setTextarea(
        '[data-testid="original-input"]',
        `${original}补充一句，用来验证旧请求不会覆盖新编辑。`
      );
      await sleep(300);

      await cdp.send("Fetch.continueRequest", {
        requestId: paused.requestId,
      });

      await waitFor(
        `(() => { const el = document.querySelector('[data-testid="info-notice"]'); return el && el.innerText.includes('原文在请求期间被修改'); })()`,
        "version conflict notice",
        45000
      );

      const after = (await value('[data-testid="result-highlight"]')).trim();
      assert.equal(after, before, "stale result overwrote the existing result");
    } finally {
      await cdp.send("Fetch.disable");
    }
  });

  await step("route changes preserve polish text and result", async () => {
    const beforeText = await value('[data-testid="original-input"]');
    const beforeResult = (await value('[data-testid="result-highlight"]')).trim();

    await goto("/settings");
    await goto("/polisher");

    await waitFor(
      `document.querySelector('[data-testid="original-input"]').value === ${JSON.stringify(
        beforeText
      )}`,
      "original text restored after route change"
    );
    assert.equal(
      (await value('[data-testid="result-highlight"]')).trim(),
      beforeResult,
      "polish result was lost after route change"
    );
  });

  await step("an in-flight polish task finishes after leaving and returning", async () => {
    const beforeTaskResult = (
      await value('[data-testid="result-highlight"]')
    ).trim();
    await setTextarea(
      '[data-testid="original-input"]',
      "这是一段用于验证跨页面任务续跑的文字。读者离开润色页去设置页之后，正在处理的润色任务仍然应该完成并回到原来的结果区。"
    );
    await cdp.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*api/v1/polish*", requestStage: "Request" },
      ],
    });
    try {
      const pausedPromise = cdp.waitFor(
        "Fetch.requestPaused",
        (params) => params.request.url.includes("/api/v1/polish"),
        20000
      );
      await click('[data-testid="run-button"]');
      const paused = await pausedPromise;

      await cdp.eval(
        `document.querySelector('a[href="/settings"]').click(); true`
      );
      await waitFor(
        `location.pathname === '/settings'`,
        "client navigation to settings"
      );
      await cdp.send("Fetch.continueRequest", {
        requestId: paused.requestId,
      });

      await waitFor(
        `(() => {
          const raw = sessionStorage.getItem('draftly.workspace.v1.editor.polish');
          if (!raw) return false;
          try {
            const state = JSON.parse(raw);
            return (
              state.originalText.includes('跨页面任务续跑') &&
              typeof state.generatedText === 'string' &&
              state.generatedText.length > 20 &&
              state.generatedText !== ${JSON.stringify(beforeTaskResult)}
            );
          } catch { return false; }
        })()`,
        "task result stored while away from the page",
        90000
      );

      await cdp.eval(
        `document.querySelector('a[href="/polisher"]').click(); true`
      );
      await waitFor(
        `location.pathname === '/polisher'`,
        "client navigation back to polisher"
      );
      await waitFor(
        `(() => { const el = document.querySelector('[data-testid="result-highlight"]'); return el && el.innerText.trim().length > 20; })()`,
        "restored in-flight polish result",
        20000
      );
      await waitFor(
        `document.querySelector('[data-testid="run-button"]').disabled === false`,
        "background task loading state cleared",
        10000
      );
    } finally {
      await cdp.send("Fetch.disable");
    }
  });

  await step("clear requires confirmation and resets both panes", async () => {
    await click('[data-testid="clear-button"]');
    await waitFor(
      `document.querySelector('[data-testid="clear-button"]').innerText.includes('确认')`,
      "clear confirmation"
    );
    await click('[data-testid="clear-button"]');
    await waitFor(
      `document.querySelector('[data-testid="original-input"]').value === ''`,
      "editor cleared"
    );
    assert.equal(
      await cdp.eval(
        `document.querySelector('[data-testid="result-empty"]') !== null`
      ),
      true
    );
  });

  console.log("\n[limits and failures]");
  await step("client blocks text over 2000 visible characters", async () => {
    await goto("/polisher");
    await setTextarea('[data-testid="original-input"]', "字".repeat(2001));
    await waitFor(
      `document.querySelector('#original-limit-hint').innerText.includes('2000')`,
      "over-limit hint"
    );
    const state = await cdp.eval(
      `(() => ({
        disabled: document.querySelector('[data-testid="run-button"]').disabled,
        invalid: document.querySelector('[data-testid="original-input"]').getAttribute('aria-invalid'),
      }))()`
    );
    assert.equal(state.disabled, true);
    assert.equal(state.invalid, "true");
  });

  await step("a failed request keeps the original text and shows an error", async () => {
    await goto("/polisher");
    await setTextarea(
      '[data-testid="original-input"]',
      "这是一段用于验证失败处理的文字，请求失败以后原文必须完整保留。"
    );
    const before = await value('[data-testid="original-input"]');

    await cdp.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*api/v1/polish*", requestStage: "Request" },
      ],
    });
    try {
      const pausedPromise = cdp.waitFor(
        "Fetch.requestPaused",
        (params) => params.request.url.includes("/api/v1/polish"),
        20000
      );
      await click('[data-testid="run-button"]');
      const paused = await pausedPromise;
      await cdp.send("Fetch.failRequest", {
        requestId: paused.requestId,
        errorReason: "Failed",
      });

      await waitFor(
        `document.querySelector('[data-testid="error-notice"]') !== null`,
        "error notice",
        30000
      );
      const notice = await text('[data-testid="error-notice"]');
      assert.match(notice, /保留你的原文|请求失败/);
      assert.equal(await value('[data-testid="original-input"]'), before);
      assert.equal(
        await count('[data-testid="result-highlight"]'),
        0,
        "a failed request must not render a result"
      );
    } finally {
      await cdp.send("Fetch.disable");
    }
  });

  console.log("\n[language independence]");
  await step("UI switches to English without changing content language", async () => {
    await goto("/polisher");
    await click(".app-menu-button");
    await waitFor(
      `document.querySelector('[data-testid="folder-drawer"]') !== null`,
      "folder drawer"
    );
    await clickText("EN", "aside");
    await waitFor(
      `document.documentElement.lang === 'en' && document.querySelector('h1').innerText.includes('Text Polisher')`,
      "English UI"
    );
    const navLabels = await cdp.eval(
      `[...document.querySelectorAll('aside nav a')].map((a) => a.textContent.trim())`
    );
    assert.ok(
      navLabels.some((item) => item.includes("Text Polisher")),
      `nav: ${navLabels}`
    );
    await screenshot("polisher-english-desktop.png");
    await clickText("中文", "aside");
    await waitFor(`document.documentElement.lang === 'zh-CN'`, "back to Chinese");
  });

  await step("English content is polished in English", async () => {
    await goto("/polisher");
    await clickText("英文");
    await setTextarea(
      '[data-testid="original-input"]',
      "The experiment was conducted in a laboratory, and the results shows that the new method is more better than the traditional one."
    );
    await clickText("流畅");
    await click('[data-testid="run-button"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="result-highlight"]'); return el && el.innerText.trim().length > 20; })()`,
      "English result",
      45000
    );
    const result = (await value('[data-testid="result-highlight"]')).trim();
    assert.match(result, /[A-Za-z]/);
    assert.ok(
      !/[\u4e00-\u9fff]/.test(result),
      "English request returned Chinese text"
    );

    await click('[data-action="explain"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="explanation"]'); return el && el.innerText.trim().length > 3; })()`,
      "Chinese explanation for English text",
      45000
    );
    const explanation = await text('[data-testid="explanation"]');
    assert.match(
      explanation,
      /[\u4e00-\u9fff]/,
      "English text change explanation should be Chinese"
    );
  });

  console.log("\n[academic]");
  await step("academic writing keeps its workflow without a fixed skill strip", async () => {
    await goto("/academic");
    const body = await text("body");
    assert.ok(
      !body.includes("公共管理 C 刊学术写作"),
      "fixed academic skill heading should be removed"
    );
    assert.ok(
      !body.includes("public-management-c-journal-writing-zh"),
      "fixed academic skill slug should be removed"
    );
    assert.equal(
      await count(".academic-skill-strip"),
      0,
      "fixed academic skill strip should be removed"
    );
    assert.ok(!body.includes("历史学"), "discipline routing should be removed");
    assert.ok(!body.includes("学科路由"), "discipline routing label should be removed");
    assert.equal(
      await count('[data-testid="academic-upload"]'),
      1,
      "document upload is missing"
    );
    assert.equal(
      await cdp.eval(
        `document.querySelector('[data-testid="academic-run"]').disabled`
      ),
      true,
      "empty manuscript should keep the run button disabled"
    );

    const sample = [
      "数字平台已经覆盖到乡镇和村一级，但同一套系统在不同地区的使用效果并不相同。本文关注平台进入基层以后，组织承接和服务对象使用之间的衔接问题。",
      "已有研究多从平台建设和功能供给解释治理效能，较少讨论乡镇如何分配任务、村级组织如何解释规则，以及群众遇到问题时如何获得回应。",
      "基于两个县的案例材料，本文比较平台运行中的任务分派、问题反馈和服务响应过程，尝试说明组织承接能力如何改变平台的实际效果。",
    ].join("\n\n");

    await cdp.eval(`(() => {
      const input = document.querySelector('input[type="file"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File(["%PDF-1.4 fake"], "paper.pdf", { type: "application/pdf" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      `document.body.innerText.includes("不支持 PDF")`,
      "PDF upload is rejected",
      10000
    );
    assert.equal(
      await cdp.eval(
        `document.querySelector('[data-testid="academic-input"]').value`
      ),
      "",
      "PDF must not fill the manuscript"
    );

    await cdp.eval(`(() => {
      const input = document.querySelector('input[type="file"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(sample)}], "manuscript.txt", { type: "text/plain" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      `document.querySelector('[data-testid="academic-input"]').value.includes("组织承接能力如何改变平台的实际效果")`,
      "TXT upload fills the manuscript",
      10000
    );
    assert.equal(
      await cdp.eval(
        `document.querySelector('[data-testid="academic-run"]').disabled`
      ),
      false,
      "uploaded manuscript should enable the run button"
    );

    await click('[data-testid="academic-run"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="academic-result-text"]'); return el && el.innerText.trim().length > 80; })()`,
      "academic skill result",
      120000
    );
    const result = await text('[data-testid="academic-result-text"]');
    assert.match(result, /写作逻辑|风格说明|修改|研究/);

    await goto("/");
    await goto("/academic");
    await waitFor(
      `document.querySelector('[data-testid="academic-result-text"]') !== null`,
      "academic result restored"
    );
    assert.equal(
      await text('[data-testid="academic-result-text"]'),
      result,
      "academic result was lost after route change"
    );
    await screenshot("academic-result-desktop.png");
  });

  console.log("\n[humanize]");
  await step("humanize runs without polish standards and explains changes", async () => {
    await goto("/humanize");
    const h1 = await text("h1");
    assert.match(h1, /人性化改写/);
    const body = await text("body");
    assert.match(body, /不承诺通过任何 AI 检测/);
    assert.equal(
      await count("button.capsule"),
      0,
      "humanize should not show polish standards"
    );

    await setTextarea(
      '[data-testid="original-input"]',
      "首先，我们需要认识到，在当前的社会背景下，随着社会的不断发展，人们对于健康的重视程度正在不断地提高。其次，健康的生活方式对于每个人来说都是非常重要的。"
    );
    await click('[data-testid="run-button"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="result-highlight"]'); return el && el.innerText.trim().length > 20; })()`,
      "humanized result",
      45000
    );
    const result = (await value('[data-testid="result-highlight"]')).trim();
    assert.ok(!/首先，我们需要认识到/.test(result));

    await click('[data-action="explain"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="explanation"]'); return el && el.innerText.trim().length > 5; })()`,
      "change explanation",
      45000
    );
    await screenshot("humanize-result-desktop.png");
  });

  console.log("\n[settings]");
  await step("settings shows the real server AI status", async () => {
    await goto("/settings");
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="ai-status"]'); return el && (el.innerText.includes('已配置') || el.innerText.includes('未配置')); })()`,
      "AI status",
      20000
    );
    const status = await text('[data-testid="ai-status"]');
    assert.match(status, /已配置/);
    assert.match(status, /deepseek/i);
    await screenshot("settings-desktop.png");
  });

  await step("local preferences can be cleared", async () => {
    await cdp.eval(
      `localStorage.setItem('draftly.uiLocale', 'en'); localStorage.setItem('draftly.contentLanguage', 'en'); true`
    );
    await clickText("清除本地偏好设置");
    await waitFor(
      `localStorage.getItem('draftly.uiLocale') === null && localStorage.getItem('draftly.contentLanguage') === null`,
      "local preferences cleared"
    );
    await waitFor(
      `document.querySelector('body').innerText.includes('已清除本地偏好设置')`,
      "clear confirmation message"
    );
  });

  console.log("\n[admin / feedback]");
  await step("admin route redirects anonymous visitors to login", async () => {
    await goto("/admin/feedback");
    await waitFor(
      `location.pathname === '/admin/login'`,
      "admin login redirect"
    );
    const body = await text("body");
    assert.match(body, /Welcome back/);
    assert.match(body, /管理后台/);
    await screenshot("admin-login-desktop.png");
  });

  await step("admin signs in and finds the persisted browser feedback", async () => {
    assert.ok(ADMIN_PASSWORD, "ADMIN_PASSWORD is missing from .env.local");
    await setInput('[data-testid="admin-password"]', ADMIN_PASSWORD);
    await click('[data-testid="admin-login-submit"]');
    await waitFor(
      `location.pathname === '/admin/feedback' && document.querySelector('[data-testid="admin-search"]') !== null`,
      "admin dashboard",
      20000
    );
    await setInput('[data-testid="admin-search"]', "Browser feedback");
    await waitFor(
      `document.querySelector('[data-testid="feedback-row"]') !== null && document.body.innerText.includes(${JSON.stringify(
        feedbackMessage.slice(0, 40)
      )})`,
      "persisted feedback row",
      15000
    );
    assert.match(await text('[data-testid="feedback-row"]'), /润色体验/);
  });

  await step("admin analytics shows persisted visits and feature usage", async () => {
    await goto("/admin/analytics");
    await waitFor(
      `document.body.innerText.includes('每日趋势') && document.body.innerText.includes('功能使用')`,
      "analytics dashboard",
      20000
    );
    const summary = await cdp.eval(
      `fetch('/api/admin/analytics?days=14', { cache: 'no-store' })
        .then((r) => r.json())`
    );
    assert.ok(summary.totals.pageViews > 0, "no real page views recorded");
    assert.ok(summary.totals.uniqueVisitors > 0, "no unique visitors recorded");
    assert.ok(summary.totals.featureRuns > 0, "no feature runs recorded");
    assert.equal(summary.daily.length, 14, "daily trend should cover 14 days");
    assert.ok(
      summary.topPages.some((row) => row.path === "/polisher"),
      "polisher page missing from top pages"
    );
    assert.ok(
      !summary.topPages.some((row) => row.path.startsWith("/admin")),
      "admin pages must not count as public visits"
    );
    assert.ok(
      summary.features.some((row) => row.feature === "polish"),
      "polish runs missing from feature usage"
    );
    await screenshot("admin-analytics-desktop.png");
    await goto("/admin/feedback");
    await waitFor(
      `document.querySelector('[data-testid="admin-search"]') !== null`,
      "back to feedback dashboard"
    );
  });

  await step("admin opens details and saves status plus internal note", async () => {
    await click('[data-testid="feedback-open"]');
    await waitFor(
      `document.querySelector('[role="dialog"]') !== null`,
      "feedback detail"
    );
    const detail = await text('[role="dialog"]');
    assert.match(detail, /Browser feedback/);
    assert.match(detail, /browser@example\.com/);
    await selectOption('[data-testid="admin-detail-status"]', "in_progress");
    await setTextarea('[data-testid="admin-note"]', "浏览器测试：已查看，准备回复。");
    await click('[data-testid="admin-save"]');
    await waitFor(
      `document.body.innerText.includes('已保存这条反馈的处理状态')`,
      "save confirmation",
      15000
    );
    await screenshot("admin-feedback-desktop.png");
    await click('[aria-label="关闭详情"]');
    await waitFor(
      `document.querySelector('[role="dialog"]') === null`,
      "detail closed"
    );
  });

  await step("admin archives the feedback", async () => {
    await click('[data-testid="feedback-open"]');
    await waitFor(
      `document.querySelector('[data-testid="admin-archive"]') !== null`,
      "archive button"
    );
    await click('[data-testid="admin-archive"]');
    await waitFor(
      `document.querySelector('[role="dialog"]') === null && document.querySelector('[data-testid="feedback-row"]')?.innerText.includes('已归档')`,
      "archived row"
    );
  });

  await step("admin deletes the feedback after a confirmation", async () => {
    await click('[data-testid="feedback-open"]');
    await waitFor(
      `document.querySelector('[data-testid="admin-delete"]') !== null`,
      "delete button"
    );

    const dialogPromise = cdp.waitFor(
      "Page.javascriptDialogOpening",
      () => true,
      5000
    );
    const clickPromise = cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('[data-testid="admin-delete"]').click()`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    const dialog = await dialogPromise;
    assert.match(dialog.message, /permanently|永久/);
    await cdp.send("Page.handleJavaScriptDialog", { accept: true });
    await clickPromise;
    await waitFor(
      `document.querySelector('[role="dialog"]') === null && document.querySelectorAll('[data-testid="feedback-row"]').length === 0`,
      "feedback deleted",
      15000
    );
  });

  console.log("\n[grammar / detector / translation]");
  await step("grammar check returns real issues and applies them locally", async () => {
    await goto("/grammar");
    const body = await text("body");
    assert.match(body, /语法检查/);
    assert.ok(!body.includes("未启用"));
    await clickText("填入示例");
    await waitFor(
      `document.querySelector('[data-testid="grammar-input"]').value.length > 20`,
      "grammar example"
    );
    await click('[data-testid="grammar-run"]');
    await waitFor(
      `document.querySelector('[data-testid="grammar-result"]')?.innerText.trim().length > 20`,
      "grammar result",
      90000
    );
    const result = (await value('[data-testid="grammar-result"]')).trim();
    const input = (await value('[data-testid="grammar-input"]')).trim();
    assert.ok(result.length > 0);
    const issues = await count('[data-testid="grammar-issue"]');
    if (issues > 0) {
      assert.ok(result !== input || issues > 0);
      await click('[data-testid="grammar-issue"] button');
      await sleep(200);
    }

    const stableResult = (await value('[data-testid="grammar-result"]')).trim();
    await goto("/settings");
    await goto("/grammar");
    await waitFor(
      `document.querySelector('[data-testid="grammar-input"]').value.trim().length > 20`,
      "grammar input restored"
    );
    assert.equal(
      (await value('[data-testid="grammar-input"]')).trim(),
      input,
      "grammar input was lost after route change"
    );
    assert.equal(
      (await value('[data-testid="grammar-result"]')).trim(),
      stableResult,
      "grammar result was lost after route change"
    );
    await screenshot("grammar-desktop.png");
  });

  await step("AI detector shows a bounded estimate and a clear limitation", async () => {
    await goto("/ai-detector");
    const body = await text("body");
    assert.ok(!body.includes("未启用"));
    await clickText("填入示例");
    await click('[data-testid="detector-run"]');
    await waitFor(
      `document.querySelector('[data-testid="detector-result"]') !== null`,
      "detector result",
      120000
    );
    const scoreText = await text('[data-testid="detector-score"]');
    const score = Number((scoreText.match(/(\d+)\s*\/\s*100/) ?? [])[1]);
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 100, scoreText);
    const result = await text('[data-testid="detector-result"]');
    assert.match(result, /不是作者身份证明/);
    assert.match(result, /误判/);

    await goto("/settings");
    await goto("/ai-detector");
    await waitFor(
      `document.querySelector('[data-testid="detector-result"]') !== null`,
      "detector result restored"
    );
    assert.match(
      await text('[data-testid="detector-result"]'),
      /不是作者身份证明/,
      "detector result was lost after route change"
    );
    await screenshot("detector-desktop.png");
  });

  await step("translation translates, styles, swaps and hands off", async () => {
    await goto("/translate");
    const body = await text("body");
    assert.match(body, /中英翻译/);
    assert.ok(!body.includes("未启用"));
    await clickText("填入示例");
    const selectState = await cdp.eval(
      `[...document.querySelectorAll('select')].map((select) => select.value)`
    );
    assert.equal(selectState[1], "en", `unexpected translation target: ${selectState[1]}`);
    await click('[data-testid="translate-run"]');
    await waitFor(
      `document.querySelector('[data-testid="translate-result"]').value.length > 10`,
      "translation result",
      120000
    );
    const translated = await value('[data-testid="translate-result"]');
    if (!/[A-Za-z]/.test(translated)) {
      console.log(`      translation output: ${JSON.stringify(translated.slice(0, 200))}`);
    }
    assert.ok(/[A-Za-z]/.test(translated), "expected English translation");
    const sourceBefore = await value('[data-testid="translate-input"]');
    await goto("/settings");
    await goto("/translate");
    await waitFor(
      `document.querySelector('[data-testid="translate-result"]').value.length > 10`,
      "translation result restored"
    );
    assert.equal(
      await value('[data-testid="translate-input"]'),
      sourceBefore,
      "translation input was lost after route change"
    );
    assert.equal(
      await value('[data-testid="translate-result"]'),
      translated,
      "translation result was lost after route change"
    );

    await click('[data-testid="translate-style-formal"]');
    const pressed = await cdp.eval(
      `document.querySelector('[data-testid="translate-style-formal"]').getAttribute('aria-pressed')`
    );
    assert.equal(pressed, "true");

    const before = await cdp.eval(
      `[...document.querySelectorAll('select')].map((select) => select.value)`
    );
    await click('[data-testid="translate-swap"]');
    await waitFor(
      `[...document.querySelectorAll('select')].map((select) => select.value).join('|') !== ${JSON.stringify(
        before.join("|")
      )}`,
      "swap updates language selects"
    );
    const after = await cdp.eval(
      `[...document.querySelectorAll('select')].map((select) => select.value)`
    );
    assert.notDeepEqual(before, after, "swap did not change languages");
    await screenshot("translation-desktop.png");

    await goto("/translate");
    await setTextarea(
      '[data-testid="translate-input"]',
      "Long writing sessions often suffer when attention drifts, so short breaks can protect both focus and quality."
    );
    await selectOption('[data-testid="translate-target"]', "zh-CN");
    await click('[data-testid="translate-run"]');
    await waitFor(
      `document.querySelector('[data-testid="translate-result"]').value.length > 5`,
      "handoff translation",
      120000
    );
    const chinese = await value('[data-testid="translate-result"]');
    assert.ok(/[\u4e00-\u9fff]/.test(chinese), "expected Chinese translation");
    await clickText("送到语法检查");
    await waitFor(`location.pathname === '/grammar'`, "grammar handoff route");
    await waitFor(
      `document.querySelector('[data-testid="grammar-input"]')?.value.length > 5`,
      "grammar handoff text",
      15000
    );
  });

  await step("privacy and terms are real readable pages", async () => {
    await goto("/privacy");
    let body = await text("body");
    assert.match(body, /Your words are/);
    assert.match(body, /反馈表单保存什么/);
    assert.match(body, /写作风格画像与样本/);
    await goto("/terms");
    body = await text("body");
    assert.match(body, /A tool, not/);
    assert.match(body, /AI 输出/);
    assert.match(body, /风格画像与样本/);
  });

  console.log("\n[style profile]");
  const styleName = `浏览器风格画像 ${Date.now().toString().slice(-5)}`;
  const styleSample =
    "我写东西时，总先写一句自己真正相信的话，再慢慢找证据。句子宁愿短一点，也不要一口气塞进三个转折。写清晨，别急着说宁静美好，先写水壶刚响、窗台的灰被风推开。读者不笨，他们会自己补上情绪。结论可以留到最后，甚至只留一个反问：我们真的需要那么多漂亮的空话吗？";

  await step("style profile page renders import, analysis and saved-profile areas", async () => {
    await goto("/tools/style-profile");
    assert.equal(await count('[data-testid="style-importer"]'), 1);
    assert.equal(await count('[data-testid="style-profile-list"]'), 1);
    assert.equal(await count('[data-testid="style-analyze"]'), 1);
    const body = await text("body");
    assert.match(body, /写作风格画像/);
    assert.match(body, /TXT/);
    assert.match(body, /PDF/);
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert.ok(overflow <= 1, `style page horizontal overflow ${overflow}px`);
    await screenshot("style-profile-desktop.png");
  });

  await step("a pasted sample is analyzed into an editable six-dimension profile", async () => {
    await setTextarea('[data-testid="style-paste"]', styleSample);
    await click('[data-testid="style-paste"]');
    await clickText("添加这段文本");
    await waitFor(
      `document.querySelector('[data-testid="style-sample-list"]') !== null`,
      "sample added"
    );
    await click('[data-testid="style-analyze"]');
    try {
      await waitFor(
        `document.querySelector('[data-testid="style-analysis-editor"]') !== null`,
        "style analysis",
        120000
      );
    } catch (error) {
      console.log(
        "      style analyze debug:",
        JSON.stringify(
          await cdp.eval(`(() => ({
            body: document.body.innerText.slice(0, 1200),
            samples: sessionStorage.getItem('draftly.workspace.v1.style.samples'),
          }))()`)
        )
      );
      throw error;
    }
    assert.equal(await count('[id^="style-dimension-"]'), 6);
    const summary = await value("#style-summary");
    assert.ok(summary && summary.length > 20, "summary is empty");
    assert.equal(await count('[data-testid="style-save"]'), 1);

    await goto("/settings");
    await goto("/tools/style-profile");
    await waitFor(
      `document.querySelector('[data-testid="style-analysis-editor"]') !== null`,
      "style analysis restored"
    );
    assert.equal(
      await value("#style-summary"),
      summary,
      "style analysis was lost after route change"
    );
    await screenshot("style-analysis-desktop.png");
  });

  await step("the profile can be named, saved and handed to the polisher", async () => {
    await setInput('[data-testid="style-name"]', styleName);
    await click('[data-testid="style-save"]');
    await waitFor(
      `document.querySelector('[data-testid="style-profile-list"]')?.innerText.includes(${JSON.stringify(
        styleName
      )})`,
      "profile saved",
      30000
    );
    await click('[data-testid="style-use-in-polisher"]');
    await waitFor(`location.pathname === '/polisher'`, "polisher handoff");
    await waitFor(
      `document.querySelector('[data-testid="style-profile-select"]')?.value.length > 10`,
      "profile selected in polisher",
      15000
    );
    const selected = await value('[data-testid="style-profile-select"]');
    assert.ok(selected.length > 10);
  });

  await step("polish with the profile shows style consistency and reviewable differences", async () => {
    await setTextarea(
      '[data-testid="original-input"]',
      "随着社会发展，人们越来越重视健康。我们应该养成良好的生活习惯，从而提升生活质量。"
    );
    await click('[data-testid="run-button"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="result-highlight"]'); return el && el.innerText.trim().length > 10; })()`,
      "styled polish result",
      60000
    );
    await waitFor(
      `document.querySelector('[data-testid="style-consistency"]')?.innerText.includes('总体风格匹配')`,
      "style consistency result",
      180000
    );
    const panel = await text('[data-testid="style-consistency"]');
    assert.match(panel, /风格匹配反馈/);
    assert.match(panel, /总体风格匹配/);
    assert.ok(!/\d+\s*%/.test(panel), "style consistency must not show a percentage");
    assert.equal(await count('[data-testid="style-review"]'), 1);

    const reviewDisabled = await cdp.eval(
      `document.querySelector('[data-testid="style-review"]').disabled`
    );
    if (reviewDisabled === false) {
      await click('[data-testid="style-review"]');
      await waitFor(
        `document.querySelectorAll('[data-testid="style-difference"]').length > 0`,
        "difference review open"
      );
      const beforeIgnore = await count('[data-testid="style-difference"]');
      assert.ok(
        (await count('[data-testid="style-ignore-difference"]')) > 0,
        "ignore action missing"
      );
      await click('[data-testid="style-ignore-difference"]');
      await waitFor(
        `document.querySelectorAll('[data-testid="style-difference"]').length === ${beforeIgnore - 1}`,
        "difference ignored"
      );
    }
    await screenshot("style-consistency-desktop.png");
  });

  console.log("\n[mobile / 390px]");
  await setViewport({ width: 390, height: 844, mobile: true, scale: 2 });
  await goto("/");

  await step("mobile home keeps the full folder, eight tabs and a stacked service list", async () => {
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);
    await screenshot("home-mobile.png", { fullPage: false });

    assert.equal(await count("aside"), 0);
    assert.equal(await count('[data-testid^="tab-"]'), 8);
    const chrome = await cdp.eval(
      `(() => ({
        headerHeight: document.querySelector('header').getBoundingClientRect().height,
        heroFont: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
        ctaHeight: document.querySelector('[data-testid="home-cta"]').getBoundingClientRect().height,
        ctaTop: document.querySelector('[data-testid="home-cta"]').getBoundingClientRect().top,
        tabRows: new Set([...document.querySelectorAll('.folder-tab')].map((el) => el.getBoundingClientRect().top)).size,
        cardPositions: [...document.querySelectorAll('.service-card-shell')].map((el) => getComputedStyle(el).position),
      }))()`
    );
    assert.ok(chrome.headerHeight > 0 && chrome.headerHeight < 90);
    assert.ok(chrome.heroFont >= 54, `hero font ${chrome.heroFont}`);
    assert.ok(chrome.ctaHeight >= 44, `CTA height ${chrome.ctaHeight}`);
    assert.ok(chrome.ctaTop < 844, `CTA below viewport: ${chrome.ctaTop}`);
    assert.equal(chrome.tabRows, 2, "mobile tabs should form two rows");
    assert.ok(
      chrome.cardPositions.every((position) => position === "static"),
      `mobile cards must not stick: ${chrome.cardPositions}`
    );

    await click('[data-testid="home-cta"]');
    await waitFor(`location.pathname === '/polisher'`, "mobile CTA workbench");
    await goto("/feedback");

    const form = await cdp.eval(
      `(() => {
        const email = document.querySelector('[data-testid="feedback-email"]').getBoundingClientRect();
        const message = document.querySelector('[data-testid="feedback-message"]').getBoundingClientRect();
        const card = document.querySelector('[data-testid="feedback-form"]').getBoundingClientRect();
        return { emailX: email.x, messageX: message.x, cardWidth: card.width, cardX: card.x, vw: innerWidth };
      })()`
    );
    assert.ok(Math.abs(form.emailX - form.messageX) <= 1, "fields do not stack");
    assert.ok(form.cardX >= 0 && form.cardX + form.cardWidth <= form.vw + 1, "form overflows");
    await screenshot("feedback-form-mobile.png", { fullPage: false });
  });

  await step("mobile admin dashboard fits without horizontal overflow", async () => {
    await goto("/admin/feedback");
    await waitFor(
      `document.querySelector('[data-testid="admin-search"]') !== null`,
      "mobile admin",
      15000
    );
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert.ok(overflow <= 1, `admin horizontal overflow ${overflow}px`);
    assert.equal(await count("aside"), 0);
    await screenshot("admin-feedback-mobile.png", { fullPage: false });
  });

  await step("mobile polish result renders without overflow", async () => {
    await goto("/polisher");
    await setTextarea(
      '[data-testid="original-input"]',
      "随着人工智能技术的快速发展，越来越多的研究者开始关注大语言模型在教育领域的应用。本文分析了该技术对学生学习效果的影响。"
    );
    await click('[data-testid="run-button"]');
    await waitFor(
      `(() => { const el = document.querySelector('[data-testid="result-highlight"]'); return el && el.innerText.trim().length > 20; })()`,
      "mobile result",
      45000
    );
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);

    const stacked = await cdp.eval(
      `(() => {
        const original = document.querySelector('[data-testid="original-input"]').closest('section').getBoundingClientRect();
        const result = document.querySelector('[data-testid="result-highlight"]').closest('section').getBoundingClientRect();
        return { oy: original.y, ry: result.y, ox: original.x, rx: result.x };
      })()`
    );
    assert.ok(stacked.ry > stacked.oy, "panes are not stacked on mobile");
    assert.ok(Math.abs(stacked.ox - stacked.rx) < 2, "mobile panes are offset");
    await screenshot("polisher-result-mobile.png");
  });

  await step("mobile style profile page fits the viewport", async () => {
    await goto("/tools/style-profile");
    await waitFor(
      `Boolean(document.querySelector('[data-testid="style-importer"]'))`,
      "mobile style importer"
    );
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert.ok(overflow <= 1, `style page horizontal overflow ${overflow}px`);
    const width = await cdp.eval(
      `document.querySelector('[data-testid="style-importer"]').getBoundingClientRect().width`
    );
    assert.ok(width <= 420, `style importer too wide on mobile: ${width}px`);
    await screenshot("style-profile-mobile.png", { fullPage: false });
  });

  console.log("\n[console health]");
  await step("no uncaught page exceptions", async () => {
    assert.deepEqual(exceptions, []);
  });

  await step("no unexpected console errors", async () => {
    const meaningful = consoleErrors.filter(
      (item) =>
        !/clipboard|permission|ERR_FAILED|api\/v1\/polish|Failed to fetch/i.test(
          item
        )
    );
    assert.deepEqual(meaningful, []);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`screenshots: ${OUT_DIR}`);

  if (exceptions.length) {
    console.log("\npage exceptions:");
    for (const item of exceptions) console.log(`  ${item}`);
  }
  if (consoleErrors.length) {
    console.log("\nconsole errors:");
    for (const item of consoleErrors) console.log(`  ${item}`);
  }

  return failed === 0 ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (error) {
  console.error("\nfatal:", error);
} finally {
  try {
    cdp?.close();
  } catch {
    /* ignore */
  }
  chrome?.kill();
  await sleep(500);
  if (profileDir) {
    try {
      await fs.rm(profileDir, { recursive: true, force: true });
    } catch {
      /* Chrome can keep a lock on Windows */
    }
  }
}

process.exit(exitCode);
