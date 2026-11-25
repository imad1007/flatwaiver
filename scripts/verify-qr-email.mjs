import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path, deps) {const mod={exports:{}};const src=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports','process','Buffer',src)(name=>{assert(name in deps,name);return deps[name];},mod,mod.exports,{env:{QR_CHECKIN_ENABLED:'true',RESEND_API_KEY:'test-only'}},Buffer);return mod.exports;}
let providerFails=false;const sends=[];
class Resend { emails={send:async(message,options)=>{sends.push({message,options});return providerFails?{data:null,error:{message:'Temporary failure'}}:{data:{id:'mail-test'},error:null};}}; }
const email=load('src/lib/email.ts',{'server-only':{},resend:{Resend},'@/lib/config':{APP:{supportEmail:'support@example.test'},transactionalEmailFrom:()=> 'test@example.test'},'@/lib/billing-expiry-email':{}});
const payload={to:'visitor@example.test',recordId:'fixture',images:[Buffer.from('qr')]};
await email.sendWaiverPassEmail(payload);await email.sendWaiverPassEmail(payload);assert.equal(sends[0].options.idempotencyKey,sends[1].options.idempotencyKey);assert(!sends[0].message.text.includes('fixture'));
providerFails=true;await assert.rejects(()=>email.sendWaiverPassEmail(payload));
let state='pending',lease=false,fail=true;const updates=[];
const admin={rpc:async()=>{if(lease)return {data:false,error:null};lease=true;return {data:true,error:null};},from(table){return {select(){return this;},eq(){return this;},single:async()=>({data:table==='signed_waivers'?{signer_email:'visitor@example.test'}:{receipt_hash:'hash'},error:null}),update(value){updates.push(value);state=value.state;if(value.lease_until===null)lease=false;return this;},then(resolve){resolve({error:null});}};}};
let calls=0;
const worker=load('src/lib/qr-pass-mail.ts',{'server-only':{},qrcode:{default:{toBuffer:async()=>Buffer.from('qr')}},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/email':{sendWaiverPassEmail:async()=>{calls++;if(fail)throw new Error('Network failed');return 'accepted';}},'@/lib/qr-pass':{qrPassesEnabled:()=>true,ensurePasses:async()=>[{code:'opaque',revoked:false}]}});
await worker.deliverPassEmail('fixture');assert.equal(state,'pending');assert(updates.at(-1).next_attempt_at);assert.equal(calls,1);
fail=false;await worker.deliverPassEmail('fixture');assert.equal(state,'sent');assert.equal(updates.at(-1).provider_id,'accepted');
lease=true;await worker.deliverPassEmail('fixture');assert.equal(calls,2,'another lease holder cannot send');
console.log('PASS: transactional pass email attachments, stable provider idempotency key, provider rejection, durable failure retry, sent state and lease exclusion.');
