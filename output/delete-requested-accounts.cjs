require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const fs=require('node:fs');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(30000)})}});
const users=['0cd23605-abf1-4f53-9650-b98eb30fcda1','a990875c-d226-49bb-9c50-afacad82eaef','9696e3f7-ed2f-47a2-92be-1cbc6f07742b'];
const orgs=['fe1e2721-df27-4fe2-a466-cd2dbd0d9c29','ba7091de-27df-4cde-9594-d5bea51c44d8','74997ef3-b9eb-4b03-ad2b-1625ad32ba68'];
function ok(r){if(r.error)throw Error(r.error.message);return r.data;}
async function inventory(){const files=[];for(const b of ok(await db.storage.listBuckets())){async function walk(prefix){if(!orgs.includes(prefix.split('/')[0])||prefix.includes('..'))throw Error('Unsafe prefix');for(let offset=0;;offset+=100){const rows=ok(await db.storage.from(b.id).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}}));for(const row of rows){const path=prefix+'/'+row.name;if(row.id)files.push({bucket:b.id,path});else await walk(path);}if(rows.length<100)break;}}for(const org of orgs)await walk(org);}return files;}
(async()=>{
 const plan=ok(await db.rpc('purge_requested_accounts_20260914',{p_execute:false}));
 if(JSON.stringify(plan.users)!==JSON.stringify(users)||JSON.stringify(plan.organizations)!==JSON.stringify(orgs))throw Error('Target mismatch');
 const templates=ok(await db.from('waiver_templates').select('id').in('org_id',orgs)).map(x=>x.id);
 const jobs=ok(await db.from('data_jobs').select('id,leased_until').in('org_id',orgs));
 if(jobs.some(x=>x.leased_until&&Date.parse(x.leased_until)>Date.now()))throw Error('Active worker');
 const files=await inventory();if(files.length!==plan.storage_objects)throw Error('Storage inventory mismatch');
 fs.writeFileSync('output/requested-account-deletion-journal.json',JSON.stringify({plan,templates,jobs,files},null,2));
 console.log('Verified deletion scope:',JSON.stringify({users:users.length,templates:templates.length,signedWaivers:plan.signed_waivers,files:files.length}));
 for(const id of users)ok(await db.auth.admin.updateUserById(id,{ban_duration:'876000h'}));
 ok(await db.from('subscriptions').update({status:'canceled'}).in('org_id',orgs));
 ok(await db.from('api_keys').update({revoked_at:new Date().toISOString()}).in('org_id',orgs));
 ok(await db.from('webhook_endpoints').update({enabled:false}).in('org_id',orgs));
 for(let pass=0;pass<3;pass++){
  const pending=await inventory();if(!pending.length)break;
  for(const bucket of [...new Set(pending.map(x=>x.bucket))]){const paths=pending.filter(x=>x.bucket===bucket).map(x=>x.path);for(let i=0;i<paths.length;i+=100)ok(await db.storage.from(bucket).remove(paths.slice(i,i+100)));}
  console.log('Removed storage objects:',pending.length);
 }
 const ready=ok(await db.rpc('purge_requested_accounts_20260914',{p_execute:false}));if(ready.storage_objects!==0)throw Error('Storage objects remain');
 const result=ok(await db.rpc('purge_requested_accounts_20260914',{p_execute:true}));console.log('Purge:',JSON.stringify(result));
 const checks={};for(const table of ['organizations','profiles','waiver_templates','signed_waivers','subscriptions','checkins','signature_reminders','activation_milestones','invitations','audit_log','api_keys','webhook_endpoints','webhook_deliveries','data_jobs','imported_waivers']){const r=await db.from(table).select('*',{count:'exact',head:true}).in(table==='organizations'?'id':'org_id',orgs);ok(r);checks[table]=r.count;}
 for(const [table,column,ids] of [['template_versions','template_id',templates],['user_notifications','recipient_id',users],['data_job_files','job_id',jobs.map(x=>x.id)],['data_import_items','job_id',jobs.map(x=>x.id)]]){if(!ids.length){checks[table]=0;continue;}const r=await db.from(table).select('*',{count:'exact',head:true}).in(column,ids);ok(r);checks[table]=r.count;}
 for(const id of users){const r=await db.auth.admin.getUserById(id);if(!r.error||r.error.status!==404)throw Error('Auth deletion verification failed: '+id);}
 checks.storage=(await inventory()).length;
 console.log('Remaining linked records:',JSON.stringify(checks));if(Object.values(checks).some(x=>x!==0))throw Error('Linked records remain');
 console.log('VERIFIED: all three Auth accounts and scoped records/files removed.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
