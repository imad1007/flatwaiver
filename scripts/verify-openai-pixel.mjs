import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pixelEnabled, pixelPageMode, registrationPixelUrl, readClickCookie, measureRegistration, measureSdkRegistration, safeClickReference } from "../src/lib/openai-pixel.ts";

for (const environment of [undefined, "development", "preview"]) assert.equal(pixelEnabled(environment, "true"), false);
assert.equal(pixelEnabled("production", undefined), false);
assert.equal(pixelEnabled("production", "true"), true);
for (const path of ["/w/foo", "/kiosk/foo", "/signatures", "/signatures/id", "/data", "/data/records/id", "/waivers/id/share", "/login", "/auth/callback", "/onboarding", "/admin"]) {
  assert.equal(pixelPageMode(path), null, path);
}
assert.equal(pixelPageMode("/dashboard"), "conversion");
assert.equal(pixelPageMode("/"), "landing");
assert.equal(pixelPageMode("/signup"), "landing");
assert.equal(pixelPageMode("/waivers/new"), "conversion");
assert.equal(pixelPageMode("/waivers/00000000-0000-4000-8000-000000000001"), "conversion");
assert.equal(safeClickReference("abc_123-XYZ"), "abc_123-XYZ");
assert.equal(safeClickReference("bad\nvalue"), null);
assert.equal(safeClickReference("x".repeat(2049)), null);

// Assert the entire outbound field set: no user matching or page parameters.
const eventId = "00000000-0000-4000-8000-000000000001";
const url = new URL(registrationPixelUrl(eventId, "opaque+/click="));
assert.equal(url.origin, "https://bzr.openai.com");
assert.deepEqual(Object.fromEntries(url.searchParams), {
  pid: "Wdj4prj2rJhsBuYu2cLejz", event: "registration_completed",
  event_id: eventId, "data[type]": "customer_action", oppref: "opaque+/click=",
});
assert.equal(new URL(registrationPixelUrl(eventId, null)).searchParams.has("oppref"), false);
assert.throws(() => registrationPixelUrl("customer@example.com", null));
assert.equal(readClickCookie("fw-consent=granted; fw-openai-oppref=opaque%2B%2Fclick%3D"), "opaque+/click=");
assert.equal(readClickCookie("fw-openai-oppref=%broken"), null);
assert.equal(readClickCookie("unrelated=secret"), null);
const sent = [];
let claims = 0, allowed = true;
const claimBrowser = async () => { claims++; return { eventId }; };
await measureRegistration(claimBrowser, () => allowed, () => null, value => sent.push(value));
assert.equal(sent.length, 1);
allowed = false;
await measureRegistration(claimBrowser, () => allowed, () => null, value => sent.push(value));
assert.equal(claims, 1, "denied consent makes no claim");
allowed = true;
await measureRegistration(async () => { allowed = false; return { eventId }; }, () => allowed, () => null, value => sent.push(value));
assert.equal(sent.length, 1, "withdrawal/navigation during claim suppresses image");
await measureRegistration(async () => null, () => true, () => null, value => sent.push(value));
await measureRegistration(async () => { throw new Error("offline"); }, () => true, () => null, value => sent.push(value));
assert.equal(sent.length, 1, "empty/failed claims cannot emit");
await measureRegistration(claimBrowser, () => true, () => null, () => { throw new Error("blocked"); });
const component = readFileSync(new URL("../src/components/openai-pixel.tsx", import.meta.url), "utf8");
assert.ok(component.includes("measureSdkRegistration"));
assert.ok(component.includes("pixelPageMode(pathname)"));

// Real SQL execution: registration completion, isolation and repeat claims.
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
  create table public.organizations(id uuid primary key, name text);
  create table public.profiles(id uuid primary key, org_id uuid, role text);
  create table public.subscriptions(org_id uuid primary key);
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0019_registration_measurement.sql", import.meta.url), "utf8"));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function account(n, { candidate = true, confirmed = true, name = "Business", role = "owner", subscription = true } = {}) {
  await db.query("insert into auth.users values($1,$2,$3)", [id(n), `user${n}@example.com`, confirmed ? new Date() : null]);
  await db.query("insert into organizations values($1,$2)", [id(n), name]);
  await db.query("insert into profiles values($1,$1,$2)", [id(n), role]);
  if (subscription) await db.query("insert into subscriptions values($1)", [id(n)]);
  if (candidate) await db.query("insert into registration_measurements(user_id,org_id) values($1,$1)", [id(n)]);
}
async function claim(n) { return (await db.query("select claim_registration_measurement($1) as event", [id(n)])).rows[0].event; }
await account(1);
const databaseClaims = await Promise.all([claim(1), claim(1), claim(1)]);
assert.equal(databaseClaims.filter(Boolean).length, 1, "tabs/retries claim only once");
await account(2, { candidate: false }); // ordinary existing user / invite
assert.equal(await claim(2), null);
await account(3, { confirmed: false });
assert.equal(await claim(3), null);
await account(4, { name: "user4@example.com" }); // Google onboarding not finished
assert.equal(await claim(4), null);
await db.query("update organizations set name='Finished Business' where id=$1", [id(4)]);
assert.ok(await claim(4));
await account(5, { role: "member" });
assert.equal(await claim(5), null);
await account(6, { subscription: false });
assert.equal(await claim(6), null);
await account(7);
await db.query("update registration_measurements set created_at=now()-interval '8 days' where user_id=$1", [id(7)]);
assert.equal(await claim(7), null);
await account(8);
assert.equal(await claim(99), null, "another user cannot consume this candidate");
assert.ok(await claim(8));
assert.equal((await db.query("select has_function_privilege('authenticated','public.claim_registration_measurement(uuid)','execute') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_table_privilege('authenticated','public.registration_measurements','select') as allowed")).rows[0].allowed, false);
await db.close();
console.log("OpenAI Pixel checks passed: production/route gates, image field allowlist, blocked transport, consent, completion, one-use claims, isolation.");

const sdkCalls = [];
const sdkQueue = (...args) => sdkCalls.push(args);
let sdkClaimed = false;
const sdkClaim = async () => sdkClaimed ? null : (sdkClaimed = true, { eventId });
await measureSdkRegistration(sdkClaim, () => false, sdkQueue);
assert.equal(sdkClaimed, false);
await measureSdkRegistration(sdkClaim, () => true, sdkQueue);
await measureSdkRegistration(sdkClaim, () => true, sdkQueue);
assert.deepEqual(sdkCalls, [["measure", "registration_completed", { type: "customer_action" }, { event_id: eventId }]]);
let stillAllowed = true;
await measureSdkRegistration(async () => { stillAllowed = false; return { eventId }; }, () => stillAllowed, sdkQueue);
await measureSdkRegistration(async () => ({ eventId: "invalid" }), () => true, sdkQueue);
await measureSdkRegistration(async () => null, () => true, sdkQueue);
await measureSdkRegistration(async () => { throw new Error("offline"); }, () => true, sdkQueue);
await measureSdkRegistration(async () => ({ eventId }), () => true, () => { throw new Error("blocked"); });
assert.equal(sdkCalls.length, 1);
console.log("SDK registration passed: exact event arguments, once-only claim, denied/withdrawn consent, failed/ineligible claims, malformed ID and blocked SDK.");
