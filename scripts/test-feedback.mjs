import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const ENV_PATH = ".env.local";
const env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  env.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const testIp = `198.51.100.${Math.floor(Math.random() * 150) + 20}`;
const unique = `feedback-${Date.now()}`;
const message = `${unique}：后台应该能看到这条真实写入数据库的反馈。`;

let passed = 0;
let failed = 0;
let cookie = "";
let createdId = "";

async function request(path, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      "x-forwarded-for": testIp,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, status: response.status, body };
}

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

function adminHeaders() {
  return { Cookie: cookie, "Content-Type": "application/json" };
}

async function cleanup() {
  if (!createdId || !cookie) return;
  await request(`/api/admin/feedback/${createdId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).catch(() => null);
}

console.log(`Draftly feedback API tests — ${BASE}`);

await test("public feedback persists a valid submission", async () => {
  const { status, body } = await request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "tester@example.com",
      category: "translation_quality",
      message,
      consent: true,
    }),
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.ok, true);
  assert.ok(body.request_id);
});

await test("invalid email is rejected", async () => {
  const { status, body } = await request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "not-an-email",
      category: "other",
      message: "这条反馈的邮箱格式是错误的。",
      consent: true,
    }),
  });
  assert.equal(status, 400, JSON.stringify(body));
  assert.equal(body.error_code, "INVALID_FEEDBACK");
});

await test("too-short message is rejected", async () => {
  const { status } = await request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "other",
      message: "短",
      consent: true,
    }),
  });
  assert.equal(status, 400);
});

await test("missing consent is rejected", async () => {
  const { status } = await request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "feature_request",
      message: "没有勾选隐私同意时不应该写入数据库。",
    }),
  });
  assert.equal(status, 400);
});

await test("honeypot submission is rejected", async () => {
  const { status } = await request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "other",
      message: "这是一条自动化垃圾提交。",
      consent: true,
      website: "https://spam.example",
    }),
  });
  assert.equal(status, 400);
});

await test("admin list rejects anonymous requests", async () => {
  const { status, body } = await request("/api/admin/feedback");
  assert.equal(status, 401, JSON.stringify(body));
  assert.equal(body.error_code, "UNAUTHORIZED");
});

await test("admin login rejects a wrong password", async () => {
  const { status } = await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "definitely-not-it" }),
  });
  assert.equal(status, 401);
});

await test("admin login returns an HttpOnly session cookie", async () => {
  assert.ok(ADMIN_PASSWORD, "ADMIN_PASSWORD is missing from .env.local");
  const { response, status, body } = await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  assert.equal(status, 200, JSON.stringify(body));
  const setCookie =
    response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie");
  assert.match(setCookie ?? "", /draftly_admin=/);
  assert.match(setCookie ?? "", /HttpOnly/i);
  assert.match(setCookie ?? "", /SameSite=Strict/i);
  cookie = setCookie.split(";")[0];
});

await test("admin list finds the persisted feedback", async () => {
  const { status, body } = await request(
    `/api/admin/feedback?search=${encodeURIComponent(unique)}`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.total, 1, JSON.stringify(body));
  const item = body.items[0];
  assert.equal(item.message, message);
  assert.equal(item.email, "tester@example.com");
  assert.equal(item.category, "translation_quality");
  assert.equal(item.status, "new");
  assert.equal(item.consent, 1);
  assert.ok(item.consented_at);
  createdId = item.id;
});

await test("admin detail returns the full feedback", async () => {
  const { status, body } = await request(`/api/admin/feedback/${createdId}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.feedback.message, message);
});

await test("admin can update status and internal note", async () => {
  const { status, body } = await request(`/api/admin/feedback/${createdId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({
      status: "in_progress",
      admin_note: "已确认，准备回复。",
    }),
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.feedback.status, "in_progress");
  assert.equal(body.feedback.admin_note, "已确认，准备回复。");
  assert.ok(body.feedback.updated_at >= body.feedback.created_at);
});

await test("invalid status is rejected", async () => {
  const { status } = await request(`/api/admin/feedback/${createdId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status: "not-a-real-status" }),
  });
  assert.equal(status, 400);
});

await test("status filters return matching records", async () => {
  const { status, body } = await request(
    "/api/admin/feedback?status=in_progress",
    { headers: { Cookie: cookie } }
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.ok(body.items.some((item) => item.id === createdId));
  assert.ok(body.stats.in_progress >= 1);
});

await test("feedback can be archived", async () => {
  const { status, body } = await request(`/api/admin/feedback/${createdId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status: "archived" }),
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.feedback.status, "archived");
});

await test("delete requires an admin session", async () => {
  const { status } = await request(`/api/admin/feedback/${createdId}`, {
    method: "DELETE",
  });
  assert.equal(status, 401);
});

await test("admin can delete a feedback record", async () => {
  const { status, body } = await request(`/api/admin/feedback/${createdId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  assert.equal(status, 200, JSON.stringify(body));
  const after = await request(`/api/admin/feedback/${createdId}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(after.status, 404);
  createdId = "";
});

await cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;