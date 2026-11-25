import "server-only";
import { NextResponse } from "next/server";
import { getOrgCaller } from "@/lib/auth";
import { roleAtLeast } from "@/lib/permissions";
import { qrPassesEnabled, qrRateLimit } from "@/lib/qr-pass";

export function qrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
export async function smallJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader || !request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid request.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > 4096) { await reader.cancel(); throw new Error("Request too large."); } chunks.push(r.value); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function qrStaff(request: Request) {
  if (!qrPassesEnabled()) return qrJson({ error: "QR check-in is not enabled." }, 404);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return qrJson({ error: "Request not allowed." }, 403);
  const caller = await getOrgCaller();
  if (!caller) return qrJson({ error: "Sign in to Front Desk." }, 401);
  if (!roleAtLeast(caller.role, "staff")) return qrJson({ error: "Staff access is required." }, 403);
  if (!await qrRateLimit(`staff:${caller.userId}`, 120)) return qrJson({ error: "Too many scans. Try again in a minute." }, 429);
  return caller;
}
