import { csvEscape } from "../src/lib/csv.ts";

const cases = [
  ["Alice", "Alice"],
  ["Doe, Jane", '"Doe, Jane"'],
  ["=2+2", "'=2+2"],
  ["  @SUM(A1:A2)", "'  @SUM(A1:A2)"],
  ["line1\nline2", '"line1\nline2"'],
  ['a"b', '"a""b"'],
];

for (const [input, expected] of cases) {
  const actual = csvEscape(input);
  if (actual !== expected) {
    throw new Error(
      `CSV escaping mismatch: ${JSON.stringify({ input, expected, actual })}`
    );
  }
}

console.log(`CSV escaping checks passed: ${cases.length}`);
