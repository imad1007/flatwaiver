import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [editor, newWaiver, actions, importRoute, migration] = await Promise.all([
  source("src/components/waiver-editor.tsx"),
  source("src/app/(app)/waivers/new/page.tsx"),
  source("src/app/(app)/waivers/actions.ts"),
  source("src/app/api/ai-import/route.ts"),
  source("supabase/migrations/0015_atomic_template_publish.sql"),
]);

assert.match(editor, /flatwaiver:draft:\$\{template\.id\}/);
assert.match(editor, /sessionStorage\.setItem\(recoveryKey/);
assert.match(editor, /draftContentSchema\.safeParse/);
assert.match(editor, /Restore changes/);
assert.match(editor, /Discard backup/);
assert.match(editor, /clearRecovery\(\)/);
assert.match(editor, /template\.source_pdf_path/);
assert.match(editor, /label="Open original file"/);

assert.match(newWaiver, /flatwaiver:new-waiver:scratch/);
assert.match(newWaiver, /value=\{name\}/);
assert.match(newWaiver, /value=\{text\}/);
assert.match(newWaiver, /sessionStorage\.setItem/);
assert.match(newWaiver, /sessionStorage\.removeItem/);
assert.match(newWaiver, /recovered === true/);
assert.match(newWaiver, /reason: "recovery_draft"/);

assert.ok(
  importRoute.indexOf("const sourcePath") <
    importRoute.indexOf("convertDocument(userContent, false)"),
  "the private source is stored before conversion starts",
);
assert.ok(
  importRoute.indexOf("const fallbackDraft") <
    importRoute.indexOf("convertDocument(userContent, false)"),
  "the recovery draft is created before conversion starts",
);
assert.match(importRoute, /recovered: true/);
assert.match(importRoute, /error: subscriptionError/);
assert.match(importRoute, /\{ status: 503 \}/);
assert.match(importRoute, /Your original is saved/);
assert.match(importRoute, /\.update\(\{[\s\S]*draft_content: draft/);
assert.equal(
  importRoute.match(/cleanupUncommittedUpload\(/g)?.length,
  2,
  "only a failed fallback insert cleans up the source; conversion failures retain it",
);

assert.match(actions, /await saveDraft\(templateId, draft, name\)/);
assert.match(actions, /data: sub, error/);
assert.match(actions, /We couldn't verify your subscription/);
assert.match(actions, /draftHasMeaningfulContent\(draft\)/);
assert.match(actions, /Add your waiver text before publishing/);
assert.match(actions, /\.rpc\(\s*"publish_template_version"/);
assert.match(actions, /Nothing partial went live; try again/);

assert.match(migration, /security invoker/i);
assert.match(migration, /for update/);
assert.match(migration, /insert into template_versions/);
assert.match(migration, /update waiver_templates/);
assert.match(migration, /grant execute[\s\S]*to authenticated/);
assert.match(migration, /revoke all[\s\S]*from public, anon/);

console.log(
  "waiver draft recovery contracts passed (source retention, tab backup, atomic publish)",
);
