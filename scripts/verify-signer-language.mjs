import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signerText, signerFieldLabel } from '../src/lib/signer-language.ts';
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
assert.ok(form.includes(`<option value="fr">${frenchName}</option>`));
assert.ok(form.includes('Les clauses et les champs personnalis\u00e9s restent dans leur langue d\u2019origine.'));
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
assert.ok(done.includes('C\u2019est fait !'));
assert.ok(done.includes('Votre document a \u00e9t\u00e9 sign\u00e9 et enregistr\u00e9. Si vous avez fourni une adresse e-mail, une copie vous sera envoy\u00e9e.'));
console.log(`UTF-8 and rendered accent checks passed across ${signerFiles.length} signer files (${checkedStrings} literals).`);
console.log('Signer language checks passed: French labels, original legal/custom wording, unchanged option values and submission keys.');
