import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const inserted = [], calls = [], timers = [];
let consent = "granted", path = "/signup", ready = false, effects = [];
const page = { URL, URLSearchParams, document: {
  cookie: "fw-consent=granted", createElement: () => ({}),
  getElementsByTagName: () => [{ parentNode: { insertBefore: el => inserted.push(el) } }],
} };
page.window = page;
page.location = { pathname: path, href: `https://www.flatwaiver.com${path}` };
page.setInterval = callback => { timers.push(callback); return 1; };
page.clearInterval = () => {};
const libContext = { exports: {}, ...page };
vm.runInNewContext(compile(fs.readFileSync("src/lib/tiktok-pixel.ts", "utf8")), libContext);
const lib = libContext.exports;
const lastPage = { current: null };
const context = { exports: {}, window: page, require: name => {
  if (name === "react") return { useEffect: fn => effects.push(fn), useRef: () => lastPage, useState: () => [ready, value => { ready = value; }] };
  if (name === "next/navigation") return { usePathname: () => path };
  if (name === "@/lib/consent") return { useConsent: () => consent };
  if (name === "@/lib/tiktok-pixel") return lib;
  if (name === "next/script") return { default: "script", __esModule: true };
  if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
  throw Error(name);
}, fetch: async () => { calls.push("reserve"); return { status: 200, json: async () => ({ events: [] }) }; } };
vm.runInNewContext(compile(fs.readFileSync("src/components/tiktok-pixel.tsx", "utf8")), context);
const render = context.exports.TikTokPixel;
assert.equal(render({ enabled: false }), null);
consent = "denied"; assert.equal(render({ enabled: true }), null);
consent = "granted";
const script = render({ enabled: true });
assert.equal(script.props.id, "flatwaiver-tiktok-pixel");
assert.equal(script.props.strategy, "afterInteractive");
vm.runInNewContext(script.props.children, page);
vm.runInNewContext(script.props.children, page);
assert.equal(inserted.length, 1, "one SDK insertion even if setup runs twice");
assert.equal(inserted[0].src, "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=DB02IERC77U04C8LUG70&lib=ttq");
script.props.onReady();
assert.equal(ready, false, "inline-script readiness is not SDK readiness");
page.ttq.find(command => command[0] === "ready")[1]();
assert.equal(ready, true);
page.ttq = {
  grantConsent: () => calls.push("grant"), revokeConsent: () => calls.push("revoke"),
  disableCookie: () => calls.push("disableCookie"), page: () => calls.push("page"),
};
effects = []; render({ enabled: true }); effects.forEach(fn => fn());
assert.equal(calls.filter(c => c === "page").length, 1);
assert.equal(calls.includes("reserve"), false, "signup page cannot request conversions");
effects = []; render({ enabled: true }); effects.forEach(fn => fn());
assert.equal(calls.filter(c => c === "page").length, 1, "rerender does not repeat page event");
path = "/dashboard"; page.location = { pathname: path, href: `https://www.flatwaiver.com${path}` };
effects = []; render({ enabled: true }); effects.forEach(fn => fn());
await new Promise(resolve => setImmediate(resolve));
assert.equal(calls.filter(c => c === "reserve").length, 1);
consent = "denied"; page.document.cookie = "fw-consent=denied";
effects = []; assert.equal(render({ enabled: true }), null); effects.forEach(fn => fn());
assert.equal(calls.at(-2), "revoke"); assert.equal(calls.at(-1), "disableCookie");
await timers[0]();
assert.equal(calls.filter(c => c === "reserve").length, 1, "revocation stops polling");
consent = "granted"; page.document.cookie = "fw-consent=granted";
path = "/w/private-waiver"; page.location = { pathname: path, href: `https://www.flatwaiver.com${path}` };
effects = []; assert.equal(render({ enabled: true }), null); effects.forEach(fn => fn());
assert.equal(calls.at(-2), "revoke", "SPA navigation into a signer page revokes SDK consent");
delete page.ttq;
vm.runInNewContext(script.props.children, page);
assert.equal(inserted.length, 1, "late script cannot initialize on private route");
const root = fs.readFileSync("src/app/layout.tsx", "utf8");
assert.equal((root.match(/<TikTokPixel /g) || []).length, 1);
console.log("TikTok real setup, one initialization, SDK readiness, page/consent/route lifecycle checks passed.");
