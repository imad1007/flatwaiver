import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

let authorized = false, missing = false, failTable = null;
const requests = [];
const orgId = "00000000-0000-4000-8000-000000000001";
const customer = { org_id: orgId, name: "Example gym", owner_user_id: "owner", signature_count: 1234 };
function query(table) {
  const request = { table, filters: [], selection: null, limit: null };
  requests.push(request);
  const chain = {
    select: (selection, options) => { request.selection = selection; request.options = options; return chain; },
    eq: (key, value) => { request.filters.push([key, value]); return chain; },
    order: () => chain,
    limit: value => { request.limit = value; return chain; },
    maybeSingle: () => chain,
    then(resolve, reject) {
      const data = table === "admin_org_overview" ? (missing ? null : customer) :
        table === "waiver_templates" ? [{ id: "template", name: "Day pass", status: "published" }] :
        table === "signed_waivers" && !request.options?.head ? [{ id: "signature", template_id: "template", signed_at: "2026-10-03" }] : null;
      return Promise.resolve({ data, count: table === "profiles" ? 2 : 1234, error: failTable === table ? Error("DB unavailable") : null }).then(resolve, reject);
    },
  };
  return chain;
}
const context = { exports: {}, require: name => {
  if (name === "server-only") return {};
  if (name === "zod") return { z };
  if (name === "@/lib/admin") return { assertAdmin: async () => { if (!authorized) throw Error("Not authorized"); } };
  if (name === "@/lib/supabase/admin") return { createAdminClient: () => ({ from: query, auth: { admin: { getUserById: async id => {
    assert.equal(id, "owner"); return { data: { user: { id, user_metadata: { signed_waiver_emails: true } } }, error: null };
  } } } }) };
  throw Error(name);
} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/admin-customer-detail.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const load = context.exports.getAdminCustomerDetail;
await assert.rejects(load(orgId), /Not authorized/);
assert.equal(requests.length, 0, "unauthorized request never reaches service client");
authorized = true;
assert.equal(await load("not-a-uuid"), null); assert.equal(requests.length, 0);
missing = true; assert.equal(await load(orgId), null); assert.equal(requests.length, 1);
missing = false; requests.length = 0;
const detail = await load(orgId);
assert.equal(detail.customer.signature_count, 1234);
assert.equal(detail.waivers[0].signatureCount, 1234, "exact count is not truncated to recent activity size");
assert.equal(detail.recent.length, 1);
assert.equal(detail.memberCount, 2);
for (const request of requests) assert.ok(request.filters.some(([key, value]) => key === "org_id" && value === orgId), `${request.table} must be scoped`);
assert.equal(requests.find(r => r.table === "signed_waivers" && !r.options?.head).limit, 20);
assert.ok(requests.find(r => r.table === "signed_waivers" && r.options?.head).filters.some(([key]) => key === "template_id"));
failTable = "signed_waivers";
await assert.rejects(load(orgId), /DB unavailable/, "query failures must not masquerade as zero activity");
console.log("Customer detail checks passed: admin authorization, ID validation, org scope, exact counts, bounded activity and failure handling.");
