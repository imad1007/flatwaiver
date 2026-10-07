import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cache = new Map();
let state = [], refs = [], stateCursor = 0, refCursor = 0;
const hooks = {
  forwardRef: render => render,
  useState(initial) { const index = stateCursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], update => { state[index] = typeof update === 'function' ? update(state[index]) : update; }]; },
  useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
  useImperativeHandle(ref, create) { ref.current = create(); },
};
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    if (file.endsWith('group-participants.tsx') && id === 'react') return hooks;
    if (id === './signature-canvas') return { SignatureCanvas: () => null };
    if (id === './waiver-render') return { signerInputClass: '' };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync));
    }
    return require(id);
  }, loaded, loaded.exports);
  cache.set(file, loaded.exports); return loaded.exports;
}
const { GroupParticipants } = load('src/components/group-participants.tsx');
const handle = { current: null };
let tree;
function render(language = 'en') { stateCursor = 0; refCursor = 0; tree = GroupParticipants({ language, minorMode: 'allowed' }, handle); return tree; }
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
function changeCount(count) { nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: String(count) } }); render(); }
function fields() { return nodes(tree).filter(n => n.type === 'fieldset'); }
function name(i, value) { nodes(fields()[i]).find(n => n.type === 'input' && n.props.type !== 'checkbox').props.onChange({ target: { value } }); render(); }
function sign(i, value) { nodes(fields()[i]).find(n => typeof n.props?.ref === 'function').props.ref({ getDataUrl: () => value }); }
render(); changeCount(2); name(0, 'John'); name(1, 'Jane'); sign(0, 'john-signature'); sign(1, 'jane-signature');
changeCount(4); name(2, 'Third'); name(3, 'Fourth'); sign(2, 'third-signature'); sign(3, 'fourth-signature');
changeCount(2);
assert.ok(fields()[2].props.hidden && fields()[2].props.disabled);
assert.deepEqual(handle.current.collect().participants.map(p => p.fullName), ['John', 'Jane']);
changeCount(4);
assert.deepEqual(handle.current.collect().participants.map(p => [p.fullName, p.signatureDataUrl]), [['John','john-signature'],['Jane','jane-signature'],['Third','third-signature'],['Fourth','fourth-signature']]);
name(2, ''); render('fr');
assert.equal(handle.current.collect().error, 'Participant 3: Le nom complet est obligatoire.');
const frenchText = JSON.stringify(tree);
assert.ok(frenchText.includes('Nombre de participants'));
assert.ok(frenchText.includes('Nom du participant'));
state = []; refs = []; render();
assert.equal(nodes(tree).find(n => n.type === 'select').props.value, 1);
assert.equal(handle.current.collect().error, 'Participant 1: Full name is required.');
console.log('PASS: actual participant UI handlers retain names/signatures on 2→4→2→4, omit hidden participants, identify French validation errors and clear state for the next kiosk group');
