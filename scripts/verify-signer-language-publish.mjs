import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Run the actual old and new RPCs against an isolated database, never production.
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const org = '00000000-0000-4000-8000-000000000002';
const template = '00000000-0000-4000-8000-000000000003';
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select '${user}'::uuid $$;
  create table profiles(id uuid primary key, org_id uuid, role text);
  create table waiver_templates(id uuid primary key, org_id uuid, current_version_id uuid, status text, updated_at timestamptz);
  create table template_versions(id uuid primary key default gen_random_uuid(), template_id uuid references waiver_templates(id), version_number integer,
    body jsonb, fields jsonb, consent_text text, minor_mode text, content_sha256 text);
  create function immutable_version() returns trigger language plpgsql as $$ begin raise exception 'Immutable'; end $$;
  create trigger immutable before update or delete on template_versions for each row execute function immutable_version();
`);
const previous = readFileSync('supabase/migrations/0015_atomic_template_publish.sql', 'utf8');
await db.exec(previous.slice(previous.indexOf('create or replace function publish_template_version(')));
await db.query('insert into profiles values($1,$2,$3)', [user, org, 'owner']);
await db.query('insert into waiver_templates(id,org_id) values($1,$2)', [template, org]);
const args = [template, JSON.stringify([{type:'paragraph',text:'Original legal text'}]), '[]', 'Original consent', 'allowed', 'hash'];
const oldPublish = () => db.query('select * from publish_template_version($1,$2,$3,$4,$5,$6)', args);
await oldPublish();
await db.exec(readFileSync('supabase/migrations/0020_signer_languages.sql', 'utf8'));
assert.equal((await db.query('select signer_language from template_versions')).rows[0].signer_language, 'en');
for (const language of ['en','fr','es','pt','zh','hi','ar','bn','ru','ur']) {
  const consent = language === 'fr' ? 'Texte français approuvé' : 'Original consent';
  const current = [...args]; current[3] = consent;
  const result = await db.query('select * from publish_template_version($1,$2,$3,$4,$5,$6,$7)', [...current, language]);
  const version = (await db.query('select * from template_versions where id=$1', [result.rows[0].version_id])).rows[0];
  assert.equal(version.signer_language, language);
  assert.equal(version.consent_text, consent);
  assert.deepEqual(version.body, [{type:'paragraph',text:'Original legal text'}]);
  assert.equal((await db.query('select current_version_id from waiver_templates')).rows[0].current_version_id, version.id);
}
await oldPublish(); // Older deployed clients still publish in English.
await assert.rejects(db.query('select * from publish_template_version($1,$2,$3,$4,$5,$6,$7)', [...args, 'bad']), /check constraint/);
assert.equal((await db.query('select count(*)::int as count from template_versions')).rows[0].count, 12);
await assert.rejects(db.query("update template_versions set consent_text='changed'"), /Immutable/);
await db.query("update profiles set role='viewer'");
await assert.rejects(db.query('select * from publish_template_version($1,$2,$3,$4,$5,$6,$7)', [...args, 'fr']), /not authorized/);
await db.query("update profiles set role='owner', org_id=gen_random_uuid()");
await assert.rejects(db.query('select * from publish_template_version($1,$2,$3,$4,$5,$6,$7)', [...args, 'fr']), /not authorized/);
assert.equal((await db.query("select has_function_privilege('anon','publish_template_version(uuid,jsonb,jsonb,text,text,text,text)','EXECUTE') as allowed")).rows[0].allowed, false);
await db.close();
console.log('Signer language publish checks passed: ten languages, immutable versions, consent preservation, rollback, old client compatibility and role/org boundaries.');
