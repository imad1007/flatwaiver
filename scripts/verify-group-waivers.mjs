import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { validateGroupSubmission, decodeSignature } from '../src/lib/group-signing.ts';
import { shapeSignature } from '../src/lib/public-api.ts';
import { contentSha256 } from '../src/lib/canonical.ts';
import { csvRecord, CSV_COLUMNS, parseCsv } from '../src/lib/data-transfer-core.mjs';
const require = createRequire(import.meta.url);
const trees = [];
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} }; cache.set(file, loaded.exports);
  const local = id => {
    if (id === 'server-only') return {};
    if (id === '@react-pdf/renderer') {
      const renderer = require(id);
      return { ...renderer, renderToBuffer: element => { trees.push(element.type(element.props)); return renderer.renderToBuffer(element); } };
    }
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync));
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', output)(local, loaded, loaded.exports);
  return loaded.exports;
}
const png = await require('sharp')({ create: { width: 100, height: 30, channels: 3, background: '#123456' } }).png().toBuffer();
const signature = 'data:image/png;base64,' + png.toString('base64');
const participant = i => ({ fullName: `Person ${i}`, dateOfBirth: `1990-02-${String(i).padStart(2, "0")}`, signatureDataUrl: signature, isMinor: false });
for (const dob of [undefined, null, '', '2023-02-29', '2000-02-30', '0000-01-01', '9999-01-01', '1990-1-01', 123, '1990-01-01T00:00:00Z']) {
 assert.match(validateGroupSubmission(true, 'allowed', 1, [{ ...participant(1), dateOfBirth: dob }]).error, /Participant 1:.*date of birth/);
}
assert.equal(validateGroupSubmission(true, 'allowed', 1, [{ ...participant(1), dateOfBirth: '2000-02-29' }]).error, undefined);
assert.equal(validateGroupSubmission(true, 'allowed', 1, [{ ...participant(1), dateOfBirth: new Date().toISOString().slice(0,10) }]).error, undefined);
assert.ok(decodeSignature(signature));
assert.equal(decodeSignature(signature + '!'), null);
assert.equal(decodeSignature('data:image/png;base64,' + png.subarray(0, 45).toString('base64')), null);
assert.deepEqual(validateGroupSubmission(false, 'allowed', undefined, undefined).participants, []);
for (const count of [1, 2, 10]) {
  const input = Array.from({ length: count }, (_, i) => participant(i + 1));
  assert.deepEqual(validateGroupSubmission(true, 'allowed', count, input).participants, input);
}
for (const count of [0, 11, -1, 1.5, '2']) assert.ok(validateGroupSubmission(true, 'allowed', count, []).error);
for (const input of [null, {}, [null], [{ ...participant(1), fullName: '' }], [{ ...participant(1), signatureDataUrl: '' }], [{ ...participant(1), extra: true }]]) {
  assert.ok(validateGroupSubmission(true, 'allowed', 1, input).error);
}
assert.ok(validateGroupSubmission(true, 'allowed', 2, [participant(1)]).error);
assert.ok(validateGroupSubmission(false, 'allowed', 1, [participant(1)]).error);
const minor = { ...participant(1), isMinor: true, guardianName: 'Parent', guardianRelationship: 'Parent', guardianSignatureDataUrl: signature };
assert.equal(validateGroupSubmission(true, 'allowed', 1, [minor]).error, undefined);
assert.ok(validateGroupSubmission(true, 'disallowed', 1, [minor]).error);
assert.ok(validateGroupSubmission(true, 'allowed', 1, [{ ...minor, guardianSignatureDataUrl: undefined }]).error);
assert.ok(validateGroupSubmission(true, 'allowed', 1, [{ ...participant(1), guardianName: 'Extra' }]).error);
assert.equal(contentSha256([], [], 'consent'), contentSha256([], [], 'consent', false));
assert.notEqual(contentSha256([], [], 'consent'), contentSha256([], [], 'consent', true));
const { signerText } = load('src/lib/signer-language.ts');
for (const text of ['Number of participants', 'Group participants', 'Participant name', 'Full name is required.']) assert.notEqual(signerText(text, 'fr'), text);
assert.equal(signerText('Number of participants', 'fr'), 'Nombre de participants');
assert.ok(signerText('Guardian name, relationship, and signature are required.', 'fr').includes('représentant légal'));
const stored = Array.from({ length: 10 }, (_, i) => ({ full_name: `Person ${i + 1}`, date_of_birth: `1990-02-${String(i + 1).padStart(2, "0")}`, signature_path: `org/id/participant-${i + 1}.png`, is_minor: false, guardian_name: null, guardian_relationship: null, guardian_signature_path: null }));
assert.deepEqual(shapeSignature({ participants: stored }).participants.map(p=>[p.full_name,p.date_of_birth]),stored.map(p=>[p.full_name,p.date_of_birth]));
assert.equal(shapeSignature({participants:[{full_name:'Legacy',is_minor:false}]}).participants[0].date_of_birth,null);
const csv = parseCsv(CSV_COLUMNS.join(',') + '\r\n' + csvRecord({ record_origin: 'native', participant_name: 'Person 1', participants: stored }, []));
assert.equal(csv.rows[0][CSV_COLUMNS.indexOf('participant_count')], '10');
assert.deepEqual(JSON.parse(csv.rows[0][CSV_COLUMNS.indexOf('participants_json')]), stored);
assert.deepEqual(JSON.parse(csv.rows[0][CSV_COLUMNS.indexOf('participant_names')]), stored.map(p => p.full_name));

// Execute the production migration against real PostgreSQL, with actual RLS.
const db = new PGlite({ extensions: { pg_trgm } });
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
await db.exec(fs.readFileSync('supabase/migrations/0001_schema.sql', 'utf8'));
await db.exec(fs.readFileSync('supabase/migrations/0002_rls.sql', 'utf8'));
await db.exec(fs.readFileSync('supabase/migrations/0015_atomic_template_publish.sql', 'utf8'));
await db.exec(fs.readFileSync('supabase/migrations/0020_signer_languages.sql', 'utf8'));
const migration = fs.readFileSync('supabase/migrations/0026_group_waivers.sql', 'utf8');
try { await db.exec(migration); } catch (error) { console.error(error.message, error.position, error.internalPosition, error.internalQuery, migration.slice(Number(error.position)-100,Number(error.position)+100)); process.exit(1); }
await db.exec(`grant usage on schema public,auth to anon,authenticated,service_role;
grant select on all tables in schema public to anon,authenticated; grant all on all tables in schema public to service_role; grant insert on template_versions to authenticated; grant update on waiver_templates to authenticated;`);
const org = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const tpl = '20000000-0000-4000-8000-000000000001', ver = '30000000-0000-4000-8000-000000000001', old = '30000000-0000-4000-8000-000000000002';
const user = '40000000-0000-4000-8000-000000000001', outsider = '40000000-0000-4000-8000-000000000002';
await db.query('insert into organizations(id,name) values ($1,\'A\'),($2,\'B\')', [org, other]);
await db.query('insert into auth.users values ($1),($2)', [user, outsider]);
await db.query("insert into profiles(id,org_id,email) values($1,$2,'a@test'),($3,$4,'b@test')", [user, org, outsider, other]);
await db.query("insert into waiver_templates(id,org_id,slug,name) values($1,$2,'group','Group')", [tpl, org]);
for (const [id, enabled, number] of [[ver, true, 1], [old, false, 2]]) await db.query("insert into template_versions(id,template_id,version_number,body,fields,consent_text,minor_mode,content_sha256,group_signing_enabled) values($1,$2,$3,'[]','[]','Consent','allowed',$4,$5)", [id, tpl, number, 'a'.repeat(64), enabled]);
const insert = async (participants, version = ver, tenant = org) => {
  const id = crypto.randomUUID();
  const evidence = participants?.map((p, i) => ({ ...p, signature_path: `${tenant}/${id}/${i === 0 ? 'signature.png' : `participant-${i + 1}.png`}` }));
  await db.query(`insert into signed_waivers(id,org_id,template_id,template_version_id,signer_name,is_minor,field_values,signature_path,pdf_path,pdf_sha256,consent_given,consent_text_snapshot,signing_channel,participants)
  values($1,$2,$3,$4,'Person 1',false,'{}',$5,'pdf',$6,true,'Consent','link',$7)`, [id, tenant, tpl, version, `${tenant}/${id}/signature.png`, 'b'.repeat(64), evidence ? JSON.stringify(evidence) : null]);
  return id;
};
await db.exec('set role service_role');
const legacy = stored.slice(0, 1).map(p => { const legacy = { ...p }; delete legacy.date_of_birth; return legacy; });
const legacyId = await insert(legacy);
const beforeMigration = (await db.query('select participants from signed_waivers where id=$1', [legacyId])).rows[0];
await db.exec('reset role');
await db.exec(fs.readFileSync('supabase/migrations/0027_participant_dates_of_birth.sql', 'utf8'));
assert.deepEqual((await db.query('select participants from signed_waivers where id=$1', [legacyId])).rows[0], beforeMigration);
await db.exec('set role service_role');
for (const count of [2, 10]) {
 const id = await insert(stored.slice(0, count));
 assert.deepEqual((await db.query('select participants from signed_waivers where id=$1', [id])).rows[0].participants.map(p=>p.date_of_birth), stored.slice(0,count).map(p=>p.date_of_birth));
}
await insert(null, old);
await db.exec('reset role');
for (const dob of ['', '2023-02-29', '2000-02-30', '0000-01-01', '9999-01-01', '1990-1-01', 123, {}, '1990-01-01T00:00:00Z']) {
 await assert.rejects(insert([{ ...stored[0], date_of_birth: dob }]));
}
await assert.rejects(insert([], ver));
await assert.rejects(insert([...stored, stored[0]]));
await assert.rejects(insert(stored.slice(0, 1), old));
await assert.rejects(insert(null, ver));
await assert.rejects(insert(stored.slice(0, 1), ver, other));
await assert.rejects(insert([{ ...stored[0], full_name: '' }]));
await assert.rejects(db.query('update signed_waivers set participants = null'));
await assert.rejects(db.query('delete from signed_waivers'));
await db.exec(`set role anon`);
assert.equal((await db.query('select * from signed_waivers')).rows.length, 0);
await db.exec('reset role');
await db.query("select set_config('test.uid',$1,false)", [outsider]); await db.exec('set role authenticated');
assert.equal((await db.query('select * from signed_waivers')).rows.length, 0);
await assert.rejects(insert(stored.slice(0, 1)));
await db.exec('reset role'); await db.query("select set_config('test.uid',$1,false)", [user]); await db.exec('set role authenticated');
assert.equal((await db.query('select * from signed_waivers')).rows.length, 4);
assert.equal((await db.query("select * from signed_waivers where participant_search ilike '%Person 10%'")).rows.length, 1);
// Publish creates another immutable version with the group setting enabled.
await db.query("select * from publish_template_version($1,'[]','[]','Consent','allowed',$2,'en',true)", [tpl, 'a'.repeat(64)]);
await assert.rejects(db.query('update template_versions set group_signing_enabled=false'));
await db.exec('reset role'); await db.close();

// Render the real PDF twice, inspect the exact rendered participant/name/image tree.
const { renderSignedPdf } = load('src/lib/pdf/waiver-pdf.tsx');
const input = { orgName: 'Group QA', logoDataUrl: null, brandColor: null, waiverName: 'Group waiver', versionNumber: 1, contentSha256: 'a'.repeat(64), blocks: [{ type: 'paragraph', text: 'Waiver clauses' }], fields: [], fieldValues: {}, signerName: 'Person 1', signerEmail: null, isMinor: false, guardianName: null, guardianRelationship: null, signatureDataUrl: signature, guardianSignatureDataUrl: null, consentText: 'Electronic consent', signedAtIso: '2026-10-07T12:00:00Z', ip: null, userAgent: 'QA', channel: 'link' };
function textNodes(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textNodes).join(' ');
  return node?.props ? textNodes(node.props.children) : '';
}
for (const count of [undefined, 1, 2, 10]) {
  const result = await renderSignedPdf({ ...input, participants: count ? Array.from({ length: count }, (_, i) => participant(i + 1)) : undefined });
  assert.equal(result.pdf.subarray(0, 4).toString(), '%PDF');
  const tree = textNodes(trees.at(-1));
  for (let i = 1; i <= (count ?? 1); i++) assert.ok(tree.includes(`Person ${i}`));
  assert.equal(tree.includes('GROUP PARTICIPANTS'), Boolean(count));
  if (count) for (let i=1;i<=count;i++) assert.ok(tree.includes(participant(i).dateOfBirth));
  else assert.ok(!tree.includes('Date of birth:'));
  if (count === 10 && process.argv.includes('--pdf-preview')) {
    fs.mkdirSync('tmp/pdfs', { recursive: true });
    fs.writeFileSync('tmp/pdfs/group-waiver-qa.pdf', result.pdf);
  }
}
console.log('PASS: group validation, PNG bounds, 1/2/10 participants, minors, version hashing, French, CSV, real migration/RLS, immutability, search, publication and single/group PDFs');
