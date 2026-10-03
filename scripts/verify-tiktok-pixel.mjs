import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as pixel from "../src/lib/tiktok-pixel.ts";

const { deliverTikTokEvent, tiktokPaymentCandidate, tiktokPaymentProperties } = pixel;
assert.equal(pixel.tiktokEnabled("preview", "true"), false);
assert.equal(pixel.tiktokEnabled("production", "false"), false);
assert.equal(pixel.tiktokEnabled("production", "true"), true);
for (const path of ["/w/example", "/w/example/done", "/kiosk/example", "/signatures/abc", "/waivers/abc", "/auth/callback", "/onboarding", "/data/records/abc"]) {
  assert.equal(pixel.tiktokPageAllowed(path), false, path);
}
for (const query of ["?email=person@example.com", "?code=secret", "#access_token=secret", "?search=health"]) {
  assert.equal(pixel.tiktokUrlAllowed(`https://www.flatwaiver.com/signup${query}`), false);
}
assert.equal(pixel.tiktokUrlAllowed("https://www.flatwaiver.com/?ttclid=opaque_123"), true);
assert.equal(pixel.tiktokBrowserPermitted(), false, "SSR safe");
const object = { id: "sub_1", mode: "prod", lastTransactionId: "tran_1" };
assert.deepEqual(tiktokPaymentCandidate("subscription.paid", object), { subscriptionId: "sub_1", transactionId: "tran_1" });
for (const type of ["checkout.completed", "subscription.active", "subscription.trialing", "subscription.update"]) {
  assert.equal(tiktokPaymentCandidate(type, object), null, type);
}
assert.equal(tiktokPaymentCandidate("subscription.paid", { ...object, mode: "test" }), null);
assert.equal(tiktokPaymentCandidate("subscription.paid", { ...object, lastTransactionId: undefined }), null);
const transaction = { mode: "prod", status: "paid", amountPaid: 1500, currency: "USD" };
assert.deepEqual(tiktokPaymentProperties(transaction), { value: 15, currency: "USD" }, "discounted actual payment, not hardcoded 19");
for (const changes of [{ mode: "test" }, { status: "pending" }, { status: "refunded" }, { amountPaid: 0 }, { amountPaid: null }, { currency: "EUR" }]) {
  assert.equal(tiktokPaymentProperties({ ...transaction, ...changes }), null);
}

const calls = [];
let acknowledgements = 0;
const item = { eventId: "00000000-0000-4000-8000-000000000001", event: "CompleteRegistration", properties: {} };
const queue = { track: (...args) => calls.push(args) };
await deliverTikTokEvent(item, () => false, queue, async () => { acknowledgements++; });
assert.equal(calls.length, 0); assert.equal(acknowledgements, 0);
await deliverTikTokEvent(item, () => true, { track: () => { throw Error("blocked"); } }, async () => { acknowledgements++; });
assert.equal(acknowledgements, 0, "failed SDK attempt never consumes candidate");
await Promise.all([1, 2, 3].map(() => deliverTikTokEvent(item, () => true, queue, async () => { throw Error("offline ack"); })));
assert.equal(calls.length, 1, "rerenders share one in-flight/queued event");
await deliverTikTokEvent(item, () => true, queue, async () => { acknowledgements++; });
assert.equal(calls.length, 1); assert.equal(acknowledgements, 1, "retry acknowledgment without requeue");
assert.deepEqual(calls[0], ["CompleteRegistration", {}, { event_id: item.eventId }]);

// Real PostgreSQL execution: new registration, ordinary login, cross-org access,
// stable reservations, OpenAI independence, completed delivery and retry window.
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create table organizations(id uuid primary key, name text);
create table profiles(id uuid primary key, org_id uuid, role text);
create table subscriptions(org_id uuid primary key, creem_subscription_id text);`);
for (const name of ["0019_registration_measurement.sql", "0022_registration_measurement_delivery.sql", "0025_tiktok_measurements.sql"]) {
  await db.exec(fs.readFileSync(`supabase/migrations/${name}`, "utf8"));
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function account(n, candidate = true, confirmed = true) {
  await db.query("insert into auth.users values($1,$2,$3)", [id(n), `example${n}@example.com`, confirmed ? new Date() : null]);
  await db.query("insert into organizations values($1,'Gym')", [id(n)]);
  await db.query("insert into profiles values($1,$1,'owner')", [id(n)]);
  await db.query("insert into subscriptions values($1,$2)", [id(n), `sub_${n}`]);
  if (candidate) await db.query("insert into registration_measurements(user_id,org_id) values($1,$1)", [id(n)]);
}
const reserve = async n => (await db.query("select * from reserve_tiktok_measurements($1)", [id(n)])).rows;
const ack = async (n, eventId) => (await db.query("select complete_tiktok_measurement($1,$2) as ok", [id(n), eventId])).rows[0].ok;
await account(1); await account(2, false); await account(3, true, false);
assert.equal((await reserve(2)).length, 0, "ordinary existing-account login has no candidate");
assert.equal((await reserve(3)).length, 0, "unconfirmed account cannot emit");
assert.equal((await db.query("select first_reserved_at from tiktok_measurements where user_id=$1", [id(1)])).rows[0].first_reserved_at, null);
const first = (await reserve(1))[0];
await db.exec("set role service_role");
assert.equal((await reserve(1))[0].event_id, first.event_id, "service-role RPC can validate private auth table without exposing it");
await db.exec("reset role");
assert.equal((await reserve(1))[0].event_id, first.event_id);
await db.query("select complete_registration_measurement($1,$2)", [id(1), first.event_id]);
assert.equal((await reserve(1))[0].event_id, first.event_id, "OpenAI acknowledgment has no effect");
assert.equal(await ack(2, first.event_id), false);
assert.equal(await ack(1, first.event_id), true);
assert.equal(await ack(1, first.event_id), true, "ack idempotent");
assert.equal((await reserve(1)).length, 0, "refresh after delivery gets no new event");
for (let i = 0; i < 2; i++) await db.exec("insert into tiktok_measurements(kind,source_id,subscription_id) values('payment','tran_1','sub_1') on conflict(kind,source_id) do nothing");
const payment = (await reserve(1))[0];
assert.equal(payment.kind, "payment");
assert.equal((await reserve(2)).length, 0, "payment scoped to subscription owner");
assert.equal((await reserve(1))[0].event_id, payment.event_id);
await db.query("update tiktok_measurements set first_reserved_at=now()-interval '48 hours' where event_id=$1", [payment.event_id]);
assert.equal((await reserve(1)).length, 0, "no retry beyond TikTok's dedupe window");
await db.exec("set role anon");
await assert.rejects(db.query("select * from tiktok_measurements"));
await assert.rejects(db.query("select * from reserve_tiktok_measurements($1)", [id(1)]));
await db.exec("reset role");
await db.close();

// Exercise actual route exports with trusted identity and consent mocks.
let rpcCalls = 0, cookie = "denied", origin = "https://www.flatwaiver.com", signedIn = true;
const admin = { rpc: async () => { rpcCalls++; return { data: [], error: null }; } };
const routeContext = { exports: {}, process: { env: { VERCEL_ENV: "production", TIKTOK_PIXEL_ENABLED: "true" } }, require: name => {
  if (name === "next/server") return { NextResponse: class { constructor(_, options) { this.status = options.status; } static json(body, options) { return { body, status: options?.status ?? 200 }; } } };
  if (name === "zod") return { z: { object: () => ({ safeParse: () => ({ success: false }) }), string: () => ({ uuid() {} }) } };
  if (name === "@/lib/auth") return { getOrgCaller: async () => signedIn ? { userId: id(1), role: "owner", email: "test@example.com" } : null };
  if (name === "@/lib/admin") return { isPlatformAdmin: () => false };
  if (name === "@/lib/supabase/admin") return { createAdminClient: () => admin };
  if (name === "@/lib/tiktok-payment") return { getTikTokPaymentProperties: async () => null };
  if (name === "@/lib/tiktok-pixel") return pixel;
  throw Error(name);
} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/api/ads/tiktok/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, routeContext);
const request = { cookies: { get: () => ({ value: cookie }) }, headers: { get: () => origin }, nextUrl: { origin: "https://www.flatwaiver.com" } };
assert.equal((await routeContext.exports.POST(request)).status, 204);
assert.equal(rpcCalls, 0, "consent denied never reserves/consumes");
cookie = "granted"; origin = "https://attacker.example";
assert.equal((await routeContext.exports.POST(request)).status, 204); assert.equal(rpcCalls, 0);
origin = request.nextUrl.origin; signedIn = false;
assert.equal((await routeContext.exports.POST(request)).status, 204); assert.equal(rpcCalls, 0);
signedIn = true;
assert.equal((await routeContext.exports.POST(request)).status, 200); assert.equal(rpcCalls, 1);

// Actual webhook handler: invalid signatures never persist payment work; valid
// paid events persist only opaque references, before the billing dedupe return.
let validSignature = false, duplicateWebhook = false;
const writes = [];
const webhookAdmin = { from: table => ({
  upsert: async (row, options) => { writes.push({ table, row, options }); return { error: null }; },
  insert: async () => ({ error: duplicateWebhook ? { code: "23505" } : null }),
  update: () => ({ eq: async () => ({ error: null }) }),
}) };
const webhookContext = { exports: {}, console, process: routeContext.process, require: name => {
  if (name === "next/server") return routeContext.require(name);
  if (name === "creem/webhooks") return { constructWebhookEventEntity: async () => {
    if (!validSignature) throw Error("invalid signature");
    return { id: "evt_1", eventType: "subscription.paid", object: { ...object, customer: { email: "private@example.com" } } };
  } };
  if (name === "@/lib/supabase/admin") return { createAdminClient: () => webhookAdmin };
  if (name === "@/lib/creem") return { mapCreemStatus: () => "active" };
  if (name === "@/lib/tiktok-pixel") return pixel;
  throw Error(name);
} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/api/webhooks/creem/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, webhookContext);
const webhookRequest = { text: async () => "signed-provider-payload", headers: {} };
assert.equal((await webhookContext.exports.POST(webhookRequest)).status, 401); assert.equal(writes.length, 0);
validSignature = true;
assert.equal((await webhookContext.exports.POST(webhookRequest)).status, 200);
assert.deepEqual(JSON.parse(JSON.stringify(writes[0])), {
  table: "tiktok_measurements", row: { kind: "payment", source_id: "tran_1", subscription_id: "sub_1" },
  options: { onConflict: "kind,source_id", ignoreDuplicates: true },
});
duplicateWebhook = true;
assert.equal((await webhookContext.exports.POST(webhookRequest)).body.duplicate, true);
assert.equal(writes.length, 2, "verified redelivery repairs telemetry before billing dedupe");
console.log("TikTok helper, payment validation, SQL delivery lifecycle, RLS and HTTP consent checks passed.");
