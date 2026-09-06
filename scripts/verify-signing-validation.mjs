import assert from "node:assert/strict";
import { isRealIsoDate } from "../src/lib/signing-validation.ts";

for (const value of ["2024-02-29", "2026-09-05", "2000-02-29"]) {
  assert.equal(isRealIsoDate(value), true, `${value} should be valid`);
}

for (const value of [
  "2023-02-29",
  "2026-02-30",
  "2026-13-01",
  "2026-00-10",
  "2026-9-05",
  "not-a-date",
]) {
  assert.equal(isRealIsoDate(value), false, `${value} should be invalid`);
}

console.log("Signing date checks passed: 9 cases");
