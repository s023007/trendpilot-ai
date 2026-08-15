import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/live-shopper';
await fs.mkdir(OUT,{recursive:true});

const report={version:'20.9.5',base:BASE,checks:{},samples:{},passed:false};
const pass=name=>{report.checks[name]=true};
const fail=(name,msg)=>{report.checks[name]=false;throw new Error(`${name}: ${msg}`)};
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

const bucketCache=new Map();
async function record(id){
  const key=id.slice(0,2);
  if(!bucketCache.has(key)){
    const res=await fetch(`${BASE}/data/v20-9/products/${key}.json?v=20.9.5`,{headers:{'user-agent':'TrendPilot-QA/20.9.5'}});
    if(!res.ok)throw new Error(`bucket ${key} returned ${res.status}`);
    bucketCache.set(key,await res.json());
  }
  return bucketCache.get(key)?.[id]||null;
}

async function comparePair(){
  const res=await fetch(`${BASE}/data/v20-9/families.json?v=20.9.5`,{headers:{'user-agent':'TrendPilot-QA/20.9.5'}});
  if(!res.ok)throw new Error(`families index returned ${res.status}`);
  const families=await res.json();
  const entry=Object.entries(families).find(([k,v])=>Array.isArray(v)&&v.length>=2&&/^(?:phone|smartphone|phones)$/i.test(k))
    || Object.entries(families).find(([k,v])=>Array.isArray(v)&&v.length>=2&&/phone/i.test(k));
  if(!entry)return null;
  const [family,ids]=entry;
  const candidates=[];
  for(const id of ids.slice(0,500)){
    const r=await record(id);
    if(!r||!r.u||clean(r.fa||r.ty)!==family)continue;
    if(!['main','used'].includes(clean(r.ro)))continue;
    candidates.push({id,r});
    if(candidates.length>=30)break;
  }
  if(candidates.length<2)return null;
  const exact=candidates.find(x=>x.r.x===true);
  const broad=candidates.find(x=>x.r.x!==true);
  const rows=exact&&broad?[exact,broad]:candidates.slice(0,2);
  return {family,rows};
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},
  deviceScaleFactor:2.75,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'
});
const page=await context.newPage();
page.setDefaultTimeout(25000);

try{
  const pair=await comparePair();
  if(!pair||pair.rows.length!==2)fail('compare_source_records','could not resolve two current same-family V20.9 phone records with seller routes');
  pass('compare_source_records');
  pass('compare_same_family_pair');
  report.samples.source=pair.rows.map(x=>({id:x.id,title:x.r.t,family:x.r.fa||x.r.ty,seller:x.r.se,exact:!!x.r.x,url:x.r.u}));

  const saved=pair.rows.map(x=>({id:x.id,fa:clean(x.r.fa),t:clean(x.r.t),ty:clean(x.r.ty)}));
  await page.goto(`${BASE}/compare/`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.evaluate(items=>localStorage.setItem('tp-v209-compare',JSON.stringify(items)),saved);
  await page.reload({waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('.tp90-product',{state:'visible',timeout:20000});
  const compare=await page.evaluate(()=>{
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const cards=[...document.querySelectorAll('.tp90-product')];
    return {
      count:cards.length,
      counter:clean(document.querySelector('[data-v209-compare-count]')?.textContent||''),
      warning:clean(document.querySelector('.tp90-warning')?.textContent||''),
      cards:cards.map(card=>{
        const facts={};
        for(const row of card.querySelectorAll('.tp90-fact')){
          const k=clean(row.querySelector('b')?.textContent||'');
          const v=clean(row.querySelector('span')?.textContent||'');
          if(k)facts[k]=v;
        }
        const a=card.querySelector('.tp90-actions a.tp90-primary');
        return {
          title:clean(card.querySelector('h2')?.textContent||''),
          price:clean(card.querySelector('.tp90-price')?.textContent||''),
          proof:clean(card.querySelector('.tp90-proof')?.textContent||''),
          facts,
          sellerText:clean(a?.textContent||''),
          sellerHref:a?.href||'',
          sellerRel:a?.getAttribute('rel')||'',
          sellerTarget:a?.getAttribute('target')||''
        };
      })
    };
  });
  report.samples.compare=compare;
  if(compare.count!==2)fail('compare_two_cards',`expected 2 cards, got ${compare.count}`);
  pass('compare_two_cards');
  if(compare.warning)fail('compare_no_cross_family_warning',compare.warning);
  pass('compare_no_cross_family_warning');
  if(!compare.counter.includes('2 product'))fail('compare_counter',compare.counter);
  pass('compare_counter');
  const families=new Set(compare.cards.map(x=>x.facts.Family).filter(Boolean));
  if(families.size!==1)fail('compare_family_purity',JSON.stringify([...families]));
  pass('compare_family_purity');

  const baseOrigin=new URL(BASE).origin;
  let exactTested=false,broadTested=false;
  for(let i=0;i<compare.cards.length;i++){
    const card=compare.cards[i],src=pair.rows[i].r;
    let u;
    try{u=new URL(card.sellerHref)}catch{fail('seller_link_http',`invalid seller URL: ${card.sellerHref}`)}
    if(!/^https?:$/.test(u.protocol)||u.origin===baseOrigin)fail('seller_link_external',card.sellerHref);
    const rel=new Set(card.sellerRel.toLowerCase().split(/\s+/).filter(Boolean));
    for(const token of ['sponsored','nofollow','noopener'])if(!rel.has(token))fail('seller_link_rel',`${card.title}: missing ${token} in ${card.sellerRel}`);
    if(card.sellerTarget!=='_blank')fail('seller_link_new_tab',`${card.title}: ${card.sellerTarget}`);
    if(src.x){
      exactTested=true;
      if(!/open exact seller product/i.test(card.sellerText)||!/confirmed exact product/i.test(card.facts.Destination||''))fail('seller_exact_truth',JSON.stringify(card));
    }else{
      broadTested=true;
      if(!/open seller route/i.test(card.sellerText)||!/broader seller route/i.test(card.facts.Destination||''))fail('seller_broad_truth',JSON.stringify(card));
    }
  }
  pass('seller_link_http');pass('seller_link_external');pass('seller_link_rel');pass('seller_link_new_tab');
  report.checks.seller_exact_truth=exactTested?true:'not-available-in-sample';
  report.checks.seller_broad_truth=broadTested?true:'not-available-in-sample';

  const redmiURL=`${BASE}/product/hot-sale-original-global-official-version-xiaomi-redmi-note-8-48mp-quad-ai-back---d0f4e3ec74717f/`;
  await page.goto(redmiURL,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('#seller-offers',{state:'visible',timeout:25000});
  const productSeller=await page.evaluate(()=>{
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const section=document.querySelector('#seller-offers');
    const anchors=[...section.querySelectorAll('a[href]')].map(a=>({text:clean(a.textContent),href:a.href,rel:a.getAttribute('rel')||'',target:a.getAttribute('target')||''}));
    return {text:clean(section.textContent),anchors};
  });
  report.samples.productSeller={url:redmiURL,...productSeller};
  const external=productSeller.anchors.filter(a=>{
    try{return /^https?:$/.test(new URL(a.href).protocol)&&new URL(a.href).origin!==baseOrigin}catch{return false}
  });
  if(!external.length)fail('product_seller_external_cta','no external seller CTA found on product page');
  pass('product_seller_external_cta');
  for(const a of external){
    const rel=new Set(a.rel.toLowerCase().split(/\s+/).filter(Boolean));
    if(!rel.has('sponsored')||!rel.has('nofollow')||!rel.has('noopener'))fail('product_seller_rel',JSON.stringify(a));
  }
  pass('product_seller_rel');
  if(!/marketplace search route|search on|browse/i.test(productSeller.text))fail('product_generic_route_truth',productSeller.text);
  pass('product_generic_route_truth');
  if(/active exact listing|exact product destination verified/i.test(productSeller.text))fail('product_no_false_exact_claim',productSeller.text);
  pass('product_no_false_exact_claim');

  report.passed=Object.values(report.checks).every(v=>v===true||v==='not-available-in-sample');
  await page.screenshot({path:`${OUT}/compare-seller-success.png`,fullPage:true});
  await fs.writeFile(`${OUT}/compare-seller-report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(err){
  report.passed=false;
  report.error=String(err?.stack||err);
  try{await page.screenshot({path:`${OUT}/compare-seller-failure.png`,fullPage:true});}catch{}
  await fs.writeFile(`${OUT}/compare-seller-report.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));
  await browser.close();
  process.exit(1);
}

await browser.close();
