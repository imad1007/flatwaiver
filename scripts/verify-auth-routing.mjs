import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
let user = { email: "owner@example.com" }, authError = null;
const cache = new Map();
const env = { ADMIN_EMAILS: " ADMIN@example.com ", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" };
const client = {
  auth: {
    getUser: async () => ({ data: { user }, error: authError }),
    exchangeCodeForSession: async () => ({ data: { user }, error: authError }),
  },
};
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const exports = {};
  cache.set(relative, exports);
  const code = ts.transpileModule(readFileSync(new URL(`../src/${relative}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    exports, URL, process: { env },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@/lib/supabase/server") return { createClient: async () => client };
      if (name === "@supabase/ssr") return { createServerClient: (_url, _key, options) => {
        options.cookies.setAll([{ name: "session", value: "refreshed", options: { httpOnly: true } }]);
        return client;
      } };
      if (name.startsWith("@/")) return load(name.slice(2));
      return require(name);
    },
  });
  return exports;
}
const { authDestination } = load("lib/auth-destination");
assert.equal(authDestination("admin@example.com", "/settings/billing"), "/admin");
assert.equal(authDestination("ADMIN@EXAMPLE.COM"), "/admin");
assert.equal(authDestination("owner@example.com"), "/dashboard");
assert.equal(authDestination(null), "/dashboard");
assert.equal(authDestination("owner@example.com", "/invite/123?source=email"), "/invite/123?source=email");
for (const path of ["https://evil.example", "//evil.example", "/auth/continue", "/login", "/signup"]) {
  assert.equal(authDestination("owner@example.com", path), "/dashboard");
}
env.ADMIN_EMAILS = "";
assert.equal(authDestination("admin@example.com"), "/dashboard", "empty allowlist fails closed");
env.ADMIN_EMAILS = "admin@example.com";
const continuation = load("app/auth/continue/route").GET;
const callback = load("app/auth/callback/route").GET;
const proxy = load("proxy").default;
for (const email of ["admin@example.com", "owner@example.com"]) {
  user = { email };
  const expected = email.startsWith("admin") ? "/admin" : "/invite/123";
  for (const [handler, path] of [[continuation, "/auth/continue?next=/invite/123"], [callback, "/auth/callback?code=test&next=/invite/123"]]) {
    const response = await handler(new Request(`https://flatwaiver.com${path}`));
    assert.equal(new URL(response.headers.get("location")).pathname, expected);
  }
  for (const path of ["/login", "/signup"]) {
    const response = await proxy(new NextRequest(`https://flatwaiver.com${path}?next=/invite/123`));
    assert.equal(new URL(response.headers.get("location")).pathname, expected);
    assert.equal(response.cookies.get("session").value, "refreshed");
  }
}
user = null;
const unauthenticated = await continuation(new Request("https://flatwaiver.com/auth/continue?next=/settings/billing"));
assert.equal(new URL(unauthenticated.headers.get("location")).pathname, "/login");
authError = { message: "expired code" };
const failedCallback = await callback(new Request("https://flatwaiver.com/auth/callback?code=expired"));
assert.equal(new URL(failedCallback.headers.get("location")).search, "?error=auth");
console.log("Auth routing checks passed: admin/customer, password continuation, callback, existing sessions, safe destinations, and refreshed cookies.");
