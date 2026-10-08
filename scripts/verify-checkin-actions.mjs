import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';

const orgId='11111111-1111-4111-8111-111111111111';
const waiverId='22222222-2222-4222-8222-222222222222';
const attendanceId='33333333-3333-4333-8333-333333333333';
let role='staff', owns=true, existing=false, writes=[], invalidations=[];
const admin={from(table) {
  const filters={}; let operation='read';
  const chain={
    select(){return chain;},eq(key,value){filters[key]=value;return chain;},gte(){return chain;},limit(){return chain;},
    insert(value){operation='insert';writes.push(value);return chain;},
    delete(){operation='delete';return chain;},
    async maybeSingle(){
      assert.equal(filters.org_id,orgId);
      if(table==='signed_waivers') {assert.equal(filters.id,waiverId);return {data:owns?{id:waiverId}:null};}
      if(operation==='delete') {assert.equal(filters.id,attendanceId);writes.push({operation,filters});return {data:owns?{id:attendanceId}:null};}
      assert.equal(filters.signed_waiver_id,waiverId);return {data:existing?{id:attendanceId}:null};
    },
    async single(){return {data:{id:attendanceId}};},
  };return chain;
}};
const deps={
  zod:{z},
  'next/cache':{revalidatePath:path=>invalidations.push(path)},
  '@/lib/auth':{requireOrgRole:async minimum=>{assert.equal(minimum,'staff');if(role==='viewer')throw Error('Forbidden');return {orgId,userId:'staff'};}},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
};
const loaded={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/app/(app)/checkin/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','module','exports',code)(id=>deps[id],loaded,loaded.exports);
const {checkIn,undoCheckIn}=loaded.exports;
await checkIn(waiverId);assert.equal(writes.length,1);assert.equal(writes[0].signed_waiver_id,waiverId);assert.equal(writes[0].org_id,orgId);
existing=true;assert.equal((await checkIn(waiverId)).duplicate,true);assert.equal(writes.length,1);
await undoCheckIn(attendanceId);assert.equal(writes.length,2);assert.deepEqual(invalidations,['/checkin','/checkin']);
owns=false;await assert.rejects(checkIn(waiverId),/not found/);
role='viewer';await assert.rejects(checkIn(waiverId),/Forbidden/);await assert.rejects(undoCheckIn(attendanceId),/Forbidden/);
assert.equal(writes.length,2);
console.log('PASS: actual check-in/undo actions preserve original waiver ID, sequential duplicate protection, organization filters and staff authorization');
