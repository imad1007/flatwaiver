import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

// Use an installed/cached Playwright via PLAYWRIGHT_MODULE; no app dependency.
const require = createRequire(import.meta.url);
let playwright;
for (const candidate of [process.env.PLAYWRIGHT_MODULE, 'playwright', ...(process.env.PATH ?? '').split(path.delimiter).filter(directory=>directory.endsWith('node_modules\\.bin') || directory.endsWith('node_modules/.bin')).map(directory=>path.join(directory,'..','playwright'))].filter(Boolean)) {
  try { playwright=require(candidate); break; } catch { /* try the next installed tool */ }
}
assert.ok(playwright, 'Install Playwright or run this script via npm exec --package=playwright@1.61.1');
const { chromium } = playwright;
const fixtureDir = path.resolve('src/app/kiosk-test-fixture');
assert.equal(path.dirname(fixtureDir),path.resolve('src/app'));
assert.ok(!fs.existsSync(fixtureDir), 'Refuse to overwrite an existing route');
fs.mkdirSync(fixtureDir);
fs.mkdirSync('tmp/kiosk',{recursive:true});
fs.writeFileSync(path.join(fixtureDir,'page.tsx'), `
import { SigningForm } from '@/components/signing-form';
import { notFound } from 'next/navigation';
export default async function Fixture({searchParams}:{searchParams:Promise<{single?:string;standard?:string;collapsed?:string}>}) {
  if(process.env.FLATWAIVER_KIOSK_TEST !== '1' || process.env.NODE_ENV !== 'development') notFound();
  const params=await searchParams;
  return <main className="mx-auto max-w-4xl px-4 py-8"><SigningForm documentDisplay={params.collapsed ? "collapsed" : undefined} slug="local-fixture" waiverName="Training waiver" orgName="Local test" defaultLanguage="en" blocks={[{type:'paragraph',text:'Read these waiver terms before signing.'}]} fields={[{key:'dob',type:'date_of_birth',label:'Date of birth',required:true},{key:'required_answer',type:'checkbox',label:'Safety acknowledgment',required:true},{key:'optional_note',type:'text',label:'Optional note',required:false}]} consentText="I agree to sign this waiver electronically." minorMode="allowed" channel={params.standard?'link':'kiosk'} kiosk={!params.standard} groupSigningEnabled={!params.single} kioskHiddenFields={['optional_note','required_answer','dob']} /></main>;
}
`);
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3107'], {env:{...process.env,FLATWAIVER_KIOSK_TEST:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let serverOutput='';
server.stdout.on('data',data=>{serverOutput=(serverOutput+data).slice(-5000);});
server.stderr.on('data',data=>{serverOutput=(serverOutput+data).slice(-5000);});
let browser;
const results=[];
try {
  for(let i=0;i<60;i++) {
    try {if((await fetch('http://127.0.0.1:3107/kiosk-test-fixture')).ok)break;}catch{}
    if(i===59)throw Error('Fixture server did not start: '+serverOutput);
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  await context.route('https://challenges.cloudflare.com/**',route=>route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(el,opts)=>{window.testToken=opts.callback;setTimeout(()=>opts.callback('local-test-token'),0);return 'fixture';},reset:()=>{setTimeout(()=>window.testToken?.('local-test-token'),0);}};`}));
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let submitted, failSubmit=false;
  await page.route('**/api/sign/local-fixture',async route=>{submitted=route.request().postDataJSON();await route.fulfill({status:failSubmit?503:200,contentType:'application/json',body:JSON.stringify(failSubmit?{error:'Test service unavailable'}:{id:'local',ok:true})});});
  await page.clock.install();
  const visible = selector => page.locator(selector).filter({visible:true});
  async function open(params='') {submitted=null;await page.goto('http://127.0.0.1:3107/kiosk-test-fixture'+params);await page.getByRole('button',{name:params.includes('standard')?'Sign waiver':'Continue',exact:true}).waitFor();}
  async function agree(){await visible('input[type=checkbox]').check();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('checkbox',{name:'Safety acknowledgment'}).check();}
  async function fill(slot,name,dob,guardian=false) {
    const card=visible('[data-participant-field="name"]').locator('xpath=ancestor::fieldset[1]');
    await card.locator('[data-participant-field="name"]').fill(name);
    await card.locator('[data-participant-field="dob"]').fill(dob);
    const signature=card.locator('[data-participant-field="signature"]');
    await signature.getByRole('button',{name:`Sign with this name: ${name}`,exact:true}).click();
    if(guardian) {await card.getByRole('checkbox',{name:'Use family guardian details for this child'}).check();const region=card.locator('[data-participant-field="guardian"]');await region.getByRole('button',{name:'Sign with this name: Parent Name',exact:true}).click();}
  }

  // Both public and kiosk renderers preserve all terms, consent, and signing.
  for (const standard of [false, true]) {
    for (const collapsed of [false, true]) {
      await page.setViewportSize({width:390,height:844});
      await open('?' + (standard ? 'standard=1&' : '') + (collapsed ? 'collapsed=1' : ''));
      const terms=page.getByText('Read these waiver terms before signing.',{exact:true});
      assert.equal(await terms.isVisible(),!collapsed);
      if(collapsed) {
        const view=page.getByRole('button',{name:'View Document',exact:true});
        assert.equal(await view.getAttribute('aria-expanded'),'false');
        await view.focus();await page.keyboard.press('Enter');
        assert.equal(await terms.isVisible(),true);
        const hide=page.getByRole('button',{name:'Hide Document',exact:true});
        assert.equal(await hide.getAttribute('aria-expanded'),'true');
        await hide.click();assert.equal(await terms.isVisible(),false);
      }
      assert.equal(await terms.textContent(),'Read these waiver terms before signing.');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.getByRole('checkbox',{name:'I agree to sign this waiver electronically.'}).check();
      if(!standard) await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.getByRole('checkbox',{name:'Safety acknowledgment'}).check();
      if(standard) {
        await page.locator('[data-participant-field="name"]').fill('Display Test');
        await page.locator('[data-participant-field="dob"]').fill('1980-01-01');
        await page.getByText('Type',{exact:true}).click();
        await page.getByLabel('Type your full signature').fill('Display Test');
      } else await fill(0,'Display Test','1980-01-01');
      if(!standard) await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.getByRole('button',{name:'Sign waiver',exact:true}).click();
      await page.waitForTimeout(500);
      assert.ok(submitted);
      assert.equal(submitted.consentGiven,true);
      assert.equal(submitted.documentDisplay,undefined,'Display is not legal signature data');
    }
  }
  for(const [scenario,viewport,adults,children] of [
    ['one adult',{width:1440,height:1000},1,0],
    ['two adults',{width:1024,height:768},2,0],
    ['adult plus three children',{width:1024,height:768},1,3],
  ]) {
    await page.setViewportSize(viewport);await open();await agree();
    const start=performance.now();await fill(0,'Parent Name','1980-01-01');
    for(let i=1;i<adults;i++){await page.getByRole('button',{name:'Add adult',exact:true}).click();await fill(i,'Adult '+i,'1990-01-01');}
    for(let i=1;i<=children;i++) {
      await page.getByRole('button',{name:'Add child',exact:true}).click();
      if(i===1) {await page.getByRole('button',{name:'Use primary participant name'}).click();await page.locator('details').getByLabel('Relationship to participant').fill('Parent');}
      await fill(i,'Child '+i,`2015-01-0${i}`,true);
    }
    const entryMs=performance.now()-start;
    const activeFormHeight=await page.locator('form').evaluate(element=>element.scrollHeight);
    await page.screenshot({path:`tmp/kiosk/${scenario.replaceAll(' ','-')}-details.png`,fullPage:true});
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    assert.equal(await visible('[data-kiosk-step="2"] li').count(),adults+children);
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.screenshot({path:`tmp/kiosk/${scenario.replaceAll(' ','-')}.png`,fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
    await page.getByRole('button',{name:'Sign waiver',exact:true}).click();
    await page.getByText("You're all set!",{exact:true}).waitFor();
    assert.equal(submitted.participants.length,adults+children);
    for(let i=1;i<=children;i++){const child=submitted.participants[i];assert.equal(child.guardianName,'Parent Name');assert.equal(child.guardianRelationship,'Parent');assert.equal(child.dateOfBirth,`2015-01-0${i}`);assert.ok(child.guardianSignatureDataUrl.startsWith('data:image/png;base64,'));assert.ok(child.signatureDataUrl.startsWith('data:image/png;base64,'));}
    await page.clock.runFor(5100);
    await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
    assert.equal(await page.locator('[data-participant-field="name"]').inputValue(),'');
    assert.equal(await page.locator('[data-participant-field="dob"]').inputValue(),'');
    assert.equal(await page.locator('input[type=checkbox]:visible').isChecked(),false);
    const names=['Parent Name',...Array.from({length:adults-1},(_,i)=>`Adult ${i+1}`),...Array.from({length:children},(_,i)=>`Child ${i+1}`)];
    results.push({scenario,viewport,automatedEntryMs:entryMs,activeFormHeight,participants:adults+children,typingActions:2*(adults+children)+(children?1:0),typedCharacters:names.reduce((total,name)=>total+name.length+10,0)+(children?'Parent'.length:0),signatureActions:adults+2*children,guardianReuseActions:children});
  }
  // Baseline is the preserved standard, all-participants form. Same fixture,
  // same names/DOBs/consent/signature methods, no writes to a real backend.
  const baseline=[];
  for(const [scenario,count,children] of [['one adult',1,0],['two adults',2,0],['adult plus three children',4,3]]) {
    await open('?standard=1');
    await page.getByLabel('Number of participants').selectOption(String(count));
    await page.getByRole('checkbox',{name:'Safety acknowledgment'}).check();
    await page.getByRole('checkbox',{name:'I agree to sign this waiver electronically.'}).check();
    const start=performance.now();
    for(let i=0;i<count;i++) {
      const card=visible('[data-participant-field="name"]').nth(i).locator('xpath=ancestor::fieldset[1]');
      const name=i===0?'Parent Name':children?`Child ${i}`:`Adult ${i}`;
      await card.locator('[data-participant-field="name"]').fill(name);await card.locator('[data-participant-field="dob"]').fill(i===0?'1980-01-01':children?`2015-01-0${i}`:'1990-01-01');
      const signature=card.locator('[data-participant-field="signature"]');await signature.getByText('Type',{exact:true}).click();await signature.locator('input[type=text]').fill(name);
      if(children && i>0) {
        await card.getByRole('checkbox',{name:'The participant is under 18'}).check();
        await card.getByLabel('Parent / guardian full legal name',{exact:true}).fill('Parent Name');await card.getByLabel('Relationship to participant',{exact:true}).fill('Parent');
        const guardian=card.locator('[data-participant-field="guardian"]');await guardian.getByText('Type',{exact:true}).click();await guardian.locator('input[type=text]').last().fill('Parent Name');
      }
    }
    const entryMs=performance.now()-start;
    const fullFormHeight=await page.locator('form').evaluate(element=>element.scrollHeight);
    failSubmit=true;await page.getByRole('button',{name:'Sign waiver',exact:true}).click();await page.locator('form [role=alert]').waitFor();failSubmit=false;
    const names=['Parent Name',...Array.from({length:count-1},(_,i)=>children?`Child ${i+1}`:`Adult ${i+1}`)];
    baseline.push({scenario,participants:count,typingActions:3*count+3*children,typedCharacters:names.reduce((total,name)=>total+2*name.length+10,0)+children*(2*'Parent Name'.length+'Parent'.length),signatureActions:count+children,guardianTypedFields:2*children,automatedEntryMs:entryMs,fullFormHeight});
  }
  // Removing a middle participant must not shift the remaining evidence.
  await open();await agree();await fill(0,'First Adult','1980-01-01');
  await page.getByRole('button',{name:'Add adult',exact:true}).click();await fill(1,'Middle Adult','1990-01-02');
  await page.getByRole('button',{name:'Add adult',exact:true}).click();await fill(2,'Last Adult','1995-01-03');
  await page.getByRole('button',{name:/Middle Adult/}).click();await page.getByRole('button',{name:'Remove participant',exact:true}).click();
  await page.getByRole('button',{name:'Keep participant',exact:true}).click();assert.equal(await visible('[data-participant-field="name"]').inputValue(),'Middle Adult');
  await page.getByRole('button',{name:'Remove participant',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Remove participant',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Sign waiver',exact:true}).click();await page.getByText("You're all set!",{exact:true}).waitFor();
  assert.deepEqual(submitted.participants.map(participant=>[participant.fullName,participant.dateOfBirth]),[['First Adult','1980-01-01'],['Last Adult','1995-01-03']]);
  // Drawn evidence survives switching to another mounted participant and back.
  await open();await agree();await fill(0,'Drawn Adult','1980-01-01');
  let region=visible('[data-participant-field="signature"]');await region.getByRole('button',{name:'Edit signature',exact:true}).click();await region.getByText('Draw',{exact:true}).click();
  await region.locator('canvas').scrollIntoViewIfNeeded();
  const box=await region.locator('canvas').boundingBox();assert.ok(box);
  await page.mouse.move(box.x+20,box.y+40);await page.mouse.down();for(let i=1;i<=16;i++){await page.mouse.move(box.x+20+i*12,box.y+40+(i%3)*12);await page.clock.runFor(20);}await page.mouse.up();
  const drawing=await region.locator('canvas').evaluate(canvas=>canvas.toDataURL('image/png'));
  await page.getByRole('button',{name:'Add adult',exact:true}).click();await fill(1,'Typed Adult','1990-01-01');
  await page.getByRole('button',{name:/Drawn Adult/}).click();region=visible('[data-participant-field="signature"]');
  const restoredDrawing=await region.locator('canvas').evaluate(canvas=>canvas.toDataURL('image/png'));
  const sharp=require('sharp');
  const beforeInk=(await sharp(Buffer.from(drawing.split(',')[1],'base64')).stats()).channels[3].sum;
  const afterInk=(await sharp(Buffer.from(restoredDrawing.split(',')[1],'base64')).stats()).channels[3].sum;
  // Canvas resize redraws the same strokes; antialiasing/compression may vary.
  assert.ok(beforeInk>0 && afterInk/beforeInk>0.8 && afterInk/beforeInk<1.2,`Drawn signature ink survives card navigation (${beforeInk} -> ${afterInk})`);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Sign waiver',exact:true}).click();await page.getByText("You're all set!",{exact:true}).waitFor();
  const submittedInk=(await sharp(Buffer.from(submitted.participants[0].signatureDataUrl.split(',')[1],'base64')).stats()).channels[3].sum;
  assert.ok(submittedInk/afterInk>0.8 && submittedInk/afterInk<1.2,'Submitted drawing preserves the original ink');
  await open();await agree();await fill(0,'Keep Me','1980-01-01');
  await page.getByRole('button',{name:'Clear form',exact:true}).click();
  await page.getByRole('button',{name:'Keep signing',exact:true}).click();assert.equal(await page.locator('[data-participant-field="name"]').inputValue(),'Keep Me');
  await page.clock.runFor(151000);await page.getByRole('dialog',{name:'Still signing?'}).waitFor();
  await page.getByRole('button',{name:'Continue signing'}).click();assert.equal(await page.locator('[data-participant-field="name"]').inputValue(),'Keep Me');
  await page.clock.runFor(181000);await page.getByRole('button',{name:'Continue',exact:true}).waitFor();assert.equal(await page.locator('[data-participant-field="name"]').inputValue(),'');
  // Missing DOB identifies and focuses the participant field.
  await agree();await page.locator('[data-participant-field="name"]').fill('Incomplete');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('form [role=alert]').waitFor();await page.clock.runFor(100);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-participant-field')),'dob');
  // Single kiosk and standard links preserve their original fields and endpoint shape.
  await open('?single=1');await agree();await page.getByLabel('Date of birth',{exact:false}).fill('1980-01-01');await page.getByLabel('Full legal name',{exact:true}).fill('Single Person');
  await page.getByText('Type',{exact:true}).click();await page.getByLabel('Type your full signature').fill('Single Person');
  await page.getByRole('button',{name:'Continue',exact:true}).click();failSubmit=true;await page.getByRole('button',{name:'Sign waiver',exact:true}).click();await page.locator('form [role=alert]').waitFor();assert.equal(submitted.participants,undefined);
  await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await page.getByLabel('Full legal name',{exact:true}).inputValue(),'Single Person');failSubmit=false;
  await open('?single=1&standard=1');assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).count(),0);assert.equal(await page.getByLabel('Optional note').count(),1);
  await open();await page.getByLabel('Language',{exact:true}).selectOption('fr');await page.getByRole('button',{name:'Continuer',exact:true}).waitFor();await page.locator('input[type=checkbox]:visible').check();await page.getByRole('button',{name:'Continuer',exact:true}).click();await page.getByRole('button',{name:'Ajouter un enfant',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await open();await agree();await fill(0,'Mobile Adult','1980-01-01');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Mobile participant controls fit the viewport');
  await page.screenshot({path:'tmp/kiosk/mobile-details.png',fullPage:true});
  assert.deepEqual(errors,[]);
  const storage=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
  for(const value of ['Parent Name','Child 1','Keep Me','Single Person','1980-01-01','data:image/png'])assert.ok(!storage.includes(value),'Personal signing data must stay out of browser storage');
  fs.writeFileSync('tmp/kiosk/browser-results.json',JSON.stringify({baseline,results,note:'Local real-browser fixtures, development server, mocked signing/Turnstile services. Automated timings include test assertions and are not human completion times or production latency.'},null,2));
  console.log('PASS: desktop/tablet real browser, one/two/family group signing, DOB/guardian signatures, back navigation, single/standard fields, validation focus, French, confirmation, idle warning/reset, success reset and no personal signing data in browser storage');
} finally {
  await browser?.close();server.kill();
  // Only the exact temporary route created above is removed.
  fs.rmSync(fixtureDir,{recursive:true,force:true});
  const generated=path.resolve('.next/dev/types/app/kiosk-test-fixture');
  assert.equal(path.dirname(generated),path.resolve('.next/dev/types/app'));
  fs.rmSync(generated,{recursive:true,force:true});
  const validator=path.resolve('.next/dev/types/validator.ts');
  if(fs.existsSync(validator))fs.writeFileSync(validator,fs.readFileSync(validator,'utf8').replace(/\/\/ Validate [^\r\n]*kiosk-test-fixture[^\r\n]*\r?\n\{[\s\S]*?\r?\n\}\r?\n/g,''));
}
