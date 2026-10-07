import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pixelDocumentScript } from '../src/lib/openai-pixel.ts';
const require = createRequire('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: true });
const context = await browser.newContext();
const bodies = [];
let claimed = false;
const sdk = readFileSync('output/openai-sdk-inspection.txt', 'utf8').replace(/^\uFEFF/, '');
await context.addCookies([{ name: 'fw-consent', value: 'granted', domain: 'pixel.test', path: '/', secure: true }]);
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  // ALL network is intercepted: never contact OpenAI or the production app.
  if (url.hostname === 'bzrcdn.openai.com' && url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'text/javascript', body: sdk });
  if (url.hostname === 'bzrcdn.openai.com') return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"automatic_advanced_matching_enabled":true}' });
  if (url.hostname === 'bzr.openai.com') {
    if (request.postData()) bodies.push(request.postData());
    return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: '{}' });
  }
  if (url.hostname !== 'pixel.test') return route.abort();
  if (url.pathname === '/api/ads/registration') {
    if (claimed) return route.fulfill({ status: 204 });
    claimed = true;
    return route.fulfill({ contentType: 'application/json', body: '{"eventId":"00000000-0000-4000-8000-000000000001"}' });
  }
  if (url.pathname === '/ads/pixel') return route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="referrer" content="no-referrer"><script>${pixelDocumentScript(url.searchParams.get('mode') === 'conversion')}</script></head><body></body></html>` });
  return route.fulfill({ contentType: 'text/html', body: '<html><body><input type="email" value="private-signer@example.com"><p>PRIVATE_WAIVER_CONTENT</p><iframe hidden referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin" src="/ads/pixel?mode=landing&oppref=mock-click"></iframe></body></html>' });
});
const page = await context.newPage();
await page.goto('https://pixel.test/?email=do-not-forward@example.com');
await page.waitForFunction(() => document.cookie.includes('__oppref='));
assert.equal(await page.evaluate(() => typeof window.oaiq), 'undefined');
await page.evaluate(() => { document.querySelector('iframe').src = '/ads/pixel?mode=conversion'; });
for (let i = 0; !claimed && i < 40; i++) await new Promise(resolve => setTimeout(resolve, 100));
assert.ok(claimed);
await new Promise(resolve => setTimeout(resolve, 3000));
const first = bodies.join('\n');
assert.ok(first.includes('registration_completed'), 'real SDK transmitted the mocked conversion');
assert.ok(first.includes('mock-click'), 'attribution persists via SDK cookie between documents');
assert.ok(!first.includes('private-signer') && !first.includes('PRIVATE_WAIVER_CONTENT') && !first.includes('do-not-forward'));
assert.ok(!first.includes(createHash('sha256').update('private-signer@example.com').digest('hex')), 'advanced matching did not inspect the parent form');
const eventsBefore = bodies.filter(body => body.includes('registration_completed')).length;
await page.evaluate(() => { document.querySelector('iframe').src = '/ads/pixel?mode=conversion&refresh=1'; });
await new Promise(resolve => setTimeout(resolve, 2000));
assert.equal(bodies.filter(body => body.includes('registration_completed')).length, eventsBefore);
await page.evaluate(() => { const f = document.querySelector('iframe'); f.contentWindow.oaiq('consent', false); f.remove(); });
assert.ok(!(await page.evaluate(() => document.cookie)).includes('__oppref='));
await browser.close();
console.log('Browser passed: real SDK with all network mocked; iframe isolation, cookie attribution, repeat claim suppression, consent deletion. No live events sent.');
