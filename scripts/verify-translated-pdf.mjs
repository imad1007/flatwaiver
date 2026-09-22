import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file=path.resolve(file);
  if(cache.has(file)) return cache.get(file);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const loaded={exports:{}}; cache.set(file,loaded.exports);
  const local=id=>{
    if(id==='server-only')return {};
    if(id.startsWith('@/')||id.startsWith('.')) {
      const base=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(file),id);
      return load(['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync));
    }
    return require(id);
  };
  new Function('require','module','exports',output)(local,loaded,loaded.exports);
  return loaded.exports;
}
const {renderSignedPdf}=load('src/lib/pdf/waiver-pdf.tsx');
const samples = [
 'Français : Je reconnais les risques et j’accepte de signer électroniquement.',
 'Español: Reconozco los riesgos y acepto firmar electrónicamente.',
 'Português: Reconheço os riscos e aceito assinar eletronicamente.',
 'Я понимаю риски и соглашаюсь подписать документ электронным способом.',
 '我了解相关风险，并同意以电子方式签署本文件。',
 'मैं जोखिमों को समझता हूँ और इलेक्ट्रॉनिक हस्ताक्षर करने के लिए सहमत हूँ।',
 'আমি ঝুঁকিগুলো বুঝি এবং ইলেকট্রনিকভাবে স্বাক্ষর করতে সম্মত।',
 'أفهم المخاطر وأوافق على توقيع هذا المستند إلكترونيًا.',
 'میں خطرات کو سمجھتا ہوں اور الیکٹرانک دستخط کرنے پر رضامند ہوں۔',
];
const png=await require('sharp')({create:{width:100,height:30,channels:3,background:'#ffffff'}}).png().toBuffer();
const result=await renderSignedPdf({orgName:'Translation QA',waiverName:'Multilingual document sample',versionNumber:1,contentSha256:'a'.repeat(64),blocks:(process.argv[2] ? [samples[Number(process.argv[2])-1]] : samples.slice(0,7)).map(text=>({type:'paragraph',text})),fields:[{key:'answer',type:'select',label:'Problème médical ?',options:['Yes','No'],option_labels:['Oui','Non'],required:true}],fieldValues:{answer:'Yes'},signerName:'Test participant',signerEmail:'test@example.invalid',isMinor:false,guardianName:null,guardianRelationship:null,signatureDataUrl:'data:image/png;base64,'+png.toString('base64'),guardianSignatureDataUrl:null,consentText:samples[4],signedAtIso:'2026-09-21T12:00:00Z',ip:null,userAgent:'QA',channel:'link',logoDataUrl:null,brandColor:null});
assert.equal(result.pdf.subarray(0,4).toString(), '%PDF');
assert.ok(result.pdf.length > 10000);
console.log('PASS: multilingual signed PDF, translated choices and Chinese consent render successfully');
