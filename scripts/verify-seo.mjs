import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
const base=process.env.SEO_BASE_URL??'http://localhost:3010';
const origin='https://www.flatwaiver.com';
const paths=['/','/pricing','/features/qr-code-waivers','/industries','/industries/fitness-studios','/industries/climbing-gyms','/industries/trampoline-parks','/blog/gym-waiver-software','/blog/waiver-software-for-climbing-gyms','/blog/smartwaiver-pricing','/blog/smartwaiver-alternatives','/blog/flatwaiver-vs-smartwaiver','/blog/waiver-software-cost'];
const report=[];const internal=new Set();
for(const path of paths){
 const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];assert.equal(new URL(canonical).href,origin+path,path+' canonical');
 assert.equal(html.match(/<meta property="og:url" content="([^"]+)"/)?.[1],canonical,path+' Open Graph');
 assert.equal((html.match(/<h1(?:\s|>)/g)??[]).length,1,path+' H1');
 const title=html.match(/<title>(.*?)<\/title>/)?.[1];assert.ok(title?.length,path+' title');
 assert.ok(html.match(/<meta name="description" content="[^"]+"/),path+' description');
 const robots=html.match(/<meta name="robots" content="([^"]+)"/)?.[1]??'';
 if(process.env.SEO_EXPECT_INDEXABLE==='true')assert.ok(!robots.includes('noindex'),path+' indexable');
 const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 for(const match of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)){const target=match[1].split('?')[0];if(!target.startsWith('/_next')&&!target.match(/\.(?:css|js|png|svg|ico|xml|webmanifest)$/)) internal.add(target.replaceAll('&amp;','&'));}
 report.push({path,status:r.status,canonical,title,robots,structuredData:schemas.length});
}
for(const path of internal){const r=await fetch(base+path,{redirect:'manual'});assert.ok(r.status===200||[301,302,307,308].includes(r.status),path+' internal link: '+r.status);}
for(const path of ['/index','/index?utm_source=seo-check']){const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.status,308);const target=new URL(r.headers.get('location'),base);assert.equal(target.origin,origin);assert.equal(target.pathname,'/');if(path.includes('?'))assert.equal(target.searchParams.get('utm_source'),'seo-check');}
const slash=await fetch(base+'/industries/fitness-studios/',{redirect:'manual'});assert.equal(slash.status,308);assert.equal(new URL(slash.headers.get('location'),base).pathname,'/industries/fitness-studios');
if (base.startsWith('http:')) { const apex=await new Promise((resolve,reject)=>http.get(base+'/pricing',{headers:{Host:'flatwaiver.com'}},r=>{r.resume();resolve({status:r.statusCode,location:r.headers.location})}).on('error',reject));assert.equal(apex.status,308);assert.equal(apex.location,origin+'/pricing'); }
const query=await fetch(base+'/?utm_source=test').then(r=>r.text());assert.equal(new URL(query.match(/<link rel="canonical" href="([^"]+)"/)?.[1]).href,origin+'/');
const sitemap=await fetch(base+'/sitemap.xml').then(r=>r.text());const urls=[...sitemap.matchAll(/<loc>([^<]+)/g)].map(m=>m[1]);assert.equal(new Set(urls).size,urls.length,'sitemap duplicates');for(const path of paths)assert.ok(urls.includes(origin+path),path+' sitemap');assert.ok(!urls.some(x=>/\/(signup|login|admin|dashboard|w\/|kiosk\/)/.test(x)),'private/auth sitemap');
const robots=await fetch(base+'/robots.txt').then(r=>r.text());if(process.env.SEO_EXPECT_INDEXABLE==='true')assert.ok(robots.includes('Allow: /'));else assert.ok(robots.includes('Disallow: /'),'preview robots');
for(const path of ['/signup','/login']){const html=await fetch(base+path).then(r=>r.text());assert.ok(/<meta name="robots" content="[^"]*noindex/.test(html),path+' noindex');}
await writeFile('docs/seo/local-verification.json',JSON.stringify({checkedOn:'2026-11-16',base,pages:report,internalLinksChecked:internal.size,sitemapUrls:urls.length,redirectChecks:'PASS'},null,2));
console.log('PASS: '+paths.length+' page metadata/H1/JSON-LD checks; '+internal.size+' internal destinations; redirect/query/apex/slash behavior; sitemap and preview robots; auth noindex');
