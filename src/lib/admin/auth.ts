import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";

export const ADMIN_COOKIE_NAME = "draftly_admin";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

type SessionPayload = {
  sub: "admin";
  exp: number;
};

function getPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

export function isAdminConfigured(): boolean {
  return getPassword().length > 0 && getSecret().length >= 32;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyAdminPassword(input: unknown): void {
  if (!getPassword() || getSecret().length < 32) {
    throw new AppError({
      message:
        "管理员登录尚未配置。请在服务端设置 ADMIN_PASSWORD 与至少 32 位的 ADMIN_SESSION_SECRET。",
      error_code: "ADMIN_NOT_CONFIGURED",
      status: 503,
    });
  }

  if (typeof input !== "string" || !input) {
    throw new AppError({
      message: "请输入管理员密码。",
      error_code: "INVALID_CREDENTIALS",
      status: 401,
    });
  }

  const actual = createHash("sha256").update(input).digest();
  const expected = createHash("sha256").update(getPassword()).digest();

  if (!timingSafeEqual(actual, expected)) {
    throw new AppError({
      message: "密码不正确，请重试。",
      error_code: "INVALID_CREDENTIALS",
      status: 401,
    });
  }
}

export function createAdminSessionToken(): string {
  if (!isAdminConfigured()) {
    throw new AppError({
      message: "管理员登录尚未配置。",
      error_code: "ADMIN_NOT_CONFIGURED",
      status: 503,
    });
  }

  const payload: SessionPayload = {
    sub: "admin",
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body, getSecret())}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token || getSecret().length < 32) return false;

  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = sign(body, getSecret());
  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    return (
      payload.sub === "admin" &&
      Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function hasAdminSession(): Promise<boolean> {
  try {
    const store = await cookies();
    return verifyAdminSessionToken(store.get(ADMIN_COOKIE_NAME)?.value);
  } catch {
    return false;
  }
}

export async function requireAdminSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    throw new AppError({
      message: "请先登录管理员账号。",
      error_code: "UNAUTHORIZED",
      status: 401,
      retryable: false,
    });
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.ADMIN_COOKIE_SECURE === "true",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  };
}