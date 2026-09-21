import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Compile the same local catalogs used by Next without a separate Node resolver.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText).toString('base64')}`;
const translations = moduleUrl(readFileSync('src/lib/signer-translations.ts', 'utf8'));
const languageSource = readFileSync('src/lib/signer-language.ts', 'utf8');
const { signerText, signerFieldLabel, SIGNER_LANGUAGES, signerLanguage, signerDirection } = await import(moduleUrl(languageSource.replace('"./signer-translations"', JSON.stringify(translations))));
assert.equal(signerText('Email','fr'),'Adresse e-mail');
assert.equal(signerText('Date of Birth','fr'),'Date de naissance');
assert.equal(signerText('Full legal name','fr'),'Nom légal complet');
assert.equal(signerText('Yes','fr'),'Oui');
assert.equal(signerText('Sign waiver','en'),'Sign waiver');
assert.equal(signerFieldLabel('Type','fr'),'Type');
assert.equal(signerFieldLabel('Email','fr'),'Adresse e-mail');
assert.equal(signerText('I accept this business-specific legal clause.','fr'),'I accept this business-specific legal clause.');
const form=readFileSync('src/components/signing-form.tsx','utf8');
const fields=readFileSync('src/components/waiver-render.tsx','utf8');
assert.match(form,/\{props.consentText\}/);
assert.match(form,/<BlockView key=\{i\} block=\{block\}/);
assert.match(fields,/<option key=\{opt\} value=\{opt\}>/);
assert.match(form,/fieldValues: submittedValues/);
assert.match(form,/done\?lang=\$\{language\}/);
// Decode bytes strictly: Node's usual utf8 reader silently replaces invalid bytes.
// Inspect string/JSX literals rather than TypeScript's legitimate ? operators.
const signerFiles = [
  'src/lib/signer-language.ts',
  'src/lib/signer-translations.ts',
  'src/lib/signer-consent.ts',
  'src/components/waiver-editor.tsx',
  'src/components/signing-form.tsx',
  'src/components/signature-canvas.tsx',
  'src/components/waiver-render.tsx',
  'src/app/w/[slug]/page.tsx',
  'src/app/w/[slug]/done/page.tsx',
  'src/app/kiosk/[slug]/page.tsx',
];
let checkedStrings = 0;
for (const file of signerFiles) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      assert.doesNotMatch(node.text, /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC/, `${file}: mojibake`);
      assert.doesNotMatch(node.text, /\p{L}\?\p{L}/u, `${file}: question mark inside a word`);
      checkedStrings++;
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
// Unicode escapes keep expected accents independent of this test file's encoding.
const frenchName = 'Fran\u00e7ais';
assert.equal(SIGNER_LANGUAGES.find(l => l.code === 'fr').name, frenchName);
assert.match(form, /SIGNER_LANGUAGES\.map/);
assert.ok(languageSource.includes('Les clauses et les champs personnalis\u00e9s restent dans leur langue d\u2019origine.'));
const examples = [
  ['Full legal name', 'Nom l\u00e9gal complet'],
  ['Phone', 'T\u00e9l\u00e9phone'],
  ['The participant is under 18', 'Le participant a moins de 18 ans'],
  ['Parent / guardian full legal name', 'Nom l\u00e9gal complet du parent ou du repr\u00e9sentant l\u00e9gal'],
  ['Type your full signature', 'Saisissez votre signature compl\u00e8te'],
  ['Your typed signature will appear in the signed PDF.', 'Votre signature saisie appara\u00eetra dans le PDF sign\u00e9.'],
  ['You must agree to sign electronically.', 'Vous devez accepter de signer \u00e9lectroniquement.'],
  ['Submitting\u2026', 'Envoi\u2026'],
  ["You're all set!", 'C\u2019est fait !'],
];
for (const [key, expected] of examples) {
  assert.equal(signerText(key, 'fr'), expected);
  assert.equal(renderToStaticMarkup(createElement('span', { lang: 'fr' }, signerText(key, 'fr'))), `<span lang="fr">${expected}</span>`);
}
const done = readFileSync('src/app/w/[slug]/done/page.tsx', 'utf8');
assert.match(done, /signerLanguage\(\(await searchParams\)\.lang\)/);
assert.ok(done.includes('signerText("Your waiver has been signed and recorded.", language)'));
assert.equal(SIGNER_LANGUAGES.length, 10);
assert.equal(signerLanguage('invalid'), 'en');
assert.equal(signerDirection('ar'), 'rtl');
assert.equal(signerDirection('ur'), 'rtl');
assert.equal(signerDirection('fr'), 'ltr');
assert.equal(signerFieldLabel('Your Email', 'fr'), 'Adresse e-mail');
assert.equal(signerFieldLabel('Signature', 'es'), 'Firma');
const { translationRows, additionalLanguages } = await import(translations);
for (const [key, values] of Object.entries(translationRows)) {
  assert.equal(values.length, additionalLanguages.length, key);
  additionalLanguages.forEach((lang, index) => {
    assert.ok(values[index].trim(), `${lang}: ${key}`);
    assert.equal(signerText(key, lang), values[index], `${lang}: ${key}`);
  });
  assert.ok(signerText(key, 'fr'), `fr: ${key}`);
}
// Every translated interface call has a nonempty entry in all ten languages.
for (const file of ['src/components/signing-form.tsx', 'src/components/signature-canvas.tsx', 'src/components/waiver-editor.tsx']) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bt\("([^"]+)"\)/g)) {
    assert.ok(Object.hasOwn(translationRows, match[1]), `${file}: missing ${match[1]}`);
  }
}
const editor = readFileSync('src/components/waiver-editor.tsx', 'utf8');
assert.match(editor, /signer_language: language/);
assert.match(editor, /setLanguage\(signerLanguage\(recovery\.draft\.signer_language\)\)/);
assert.match(editor, /consentText === DEFAULT_CONSENT_TEXT/);
assert.match(editor, /setConsentText\(FRENCH_DEFAULT_CONSENT\)/);
for (const lang of SIGNER_LANGUAGES) {
  assert.equal(signerFieldLabel('Custom medical question?', lang.code), 'Custom medical question?');
}
const signRoute = readFileSync('src/app/api/sign/[slug]/route.ts', 'utf8');
assert.match(signRoute, /consent_text_snapshot: version.consent_text/);
assert.match(signRoute, /consentText: version.consent_text/);
// Render real form/field/signature components, with only navigation and CAPTCHA
// stubbed. No database, network, or real submission is involved.
const nodeRequire = createRequire(import.meta.url);
const cache = new Map();
function loadComponent(path) {
  const file = resolve(path);
  if (cache.has(file)) return cache.get(file);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule.exports);
  const requireLocal = id => {
    if (id === 'next/navigation') return { useRouter: () => ({ push() {} }) };
    if (id === '@/components/turnstile-widget') return { TurnstileWidget: () => null };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? resolve('src', id.slice(2)) : resolve(dirname(file), id);
      const target = ['.ts', '.tsx'].map(ext => base + ext).find(existsSync);
      assert.ok(target, `Missing local module ${id}`);
      return loadComponent(target);
    }
    return nodeRequire(id);
  };
  new Function('require', 'module', 'exports', compiled)(requireLocal, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { SigningForm } = loadComponent('src/components/signing-form.tsx');
const { default: DonePage } = loadComponent('src/app/w/[slug]/done/page.tsx');
const formProps = {
  slug: 'test', waiverName: 'Test waiver', orgName: 'Test organization',
  blocks: [{ type: 'paragraph', text: 'Original clause, unchanged.' }],
  fields: [{ key: 'email', type: 'email', label: 'Your Email', required: true }, { key: 'custom', type: 'text', label: 'Custom question?', required: false }],
  consentText: 'Original consent, unchanged.', minorMode: 'allowed', channel: 'link',
};
for (const { code } of SIGNER_LANGUAGES) {
  const html = renderToStaticMarkup(createElement(SigningForm, { ...formProps, defaultLanguage: code }));
  assert.ok(html.includes(`lang="${code}"`));
  assert.ok(html.includes(`dir="${signerDirection(code)}"`));
  assert.ok(html.includes(signerFieldLabel('Your Email', code)));
  assert.ok(html.includes(signerText('The participant is under 18', code)));
  assert.ok(html.includes(signerText('Clear drawing', code)));
  assert.ok(html.includes('Original clause, unchanged.'));
  assert.ok(html.includes('Custom question?'));
  assert.ok(html.includes('Original consent, unchanged.'));
  assert.equal((html.match(/<option /g) ?? []).length, 10);
  const completion = renderToStaticMarkup(await DonePage({ searchParams: Promise.resolve({ lang: code }) }));
  assert.ok(completion.includes(`lang="${code}"`));
  assert.ok(completion.includes(signerText('Your waiver has been signed and recorded.', code)));
}
console.log('Actual signing form SSR passed in all ten languages, including RTL, common fields, signature controls and unchanged legal content.');
console.log(`UTF-8 and rendered accent checks passed across ${signerFiles.length} signer files (${checkedStrings} literals).`);
console.log('Signer language checks passed: French labels, original legal/custom wording, unchanged option values and submission keys.');
