import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [editor, page, types, schema, importRoute, actions, renewal, photo] = await Promise.all([
  source("src/components/waiver-editor.tsx"),
  source("src/app/(app)/waivers/[id]/page.tsx"),
  source("src/lib/types.ts"),
  source("src/lib/waiver-schema.ts"),
  source("src/app/api/ai-import/route.ts"),
  source("src/app/(app)/waivers/actions.ts"),
  source("src/components/waiver-renewal-setting.tsx"),
  source("src/components/waiver-photo-setting.tsx"),
]);

// The document remains backed by the existing block and field model.
assert.match(types, /type WaiverBlock/);
assert.match(types, /interface WaiverField/);
assert.match(schema, /blocks:\s*z\.array/);
assert.match(schema, /fields:\s*z\.array/);
assert.doesNotMatch(editor, /contentEditable/);

// Imported text and its diagnostics/source remain available to the editor.
assert.match(importRoute, /draft_content/);
assert.match(importRoute, /warnings/);
assert.match(editor, /warnings\.map/);
assert.match(editor, /label="Compare with original"/);
assert.match(editor, /bucket="uploads"/);

// The editor is a toolbar and continuous document; preview/settings are overlays.
assert.match(editor, /xl:grid-cols-\[240px_minmax\(0,1fr\)\]/);
assert.match(editor, /rounded-t-2xl/);
assert.match(editor, /rounded-b-2xl/);
assert.match(editor, /<Dialog open=\{previewOpen\}/);
assert.match(editor, /Mobile preview/);
assert.match(editor, /Desktop preview/);
assert.match(editor, /<Sheet open=\{settingsOpen\}/);
assert.match(editor, /<Sheet open=\{toolsOpen\}/);
assert.doesNotMatch(editor, /xl:grid-cols-\[[^\]]+_[^\]]+_[^\]]+\]/);

// Authoring operations and keyboard-accessible alternatives stay wired.
for (const contract of [
  /onBlockDragEnd/,
  /onFieldDragEnd/,
  /Duplicate block/,
  /Remove block/,
  /Move block up/,
  /Move block down/,
  /Duplicate field/,
  /Remove field/,
  /Move field up/,
  /Move field down/,
]) assert.match(editor, contract);

// All supported custom signer input types remain selectable. Signature and legal
// name stay built-in and are not represented as invented custom field types.
for (const type of ["text", "multiline", "email", "phone", "date", "date_of_birth", "select", "checkbox", "initials"]) {
  assert.match(editor, new RegExp(`addField\\(\\"${type}\\"`));
}
assert.match(editor, /signature capture are included automatically/i);

// Save/publish, recovery, archive, renewal and photo settings remain connected.
assert.match(editor, /saveDraft\(template\.id/);
assert.match(editor, /publishTemplate\(template\.id/);
assert.match(editor, /beforeunload/);
assert.match(editor, /sessionStorage\.setItem/);
assert.match(editor, /archiveTemplate\(template\.id\)/);
assert.match(editor, /unarchiveTemplate\(template\.id\)/);
assert.match(page, /<WaiverRenewalSetting/);
assert.match(page, /<WaiverPhotoSetting/);
assert.match(page, /settings=\{/);
assert.match(renewal, /onChange=\{\(e\) => update/);
assert.match(renewal, /setWaiverExpiry\(templateId, next\)/);
assert.match(photo, /onChange=\{\(e\) => update/);
assert.match(photo, /setPhotoMode\(templateId, next\)/);
assert.doesNotMatch(renewal, />Save</);
assert.doesNotMatch(photo, />Save</);
assert.match(actions, /subscriptionIsUsable/);
assert.match(actions, /publish_template_version/);

console.log("waiver editor UX contracts passed (continuous document, overlays, full field palette, persistence and settings)");
