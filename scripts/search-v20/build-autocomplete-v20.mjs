import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH = path.join(ROOT,'data','search-v20');
const VERSION = '20.3.3';
const manifest = JSON.parse(fs.readFileSync(path.join(SEARCH,'manifest.json'),'utf8'));
const blocked = new Set(['temu','joom','filamentpro','filamentpro eu cps']);
const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}+#.-]+/gu,' ').replace(/\s+/g,' ').trim();
const clean = v => String(v ?? '').replace(/\s+/g,' ').trim();
const validHttp = v => /^https?:\/\//i.test(clean(v));


const INTENT_LABELS={
  phone:['phone','smartphone'], laptop:['laptop'], smartwatch:['smartwatch','smart watch'],
  headphones:['headphones','earbuds'], perfume:['perfume','fragrance'], dog_food:['dog food'],
  power_bank:['power bank'], air_conditioner:['air conditioner'], '3d_filament':['3d filament'],
  cookware:['cookware'], lighting:['lighting'], tools:['tools']
};

const modelPatterns = {
  phone: [
    /\biphone\s+(?:se(?:\s*\d{4})?|\d{1,2})(?:\s+(?:pro\s+max|pro|max|plus|mini|air)){0,2}\b/ig,
    /\b(?:samsung\s+)?galaxy\s+(?:s\d{2}(?:\s*(?:ultra|plus|\+|fe))?|a\d{2,3}|m\d{2,3}|z\s*(?:fold|flip)\s*\d+|note\s*\d+)\b/ig,
    /\bgoogle\s+pixel\s+\d+(?:\s*(?:pro|pro xl|a|fold))?\b/ig,
    /\b(?:xiaomi|redmi|poco|oneplus|oppo|vivo|realme|nothing)\s+[a-z0-9][a-z0-9 +.-]{0,24}\b/ig
  ],
  laptop: [
    /\bthinkpad\s+[a-z]\d{1,3}[a-z]?(?:\s+gen\s+\d+)?\b/ig,
    /\b(?:lenovo\s+)?(?:ideapad|yoga|legion)\s+[a-z0-9][a-z0-9 +.-]{0,20}\b/ig,
    /\bmacbook\s+(?:air|pro)(?:\s+\d{2})?(?:\s+m\d(?:\s+(?:pro|max))?)?\b/ig,
    /\b(?:dell\s+)?(?:xps|latitude|inspiron)\s+\d{3,4}[a-z0-9-]*\b/ig,
    /\b(?:hp\s+)?(?:elitebook|probook|pavilion|envy)\s+[a-z0-9][a-z0-9 +.-]{0,20}\b/ig,
    /\b(?:asus\s+)?(?:zenbook|vivobook|rog|tuf)\s+[a-z0-9][a-z0-9 +.-]{0,20}\b/ig,
    /\b(?:acer\s+)?(?:aspire|swift|predator)\s+[a-z0-9][a-z0-9 +.-]{0,20}\b/ig
  ],
  smartwatch: [
    /\bapple\s+watch\s+(?:series\s+\d+|ultra(?:\s+\d+)?|se(?:\s+\d+)?)\b/ig,
    /\bgalaxy\s+watch\s+\d+(?:\s*(?:classic|pro|ultra))?\b/ig,
    /\b(?:garmin|amazfit|huawei)\s+[a-z0-9][a-z0-9 +.-]{0,24}\b/ig
  ]
};

function modelLabels(type,title){
  const out=[];
  for(const re0 of modelPatterns[type] || []){
    const re = new RegExp(re0.source,re0.flags);
    for(const m of title.matchAll(re)){
      let label=clean(m[0]).replace(/[,:;|/\\]+$/,'').trim();
      if(label.length>=4 && label.length<=64) out.push(label);
    }
  }
  return [...new Set(out.map(x=>x.replace(/\s+/g,' ')))];
}

const main=[];
const related=[];
const models=new Map();
let blockedLeaks=0;
for(const type of Object.keys(manifest.typeCounts || {}).sort()){
  const file=path.join(SEARCH,'types',`${type}.json`);
  if(!fs.existsSync(file)) continue;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const channel of ['main','related']){
    for(const row of data[channel] || []){
      const seller=clean(row.seller);
      if(blocked.has(norm(seller))){ blockedLeaks++; continue; }
      const title=clean(row.title);
      if(!title) continue;
      const compact={
        value:title,
        seller,
        type:clean(row.type || type),
        image:validHttp(row.image)?clean(row.image):'',
        quality:Number(row.quality || 0)
      };
      (channel==='main'?main:related).push(compact);
      if(channel==='main'){
        for(const label of modelLabels(type,title)){
          const key=`${type}|${norm(label)}`;
          const hit=models.get(key) || {value:label,type,sellers:new Set(),image:'',quality:0};
          hit.sellers.add(seller);
          if(!hit.image && compact.image) hit.image=compact.image;
          hit.quality=Math.max(hit.quality,compact.quality);
          if(label.length<hit.value.length) hit.value=label;
          models.set(key,hit);
        }
      }
    }
  }
}

const modelRows=[...models.values()].map(x=>({
  value:x.value,
  type:x.type,
  sellerCount:x.sellers.size,
  sellers:[...x.sellers].sort(),
  image:x.image,
  quality:x.quality
})).sort((a,b)=>b.sellerCount-a.sellerCount || b.quality-a.quality || a.value.localeCompare(b.value));

const intents=[];
for(const [type,labels] of Object.entries(INTENT_LABELS)){
  if(!manifest.typeCounts?.[type])continue;
  for(const value of labels)intents.push({value,type});
}

const output={
  version:VERSION,
  sourceVersion:manifest.version,
  generatedAt:new Date().toISOString(),
  publicSellers:(manifest.publicSellers||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean),
  blockedSellerLeaks:blockedLeaks,
  counts:{intents:intents.length,models:modelRows.length,main:main.length,related:related.length},
  intents,
  models:modelRows,
  main,
  related
};
fs.writeFileSync(path.join(SEARCH,'autocomplete-v1.json'),JSON.stringify(output));
console.log(JSON.stringify(output.counts));
if(blockedLeaks!==0) throw new Error(`Blocked seller leak while building autocomplete: ${blockedLeaks}`);
if(main.length<1000) throw new Error(`Unexpectedly small main autocomplete corpus: ${main.length}`);
