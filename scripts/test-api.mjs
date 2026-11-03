import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const RUN_ID = Math.random().toString(36).slice(2, 8);
let clientCounter = 0;
function nextClientIp() {
  clientCounter += 1;
  return `198.51.${100 + (clientCounter % 40)}.${20 + (clientCounter % 200)}`;
}

let passed = 0;
let failed = 0;
const timings = [];

function ok(name) {
  passed += 1;
  console.log(`  ok  ${name}`);
}

function bad(name, error) {
  failed += 1;
  console.error(`FAIL  ${name}`);
  console.error(`      ${error instanceof Error ? error.message : error}`);
}

async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    ok(name);
  } catch (error) {
    bad(name, error);
  } finally {
    timings.push({ name, ms: Date.now() - started });
  }
}

async function request(path, options = {}) {
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "x-forwarded-for": options.clientIp ?? nextClientIp(),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: response.status,
    headers: response.headers,
    text,
    json,
    ms: Date.now() - started,
  };
}

function post(path, body, extra = {}) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extra.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...extra,
  });
}

function assertErrorEnvelope(result) {
  assert.equal(typeof result.json?.request_id, "string");
  assert.equal(typeof result.json?.error_code, "string");
  assert.equal(typeof result.json?.message, "string");
  assert.equal(typeof result.json?.retryable, "boolean");
  assert.ok(result.json.message.length > 0);
}

const zhText =
  "随着人工智能技术的快速发展，越来越多的研究者开始关注大语言模型在教育领域的应用。本文通过对相关文献的梳理，分析了该技术对学生学习效果的影响。";
const enText =
  "The experiment was conducted in a laboratory, and the results shows that the new method is more better than the traditional one.";

console.log(`\nDraftly API integration tests — ${BASE}`);
console.log(`isolated client key per request (run ${RUN_ID})\n`);

console.log("[service + routes]");
await test("GET /api/v1/health reports AI configuration", async () => {
  const result = await request("/api/v1/health");
  assert.equal(result.status, 200);
  assert.equal(result.json?.ok, true);
  assert.equal(result.json?.aiConfigured, true);
  assert.ok(result.json?.model);
  assert.equal(result.headers.get("cache-control"), "no-store, max-age=0");
});

await test("all routes render directly (200)", async () => {
  for (const path of [
    "/",
    "/polisher",
    "/humanize",
    "/grammar",
    "/ai-detector",
    "/translate",
    "/settings",
  ]) {
    const result = await request(path);
    assert.equal(result.status, 200, `${path} returned ${result.status}`);
    assert.ok(result.text.includes("Draftly"), `${path} missing brand`);
  }
});

await test("home page uses the split hero copy and five tools", async () => {
  const result = await request("/");
  assert.ok(result.text.includes("AI WRITING STUDIO"));
  assert.ok(result.text.includes("DRAFTLY"));
  assert.ok(result.text.includes("Polish your draft in seconds"));
  assert.ok(result.text.includes("Make every sentence sound more like you"));
  assert.ok(result.text.includes("Meet your words"));
  assert.ok(result.text.includes("遇见更好的表达"));
  assert.ok(result.text.includes("一元硬币"));
  assert.ok(result.text.includes("文本润色"));
  assert.ok(result.text.includes("中英翻译"));
  assert.ok(result.text.includes("语法检查"));
  assert.ok(result.text.includes("AI 文本检测"));
  assert.ok(!result.text.includes("中文优先"));
});

await test("function pages share the new footer line", async () => {
  for (const path of ["/polisher", "/humanize", "/translate", "/grammar", "/ai-detector"]) {
    const result = await request(path);
    assert.equal(result.status, 200, `${path} returned ${result.status}`);
    assert.ok(
      result.text.includes("让每一句话，更接近你想表达的样子。"),
      `${path} is missing the shared footer line`
    );
  }
});

await test("unknown route returns 404", async () => {
  const result = await request("/definitely-not-a-page");
  assert.equal(result.status, 404);
});

await test("browser HTML and JS bundles contain no AI key", async () => {
  const home = await request("/");
  assert.ok(!home.text.includes("sk-"));
  assert.ok(!home.text.includes("AI_API_KEY"));

  const scripts = [...home.text.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(
    (match) => match[1]
  );
  assert.ok(scripts.length > 0, "no script tags found");
  for (const src of scripts) {
    const asset = await request(src);
    assert.equal(asset.status, 200, `${src} returned ${asset.status}`);
    assert.ok(!asset.text.includes("sk-"), `${src} leaks a key-like string`);
    assert.ok(!asset.text.includes("AI_API_KEY"), `${src} leaks env name`);
  }
});

console.log("\n[real AI calls]");
let polishedZh = "";

await test("Chinese academic polish returns real AI text", async () => {
  const result = await post("/api/v1/polish", {
    text: zhText,
    standard: "academic",
    intensity: "moderate",
    contentLanguage: "auto",
    scene: "essay",
    sourceVersion: `test-${RUN_ID}-zh`,
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.json?.sourceVersion, `test-${RUN_ID}-zh`);
  assert.equal(result.json?.detectedLanguage, "zh-CN");
  assert.ok(typeof result.json?.model === "string");
  assert.ok(result.json.text.length > 10);
  assert.notEqual(result.json.text, zhText);
  assert.ok(/[\u4e00-\u9fff]/.test(result.json.text));
  polishedZh = result.json.text;
});

await test("English fluent polish returns real AI text", async () => {
  const result = await post("/api/v1/polish", {
    text: enText,
    standard: "fluent",
    intensity: "moderate",
    contentLanguage: "en",
    sourceVersion: `test-${RUN_ID}-en`,
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.json?.detectedLanguage, "en");
  assert.notEqual(result.json.text, enText);
  assert.ok(/[A-Za-z]/.test(result.json.text));
});

await test("Chinese humanize returns real AI text", async () => {
  const result = await post("/api/v1/humanize", {
    text: "首先，我们需要认识到，在当前的社会背景下，随着社会的不断发展，人们对于健康的重视程度正在不断地提高。其次，健康的生活方式对于每个人来说都是非常重要的。",
    intensity: "moderate",
    contentLanguage: "auto",
    sourceVersion: `test-${RUN_ID}-humanize`,
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.json?.detectedLanguage, "zh-CN");
  assert.ok(result.json.text.length > 10);
});

await test("grammar check returns validated spans and corrected text", async () => {
  const result = await post("/api/v1/grammar/check", {
    text: enText,
    contentLanguage: "en",
    sourceVersion: `test-${RUN_ID}-grammar`,
  });
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.json?.issues));
  assert.equal(typeof result.json?.correctedText, "string");
  assert.equal(result.json?.detectedLanguage, "en");
  for (const issue of result.json.issues) {
    assert.equal(typeof issue.start, "number");
    assert.equal(typeof issue.end, "number");
    assert.ok(issue.start >= 0);
    assert.ok(issue.end > issue.start);
    assert.equal(
      enText.slice(issue.start, issue.end),
      issue.original,
      "issue offsets must match the source"
    );
    assert.ok(issue.message.length > 0);
  }
});

await test("long grammar passage returns issues instead of an empty AI response", async () => {
  const longText =
    "The experiment was conducted in a laboratory, and the results shows that the new method is more better than the traditional one. Although the sample size were small, the findings suggests that the approach may have potential for future research and applications in real-world settings.".repeat(
      3
    );
  const result = await post("/api/v1/grammar/check", {
    text: longText,
    contentLanguage: "en",
    sourceVersion: `test-${RUN_ID}-grammar-long`,
  });
  assert.equal(result.status, 200, result.text);
  assert.ok(
    result.json.issues.length > 0,
    "expected grammar issues for a long erroneous passage"
  );
  assert.notEqual(result.json.correctedText, longText);
  for (const issue of result.json.issues) {
    assert.equal(longText.slice(issue.start, issue.end), issue.original);
  }
});

await test("AI text detector returns a bounded estimate and disclaimer", async () => {
  const result = await post("/api/v1/detector/analyze", {
    text: "在当今快速发展的数字化时代，人工智能技术正以前所未有的速度改变着我们的生活。首先，它提升了工作效率；其次，它拓展了信息获取的边界；最后，它也带来了新的挑战。综上所述，我们应当以开放而审慎的态度拥抱这一变化。",
    contentLanguage: "zh-CN",
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(typeof result.json?.score, "number");
  assert.ok(result.json.score >= 0 && result.json.score <= 100);
  assert.ok(["human", "uncertain", "ai"].includes(result.json.band));
  assert.ok(["low", "medium", "high"].includes(result.json.confidence));
  assert.ok(Array.isArray(result.json.signals));
  assert.match(result.json.disclaimer, /作者身份/);
  assert.match(result.json.disclaimer, /误判|不是/);
});

await test("translation returns real English with style metadata", async () => {
  const result = await post("/api/v1/translate", {
    text: "这家公司正在重新设计客户支持流程，希望在不增加人手的情况下，把响应时间缩短一半。",
    sourceLanguage: "auto",
    targetLanguage: "en",
    style: "natural",
    sourceVersion: `test-${RUN_ID}-translate`,
  });
  assert.equal(result.status, 200, result.text);
  assert.ok(result.json.text.length > 10);
  assert.ok(/[A-Za-z]/.test(result.json.text));
  assert.equal(result.json?.detectedLanguage, "zh-CN");
  assert.equal(result.json?.targetLanguage, "en");
  assert.equal(result.json?.style, "natural");
});

await test("word suggestions are contextual and bounded", async () => {
  const result = await post("/api/v1/word-suggestions", {
    text: "I believe this idea is valuable and could make a real difference.",
    originalText: "I think this idea is very good and can help a lot.",
    selectedText: "valuable",
    beforeContext: "I believe this idea is ",
    afterContext: " and could make a real difference.",
    contentLanguage: "en",
    style: "fluent",
  });
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.json?.suggestions));
  assert.ok(result.json.suggestions.length <= 5);
  for (const suggestion of result.json.suggestions) {
    assert.equal(typeof suggestion, "string");
    assert.ok(suggestion.trim().length > 0);
    assert.notEqual(suggestion.trim().toLowerCase(), "valuable");
  }
});

await test("academic polish keeps numbers and citations", async () => {
  const source =
    "已有研究表明，该方法在 2023 年的实验中使准确率提升了 12.5%（Zhang et al., 2023）。";
  const result = await post("/api/v1/polish", {
    text: source,
    standard: "academic",
    intensity: "light",
    contentLanguage: "zh-CN",
    sourceVersion: `test-${RUN_ID}-numbers`,
  });
  assert.equal(result.status, 200, result.text);
  assert.match(result.json.text, /2023/);
  assert.match(result.json.text, /12\.5/);
  assert.match(result.json.text, /Zhang/);
});

await test("alternatives returns 1–5 strings", async () => {
  const result = await post("/api/v1/alternatives", {
    originalSentence: zhText,
    currentSentence: polishedZh || zhText,
    contentLanguage: "zh-CN",
  });
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.json?.alternatives));
  assert.ok(result.json.alternatives.length >= 1);
  assert.ok(result.json.alternatives.length <= 5);
  for (const item of result.json.alternatives) {
    assert.equal(typeof item, "string");
    assert.ok(item.trim().length > 0);
  }
});

await test("explain-change returns an explanation", async () => {
  const result = await post("/api/v1/explain-change", {
    originalSentence: zhText.split("。")[0] + "。",
    revisedSentence: (polishedZh || zhText).split("。")[0] + "。",
    contentLanguage: "zh-CN",
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(typeof result.json?.explanation, "string");
  assert.ok(result.json.explanation.length > 3);
});

await test("English explanation is returned in Chinese", async () => {
  const result = await post("/api/v1/explain-change", {
    originalSentence: "The results shows that the new method is more better.",
    revisedSentence: "The results show that the new method is better.",
    contentLanguage: "en",
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(typeof result.json?.explanation, "string");
  assert.match(
    result.json.explanation,
    /[\u4e00-\u9fff]/,
    "English explanation should contain Chinese characters"
  );
});

console.log("\n[validation and error envelope]");

const basePolish = {
  text: zhText,
  standard: "standard",
  intensity: "moderate",
  contentLanguage: "auto",
  sourceVersion: `test-${RUN_ID}-valid`,
};

await test("empty text → EMPTY_TEXT 400", async () => {
  const result = await post("/api/v1/polish", { ...basePolish, text: "   " });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "EMPTY_TEXT");
  assertErrorEnvelope(result);
});

await test("1001 visible chars → TEXT_TOO_LONG 400", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    text: "字".repeat(1001),
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "TEXT_TOO_LONG");
  assert.match(result.json.message, /1000/);
});

await test("exactly 1000 chars passes length validation", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    text: "字".repeat(1000),
    standard: "not-a-standard",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_STANDARD");
});

await test("invalid standard → INVALID_STANDARD", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    standard: "poetic",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_STANDARD");
});

await test("invalid intensity → INVALID_INTENSITY", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    intensity: "extreme",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_INTENSITY");
});

await test("invalid content language → INVALID_LANGUAGE", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    contentLanguage: "fr",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_LANGUAGE");
});

await test("missing sourceVersion → INVALID_SOURCE_VERSION", async () => {
  const { sourceVersion, ...withoutVersion } = basePolish;
  void sourceVersion;
  const result = await post("/api/v1/polish", withoutVersion);
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_SOURCE_VERSION");
});

await test("malformed JSON → INVALID_JSON", async () => {
  const result = await post("/api/v1/polish", "{not-json", {
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_JSON");
  assertErrorEnvelope(result);
});

await test("oversized body → PAYLOAD_TOO_LARGE 413", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    text: "字".repeat(40000),
  });
  assert.equal(result.status, 413);
  assert.equal(result.json?.error_code, "PAYLOAD_TOO_LARGE");
  assertErrorEnvelope(result);
});

await test("JSON array body → INVALID_BODY", async () => {
  const result = await post("/api/v1/polish", [1, 2, 3]);
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_BODY");
});

await test("unknown scene → INVALID_SCENE", async () => {
  const result = await post("/api/v1/polish", {
    ...basePolish,
    scene: "novel",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_SCENE");
});

await test("grammar empty text → EMPTY_TEXT", async () => {
  const result = await post("/api/v1/grammar/check", {
    text: " ",
    contentLanguage: "auto",
    sourceVersion: "v1",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "EMPTY_TEXT");
});

await test("detector empty text → EMPTY_TEXT", async () => {
  const result = await post("/api/v1/detector/analyze", {
    text: "",
    contentLanguage: "auto",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "EMPTY_TEXT");
});

await test("translation same source and target → INVALID_LANGUAGE_PAIR", async () => {
  const result = await post("/api/v1/translate", {
    text: "测试文本",
    sourceLanguage: "zh-CN",
    targetLanguage: "zh-CN",
    style: "natural",
    sourceVersion: "v1",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_LANGUAGE_PAIR");
});

await test("translation invalid style → INVALID_TRANSLATION_STYLE", async () => {
  const result = await post("/api/v1/translate", {
    text: "测试文本",
    sourceLanguage: "zh-CN",
    targetLanguage: "en",
    style: "poetic",
    sourceVersion: "v1",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_TRANSLATION_STYLE");
});

await test("word suggestions missing selection → INVALID_TEXT", async () => {
  const result = await post("/api/v1/word-suggestions", {
    text: "A complete sentence.",
    contentLanguage: "en",
    style: "fluent",
  });
  assert.equal(result.status, 400);
  assert.equal(result.json?.error_code, "INVALID_TEXT");
});

console.log("\n[reserved endpoints are explicit 501s]");
for (const path of [
  "/api/v1/documents/extract",
  "/api/v1/documents/export",
]) {
  await test(`${path} → 501 FEATURE_NOT_ENABLED`, async () => {
    const result = await post(path, {});
    assert.equal(result.status, 501);
    assert.equal(result.json?.error_code, "FEATURE_NOT_ENABLED");
    assertErrorEnvelope(result);
  });
}

console.log("\n[rate limiting]");
await test("21st request within a minute → 429 RATE_LIMITED", async () => {
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
  let limited = null;
  for (let i = 0; i < 21; i += 1) {
    const result = await post(
      "/api/v1/humanize",
      {},
      { clientIp: ip }
    );
    if (result.status === 429) {
      limited = result;
      break;
    }
    assert.equal(result.status, 400, `request ${i + 1} was ${result.status}`);
  }
  assert.ok(limited, "expected a 429 within 21 requests");
  assert.equal(limited.json?.error_code, "RATE_LIMITED");
  assert.equal(limited.json?.retryable, true);
});

const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 5);
console.log("\nslowest calls:");
for (const item of slowest) {
  console.log(`  ${String(item.ms).padStart(6)} ms  ${item.name}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);