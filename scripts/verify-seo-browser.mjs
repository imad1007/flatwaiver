import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.SEO_BASE_URL??'http://localhost:3010';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
// Keep UI smoke tests deterministic and prevent third-party telemetry/network calls.
await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
await page.context().addCookies([{name:'fw-consent',value:'denied',url:base}]);
const pages=['/pricing','/features/qr-code-waivers','/industries/fitness-studios','/industries/climbing-gyms','/industries/trampoline-parks','/blog/waiver-software-cost'];
const report=[];
await mkdir('docs/seo/screenshots',{recursive:true});
for(const theme of ['light','dark']){
 await page.context().addCookies([{name:'fw-theme',value:theme,url:base}]);
 for(const path of pages){
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});
   const response=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(response.status(),200,path);
   assert.equal(await page.locator('h1').count(),1);
   const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.equal(dims.width,dims.scroll,theme+path+width+' overflow');
   const signup=page.locator('a[href="/signup"]');assert.ok(await signup.count()>0);
   const name=path.replaceAll('/','-');
   if(width===390||width===1440)await page.screenshot({path:`docs/seo/screenshots/${theme}${name}-${width}.png`,fullPage:false,animations:'disabled'});
   report.push({path,theme,...dims,status:response.status()});
  }
 }
}
await page.goto(base,{waitUntil:'networkidle'});
await page.locator('#try-it').scrollIntoViewIfNeeded();
await page.getByText('Interactive demo',{exact:false}).first().waitFor({state:'visible'});
const demo=page.locator('#try-it');await demo.locator('form').waitFor({state:'visible'});
await demo.getByRole('radio',{name:'Type',exact:true}).locator('..').click();
assert.ok(await demo.getByRole('radio',{name:'Type',exact:true}).isChecked());
await demo.getByRole('textbox',{name:/Type your full signature/}).fill('Alex Demo');
await demo.getByRole('checkbox').check();
await demo.getByRole('button',{name:'Sign the demo waiver',exact:true}).click();
await demo.getByText(/Demo receipt/).waitFor({state:'visible'});
await demo.getByRole('button',{name:'Try again',exact:true}).click();
assert.ok(await demo.locator('form').count()>0,'demo resets');
for(const path of ['/signup','/login']){const r=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(r.status(),200);assert.ok(await page.locator('h1').isVisible());}
await writeFile('docs/seo/browser-verification.json',JSON.stringify({checkedOn:new Date().toISOString().slice(0,10),views:report,deferredDemo:'PASS',authNavigation:'PASS',accountCreation:'NOT ATTEMPTED'},null,2));
await browser.close();console.log('PASS: 36 responsive/theme views, deferred demo load and signup/login navigation; no accounts created');
