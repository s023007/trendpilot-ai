import fs from 'node:fs';
import path from 'node:path';
import { runShadowSearch, normalize } from '../../netlify/functions/products-v20-shadow-lib.mjs';
const ROOT=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'data/search-v20/manifest.json'),'utf8'));
const loadType=async(type)=>JSON.parse(fs.readFileSync(path.join(ROOT,'data/search-v20/types',`${type}.json`),'utf8'));
const blocked=new Set(['temu','joom','filamentpro','filamentpro eu cps']);
// Regression guard: reject only clear accessory/part constructions.
// Do NOT reject legitimate feature words such as "screen", "SSD", "monitor",
// "filter", or "cover" when they are part of a real product description.
const dirtyPhrases={
 phone:[
   'case for','cover for','screen protector','camera lens protector','charger for',
   'charging cable for','phone stand','phone holder','mount for','adapter for',
   'keyboard for','replacement screen','replacement battery','selfie light','fill light'
 ],
 laptop:[
   'keyboard for','briefcase for','laptop bag','sleeve for','vacuum cleaner for',
   'screwdriver for','adapter for','dock for','hub for','replacement screen',
   'replacement keyboard'
 ],
 smartwatch:[
   'band for','strap for','case for','cover for','replacement band','replacement strap'
 ],
 headphones:[
   'case for','cover for','replacement earpad','replacement cable','adapter for'
 ],
 perfume:[
   'perfume power bank','perfume powerbank','perfume keychain','airpods perfume',
   'car perfume','cars perfume','air freshener','empty perfume bottle'
 ],
 dog_food:[
   'dog food feeder','dog food bowl','dog food opener','tab buddy','food storage container',
   'dog food dispenser','slow feeder bowl'
 ],
 air_conditioner:[
   'filter for','bracket for','cover for','cleaning brush','drill dust',
   'evaporative air cooler','mist fan','usb powered air conditioner',
   'usb-powered air conditioner'
 ],
 '3d_filament':[
   'filament rewinder','filament winder','winding machine','3d printer combo',
   'printer + filament','3d printer +'
 ],
};
function hasDirty(type,title){
  const t=` ${normalize(title)} `;
  return (dirtyPhrases[type]||[]).some(x=>t.includes(` ${normalize(x)} `));
}
const queries=['phone','laptop','smartwatch','headphones','perfume','dog food','power bank','air conditioner','3d filament','lighting','tools','ThinkPad','iPhone 16','Galaxy S25'];
const results=[];
let failures=[];
for(const q of queries){
 const r=await runShadowSearch({query:q,limit:12,includeRelated:true},manifest,loadType); results.push({q,mode:r.mode,type:r.type,main:r.main.length,alternatives:r.alternatives.length,related:r.relatedCount,sellers:r.sellers});
 if(!r.ready) failures.push(`${q}:not-ready`);
 for(const row of r.main){
   if(row.role!=='main') failures.push(`${q}:non-main:${row.title}`);
   if(row.type!==r.type) failures.push(`${q}:wrong-type:${row.type}:${row.title}`);
   if(blocked.has(normalize(row.seller))) failures.push(`${q}:blocked-seller:${row.seller}`);
   if(hasDirty(r.type,row.title)) failures.push(`${q}:dirty-main:${row.title}`);
 }
}
for(const q of ['iPhone 16','Galaxy S25']){
 const r=await runShadowSearch({query:q,limit:12,includeRelated:true},manifest,loadType);
 if(r.main.some(x=>hasDirty('phone',x.title))) failures.push(`${q}:accessory-promoted`);
}
if(manifest.publicSellers.length!==13) failures.push(`public-sellers:${manifest.publicSellers.length}`);
if(manifest.catalogFilesLoaded!==13) failures.push(`catalog-files:${manifest.catalogFilesLoaded}`);
if(manifest.blockedSellerLeaks!==0) failures.push(`blocked-leaks:${manifest.blockedSellerLeaks}`);
if(Number(manifest.roleCounts.main||0)<5000) failures.push(`main-count-too-low:${manifest.roleCounts.main}`);
const report={version:manifest.version,results,failures};
const reportJson=JSON.stringify(report,null,2);
console.log(reportJson);
fs.writeFileSync('/tmp/v20-2-local-tests.json',reportJson);
if(failures.length) process.exit(2);

