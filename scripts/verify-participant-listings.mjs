import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
let rows = [], calls = [], role = 'staff', controls = [];
const db = { from(table) {
  const chain = {};
  for (const method of ['select','order','range','ilike','gte','lte','eq']) chain[method] = (...args) => { calls.push([table,method,...args]); return chain; };
  chain.then = resolve => resolve({ error:null, data: table === 'signed_waivers' ? rows : table === 'checkins' ? [{ id:'attendance', signed_waiver_id:'group', checked_in_at:'2026-10-08T12:00:00Z' }] : [{id:'template',name:'Swimming'}], count:101 });
  return chain;
} };
const deps = {
  'react/jsx-runtime':jsx,
  'next/link':{default:({children,...props})=>jsx.jsx('a',{...props,children})},
  'next/navigation':{redirect:()=>{throw Error('redirect');}},
  'lucide-react':{ClipboardCheck:()=>null,FileSignature:()=>null},
  '@/lib/supabase/server':{createClient:async()=>db},
  '@/lib/auth':{getOrgCaller:async()=>({role})},
  '@/lib/permissions':{roleAtLeast:r=>r !== 'viewer'},
  '@/components/checkin-button':{CheckinButton:props=>{controls.push(props);return jsx.jsx('button',{children:'Check in'});}},
  '@/components/empty-state':{EmptyState:()=>null},
  '@/components/data-load-error':{DataLoadError:()=>null},
  '@/components/ui/button':{Button:()=>null},
  '@/components/signature-export-buttons':{SignatureExportButtons:()=>null},
};
function load(path) {
  const loaded={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(id=>{assert.ok(id in deps,id);return deps[id];},loaded,loaded.exports);
  return loaded.exports;
}
deps['@/components/waiver-participant-list']=load('src/components/waiver-participant-list.tsx');
const signatures=load('src/app/(app)/signatures/page.tsx').default;
const checkin=load('src/app/(app)/checkin/page.tsx').default;
for (const count of [0,2,10,12]) {
  rows=[{id:'group',signer_name:'Primary Person',template_id:'template',signed_at:'2026-10-08T12:00:00Z',signing_channel:'link',participants:count ? Array.from({length:count},(_,i)=>({full_name:`Member ${i}`, ...(i % 2 ? {date_of_birth:'1990-02-01',signature_path:'private-evidence'} : {})})) : null}];
  for (const page of [signatures,checkin]) {
    calls=[];controls=[];
    const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({q:'Member',page:'2',template:'template',flagged:'1',from:'2026-01-01',to:'2026-12-31',email:'person'})}));
    for(let i=0;i<count;i++) assert.ok(html.includes(`Member ${i}`));
    assert.equal(html.includes('one signed record'),count>0);
    assert.equal(html.includes('Primary signer'),count>0);
    assert.ok(!html.includes('1990-02-01') && !html.includes('private-evidence'));
    assert.ok(html.includes('href="/signatures/group"'));
    assert.ok(calls.some(c=>c[1]==='ilike' && c[2]==='participant_search' && c[3]==='%Member%'));
    assert.equal(calls.filter(c=>c[1]==='select').length,page===checkin?3:2);
    assert.ok(calls.some(c=>c[1]==='range' && c[2]===(page===checkin?25:50)));
    if(page===checkin) {
      assert.equal(controls.length,1); assert.equal(controls[0].signedWaiverId,'group');
      assert.equal(controls[0].checkinId,'attendance'); assert.equal(controls[0].canCheckIn,true);
    } else {
      assert.ok(calls.some(c=>c[1]==='eq' && c[2]==='flagged' && c[3]===true));
      assert.ok(calls.some(c=>c[1]==='eq' && c[2]==='template_id'));
      assert.ok(calls.some(c=>c[1]==='ilike' && c[2]==='signer_email'));
    }
  }
}
role='viewer';controls=[];
renderToStaticMarkup(await checkin({searchParams:Promise.resolve({})}));
assert.equal(controls[0].canCheckIn,false);
rows[0].participants[1].full_name='<script>alert(1)</script>';
const html=renderToStaticMarkup(await signatures({searchParams:Promise.resolve({})}));
assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
console.log('PASS: single/2/10/12 participants, legacy DOB, links, no sensitive markup, paginated server search/filter queries, one group check-in, viewer permissions, XSS escaping');
