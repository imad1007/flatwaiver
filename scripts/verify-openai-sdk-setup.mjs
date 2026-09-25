import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync("src/components/openai-pixel.tsx", "utf8");
let consent = null;
let ready = false;
let pathname = "/signup";
let measurementAttempts = 0;
let effects = [];
const browser = {};
const context = {
  exports: {}, window: browser,
  require: id => {
    if (id === "react") return { useEffect: fn => { effects.push(fn); }, useState: () => [ready, value => { ready = value; }] };
    if (id === "next/navigation") return { usePathname: () => pathname };
    if (id === "@/lib/openai-pixel") return { pixelPageMode: value => value === "/dashboard" ? "conversion" : "landing", measureSdkRegistration: () => { measurementAttempts++; } };
    if (id === "@/lib/consent") return { useConsent: () => consent };
    if (id === "next/script") return { default: "script", __esModule: true };
    if (id === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
    throw new Error(id);
  },
};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const render = context.exports.OpenAIPixel;
assert.equal(render({ enabled: true }), null);
consent = "granted";
assert.equal(render({ enabled: false }), null);
const script = render({ enabled: true });
assert.equal(script.props.id, "flatwaiver-openai-ads-pixel");
assert.equal(script.props.strategy, "afterInteractive");
const inserted = [];
const page = { document: { cookie: "fw-consent=granted", createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: el => inserted.push(el) } }] } };
page.window = page;
vm.runInNewContext(script.props.children, page);
assert.equal(inserted.length, 1);
assert.equal(inserted[0].src, "https://bzrcdn.openai.com/sdk/oaiq.min.js");
assert.equal(page.oaiq.q[0][0], "init");
assert.equal(page.oaiq.q[0][1].pixelId, "Wdj4prj2rJhsBuYu2cLejz");
assert.equal(page.oaiq.q[0][1].debug, true);
assert.ok(page.oaiq.q.every(args => args[0] !== "measure"));
vm.runInNewContext(script.props.children, page);
assert.equal(inserted.length, 1);
page.document.cookie = "fw-consent=denied";
const before = page.oaiq.q.length;
vm.runInNewContext(script.props.children, page);
assert.equal(page.oaiq.q.length, before);
const calls = [];
browser.oaiq = (...args) => calls.push(args);
consent = "denied";
effects = []; render({ enabled: true }); effects[0]();
assert.deepEqual(calls, [["consent", false]]);
assert.ok(source.includes("pixelPageMode(pathname)"));
console.log("SDK setup passed: exact config, one SDK insertion, environment/consent gates, denial race, withdrawal, no conversion calls. SDK network mocked.");

consent = "granted";
pathname = "/dashboard";
effects = []; render({ enabled: true }); effects[1]();
assert.equal(measurementAttempts, 0, "wait for SDK queue initialization");
script.props.onReady();
for (const route of ["/signup", "/login", "/w/example", "/auth/callback"]) {
  pathname = route; effects = []; render({ enabled: true }); effects[1]();
}
assert.equal(measurementAttempts, 0, "no claim from signup/login/public signer/callback");
pathname = "/dashboard";
effects = []; render({ enabled: true }); effects[1]();
assert.equal(measurementAttempts, 1, "claim only after queue and completion route");
consent = "denied";
effects = []; render({ enabled: true }); effects[1]();
assert.equal(measurementAttempts, 1);
console.log("Component wiring passed: readiness, route and consent gates.");
