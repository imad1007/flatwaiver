import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec("create table waiver_templates(id integer primary key); insert into waiver_templates values(1);");
await db.exec(fs.readFileSync('supabase/migrations/0028_document_display.sql','utf8'));
assert.equal((await db.query('select document_display from waiver_templates where id=1')).rows[0].document_display,'full');
await db.exec("insert into waiver_templates(id) values(2); update waiver_templates set document_display='collapsed' where id=2;");
assert.equal((await db.query('select document_display from waiver_templates where id=2')).rows[0].document_display,'collapsed');
await assert.rejects(db.exec("update waiver_templates set document_display='invalid' where id=1"));
for(const file of ['src/lib/canonical.ts','src/lib/pdf/waiver-pdf.tsx','src/app/api/sign/[slug]/route.ts','src/lib/waiver-schema.ts']) {
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/document_display|documentDisplay/,'Presentation must not affect legal or PDF inputs: '+file);
}
const actions=fs.readFileSync('src/app/(app)/waivers/actions.ts','utf8');
const setter=actions.slice(actions.indexOf('export async function setDocumentDisplay'));
assert.match(setter,/requireOrgRole\("staff"\)/);
assert.match(setter,/z.enum\(\["full", "collapsed"\]\)/);
assert.doesNotMatch(setter,/template_versions|publish_template_version|createAdminClient/);
await db.close();
console.log('PASS: existing-row default, saved opt-in, SQL constraint, unchanged legal/PDF input contracts and authorized setting action');
