import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let server = false;
let cookie = "";
const events = [];
const listeners = new Map();
const context = {
  exports: {},
  require: () => ({ useSyncExternalStore: (_subscribe, client, ssr) => server ? ssr() : client() }),
  document: { get cookie() { return cookie; }, set cookie(value) { events.push(value); cookie = value.split(";")[0]; } },
  window: {
    dispatchEvent: event => events.push(event.type),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  },
  localStorage: { setItem: () => {} },
  Event,
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/consent.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
// React is stubbed above to exercise the client/server snapshot contracts.
const { useConsent: readSnapshot, useConsentReady: readReady, setConsent } = context.exports;
server = true;
assert.equal(readReady(), false);
assert.equal(readSnapshot(), null);
server = false;
assert.equal(readReady(), true);
for (const value of ["granted", "denied"]) {
  cookie = "other=value; fw-consent=" + value;
  assert.equal(readSnapshot(), value);
}
cookie = "fw-consent=granted-invalid";
assert.equal(readSnapshot(), null);
cookie = "";
assert.equal(readSnapshot(), null);
setConsent("granted");
assert.ok(events.some(value => value.includes("max-age=31536000")));
assert.ok(events.includes("fw-consent-change"));
context.localStorage.setItem = () => { throw new Error("Blocked storage"); };
assert.doesNotThrow(() => setConsent("denied"));
assert.ok(events.some(value => value.startsWith("fw-openai-oppref=;")));
const banner = fs.readFileSync("src/components/cookie-consent.tsx", "utf8");
assert.ok(banner.includes("!ready || consent !== null || isSignerPage(pathname)"));
console.log("Cookie consent passed: hydration readiness, saved choices, strict cookie parsing, persistence, attribution cleanup and blocked local storage.");
