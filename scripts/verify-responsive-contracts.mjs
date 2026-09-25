import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [tabs, checkin, renewals, shell, waiverRender, waiverEditor, signingForm] = await Promise.all([
  source("src/components/settings-tabs.tsx"),
  source("src/app/(app)/checkin/page.tsx"),
  source("src/components/renewals-table.tsx"),
  source("src/components/app-shell.tsx"),
  source("src/components/waiver-render.tsx"),
  source("src/components/waiver-editor.tsx"),
  source("src/components/signing-form.tsx"),
]);

assert.match(tabs, /overflow-x-auto/);
assert.match(tabs, /snap-x snap-mandatory/);
assert.match(tabs, /aria-current=\{active \? "page"/);
assert.match(tabs, /shrink-0 snap-start/);

for (const table of [checkin, renewals]) {
  assert.match(table, /overflow-x-auto/);
  assert.match(table, /min-w-\[720px\]/);
  assert.match(table, /<caption className="sr-only">/);
  assert.ok(table.match(/scope="col"/g)?.length >= 4);
}

assert.ok(
  shell.match(/className="hidden size-9[^"]*sm:inline-flex"/g)?.length >= 2,
  "secondary header controls stay out of the narrowest viewport"
);

assert.match(waiverRender, /\[overflow-wrap:anywhere\]/);
assert.ok(waiverRender.match(/waiverTextWrapClass/g)?.length >= 5);
assert.match(waiverEditor, /overflow-x-hidden overflow-y-auto/);
assert.match(signingForm, /min-w-0 space-y-4 overflow-x-hidden/);

console.log("responsive contracts passed (tabs, 2 data tables, narrow header, imported waiver text containment)");
