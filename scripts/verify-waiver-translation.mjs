import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { applyTranslation, translationSegments } from '../src/lib/waiver-translation.ts';
import { draftContentSchema } from '../src/lib/waiver-schema.ts';

const draft = { title: 'Waiver', blocks: [{type:'heading',text:'Read this'}, {type:'paragraph',text:'Do not participate if unwell.'}, {type:'list',items:['Rule one','Rule two']}],
  fields: [{key:'medical_condition',type:'select',label:'Medical condition?',options:['Yes','No'],flag_values:['Yes'],required:true}],
  consent_text:'I agree to sign electronically under the ESIGN Act and UETA.', minor_mode:'allowed', signer_language:'fr', translate_content:true };
const original = JSON.stringify(draft);
const translated = ['Décharge','Lisez ceci','Ne participez pas si vous êtes malade.','Première règle','Deuxième règle','Problème médical ?','Oui','Non','J’accepte de signer électroniquement conformément à l’ESIGN Act et à l’UETA.'];
assert.equal(translationSegments(draft).length, translated.length);
const result = draftContentSchema.parse(applyTranslation(draft, translated));
assert.equal(result.consent_text, translated.at(-1));
assert.equal(result.blocks[1].text, translated[2]);
assert.deepEqual(result.fields[0].options, ['Yes','No']);
assert.deepEqual(result.fields[0].option_labels, ['Oui','Non']);
assert.deepEqual(result.fields[0].flag_values, ['Yes']);
assert.equal(result.fields[0].key, 'medical_condition');
assert.equal(result.fields[0].required, true);
assert.equal(result.translate_content, true);
assert.equal(JSON.stringify(draft), original, 'source draft unchanged');
assert.throws(() => applyTranslation(draft, translated.slice(1)), /Incomplete/);
assert.throws(() => applyTranslation(draft, translated.map((v,i)=>i===2?'':v)), /omitted/);
assert.throws(() => applyTranslation(draft, { title: 'Bad shape' }));
assert.throws(() => draftContentSchema.parse({...result, fields:[{...result.fields[0],option_labels:['Only one']}]}));
assert.deepEqual(translationSegments(result).slice(-3,-1), ['Oui','Non'], 'retranslation uses visible choices');
const route = readFileSync('src/app/api/waivers/translate/route.ts','utf8');
assert.ok(route.indexOf('getOrgCaller()') < route.indexOf('new Anthropic('));
assert.match(route,/canManageTemplates\(caller.role\)/);
assert.match(route,/\.eq\("org_id", caller.orgId\)/);
assert.match(route,/response.stop_reason !== "end_turn"/);
assert.doesNotMatch(route,/\.insert\(|\.update\(|\.rpc\(/);
const editor = readFileSync('src/components/waiver-editor.tsx','utf8');
assert.match(editor,/translationPreview.source !== currentFingerprint/);
assert.match(editor,/loadTranslatedDraft\(translationPreview.draft\)/);
assert.match(editor,/translate_content: translateContent/);
console.log('Full-waiver translation passed: every text section and consent, stable answers/flags/keys, draft preservation, malformed output, review/stale-response and authorization contracts.');

// Execute the real route with isolated auth/database/provider adapters.
const require = createRequire(import.meta.url);
let caller = { orgId:'org-a', role:'owner' }, status = 'active', providerCalls = 0, malformed = false;
const validTemplate = '00000000-0000-4000-8000-000000000001';
const client = { from(table) {
  const filters = {};
  return { select() { return this; }, eq(key,value) { filters[key]=value; return this; }, async maybeSingle() {
    return { data: table === 'subscriptions' ? { status, trial_ends_at:'2000-01-01' }
      : filters.org_id === 'org-a' && filters.id === validTemplate ? {id:validTemplate} : null };
  } };
} };
class MockAnthropic {
  messages = { create: async () => { providerCalls++; return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(malformed ? ['Incomplete'] : translated)}]}; } };
}
const dependencies = {
  '@anthropic-ai/sdk': { default: MockAnthropic, __esModule:true },
  'next/server': {NextResponse:Response},
  '@/lib/auth': {getOrgCaller:async()=>caller},
  '@/lib/permissions': {canManageTemplates:role=>['owner','admin','staff'].includes(role)},
  '@/lib/supabase/server': {createClient:async()=>client},
  '@/lib/waiver-schema': {draftContentSchema},
  '@/lib/waiver-translation': {translationSegments,applyTranslation},
  '@/lib/signer-language': {SIGNER_LANGUAGES:[{code:'fr',name:'Français'},{code:'ar',name:'العربية'}]},
};
const loaded = {exports:{}};
new Function('require','exports','module',ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(id=>dependencies[id]??require(id),loaded.exports,loaded);
const previousKey = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY='mock-test-only';
const call = (body={templateId:validTemplate,draft}, origin='https://waiver.test') => loaded.exports.POST(new Request('https://waiver.test/api/waivers/translate',{method:'POST',headers:{origin},body:JSON.stringify(body)}));
try {
  assert.equal((await call()).status,200); assert.equal(providerCalls,1);
  caller=null; assert.equal((await call()).status,403);
  caller={orgId:'org-a',role:'viewer'}; assert.equal((await call()).status,403);
  caller={orgId:'org-b',role:'owner'}; assert.equal((await call()).status,404);
  caller={orgId:'org-a',role:'owner'};
  assert.equal((await call(undefined,'https://attacker.test')).status,403);
  status='trialing'; assert.equal((await call()).status,403); status='active';
  assert.equal((await call({templateId:validTemplate,draft:{...draft,signer_language:'ar'}})).status,422);
  assert.equal(providerCalls,1,'rejected requests never call the provider');
  malformed=true; assert.equal((await call()).status,502);
} finally {
  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY=previousKey;
}
console.log('Translation endpoint passed with mocked provider: success, role/org isolation, origin checks, expired trial, unsupported PDF language, malformed response. No live AI calls.');
