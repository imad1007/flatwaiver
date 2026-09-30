import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { billingLifecyclePhase, canAcceptPublicSignatures } from "../src/lib/billing-lifecycle.ts";

const now = Date.parse("2026-09-28T12:00:00Z");
const sub = (status, trial_ends_at, public_signing_suspended_at = null) => ({ status, trial_ends_at, public_signing_suspended_at });
const end = now + 14 * 86400000;
const trial = sub("trialing", new Date(end).toISOString());
const { APP } = await import("../src/lib/config.ts");
assert.equal(APP.trialDays, 14);
for (const [days, phase] of [[13,"trial"],[14,"grace"],[15,"grace"],[20,"warning"],[21,"suspended"],[22,"suspended"]]) {
  const time = now + days * 86400000;
  assert.equal(billingLifecyclePhase(trial,time), phase);
  assert.equal(canAcceptPublicSignatures(trial,time), phase !== "suspended");
  assert.equal(canAcceptPublicSignatures({...trial,status:"active",public_signing_suspended_at:new Date(now).toISOString()},time), true);
}
assert.equal(canAcceptPublicSignatures(trial,end+7*86400000-1),true);
assert.equal(billingLifecyclePhase({...trial,public_signing_suspended_at:new Date(end).toISOString()},end+4*86400000),"grace");
assert.equal(canAcceptPublicSignatures(sub("active",null)),true);
assert.equal(canAcceptPublicSignatures(sub("canceled",null)),false);

const migration = await readFile(new URL("../supabase/migrations/0023_billing_lifecycle.sql", import.meta.url), "utf8");
const graceMigration = await readFile(new URL("../supabase/migrations/0024_seven_day_post_trial_grace.sql", import.meta.url), "utf8");
const cron = await readFile(new URL("../src/app/api/cron/billing-expiry/route.ts", import.meta.url), "utf8");
const webhook = await readFile(new URL("../src/app/api/webhooks/creem/route.ts", import.meta.url), "utf8");
const signRoute = await readFile(new URL("../src/app/api/sign/[slug]/route.ts", import.meta.url), "utf8");
const publicPage = await readFile(new URL("../src/app/w/[slug]/page.tsx", import.meta.url), "utf8");
const vercel = await readFile(new URL("../vercel.json", import.meta.url), "utf8");

assert.match(migration, /for update/i, "lifecycle rows are locked against payment races");
assert.match(migration, /on conflict \(org_id, recipient_id, kind, episode\) do nothing/i);
assert.match(migration, /claim_billing_expiry_emails[\s\S]*kind <> 'suspension-warning'/i, "old deployments cannot claim new warning jobs");
assert.doesNotMatch(migration, /(update|delete from) public\.waiver_templates/i);
assert.doesNotMatch(migration, /(update|delete from) public\.signed_waivers/i);
assert.match(cron, /process_billing_lifecycle/);
assert.match(webhook, /public_signing_suspended_at: null/);
assert.ok(signRoute.indexOf("if (!waiver.acceptingSignatures)") < signRoute.indexOf('.from("signatures")'), "billing is checked before evidence uploads");
assert.match(signRoute, /jsonError\("This waiver is temporarily unavailable\.", 403\)/);
assert.match(publicPage, /This waiver is temporarily unavailable because this organization&apos;s FlatWaiver subscription requires attention\./);
assert.match(publicPage, /\.eq\("org_id", orgId\)[\s\S]*\.eq\("role", "owner"\)/);
assert.equal(JSON.parse(vercel).crons.find((job) => job.path === "/api/cron/billing-expiry").schedule, "15 * * * *");

const db = new PGlite();
await db.exec(`
  create schema auth;
  create table public.organizations(id uuid primary key, name text not null);
  create table auth.users(id uuid primary key, email text);
  create table public.profiles(id uuid primary key, org_id uuid not null, role text not null);
  create table public.waiver_templates(id uuid primary key, org_id uuid not null, status text not null);
  create table public.signed_waivers(id uuid primary key, org_id uuid not null);
  create table public.subscriptions(
    org_id uuid primary key, status text not null, trial_ends_at timestamptz,
    current_period_end timestamptz, creem_subscription_id text, stripe_subscription_id text
  );
  create role anon; create role authenticated; create role service_role;
`);
await db.exec(migration);
await db.exec(graceMigration);
await db.exec(graceMigration);

const ids = [1,2,3,4].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
for (let i = 0; i < ids.length; i++) {
  await db.query("insert into public.organizations values ($1,$2)", [ids[i], `Org ${i}`]);
  await db.query("insert into auth.users values ($1,$2)", [ids[i], `owner${i}@example.test`]);
  await db.query("insert into public.profiles values ($1,$1,'owner')", [ids[i]]);
}
await db.query("insert into public.waiver_templates values ('10000000-0000-4000-8000-000000000001',$1,'published'),('10000000-0000-4000-8000-000000000002',$2,'draft'),('10000000-0000-4000-8000-000000000003',$3,'archived')", ids.slice(0,3));
await db.query("insert into public.signed_waivers values ('20000000-0000-4000-8000-000000000001',$1)", [ids[2]]);
await db.query("insert into public.subscriptions(org_id,status,trial_ends_at) values ($1,'trialing',now()-interval '1 hour'),($2,'trialing',now()-interval '145 hours'),($3,'trialing',now()-interval '169 hours')", ids.slice(0,3));
await db.query("insert into public.subscriptions(org_id,status,trial_ends_at,billing_grace_started_at,public_signing_suspended_at) values ($1,'active',now()-interval '80 hours',now()-interval '80 hours',now()-interval '8 hours')", [ids[3]]);

await db.query("select * from public.process_billing_lifecycle(20)");
const lifecycle = await db.query("select org_id::text,status,billing_grace_started_at is not null grace,public_signing_suspended_at is not null suspended from public.subscriptions order by org_id");
assert.deepEqual(lifecycle.rows.map((r) => [r.status, r.grace, r.suspended]), [
  ["trialing", true, false], ["trialing", true, false], ["trialing", true, true], ["active", false, false],
]);
const notices = await db.query("select org_id::text,kind,status from public.billing_expiry_emails order by org_id,kind");
assert.deepEqual(notices.rows.map((r) => [r.kind, r.status]), [
  ["trial-ended", "sending"],
  ["suspension-warning", "sending"], ["trial-ended", "skipped"],
  ["suspension-warning", "skipped"], ["trial-ended", "skipped"],
]);
await db.query("select * from public.process_billing_lifecycle(20)");
const count = await db.query("select count(*)::int count from public.billing_expiry_emails");
assert.equal(count.rows[0].count, 5, "repeated processing does not duplicate notices");
const templates = await db.query("select status from public.waiver_templates order by id");
assert.deepEqual(templates.rows.map((r) => r.status), ["published", "draft", "archived"]);
const history = await db.query("select count(*)::int count from public.signed_waivers");
assert.equal(history.rows[0].count, 1, "signed history remains untouched");
// Verify the SQL scheduler at exact boundaries in one fixed-time transaction.
await db.exec("begin");
for (const [days, suspended, kinds] of [[-1,false,[]],[0,false,["trial-ended"]],[1,false,["trial-ended"]],[6,false,["suspension-warning"]],[7,true,[]],[8,true,[]]]) {
  await db.exec("delete from public.billing_expiry_emails");
  await db.query("update public.subscriptions set status='trialing',trial_ends_at=now()-($1::int * interval '1 day'),public_signing_suspended_at=null where org_id=$2",[days,ids[0]]);
  await db.query("select * from public.process_billing_lifecycle(20)");
  const state=await db.query("select public_signing_suspended_at is not null suspended from public.subscriptions where org_id=$1",[ids[0]]);
  assert.equal(state.rows[0].suspended,suspended);
  const candidates=await db.query("select kind from public.billing_expiry_candidates where org_id=$1 order by kind",[ids[0]]);
  assert.deepEqual(candidates.rows.map(r=>r.kind),kinds);
}
await db.exec("rollback");
const trialEndsBefore = await db.query("select org_id,trial_ends_at from public.subscriptions order by org_id");
await db.query("update public.subscriptions set status='active' where org_id in ($1,$2)",[ids[1],ids[2]]);
await db.query("select * from public.process_billing_lifecycle(20)");
const paid = await db.query("select public_signing_suspended_at,billing_grace_started_at from public.subscriptions where status='active'");
assert.ok(paid.rows.every(r=>r.public_signing_suspended_at===null && r.billing_grace_started_at===null));
assert.deepEqual((await db.query("select org_id,trial_ends_at from public.subscriptions order by org_id")).rows,trialEndsBefore.rows);
await db.close();

console.log("Billing lifecycle passed: 14-day trial, six-day warning, seven-day post-trial suspension, payment reactivation, idempotency, race locks and API enforcement.");
