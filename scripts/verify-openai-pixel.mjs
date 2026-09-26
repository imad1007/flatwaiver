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
assert.ok(component.includes('method: "PATCH"'), "queued SDK delivery is acknowledged separately");
const route = readFileSync(new URL("../src/app/api/ads/registration/route.ts", import.meta.url), "utf8");
assert.ok(route.includes('request.cookies.get("fw-consent")?.value === "granted"'));
assert.ok(route.includes('rpc("reserve_registration_measurement"'));
assert.ok(route.includes('rpc("complete_registration_measurement"'));
const bootstrap = readFileSync(new URL("../src/lib/bootstrap.ts", import.meta.url), "utf8");
assert.ok(bootstrap.includes('.from("registration_measurements").insert'));
assert.ok(!bootstrap.includes("OPENAI_ADS_PIXEL_ENABLED"), "candidate persistence is independent of later consent/configuration");

// Real SQL execution: registration eligibility, stable reservations, delivery
// acknowledgment, isolation, and retry behavior.
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
await db.exec(readFileSync(new URL("../supabase/migrations/0022_registration_measurement_delivery.sql", import.meta.url), "utf8"));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function account(n, { candidate = true, confirmed = true, name = "Business", role = "owner", subscription = true } = {}) {
  await db.query("insert into auth.users values($1,$2,$3)", [id(n), `user${n}@example.com`, confirmed ? new Date() : null]);
  await db.query("insert into organizations values($1,$2)", [id(n), name]);
  await db.query("insert into profiles values($1,$1,$2)", [id(n), role]);
  if (subscription) await db.query("insert into subscriptions values($1)", [id(n)]);
  if (candidate) await db.query("insert into registration_measurements(user_id,org_id) values($1,$1)", [id(n)]);
}
async function reserve(n) { return (await db.query("select reserve_registration_measurement($1) as event", [id(n)])).rows[0].event; }
async function complete(n, event) { return (await db.query("select complete_registration_measurement($1,$2) as completed", [id(n), event])).rows[0].completed; }

// 1. A newly created business gets one stable event ID.
await account(1);
const databaseReservations = await Promise.all([reserve(1), reserve(1), reserve(1)]);
assert.ok(databaseReservations[0], "new account returns a registration ID");
assert.equal(new Set(databaseReservations).size, 1, "tabs/renders receive one stable logical event ID");

// 2. An existing login or invited account has no candidate and no event.
await account(2, { candidate: false }); // ordinary existing user / invite
assert.equal(await reserve(2), null);
await account(3, { confirmed: false });
assert.equal(await reserve(3), null);
await account(4, { name: "user4@example.com" }); // Google onboarding not finished
assert.equal(await reserve(4), null);
await db.query("update organizations set name='Finished Business' where id=$1", [id(4)]);
assert.ok(await reserve(4));
await account(5, { role: "member" });
assert.equal(await reserve(5), null);
await account(6, { subscription: false });
assert.equal(await reserve(6), null);
await account(7);
await db.query("update registration_measurements set created_at=now()-interval '8 days' where user_id=$1", [id(7)]);
assert.equal(await reserve(7), null);
await account(8);
assert.equal(await reserve(99), null, "another user cannot reserve this candidate");
assert.ok(await reserve(8));

// 3. Repeated requests never create another logical event.
assert.equal(await reserve(1), databaseReservations[0]);
assert.equal(await complete(1, id(999)), false, "a mismatched ID cannot complete another event");

// 4. Consent denial makes no API reservation; an unacknowledged reservation
// remains deliverable and the legacy claimed_at bug is recoverable.
await db.query("update registration_measurements set claimed_at=now() where user_id=$1", [id(1)]);
assert.equal(await reserve(1), databaseReservations[0], "old eager claims can retry with their original ID");

// 5. Once the SDK queues the event and the app acknowledges it, subsequent
// requests return no event. Completion itself is idempotent.
assert.equal(await complete(1, databaseReservations[0]), true);
assert.equal(await complete(1, databaseReservations[0]), true);
assert.equal(await reserve(1), null, "successfully queued delivery is complete");
assert.equal((await db.query("select has_function_privilege('authenticated','public.reserve_registration_measurement(uuid)','execute') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_function_privilege('authenticated','public.complete_registration_measurement(uuid,uuid)','execute') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_table_privilege('authenticated','public.registration_measurements','select') as allowed")).rows[0].allowed, false);
await db.close();
console.log("OpenAI Pixel database checks passed: new/existing eligibility, stable IDs, retry recovery, completion, consent-safe reservation, isolation.");

const sdkCalls = [];
const sdkQueue = (...args) => sdkCalls.push(args);
let reserves = 0, acknowledgments = 0;
const sdkReserve = async () => { reserves++; return { eventId }; };
const sdkAcknowledge = async received => { assert.equal(received, eventId); acknowledgments++; };
await measureSdkRegistration(sdkReserve, sdkAcknowledge, () => false, sdkQueue);
assert.equal(reserves, 0, "denied consent does not reserve or consume an event");
await measureSdkRegistration(sdkReserve, sdkAcknowledge, () => true, sdkQueue);
assert.deepEqual(sdkCalls, [["measure", "registration_completed", { type: "customer_action" }, { event_id: eventId }]]);
assert.equal(acknowledgments, 1, "delivery is completed only after the SDK queue call");
let stillAllowed = true;
await measureSdkRegistration(async () => { stillAllowed = false; return { eventId }; }, sdkAcknowledge, () => stillAllowed, sdkQueue);
await measureSdkRegistration(async () => ({ eventId: "invalid" }), sdkAcknowledge, () => true, sdkQueue);
await measureSdkRegistration(async () => null, sdkAcknowledge, () => true, sdkQueue);
await measureSdkRegistration(async () => { throw new Error("offline"); }, sdkAcknowledge, () => true, sdkQueue);
await measureSdkRegistration(async () => ({ eventId }), sdkAcknowledge, () => true, () => { throw new Error("blocked"); });
assert.equal(sdkCalls.length, 1);
assert.equal(acknowledgments, 1, "blocked SDK delivery is never acknowledged");

let retryAcknowledgments = 0;
await measureSdkRegistration(
  async () => ({ eventId }),
  async () => { retryAcknowledgments++; throw new Error("ack offline"); },
  () => true,
  sdkQueue,
);
assert.equal(retryAcknowledgments, 1);
assert.equal(sdkCalls.at(-1)[3].event_id, eventId, "retry preserves the same deduplication ID");
console.log("SDK registration passed: exact arguments, consent gates, queue-before-ack lifecycle, failed delivery and stable-ID retry.");
