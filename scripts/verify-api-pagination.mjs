import assert from "node:assert/strict";
import { shapeCursorPage } from "../src/lib/public-api.ts";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.deepEqual(shapeCursorPage(rows, 3), {
  data: rows,
  hasMore: false,
  nextCursor: null,
});
assert.deepEqual(shapeCursorPage(rows, 2), {
  data: rows.slice(0, 2),
  hasMore: true,
  nextCursor: "b",
});
assert.deepEqual(shapeCursorPage([], 50), {
  data: [],
  hasMore: false,
  nextCursor: null,
});

console.log("API pagination checks passed: 3 scenarios");
