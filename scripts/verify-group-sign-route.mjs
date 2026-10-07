import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import * as groupSigning from '../src/lib/group-signing.ts';
import * as types from '../src/lib/types.ts';
import { isRealIsoDate } from '../src/lib/signing-validation.ts';
const require = createRequire(import.meta.url);
let enabled = true, accepting = true, saved, pdfInput, rateCount = 0, calls = 0;
const uploads = [];
const admin = { from(table) {
  calls++;
  const query = { select() { return this; }, eq() { return this; }, gte() { return this; }, in() { return this; },
    maybeSingle: async () => ({ data: null, error: null }),
    insert: async row => { saved = row; return { error: null }; },
    then(resolve) { resolve({ data: table === 'profiles' ? [] : null, error: null, count: rateCount }); },
  };
  return query;
}, storage: { from(bucket) { return { upload: async (path, bytes) => { uploads.push({ bucket, path, bytes }); return { error: null }; }, remove: async () => ({ error: null }) }; } } };
const dependencies = {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  'zod': require('zod'),
  '@/lib/supabase/admin': { createAdminClient: () => admin },
  '@/lib/public-waiver': { PublicWaiverLoadError: class extends Error {}, getPublishedWaiverBySlug: async () => ({
    templateId: 'template', orgId: 'org', orgName: 'Org', name: 'Waiver', acceptingSignatures: accepting, photoMode: 'off', branding: {},
    version: { id: 'version', version_number: 1, fields: [], body: [], consent_text: 'Consent', minor_mode: 'allowed', group_signing_enabled: enabled },
  }) },
  '@/lib/turnstile': { verifyTurnstile: async () => true },
  '@/lib/pdf/waiver-pdf': { renderSignedPdf: async input => { pdfInput = input; return { pdf: Buffer.from('%PDF-test'), pdfSha256: 'hash' }; } },
  '@/lib/email': {}, '@/lib/webhooks': { dispatchWebhooks: async () => {} }, '@/lib/config': { APP: {} },
  '@/lib/signing-validation': { isRealIsoDate }, '@/lib/group-signing': groupSigning, '@/lib/types': types,
};
const loaded = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/app/api/sign/[slug]/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', source)(id => { assert.ok(id in dependencies, id); return dependencies[id]; }, loaded, loaded.exports);
const png = await require('sharp')({ create: { width: 100, height: 30, channels: 3, background: '#123456' } }).png().toBuffer();
const signature = 'data:image/png;base64,' + png.toString('base64');
const participant = i => ({ fullName: `Person ${i}`, signatureDataUrl: signature, isMinor: false });
const base = { turnstileToken: 'token', signerName: 'Person 1', isMinor: false, fieldValues: {}, signatureDataUrl: signature, consentGiven: true, channel: 'link' };
const post = body => loaded.exports.POST(new Request('https://example.test/api/sign/group', { method: 'POST', headers: { 'x-real-ip': '127.0.0.1' }, body: JSON.stringify(body) }), { params: Promise.resolve({ slug: 'group' }) });
for (const count of [1, 2, 10]) {
  saved = null; uploads.length = 0;
  const participants = Array.from({ length: count }, (_, i) => participant(i + 1));
  assert.equal((await post({ ...base, participantCount: count, participants })).status, 200);
  assert.deepEqual(saved.participants.map(p => p.full_name), participants.map(p => p.fullName));
  assert.equal(pdfInput.participants.length, count);
  assert.equal(uploads.filter(u => u.bucket === 'signatures').length, count);
  assert.ok(uploads.every(u => u.path.startsWith(`org/${saved.id}/`)));
}
const minor = { ...participant(1), isMinor: true, guardianName: 'Parent', guardianRelationship: 'Parent', guardianSignatureDataUrl: signature };
assert.equal((await post({ ...base, participantCount: 2, participants: [minor, participant(2)] })).status, 200);
assert.equal(saved.is_minor, true);
assert.equal(saved.guardian_name, 'Parent');
assert.equal(saved.guardian_signature_path, saved.participants[0].guardian_signature_path);
assert.equal(pdfInput.participants[0].guardianSignatureDataUrl, signature);
for (const body of [
  { ...base, participantCount: 0, participants: [] },
  { ...base, participantCount: 11, participants: Array.from({ length: 11 }, (_, i) => participant(i + 1)) },
  { ...base, participantCount: 2, participants: [participant(1)] },
  { ...base, participantCount: 1, participants: [{ ...participant(1), extra: true }] },
  { ...base, participantCount: 1, participants: [{ ...participant(1), fullName: '' }] },
  { ...base, participantCount: 1, participants: [{ ...participant(1), signatureDataUrl: '' }] },
  { ...base, participantCount: 1, participants: [participant(1)], signerName: 'Mismatch' },
]) { const before = uploads.length; assert.equal((await post(body)).status, 400); assert.equal(uploads.length, before); }
enabled = false;
assert.equal((await post({ ...base, participantCount: 1, participants: [participant(1)] })).status, 400);
assert.equal((await post(base)).status, 200);
assert.equal(saved.participants, null); assert.equal(pdfInput.participants, undefined);
enabled = true;
rateCount = 5; assert.equal((await post({ ...base, participantCount: 1, participants: [participant(1)] })).status, 429);
accepting = false;
const before = calls;
assert.equal((await post({ ...base, participantCount: 1, participants: [participant(1)] })).status, 403);
assert.equal(calls, before);
console.log('PASS: actual POST single/group submission, participant storage ordering, PDF inputs, private uploads, invalid requests, disabled versions, rate limit and billing gate');
