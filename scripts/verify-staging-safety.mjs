import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,env,dependencies={}) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,process:{env},require:name=>{if(name in dependencies)return dependencies[name];throw Error(`Unexpected dependency ${name}`);},console,Buffer,Error,Date});
  return exports;
}
const stage={FLATWAIVER_ENV:'staging',VERCEL_ENV:'production',RESEND_API_KEY:'accidentally-copied-live-key'};
const forbidden=()=>{throw Error('External side effect attempted');};
const email=load('src/lib/email.ts',stage,{'server-only':{},resend:{Resend:forbidden},'@/lib/config':{APP:{},transactionalEmailFrom:()=>''},'@/lib/billing-expiry-email':{billingExpiryEmail:forbidden}});
await email.sendSignerCopyEmail({to:'customer@example.com'});
await assert.rejects(()=>email.sendBillingExpiryEmail({to:'customer@example.com'}),/not configured/);
const hooks=load('src/lib/webhooks.ts',stage,{'server-only':{},crypto:{createHmac:forbidden},'@/lib/supabase/admin':{createAdminClient:forbidden},'@/lib/webhook-url':{assertSafeWebhookUrl:forbidden}});
await hooks.dispatchWebhooks('org',{});
const billing=load('src/lib/creem-environment.ts',stage);
assert.throws(()=>billing.resolveCreemServer('prod','creem_live_example'),/Staging requires/);
assert.throws(()=>billing.resolveCreemServer('test','unknown-key'),/Staging requires/);
assert.equal(billing.resolveCreemServer('test','creem_test_example'),'test');
const stripe=load('src/lib/stripe.ts',{...stage,STRIPE_SECRET_KEY:'sk_live_example'},{'server-only':{},stripe:{default:forbidden}});
assert.throws(()=>stripe.getStripe(),/Staging requires/);
const robots=load('src/app/robots.ts',stage,{'@/lib/config':{APP:{siteUrl:'https://www.flatwaiver.com'}}});
assert.equal(robots.default().rules[0].disallow,'/');
const production=load('src/app/robots.ts',{VERCEL_ENV:'production'},{'@/lib/config':{APP:{siteUrl:'https://www.flatwaiver.com'}}});
assert.equal(production.default().rules[0].allow,'/');
const config=load('next.config.ts',stage);
assert.ok((await config.default.headers()).some(rule=>rule.source==='/:path*' && rule.headers.some(header=>header.key==='X-Robots-Tag' && header.value.includes('noindex'))));
console.log('PASS: actual staging helpers prevent app mail, outbound customer hooks and live billing; noindex survives Vercel production target; production robots unchanged.');
