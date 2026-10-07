import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: true });
try {
  const context = await browser.newContext();
  const requests = [];
  let claimed = false;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'bzr.openai.com') {
      requests.push({ url: request.url(), headers: request.headers() });
      return route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64') });
    }
    if (url.hostname !== 'pixel.test') throw new Error('Unexpected external request: ' + url.hostname);
    if (url.pathname === '/api/ads/registration') {
      if (claimed) return route.fulfill({ status: 204 });
      claimed = true;
      return route.fulfill({ contentType: 'application/json', body: '{"eventId":"00000000-0000-4000-8000-000000000001"}' });
    }
    return route.fulfill({ contentType: 'text/html', body: '<input value="private@example.com"><span id="pixel"></span>' });
  });
  const page = await context.newPage();
  await page.goto('https://pixel.test/signup?oppref=opaque-click&email=private@example.com');
  function compile(path) {
    return ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
      .replace(/^import .*?;\r?\n/gm, '').replace(/\bexport /g, '');
  }
  await page.addScriptTag({ content: `
    let testPath='/signup', testConsent=null, cleanup;
    function usePathname(){return testPath;}
    function useConsent(){return testConsent;}
    function useRef(){return {current:document.getElementById('pixel')};}
    function useEffect(fn){cleanup=fn();}
    function _jsx(){return null;}
    ${compile('src/lib/openai-pixel.ts')}
    ${compile('src/components/openai-pixel.tsx')}
    window.renderTest=(path,consent)=>{
      cleanup?.();testPath=path;testConsent=consent;
      document.cookie='fw-consent='+consent+'; path=/; secure';
      OpenAIPixel({enabled:true});
    };
  ` });
  await page.evaluate(() => window.renderTest('/signup', 'denied'));
  assert.equal((await context.cookies()).some(c => c.name === 'fw-openai-oppref'), false);
  await page.evaluate(() => window.renderTest('/signup', 'granted'));
  assert.equal((await context.cookies()).find(c => c.name === 'fw-openai-oppref')?.value, 'opaque-click');
  assert.equal(requests.length, 0, 'landing does not send a conversion');
  await page.evaluate(() => window.renderTest('/dashboard', 'granted'));
  await page.waitForFunction(() => document.querySelector('#pixel img')?.complete);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers.referer, 'https://pixel.test/');
  const params = new URL(requests[0].url).searchParams;
  assert.equal(params.get('oppref'), 'opaque-click');
  assert.equal(params.get('event'), 'registration_completed');
  assert.equal([...params].length, 5);
  assert.equal(requests[0].url.includes('private'), false);
  await page.evaluate(() => window.renderTest('/dashboard', 'granted'));
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(requests.length, 1, 'repeat claim is suppressed');
  await page.evaluate(() => window.renderTest('/signatures/id', 'granted'));
  assert.equal(await page.locator('#pixel img').count(), 0);
  assert.equal(await page.evaluate(() => typeof window.oaiq), 'undefined');
  console.log('Browser passed: actual component, consent, attribution cookie, exact image fields, origin-only referrer, repeat suppression, document exclusion. All requests intercepted; no live events.');
} finally { await browser.close(); }
