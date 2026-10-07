import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { groupParticipants, csvRecord, CSV_COLUMNS, parseCsv } from '../src/lib/data-transfer-core.mjs';
const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server');
const jsx = require('react/jsx-runtime');
let record;
const db = { from(table) { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ error: null, data: table === 'signed_waivers' ? record : table === 'waiver_templates' ? { name: 'Waiver' } : { version_number: 1 } }) }; } };
const dependencies = {
  'react/jsx-runtime': jsx,
  'next/link': { default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }) },
  'next/navigation': { notFound: () => { throw Error('not found'); } },
  '@/lib/supabase/server': { createClient: async () => db },
  '@/lib/supabase/admin': { createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl: async path => {
    assert.ok(path.startsWith('org/')); return { data: { signedUrl: `https://private.test/${path}` } };
  } }) } }) },
  '@/components/file-download-button': { FileDownloadButton: () => jsx.jsx('button', { children: 'Download signed PDF' }) },
  '@/components/data-load-error': { DataLoadError: () => null },
};
const loaded = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync('src/app/(app)/signatures/[id]/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function('require', 'module', 'exports', compiled)(id => { assert.ok(id in dependencies, id); return dependencies[id]; }, loaded, loaded.exports);
const base = { id: 'record', org_id: 'org', signer_name: 'Contact', signed_at: '2026-10-07T12:00:00Z', field_values: {}, pdf_path: 'org/record.pdf', is_minor: false, photo_path: null, consent_given: true };
for (const count of [undefined, 1, 2, 10]) {
  record = { ...base, participants: count ? Array.from({ length: count }, (_, i) => ({ full_name: `Person ${i + 1}`, signature_path: `org/record/p${i}.png`, is_minor: false, guardian_signature_path: null })) : null };
  const html = renderToStaticMarkup(await loaded.exports.default({ params: Promise.resolve({ id: 'record' }) }));
  assert.equal(html.includes('Group waiver'), Boolean(count));
  assert.ok(html.includes('Download signed PDF'));
  for (let i = 1; i <= (count ?? 0); i++) assert.ok(html.includes(`Person ${i}`));
  assert.equal((html.match(/<img /g) ?? []).length, count ?? 0);
}
record.participants[0].full_name = '<script>alert(1)</script>';
record.participants[0].signature_path = 'other-org/private.png';
const html = renderToStaticMarkup(await loaded.exports.default({ params: Promise.resolve({ id: 'record' }) }));
assert.ok(!html.includes('<script>'));
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(html.includes('Signature preview unavailable'));
assert.ok(!html.includes('https://private.test/other-org'));
const restored = { participant_name: 'Contact', source_evidence: { backup_exported_record: { participants: [{ full_name: 'Restored participant' }] } } };
assert.equal(groupParticipants(restored)[0].full_name, 'Restored participant');
const csv = parseCsv(CSV_COLUMNS.join(',') + '\r\n' + csvRecord(restored, []));
assert.equal(JSON.parse(csv.rows[0][CSV_COLUMNS.indexOf('participant_names')])[0], 'Restored participant');
console.log('PASS: actual completed single/group views, all names/signatures, XSS escaping, org-prefix defense and restored group CSV metadata');
