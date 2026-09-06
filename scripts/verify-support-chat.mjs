import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual loader effect with a fake widget: no network or messages.
const code = ts.transpileModule(readFileSync(new URL("../src/components/live-chat.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let effect, cleanup, pathname = "/help", consent = "denied", status;
let shown = 0, hidden = 0, maximized = 0;
const listeners = new Map(), timers = new Map(), scripts = new Map();
let timerId = 0;
const window = {
  location: { hostname: "www.flatwaiver.com" },
  addEventListener: (key, fn) => listeners.set(key, fn),
  removeEventListener: (key) => listeners.delete(key),
};
const document = {
  getElementById: (id) => scripts.get(id),
  createElement: () => ({ setAttribute() {}, remove() { scripts.delete(this.id); } }),
  body: { appendChild: (script) => scripts.set(script.id, script) },
};
const exports = {};
vm.runInNewContext(code, {
  exports, window, document, Date, process: { env: {} },
  setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
  clearTimeout: (id) => timers.delete(id),
  require: (name) => {
    if (name === "react") return { useEffect: (fn) => { effect = fn; } };
    if (name === "next/navigation") return { usePathname: () => pathname };
    if (name === "@/lib/consent") return { useConsent: () => consent };
    if (name === "@/lib/signer-pages") return { isSignerPage: (path) => path.startsWith("/w/") || path.startsWith("/kiosk/") };
    if (name === "@/lib/chat") return { CHAT_REQUEST: "open", publishChatStatus: (value) => { status = value; } };
    throw new Error(`Unexpected import: ${name}`);
  },
});
function mount() { cleanup?.(); exports.LiveChat(); cleanup = effect(); }
mount();
assert.equal(scripts.size, 0, "declined consent must not load chat automatically");
listeners.get("open")();
assert.equal(scripts.size, 1, "explicit request loads one widget");
assert.equal(consent, "denied", "opening chat must not grant analytics consent");
listeners.get("open")();
assert.equal(scripts.size, 1, "repeated clicks must not duplicate the script");
for (const fn of timers.values()) fn();
assert.equal(status, "unavailable", "a stalled load offers fallback");
scripts.get("tawk-to").onerror();
assert.equal(scripts.size, 0, "script failures allow retry");
listeners.get("open")();
Object.assign(window.Tawk_API, {
  getStatus: () => "online", showWidget: () => shown++,
  hideWidget: () => hidden++, maximize: () => maximized++,
});
window.Tawk_API.onLoad();
assert.equal(status, "online");
assert.equal(maximized, 1, "queued click opens after API readiness");
window.Tawk_API.onStatusChange("offline");
assert.equal(status, "offline", "availability reflects the real widget");
pathname = "/w/example"; mount();
assert.equal(hidden, 1);
listeners.get("open")();
assert.equal(maximized, 1, "signer routes cannot open support chat");
pathname = "/help"; mount();
assert.ok(shown >= 2, "returning to the app restores the widget");
listeners.get("open")();
assert.equal(maximized, 2, "loaded widget can reopen");
cleanup();
assert.equal(listeners.size, 0);
assert.equal(timers.size, 0);
console.log("Support chat lifecycle checks passed.");
