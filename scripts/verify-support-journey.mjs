import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SUPPORT_TOPICS, supportRequestSchema } from "../src/lib/support-request.ts";

const valid = {
  email: " Owner@Example.COM ",
  name: "Sam",
  topic: "Signing issue",
  message: "A customer cannot complete our waiver.",
  turnstileToken: "verified-token",
  website: "",
};
const parsed = supportRequestSchema.parse(valid);
assert.equal(parsed.email, "owner@example.com");
assert.equal(SUPPORT_TOPICS.length, 6);
assert.equal(supportRequestSchema.safeParse({ ...valid, email: "not-email" }).success, false);
assert.equal(supportRequestSchema.safeParse({ ...valid, topic: "Refund me now" }).success, false);
assert.equal(supportRequestSchema.safeParse({ ...valid, message: "too short" }).success, false);
assert.equal(supportRequestSchema.safeParse({ ...valid, message: "x".repeat(4001) }).success, false);
assert.equal(supportRequestSchema.safeParse({ ...valid, turnstileToken: "" }).success, false);

const route = await readFile(new URL("../src/app/api/support/route.ts", import.meta.url), "utf8");
const email = await readFile(new URL("../src/lib/email.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/support/page.tsx", import.meta.url), "utf8");
assert.ok(route.indexOf("verifyTurnstile") < route.indexOf("sendSupportRequestEmail({"));
assert.match(route, /if \(parsed\.data\.website\) return NextResponse\.json\(\{ ok: true \}\)/);
assert.match(route, /jsonError\("Verification failed[^\n]+403\)/);
assert.match(route, /jsonError\("We couldn't deliver[^\n]+502\)/);
assert.match(email, /replyTo: opts\.fromEmail/);
assert.match(email, /assertEmailAccepted\(result\)/);
assert.match(email, /escapeHtml\(opts\.message\)\.replace/);
assert.match(page, /process\.env\.RESEND_API_KEY[\s\S]*TURNSTILE_SECRET_KEY[\s\S]*NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
assert.match(page, /Prefer email\? Write directly/);

console.log("support journey verification passed (6 validation + delivery/security contracts)");
