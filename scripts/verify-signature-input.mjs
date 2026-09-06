import assert from "node:assert/strict";
import { typedSignatureIsValid } from "../src/lib/signature-input.ts";

for (const value of ["Ada Lovelace", " 李 ", "AB", "  Grace Hopper  "]) {
  assert.equal(typedSignatureIsValid(value), true, `${JSON.stringify(value)} should pass`);
}
for (const value of ["", " ", "x".repeat(201)]) {
  assert.equal(typedSignatureIsValid(value), false, `${JSON.stringify(value)} should fail`);
}

console.log("Typed signature checks passed: 7 cases");
