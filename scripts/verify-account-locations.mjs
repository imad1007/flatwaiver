import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const {renderToStaticMarkup}=require('react-dom/server');
const jsx=require('react/jsx-runtime');
const country=load('src/lib/country.ts',{});
const network=load('src/lib/network-address.ts',{'node:net':require('node:net')});
function load(file,deps) {
 const loaded={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>{assert.ok(id in deps,id);return deps[id];},loaded,loaded.exports);
 return loaded.exports;
}
let saved=null, fail=false;
const account=load('src/lib/account-location.ts',{
 'server-only':{},'next/headers':{headers:async()=>new Headers({'x-vercel-forwarded-for':'8.8.8.8','x-vercel-ip-country':'US'})},
 '@/lib/network-address':network,'@/lib/country':country,
 '@/lib/supabase/admin':{createAdminClient:()=>({from:table=>{assert.equal(table,'account_locations');return {upsert:async(row,options)=>{saved={row,options};return {error:fail?{message:'test'}:null};}};}})}
});
assert.equal(country.countryCode('ca'),'CA');
for(const raw of [null,undefined,'','XX','ZZ','EU','UN','USA','<script>','12'])assert.equal(country.countryCode(raw),null);
const h=new Headers({'x-vercel-forwarded-for':'8.8.8.8','x-vercel-ip-country':'ca'});
assert.deepEqual(account.accountLocationFromHeaders(h,true),{ip:'8.8.8.8',country_code:'CA'});
assert.equal(account.accountLocationFromHeaders(h,false),null,'Untrusted hosts cannot spoof location');
for(const ip of ['127.0.0.1','192.168.1.1','bad','203.0.113.4']) {
 h.set('x-vercel-forwarded-for',ip);assert.equal(account.accountLocationFromHeaders(h,true),null);
}
h.set('x-vercel-forwarded-for','2606:4700:4700::1111');
assert.ok(account.accountLocationFromHeaders(h,true),'IPv6 supported');
h.set('x-vercel-ip-country','XX');assert.equal(account.accountLocationFromHeaders(h,true).country_code,null);
const before=process.env.VERCEL;process.env.VERCEL='1';
await account.recordAccountLocation('owner-id');
assert.equal(saved.row.user_id,'owner-id');assert.equal(saved.row.ip,'8.8.8.8');assert.equal(saved.row.country_code,'US');
assert.deepEqual(saved.options,{onConflict:'user_id'});
fail=true;const warn=console.warn;console.warn=()=>{};await account.recordAccountLocation('owner-id');console.warn=warn;
if(before===undefined)delete process.env.VERCEL;else process.env.VERCEL=before;
const {CustomerCountry}=load('src/components/admin/customer-country.tsx',{'@/lib/country':country,'react/jsx-runtime':jsx});
const markup=renderToStaticMarkup(jsx.jsx(CustomerCountry,{code:'CA'}));
assert.match(markup,/fi-ca/);assert.match(markup,/Canada/);assert.match(markup,/approximate/);
assert.match(renderToStaticMarkup(jsx.jsx(CustomerCountry,{code:'XX'})),/Unknown/);
// Verify private storage with real PostgreSQL, including hostile authenticated users.
const db=new PGlite();
try {
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;");
 await db.exec(fs.readFileSync('supabase/migrations/0030_account_locations.sql','utf8'));
 const user='10000000-0000-4000-8000-000000000001';
 await db.query('insert into auth.users values($1)',[user]);
 await db.exec('set role service_role');
 await db.query("insert into account_locations(user_id,ip,country_code) values($1,'8.8.8.8','CA')",[user]);
 assert.equal((await db.query('select country_code from account_locations')).rows[0].country_code,'CA');
 await db.query("insert into account_locations(user_id,ip,country_code) values($1,'1.1.1.1','US') on conflict(user_id) do update set ip=excluded.ip,country_code=excluded.country_code",[user]);
 assert.equal((await db.query('select count(*) from account_locations')).rows[0].count,1);
 for(const role of ['anon','authenticated']){
  await db.exec('reset role;set role '+role);
  await assert.rejects(db.query('select * from account_locations'),/permission denied/);
  await assert.rejects(db.query("update account_locations set country_code='GB'"),/permission denied/);
 }
 await db.exec('reset role');
 await db.query('delete from auth.users where id=$1',[user]);
 assert.equal((await db.query('select count(*) from account_locations')).rows[0].count,0);
} finally {await db.close();}
console.log('PASS: trusted Vercel location, IPv4/IPv6 validation, unknown countries, authenticated-user binding, best-effort capture, accessible flag markup, service-only SQL access, one latest observation and auth deletion cascade');

const queries=[];
const overview=load('src/lib/admin-data.ts',{
 'server-only':{},'@/lib/country':country,
 '@/lib/blog-db':{isMissingTableError:()=>false},
 '@/lib/config':{APP:{priceMonthlyUsd:19}},
 '@/lib/supabase/admin':{createAdminClient:()=>({
  auth:{admin:{listUsers:async()=>({data:{users:[]},error:null})}},
  from:table=>{
   const record={table};queries.push(record);
   const chain={select:value=>{record.select=value;return chain;},order:()=>chain,range:()=>chain,in:(_,ids)=>{record.ids=ids;return chain;},
    then:resolve=>resolve({error:null,data:table==='admin_org_overview'?
      [{org_id:'one',name:'One',owner_user_id:'owner',signature_count:0},{org_id:'two',name:'Two',owner_user_id:'no-country',signature_count:0}]:
      [{user_id:'owner',country_code:'CA'}]})};
   return chain;
  }
 })}
});
const snapshot=await overview.getAdminOverview();
assert.equal(snapshot.rows[0].ownerCountryCode,'CA');
assert.equal(snapshot.rows[1].ownerCountryCode,null);
assert.equal(queries.find(q=>q.table==='account_locations').select,'user_id, country_code');
assert.ok(!JSON.stringify(snapshot.rows).includes('8.8.8.8'));
console.log('PASS: countries joined to workspace owners, unknown fallback, raw IPs excluded from admin directory data');
