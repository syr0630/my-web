import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.ADMIN_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  });
  return response;
}