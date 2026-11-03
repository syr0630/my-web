import assert from "node:assert/strict";
import { countVisibleChars, truncateToVisibleChars } from "../src/lib/text/char-count.ts";
import { detectLanguage, isLanguageReliable } from "../src/lib/language/detect.ts";
import {
  buildSentencePairs,
  computeDiff,
  splitSentences,
} from "../src/lib/diff/text-diff.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

console.log("\n[visible character counting]");
test("counts Chinese characters", () => {
  assert.equal(countVisibleChars("你好"), 2);
});
test("ignores CR but counts LF", () => {
  assert.equal(countVisibleChars("a\r\nb"), 3);
});
test("counts an emoji as one code point", () => {
  assert.equal(countVisibleChars("😀"), 1);
});
test("truncates by code point, not UTF-16 unit", () => {
  assert.equal(truncateToVisibleChars("😀😀😀", 2), "😀😀");
});
test("1000-character rule", () => {
  assert.equal(countVisibleChars("字".repeat(1000)), 1000);
});

console.log("\n[language detection]");
test("Chinese text", () => {
  assert.equal(detectLanguage("这是一个用于测试的中文句子。"), "zh-CN");
});
test("English text", () => {
  assert.equal(detectLanguage("This is a plain English sentence for testing."), "en");
});
test("mixed text", () => {
  assert.equal(detectLanguage("我用 Next.js 做了这个项目，感觉还不错。"), "mixed");
});
test("too-short text is not reliable", () => {
  assert.equal(isLanguageReliable("a"), false);
});
test("long Chinese text is reliable", () => {
  assert.equal(isLanguageReliable("这是一个用于测试的中文句子，长度足够。"), true);
});

console.log("\n[sentence splitting]");
test("Chinese punctuation", () => {
  const sentences = splitSentences("今天天气很好。我们去公园吧！");
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].text, "今天天气很好。");
});
test("English punctuation", () => {
  const sentences = splitSentences("Hello world. This is a test!");
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].text, "Hello world.");
});
test("mixed Chinese / English", () => {
  const sentences = splitSentences("我用 Next.js 做了个项目。It works well!");
  assert.equal(sentences.length, 2);
});
test("decimals are not sentence boundaries", () => {
  const sentences = splitSentences("Pi is 3.14 and that is fine.");
  assert.equal(sentences.length, 1);
});
test("newlines split paragraphs", () => {
  const sentences = splitSentences("第一段第一句\n第二段第一句");
  assert.equal(sentences.length, 2);
});
test("leading whitespace is outside the span", () => {
  const text = "  Hello world.  Next one.";
  const sentences = splitSentences(text);
  assert.equal(text.slice(sentences[0].start, sentences[0].end), "Hello world.");
});

console.log("\n[diff]");
test("equal text has one equal segment", () => {
  assert.deepEqual(computeDiff("abc", "abc"), [{ type: "equal", text: "abc" }]);
});
test("insertion is detected and current is reconstructable", () => {
  const segments = computeDiff("我今天去公园", "我今天和小明去公园");
  const rebuilt = segments
    .filter((segment) => segment.type !== "delete")
    .map((segment) => segment.text)
    .join("");
  assert.equal(rebuilt, "我今天和小明去公园");
  assert.ok(segments.some((segment) => segment.type === "insert"));
});
test("which marks a deletion only when requested", () => {
  const segments = computeDiff("abcdef", "abc");
  assert.ok(segments.some((segment) => segment.type === "delete"));
});

console.log("\n[sentence alignment]");
test("identical text produces unchanged pairs", () => {
  const text = "第一句。第二句。第三句。";
  const pairs = buildSentencePairs(text, text);
  assert.equal(pairs.length, 3);
  assert.ok(pairs.every((pair) => !pair.changed));
});
test("spans match the source strings exactly", () => {
  const original = "由于数据量较少，我们决定后续优化。这个功能仍需完善。";
  const current = "数据量有限，这一功能将在后续版本优化。它仍需完善。";
  const pairs = buildSentencePairs(original, current);
  assert.ok(pairs.length >= 2);
  for (const pair of pairs) {
    assert.equal(original.slice(pair.originalStart, pair.originalEnd), pair.original);
    assert.equal(current.slice(pair.currentStart, pair.currentEnd), pair.current);
  }
});
test("inserted sentence restores by deleting its span", () => {
  const original = "第一句。第二句。";
  const current = "第一句。这是新增的一句。第二句。";
  const pairs = buildSentencePairs(original, current);
  const inserted = pairs.find((pair) => pair.original === "");
  assert.ok(inserted, "expected an inserted pair");
  const restored =
    current.slice(0, inserted.currentStart) + current.slice(inserted.currentEnd);
  assert.ok(restored.includes("第一句"));
  assert.ok(!restored.includes("这是新增的一句"));
});
test("restoring a rewritten sentence puts the original back", () => {
  const original = "这个方案能够有效提升工作效率。";
  const current = "该方案可以明显提高工作效率。";
  const pair = buildSentencePairs(original, current)[0];
  const restored =
    current.slice(0, pair.currentStart) +
    pair.original +
    current.slice(pair.currentEnd);
  assert.equal(restored, original);
});
test("English merge / split alignment keeps valid spans", () => {
  const original = "First sentence. Second sentence. Third sentence.";
  const current = "First sentence. Second and third sentences were merged.";
  const pairs = buildSentencePairs(original, current);
  for (const pair of pairs) {
    assert.equal(original.slice(pair.originalStart, pair.originalEnd), pair.original);
    assert.equal(current.slice(pair.currentStart, pair.currentEnd), pair.current);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);