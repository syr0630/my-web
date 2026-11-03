import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const SAMPLE = `写作这件事，很多时候不是“想清楚了再写”，而是“写着写着才想清楚”。我习惯先丢下一句不太好听的真话，再慢慢解释它为什么成立。句子要短，能停顿的地方就停顿；别急着用形容词，先把动作和细节摆出来。比如写清晨，不必说“宁静而美好”，可以写水壶刚响、窗台上的灰被风推开、楼下有人咳了一声。读者不笨，他们会自己补上情绪。至于结论，我常常留到最后一段，甚至只留一个反问：我们真的需要那么多漂亮的空话吗？`;
const ORIGINAL =
  "随着社会的发展，人们越来越重视健康问题。我们应该养成良好的生活习惯，从而提升生活质量。";

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.error(`FAIL  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

async function request(pathname, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.json !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(BASE + pathname, {
    method:
      options.method ??
      (options.json !== undefined || options.form !== undefined ? "POST" : "GET"),
    headers,
    body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

function newOwnerCookie(response) {
  const value = response.headers.get("set-cookie");
  assert.ok(value, "expected an owner cookie");
  assert.match(value, /HttpOnly/i);
  assert.match(value, /SameSite=Lax/i);
  return value.split(";")[0];
}

function makePdf(stream) {
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>";
  objects[4] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index <= 5; index += 1) {
    offsets[index] = Buffer.byteLength(pdf);
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

function makeDocx(text) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`;
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(rels),
      "word/document.xml": strToU8(document),
    })
  );
}

async function extract(name, bytes, cookie) {
  const form = new FormData();
  form.append("files", new Blob([bytes]), name);
  return request("/api/style-profile/extract", { form, cookie });
}

async function main() {
  console.log(`\nDraftly Style Profile API tests — ${BASE}\n`);

  let ownerA = "";
  let ownerB = "";
  let profileId = "";
  let analysis = null;
  let samples = [];
  let polishedText = "";
  let consistencyBody = null;

  await test("style list creates an HttpOnly anonymous owner cookie", async () => {
    const result = await request("/api/style-profile");
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.profiles, []);
    ownerA = newOwnerCookie(result.response);
    assert.match(ownerA, /^draftly_style_owner=[0-9a-f-]{36}$/i);
  });

  await test("TXT samples are decoded with correct character counts", async () => {
    const result = await extract("sample.txt", Buffer.from(SAMPLE, "utf8"), ownerA);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.errors.length, 0);
    assert.equal(result.body.samples.length, 1);
    assert.equal(result.body.samples[0].sourceType, "txt");
    assert.ok(result.body.samples[0].chars > 100);
    samples = result.body.samples;
  });

  await test("DOCX text is extracted from the document body", async () => {
    const result = await extract(
      "sample.docx",
      makeDocx("这是 DOCX 风格样本。句子要短。细节要具体。"),
      ownerA
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.body.samples[0]?.sourceType, "docx");
    assert.match(result.body.samples[0]?.text ?? "", /DOCX 风格样本/);
  });

  await test("PDF text is extracted without an external OCR service", async () => {
    const result = await extract(
      "sample.pdf",
      makePdf(
        "BT /F1 16 Tf 72 720 Td (Style profile PDF sample. Keep sentences short.) Tj ET"
      ),
      ownerA
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.body.samples[0]?.sourceType, "pdf");
    assert.match(result.body.samples[0]?.text ?? "", /PDF sample/);
  });

  await test("scanned PDFs fail explicitly instead of returning fake text", async () => {
    const result = await extract("scan.pdf", makePdf(""), ownerA);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.samples.length, 0);
    assert.match(result.body.errors[0]?.message ?? "", /OCR|扫描/);
  });

  await test("legacy .doc and unsupported files are rejected per file", async () => {
    const result = await extract("legacy.doc", Buffer.from("legacy"), ownerA);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.samples.length, 0);
    assert.match(result.body.errors[0]?.message ?? "", /\.doc|docx/);
  });

  await test("AI style analysis returns six dimensions and no fake percentage", async () => {
    const result = await request("/api/style-profile/analyze", {
      json: { samples },
      cookie: ownerA,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    analysis = result.body.analysis;
    assert.equal(Object.keys(analysis.dimensions).length, 6);
    for (const key of [
      "tone",
      "wording",
      "sentence",
      "expression",
      "paragraph",
      "rhetoric",
    ]) {
      assert.ok(analysis.dimensions[key].description.length > 10, key);
    }
    assert.ok(["high", "medium", "low"].includes(analysis.confidence));
    assert.ok(analysis.sampleAssessment.length > 10);
    assert.ok(!JSON.stringify(analysis).includes("%"));
  });

  await test("a named profile is persisted and scoped to its owner", async () => {
    const created = await request("/api/style-profile", {
      json: { name: "短句随笔风格", analysis, samples },
      cookie: ownerA,
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    profileId = created.body.profile.id;
    assert.equal(created.body.profile.sampleCount, 1);

    const listA = await request("/api/style-profile", { cookie: ownerA });
    assert.equal(listA.body.profiles.length, 1);
    assert.equal(listA.body.profiles[0].id, profileId);

    const other = await request("/api/style-profile");
    ownerB = newOwnerCookie(other.response);
    const listB = await request("/api/style-profile", { cookie: ownerB });
    assert.deepEqual(listB.body.profiles, []);
    const foreign = await request(`/api/style-profile/${profileId}`, {
      cookie: ownerB,
    });
    assert.equal(foreign.response.status, 404);
    assert.equal(foreign.body.error_code, "STYLE_PROFILE_NOT_FOUND");
  });

  await test("a profile can be renamed and read back", async () => {
    const renamed = await request(`/api/style-profile/${profileId}`, {
      method: "PATCH",
      json: { name: "短句随笔风格（重命名）" },
      cookie: ownerA,
    });
    assert.equal(renamed.response.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.profile.name, "短句随笔风格（重命名）");
    const read = await request(`/api/style-profile/${profileId}`, {
      cookie: ownerA,
    });
    assert.equal(read.body.profile.name, "短句随笔风格（重命名）");
  });

  await test("polish accepts styleProfileId and reports the used profile", async () => {
    const result = await request("/api/v1/polish", {
      json: {
        text: ORIGINAL,
        standard: "standard",
        intensity: "moderate",
        contentLanguage: "zh-CN",
        sourceVersion: "style-test-v1",
        styleProfileId: profileId,
      },
      cookie: ownerA,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.ok(result.body.text.length > 10);
    assert.equal(result.body.styleProfile.id, profileId);
    assert.equal(result.body.styleProfile.name, "短句随笔风格（重命名）");
    polishedText = result.body.text;
  });

  await test("style consistency returns five ratings and anchored differences", async () => {
    const result = await request("/api/style-consistency/analyze", {
      json: {
        originalText: ORIGINAL,
        currentText: polishedText,
        styleProfileId: profileId,
        standard: "standard",
      },
      cookie: ownerA,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.ok(["high", "medium", "low"].includes(result.body.overall));
    assert.equal(result.body.dimensions.length, 5);
    assert.ok(!JSON.stringify(result.body).includes("%"));
    consistencyBody = result.body;
    for (const difference of result.body.differences) {
      assert.ok(difference.start >= 0);
      assert.ok(difference.end <= polishedText.length);
      assert.equal(
        polishedText.slice(difference.start, difference.end),
        difference.quote
      );
    }
  });

  await test("apply suggestions returns a complete revision and preserves sourceVersion", async () => {
    const result = await request("/api/style-consistency/apply", {
      json: {
        currentText: polishedText,
        styleProfileId: profileId,
        standard: "standard",
        sourceVersion: "style-test-v1",
        differences: consistencyBody.differences,
        suggestions: consistencyBody.differences.map((item) => item.suggestion),
      },
      cookie: ownerA,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.ok(result.body.text.length > 5);
    assert.equal(result.body.sourceVersion, "style-test-v1");
    assert.ok(Array.isArray(result.body.appliedChanges));
  });

  await test("deleting a profile removes it and its samples", async () => {
    const deleted = await request(`/api/style-profile/${profileId}`, {
      method: "DELETE",
      cookie: ownerA,
    });
    assert.equal(deleted.response.status, 200);
    const read = await request(`/api/style-profile/${profileId}`, {
      cookie: ownerA,
    });
    assert.equal(read.response.status, 404);
    const list = await request("/api/style-profile", { cookie: ownerA });
    assert.equal(list.body.profiles.length, 0);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log(`- ${failure.name}`);
    }
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
    await fs.rm(path.join(os.tmpdir(), "draftly-style-test"), {
      recursive: true,
      force: true,
    });
  } catch {
    /* ignore */
  }
}
process.exitCode = exitCode;