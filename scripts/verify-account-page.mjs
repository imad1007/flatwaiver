import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let caller = { email: "owner@example.com", orgId: "org-a", role: "owner" };
let error = null, filters = [];
const query = {
  select: () => query,
  eq: (key, value) => { filters.push([key, value]); return query; },
  single: async () => ({ data: error ? null : { name: "Example business" }, error }),
};
const exports = {};
const code = ts.transpileModule(readFileSync(new URL("../src/app/(app)/settings/account/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, {
  exports,
  require(name) {
    if (name === "next/navigation") return { redirect: (href) => { throw new Error(`redirect:${href}`); } };
    if (name === "@/lib/auth") return { getOrgCaller: async () => caller };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ from: (table) => { assert.equal(table, "organizations"); return query; } }) };
    if (name === "@/lib/permissions") return { canManageBranding: (role) => ["admin", "owner"].includes(role) };
    if (name === "@/components/account-form") return { AccountForm: "account-form" };
    if (name === "@/components/data-load-error") return { DataLoadError: "load-error" };
    return require(name);
  },
});
for (const role of ["owner", "admin", "staff", "viewer"]) {
  caller.role = role;
  filters = [];
  const rendered = await exports.default();
  assert.equal(rendered.type, "account-form");
  assert.equal(rendered.props.email, caller.email);
  assert.equal(rendered.props.canEditBusiness, role === "owner" || role === "admin");
  assert.deepEqual(filters, [["id", "org-a"]]);
}
error = { message: "database unavailable" };
assert.equal((await exports.default()).props.retryHref, "/settings/account");
caller = null;
await assert.rejects(exports.default(), /redirect:\/login/);
console.log("Account page checks passed: scoped reads, role permissions, load failure and signed-out redirect.");
