import { randomUUID } from "node:crypto";
import { jsonHeaders } from "@/lib/errors";

export const STYLE_OWNER_COOKIE = "draftly_style_owner";
const OWNER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StyleOwnerContext = {
  ownerId: string;
  setCookie?: string;
};

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    if (trimmed.slice(0, separator) !== name) continue;
    const value = trimmed.slice(separator + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Draftly has no account system, so a profile belongs to one anonymous browser
 * visitor. The random HttpOnly id is an isolation boundary, not authentication:
 * anyone with the cookie can read that visitor's profiles.
 */
export function getStyleOwner(request: Request): StyleOwnerContext {
  const existing = readCookie(request, STYLE_OWNER_COOKIE);
  if (existing && OWNER_PATTERN.test(existing)) {
    return { ownerId: existing };
  }

  const ownerId = randomUUID();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure =
    new URL(request.url).protocol === "https:" || forwardedProto === "https"
      ? "; Secure"
      : "";
  return {
    ownerId,
    setCookie: `${STYLE_OWNER_COOKIE}=${encodeURIComponent(
      ownerId
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  };
}

export function styleJson(
  payload: unknown,
  owner: StyleOwnerContext,
  status = 200,
  requestId?: string
): Response {
  return Response.json(payload, {
    status,
    headers: {
      ...jsonHeaders(requestId),
      ...(owner.setCookie ? { "Set-Cookie": owner.setCookie } : {}),
    },
  });
}