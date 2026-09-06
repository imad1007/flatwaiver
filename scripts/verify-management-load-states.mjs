import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [layout, loading, dashboard, waiverList, waiverEditor, share, signatures, exports] =
  await Promise.all([
    source("src/app/(app)/layout.tsx"),
    source("src/app/(app)/loading.tsx"),
    source("src/app/(app)/dashboard/page.tsx"),
    source("src/app/(app)/waivers/page.tsx"),
    source("src/app/(app)/waivers/[id]/page.tsx"),
    source("src/app/(app)/waivers/[id]/share/page.tsx"),
    source("src/app/(app)/signatures/page.tsx"),
    source("src/components/signature-export-buttons.tsx"),
  ]);

assert.match(layout, /error: authError/);
assert.match(layout, /if \(authError\) throw/);
assert.match(layout, /profileError \|\| !profile/);
assert.match(layout, /orgResult\.error/);
assert.match(layout, /subscriptionResult\.error/);
assert.match(layout, /flaggedResult\.error/);
assert.ok(
  layout.indexOf("orgResult.error") < layout.indexOf("if (businessNameMissing"),
  "shell query failures are handled before onboarding decisions",
);

assert.match(loading, /role="status"/);
assert.match(loading, /aria-label="Loading page"/);
assert.match(loading, /sr-only/);
assert.match(dashboard, /firstDraft \? `\/waivers\/\$\{firstDraft\.id\}`/);
assert.match(dashboard, /`\/waivers\/\$\{firstPublished\.id\}\/share`/);

assert.match(waiverList, /error \?/);
assert.match(waiverList, /retryHref="\/waivers"/);
assert.match(waiverEditor, /if \(templateError\)/);
assert.match(waiverEditor, /if \(versionsError\)/);
assert.match(waiverEditor, /incorrect next version cannot be published/);
assert.match(share, /if \(error\)/);
assert.match(share, /retryHref=\{`\/waivers\/\$\{id\}\/share`\}/);
assert.match(signatures, /signaturesError \|\| templatesError/);
assert.match(signatures, /waiver filters again/);
assert.match(signatures, /<SignatureExportButtons query=\{exportQuery\.toString\(\)\}/);
assert.doesNotMatch(signatures, /href=\{`\/api\/signatures\/export/);
assert.match(exports, /if \(!response\.ok\)/);
assert.match(exports, /await response\.blob\(\)/);
assert.match(exports, /blob\.size === 0/);
assert.match(exports, /URL\.revokeObjectURL/);
assert.match(exports, /role="alert"/);

console.log(
  "management load-state contracts passed (shell, loading UI, collections, editor, sharing)",
);
