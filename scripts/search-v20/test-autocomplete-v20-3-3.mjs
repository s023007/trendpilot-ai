import fs from 'node:fs';
import { topRows } from '../../netlify/functions/products-v20-suggest.mjs';
const data=JSON.parse(fs.readFileSync('data/search-v20/autocomplete-v1.json','utf8'));
const blocked=new Set(['temu','joom','filamentpro','filamentpro eu cps']);
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const dirty=/\b(?:case|cases|cover|covers|charger|chargers|charging cable|screen protector|protector|accessor(?:y|ies)|replacement part)\b/i;
function check(q,{requireIphone=false,allowRelated=false}={}){
  const r=topRows(data,q,'',8);
  console.log(q,JSON.stringify({accessoryIntent:r.accessoryIntent,rows:r.rows.map(x=>({value:x.value,seller:x.seller,kind:x.kind}))},null,2));
  if(!allowRelated && !r.rows.length) throw new Error(`${q}: no suggestions`);
  for(const row of r.rows){
    if(blocked.has(norm(row.seller))) throw new Error(`${q}: blocked seller ${row.seller}`);
    if(!r.accessoryIntent && dirty.test(row.value)) throw new Error(`${q}: accessory leaked into main autocomplete: ${row.value}`);
  }
  if(requireIphone && !r.rows.some(x=>/iphone/i.test(x.value))) throw new Error(`${q}: iPhone main/model suggestion missing`);
}
check('iph',{requireIphone:true});
check('iphone',{requireIphone:true});
check('lap');
check('iphone case',{allowRelated:true});
if(data.publicSellers.length!==13)throw new Error(`Expected 13 sellers, got ${data.publicSellers.length}`);
for(const seller of data.publicSellers)if(blocked.has(norm(seller)))throw new Error(`Blocked public seller: ${seller}`);
console.log('V20.3.3 autocomplete purity tests PASS');
