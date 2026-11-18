import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let owner=true, writes=0, saved, authCalls=0;
const branding={color:'#123456',logo_path:'org/brand.png',unrelated:'keep'};
const db={from(table){assert.equal(table,'organizations');return {
  select(){return this;},eq(key,value){assert.equal(key,'id');assert.equal(value,'org');return this;},
  single:async()=>({data:{branding}}),update(value){saved=value;writes++;return this;},maybeSingle:async()=>({data:{id:'org'}}),
};}};
const dependencies={
  '@/lib/auth':{requireOrgRole:async role=>{authCalls++;assert.equal(role,'owner');if(!owner)throw Error('Forbidden');return {orgId:'org'};}},
  '@/lib/supabase/admin':{createAdminClient:()=>db},
  'next/cache':{revalidatePath:path=>assert.equal(path,'/settings/kiosk')},
};
const modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const loaded={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(id=>{
    if(id in dependencies)return dependencies[id];
    if(id.startsWith('@/'))return load(path.join('src',id.slice(2)+'.ts'));
    if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.ts'));
    return require(id);
  },loaded,loaded.exports);modules.set(file,loaded.exports);return loaded.exports;
}
const {kioskSettingsSchema,readKioskSettings,kioskHiddenFields,kioskFieldCanBeHidden}=load('src/lib/kiosk-settings.ts');
const template='11111111-1111-4111-8111-111111111111';
const fields=[
  {key:'optional',type:'text',required:false},
  {key:'required',type:'text',required:true},
  {key:'dob',type:'date_of_birth',required:false},
  {key:'consent',type:'checkbox',required:false},
  {key:'initials',type:'initials',required:false},
  {key:'name',type:'name',required:false},
  {key:'flagged',type:'select',required:false,flag_values:['yes']},
  {key:'medical_condition',type:'select',required:false},
  {key:'medical_condition_detail',type:'multiline',required:false},
];
const {MEDICAL_CONDITION_KEY,MEDICAL_CONDITION_DETAIL_KEY}=load('src/lib/types.ts');
fields[7].key=MEDICAL_CONDITION_KEY;fields[8].key=MEDICAL_CONDITION_DETAIL_KEY;
const settings={welcome:{en:'Welcome',fr:'Bienvenue'},instructions:{en:'Sign here',fr:'Signez ici'},hiddenOptionalFields:{[template]:fields.map(field=>field.key)}};
assert.deepEqual(kioskHiddenFields(settings,template,fields),['optional']);
assert.ok(!kioskFieldCanBeHidden({...fields[0],required:true}),'republished required field becomes visible');
assert.deepEqual(kioskHiddenFields(settings,'other-template',fields),[]);
assert.equal(kioskSettingsSchema.safeParse({...settings,welcome:{en:'x'.repeat(1001),fr:''}}).success,false);
assert.equal(kioskSettingsSchema.safeParse({...settings,bypassRequired:true}).success,false);
assert.deepEqual(readKioskSettings({malformed:true}).hiddenOptionalFields,{});
const {updateKioskSettings}=load('src/app/(app)/settings/kiosk/actions.ts');
await updateKioskSettings(settings);assert.equal(writes,1);assert.deepEqual(saved.branding,{...branding,kiosk:settings});
owner=false;await assert.rejects(updateKioskSettings(settings),/Forbidden/);assert.equal(writes,1);assert.equal(authCalls,2);
owner=true;await assert.rejects(updateKioskSettings({...settings,requiredFields:[]}));assert.equal(writes,1);
const {kioskIdleState}=load('src/lib/kiosk-privacy.ts');
assert.deepEqual(kioskIdleState(0,149000),{expired:false,warning:false,seconds:31});
assert.deepEqual(kioskIdleState(0,150000),{expired:false,warning:true,seconds:30});
assert.equal(kioskIdleState(0,180000).expired,true);
assert.equal(kioskIdleState(175000,180000).warning,false);
const {kioskFrench}=load('src/lib/kiosk-translations.ts');const {signerText}=load('src/lib/signer-language.ts');
for(const [key,value] of Object.entries(kioskFrench)){assert.equal(signerText(key,'fr'),value);assert.equal(signerText(key,'en'),key);}
console.log('PASS: kiosk optional-field restrictions, republished required fields, per-template isolation, owner-only settings, branding preservation, strict payload validation, privacy deadlines and all English/French kiosk copy');
