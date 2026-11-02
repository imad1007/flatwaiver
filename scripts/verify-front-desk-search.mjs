import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
const db=new PGlite({extensions:{pg_trgm}});
try {
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;`);
for(const file of ['0001_schema.sql','0002_rls.sql','0015_atomic_template_publish.sql','0020_signer_languages.sql','0026_group_waivers.sql','0027_participant_dates_of_birth.sql'])
 await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
await db.exec(`grant usage on schema public,auth to anon,authenticated;
grant select on all tables in schema public to anon,authenticated;`);
const org='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002';
const user='20000000-0000-4000-8000-000000000001', outsider='20000000-0000-4000-8000-000000000002';
const tpl='30000000-0000-4000-8000-000000000001', tpl2='30000000-0000-4000-8000-000000000002';
const version='40000000-0000-4000-8000-000000000001', group='40000000-0000-4000-8000-000000000002', foreign='40000000-0000-4000-8000-000000000003';
await db.query("insert into organizations(id,name) values($1,'Local'),($2,'Other')",[org,other]);
await db.query("insert into auth.users values($1),($2)",[user,outsider]);
await db.query("insert into profiles(id,org_id,email) values($1,$2,'a@test'),($3,$4,'b@test')",[user,org,outsider,other]);
await db.query("insert into waiver_templates(id,org_id,slug,name) values($1,$2,'local','Party'),($3,$4,'other','Other')",[tpl,org,tpl2,other]);
const fields=[{key:'child_name',type:'name',label:'Child name',required:false},{key:'guest_name',type:'text',label:'Participant name',required:false},{key:'notes',type:'text',label:'Medical notes',required:false}];
for(const [id,template,n,enabled] of [[version,tpl,1,false],[group,tpl,2,true],[foreign,tpl2,1,false]])
 await db.query("insert into template_versions(id,template_id,version_number,body,fields,consent_text,content_sha256,group_signing_enabled) values($1,$2,$3,'[]',$4,'Consent','hash',$5)",[id,template,n,JSON.stringify(enabled ? [] : fields),enabled]);
// New current version intentionally lacks legacy custom fields.
await db.query('update waiver_templates set current_version_id=$1 where id=$2',[group,tpl]);
const insert=async(name,guardian=null,values={},participants=null,tenant=org,template=tpl,ver=version,date='2020-01-01')=>{
 const id=randomUUID();
 if(participants) participants=participants.map((p,i)=>({...p,signature_path:tenant+'/'+id+'/'+(i===0?'signature.png':'participant-'+(i+1)+'.png'),guardian_signature_path:p.is_minor?tenant+'/'+id+'/participant-'+(i+1)+'-guardian.png':null}));
 const result=await db.query(`insert into signed_waivers(id,org_id,template_id,template_version_id,signer_name,guardian_name,is_minor,field_values,participants,signature_path,guardian_signature_path,pdf_path,pdf_sha256,consent_given,consent_text_snapshot,signed_at)
 values($12,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'stored.pdf','unchanged-hash',true,'Consent',$11) returning id`,
 [tenant,template,ver,name,guardian,!!guardian,JSON.stringify(values),participants?JSON.stringify(participants):null,participants?.[0].signature_path??'sig.png',guardian?'guardian.png':null,date,id]);
 return result.rows[0].id;
};
const primary=await insert('Adult Jones');
const minor=await insert('Chloe Minor','Pat Guardian');
const custom=await insert('Parent Legacy',null,{child_name:'Chloe Legacy',guest_name:'Jamie Guest',notes:'Secret Medical'});
const participants=[
 {full_name:'Group Parent',date_of_birth:'1980-01-01',is_minor:false,signature_path:'group.png',guardian_name:null,guardian_relationship:null,guardian_signature_path:null},
 {full_name:'Chloe Group',date_of_birth:'2015-01-01',is_minor:true,signature_path:'child.png',guardian_name:'Alex Guardian',guardian_relationship:'Parent',guardian_signature_path:'guardian.png'}
];
const grouped=await insert('Group Parent',null,{},participants,org,tpl,group);
await insert('Chloe Foreign',null,{},null,other,tpl2,foreign);
await insert('Percent%_Name');
for(let i=0;i<65;i++)await insert('Paged Child '+i,null,{},null,org,tpl,version,'2026-01-01');
const before=(await db.query('select id,to_jsonb(s) evidence from signed_waivers s order by id')).rows;
assert.equal((await db.query("select id from signed_waivers where participant_search ilike '%Chloe Legacy%'")).rows.length,0,'Reproduce custom child name omission');
assert.equal((await db.query("select id from signed_waivers where participant_search ilike '%Alex Guardian%'")).rows.length,0,'Reproduce guardian omission');
await db.exec(fs.readFileSync('supabase/migrations/0029_front_desk_participant_search.sql','utf8'));
await db.exec('set role authenticated');
await db.query("select set_config('test.uid',$1,false)",[user]);
const search=async q=>(await db.query('select id from search_front_desk_waivers($1) order by id',[q])).rows.map(r=>r.id);
assert.deepEqual(await search('jOn'),[primary]);
assert.deepEqual(await search('cHlOe'),[minor,custom,grouped].sort());
assert.deepEqual(await search('pat guar'),[minor]);
assert.deepEqual(await search('alex guar'),[grouped]);
assert.deepEqual(await search('Jamie'),[custom]);
assert.deepEqual(await search('Secret Medical'),[],'Non-name custom answers excluded');
assert.deepEqual(await search('missing'),[]);
assert.deepEqual(await search('   '),[]);
assert.equal((await search('%_')).length,1,'Wildcards are literal');
assert.equal((await search('Paged Child')).length,65);
const page1=(await db.query("select id from search_front_desk_waivers('paged child') order by signed_at desc,id desc limit 25")).rows;
const page2=(await db.query("select id from search_front_desk_waivers('paged child') order by signed_at desc,id desc limit 25 offset 25")).rows;
assert.equal(page1.length,25);assert.equal(page2.length,25);
assert.ok(page2.every(b=>!page1.some(a=>a.id===b.id)));
await db.query("select set_config('test.uid',$1,false)",[outsider]);
assert.equal((await search('Chloe')).length,1,'Only own organization');
assert.deepEqual(await search('Chloe Legacy'),[]);
await db.exec('reset role; set role anon');
await assert.rejects(search('Chloe'),/permission denied/);
await db.exec('reset role');
assert.deepEqual((await db.query('select id,to_jsonb(s) evidence from signed_waivers s order by id')).rows,before,'All signed rows including PDF hashes remain identical');
await assert.rejects(db.exec("update signed_waivers set signer_name='Changed'"),/append-only/);
await assert.rejects(db.exec("delete from signed_waivers"),/append-only/);
console.log('PASS: reproduced legacy child/guardian omissions; primary/minor/group/custom/guardian partial search, literal wildcards, historical versions, 65-result pagination, cross-org RLS, anon denial, byte-equivalent signed JSON/PDF references, append-only enforcement');
} finally {await db.close();}
