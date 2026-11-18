import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cache = new Map();
let state = [], refs = [], stateCursor = 0, refCursor = 0, realReact = false, kiosk = false;
const hooks = {
  memo: component => component,
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
    if (!realReact && file.endsWith('group-participants.tsx') && id === 'react') return hooks;
    if (id === 'next/navigation') return { useRouter: () => ({ push() {} }) };
    if (id === '@/components/turnstile-widget') return { TurnstileWidget: () => null };
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
function render(language = 'en') { stateCursor = 0; refCursor = 0; tree = GroupParticipants({ language, minorMode: 'allowed', kiosk }, handle); return tree; }
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
function changeCount(count) { nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: String(count) } }); render(); }
function fields() { return nodes(tree).filter(n => n.type === 'fieldset'); }
function name(i, value) { nodes(fields()[i]).find(n => n.type === 'input' && n.props.type !== 'checkbox').props.onChange({ target: { value } }); render(); }
function dob(i, value) { nodes(fields()[i]).find(n => n.type === 'input' && n.props.type === 'date').props.onChange({ target: { value } }); render(); }
function sign(i, value) { nodes(fields()[i]).find(n => typeof n.props?.ref === 'function' && n.type !== 'fieldset').props.ref({ getDataUrl: () => value }); }
render(); changeCount(2); name(0, 'John'); name(1, 'Jane'); sign(0, 'john-signature'); sign(1, 'jane-signature');
changeCount(4); name(2, 'Third'); name(3, 'Fourth'); sign(2, 'third-signature'); sign(3, 'fourth-signature');
for (let i=0;i<4;i++) dob(i, ['1980-01-02','1991-03-04','2000-02-29','2015-12-31'][i]);
changeCount(2);
assert.ok(fields()[2].props.hidden && fields()[2].props.disabled);
assert.deepEqual(handle.current.collect().participants.map(p => p.fullName), ['John', 'Jane']);
changeCount(4);
assert.deepEqual(handle.current.collect().participants.map(p => [p.fullName, p.signatureDataUrl]), [['John','john-signature'],['Jane','jane-signature'],['Third','third-signature'],['Fourth','fourth-signature']]);
assert.deepEqual(handle.current.collect().participants.map(p=>[p.fullName,p.dateOfBirth]), [['John','1980-01-02'],['Jane','1991-03-04'],['Third','2000-02-29'],['Fourth','2015-12-31']]);
dob(3, ''); render('fr');
assert.match(handle.current.collect().error, /Participant 4:.*date de naissance/);
dob(3, '9999-01-01'); assert.match(handle.current.collect().error,/Participant 4:.*date of birth/);
changeCount(2); assert.equal(handle.current.collect().error,undefined);
changeCount(4); dob(3,'2015-12-31');
name(2, ''); render('fr');
assert.equal(handle.current.collect().error, 'Participant 3: Le nom complet est obligatoire.');
const frenchText = JSON.stringify(tree);
assert.ok(frenchText.includes('Nombre de participants'));
assert.ok(frenchText.includes('Nom du participant'));
state = []; refs = []; render();
assert.equal(nodes(tree).find(n => n.type === 'select').props.value, 1);
assert.equal(handle.current.collect().error, 'Participant 1: Full name is required.');
assert.equal(nodes(fields()[0]).find(n=>n.props?.type==='date').props.value,'');
console.log('PASS: actual participant UI handlers retain names/signatures on 2→4→2→4, omit hidden participants, identify French validation errors and clear state for the next kiosk group');

// Exercise stable kiosk slots and shared guardian binding through real handlers.
state=[];refs=[];kiosk=true;globalThis.requestAnimationFrame=callback=>callback();render();
function text(node){return typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';}
function click(label){nodes(tree).find(node=>node.type==='button' && text(node)===label).props.onClick();render();}
function signature(i,guardian=false){let image=`signature-${i}-${guardian}`;nodes(fields()[i]).find(node=>typeof node.props?.ref==='function' && node.type!=='fieldset' && Boolean(node.props?.label?.includes('Parent / guardian signature'))===guardian).props.ref({getDataUrl:()=>image,clear:()=>{image=null;}});}
name(0,'Parent');dob(0,'1980-01-01');signature(0);
for(let i=1;i<=3;i++){click('Add child');name(i,`Child ${i}`);dob(i,`2015-01-0${i}`);signature(i);}
nodes(tree).find(node=>node.props?.['data-shared-guardian']==='name').props.onChange({target:{value:'Parent'}});render();
nodes(tree).find(node=>node.props?.['data-shared-guardian']==='relationship').props.onChange({target:{value:'Parent'}});render();
for(let i=1;i<=3;i++){const label=nodes(fields()[i]).find(node=>node.type==='label' && text(node).includes('Use family guardian details for this child'));nodes(label).find(node=>node.type==='input').props.onChange({target:{checked:true}});render();signature(i,true);}
assert.deepEqual(handle.current.collect().participants.slice(1).map(participant=>[participant.fullName,participant.dateOfBirth,participant.guardianName,participant.guardianRelationship]),[['Child 1','2015-01-01','Parent','Parent'],['Child 2','2015-01-02','Parent','Parent'],['Child 3','2015-01-03','Parent','Parent']]);
nodes(tree).find(node=>node.props?.['data-shared-guardian']==='name').props.onChange({target:{value:'Other Guardian'}});render();
assert.match(handle.current.collect().error,/Guardian name, relationship, and signature/);render();
for(let i=1;i<=3;i++)signature(i,true);
assert.equal(handle.current.collect().participants[3].guardianName,'Other Guardian');
nodes(fields()[2]).find(node=>node.type==='button' && text(node)==='Remove participant').props.onClick();render();
nodes(tree).filter(node=>node.type==='button' && text(node)==='Remove participant').at(-1).props.onClick();render();
assert.deepEqual(handle.current.collect().participants.map(participant=>[participant.fullName,participant.dateOfBirth]),[['Parent','1980-01-01'],['Child 1','2015-01-01'],['Child 3','2015-01-03']]);
click('Add adult');name(2,'Replacement');dob(2,'1990-01-01');signature(2);
assert.deepEqual(handle.current.collect().participants.map(participant=>participant.fullName),['Parent','Child 1','Child 3','Replacement']);
dob(3,'2015-02-01');assert.match(handle.current.collect().error,/signature/);
console.log('PASS: actual family reuse handlers, separate guardian signatures, signature invalidation on identity changes, middle removal/readdition and name/DOB/evidence pairing');

// Render the actual parent form: group DOB replaces the primary template input,
// while single signing still renders the original required template field.
realReact = true; cache.clear();
const { SigningForm } = load('src/components/signing-form.tsx');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const props = { slug: 'sample', waiverName: 'Sample', orgName: 'Org', blocks: [], fields: [{ key: 'dob', type: 'date_of_birth', label: 'Original DOB label', required: true }], consentText: 'Consent', minorMode: 'allowed', channel: 'link' };
for (const enabled of [false,true]) {
 const html = renderToStaticMarkup(createElement(SigningForm, { ...props, groupSigningEnabled: enabled }));
 assert.equal((html.match(/type="date"/g)??[]).length,1);
 assert.equal(html.includes('Original DOB label'),!enabled);
 assert.equal(html.includes('Group participants'),enabled);
}
console.log('PASS: actual signing form renders per-participant DOB without duplicate primary input; single form retains its original DOB field.');
