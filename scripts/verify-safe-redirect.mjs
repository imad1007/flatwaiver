import assert from "node:assert/strict";
import { safeInternalPath } from "../src/lib/safe-redirect.ts";

const accepted = new Map([
  ["/dashboard", "/dashboard"],
  ["/invite/123?source=email#join", "/invite/123?source=email#join"],
  ["/%E2%9C%93", "/%E2%9C%93"],
]);

for (const [input, expected] of accepted) {
  assert.equal(safeInternalPath(input), expected, `accept ${input}`);
}

const rejected = [
  undefined,
  null,
  "",
  "dashboard",
  "https://evil.example/phish",
  "//evil.example/phish",
  "/\\evil.example/phish",
  "/%5Cevil.example/phish",
  "/%2F%2Fevil.example/phish",
  "/%252F%252Fevil.example/phish",
  "/dashboard\nSet-Cookie:x",
  "/%not-valid",
];

for (const input of rejected) {
  assert.equal(safeInternalPath(input), "/dashboard", `reject ${String(input)}`);
}

assert.equal(safeInternalPath("//evil.example", "/login"), "/login");
console.log(`safe redirect verification passed (${accepted.size + rejected.length + 1} cases)`);
