import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/live-shopper';
await fs.mkdir(OUT,{recursive:true});

const report={version:'20.9.4',base:BASE,queries:[],checks:{},samples:{}};
const fail=(name,msg)=>{report.checks[name]=false;throw new Error(`${name}: ${msg}`)};
const pass=name=>{report.checks[name]=true};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},
  deviceScaleFactor:2.75,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'
});
const page=await context.newPage();
page.setDefaultTimeout(35000);

async function search(query){
  const url=`${BASE}/find/?q=${encodeURIComponent(query)}&engine=v2064&universal=1&ui=2094`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__TP_V2091_UNIVERSAL__?.runtimeVersion==='20.9.4');
  await page.waitForSelector('[data-v209-card]');
  const rows=await page.$$eval('[data-v209-card]',cards=>cards.slice(0,12).map(c=>({
    title:c.querySelector('h3')?.textContent?.trim()||'',
    seller:c.getAttribute('data-v209-seller')||'',
    role:c.getAttribute('data-v209-role')||'',
    family:c.getAttribute('data-v209-family')||'',
    href:c.querySelector('.internal-detail')?.getAttribute('href')||''
  })));
  if(!rows.length) fail(`search_${query}`,'no product cards rendered');
  report.queries.push({query,count:await page.locator('[data-v209-card]').count(),first:rows[0]});
  pass(`search_${query}`);
  return rows;
}

function rejectBad(query,rows,re){
  const bad=rows.filter(r=>re.test(r.title));
  if(bad.length) fail(`semantic_${query}`,JSON.stringify(bad.slice(0,4)));
  pass(`semantic_${query}`);
}

try{
  const resultSets={};
  const firstTitles=[];
  for(const q of ['phone','laptop','perfume','power bank','lighting']){
    const rows=await search(q);resultSets[q]=rows;firstTitles.push(rows[0].title);
  }
  if(new Set(firstTitles).size<4) fail('query_changes_results',`first results did not change enough: ${JSON.stringify(firstTitles)}`);
  pass('query_changes_results');

  rejectBad('phone',resultSets.phone,/\b(?:(?:battery|power\s*bank|charging|protective|shockproof|wallet|silicone|leather)\s+case|case\s+(?:for|fits?|compatible\s+with)|screen\s+protector|tempered\s+glass|phone\s+(?:holder|mount)|replacement\s+(?:screen|battery)|motherboard|charging\s+port|flex\s+cable)\b/i);
  rejectBad('laptop',resultSets.laptop,/\b(?:motherboard|mainboard|replacement\s+battery|battery\s+for|charger\s+for|adapter\s+for|keyboard\s+for|screen\s+for|lcd\s+for|hinge|palmrest|bottom\s+case|top\s+case|cooling\s+fan|heatsink|dc\s+jack|charging\s+port|laptop\s+(?:sleeve|bag|stand|dock)|docking\s+station)\b/i);
  rejectBad('perfume',resultSets.perfume,/\b(?:vending\s+machine|dispensing\s+machine|empty\s+(?:perfume\s+)?bottle|refillable\s+perfume\s+bottle|perfume\s+atomizer|perfume\s+sprayer|filling\s+machine|packaging\s+machine|bottle\s+cap|display\s+stand)\b/i);
  rejectBad('power_bank',resultSets['power bank'],/\b(?:battery\s+adapter|adapter\s+converter|converter\s+charger|power\s*bank\s+case|powerbank\s+case|housing|shell|pcb|circuit\s+board|power\s+module|battery\s+holder)\b/i);
  if(resultSets.lighting.some(r=>r.family!=='lighting')) fail('lighting_family_purity',JSON.stringify(resultSets.lighting.slice(0,6)));
  pass('lighting_family_purity');
  rejectBad('lighting',resultSets.lighting,/\b(?:scooter|e-?bike|bicycle|motorcycle|car\b|vehicle|automotive|headlight|tail\s*light|taillight|turn\s+signal|indicator|helmet)\b/i);

  const phone=await search('phone');
  if(phone.some(r=>!['main','used'].includes(r.role))) fail('phone_role_purity',JSON.stringify(phone));
  pass('phone_role_purity');

  const options=await page.$$eval('[data-filter-merchant] option',os=>os.map(o=>({value:o.value,text:o.textContent?.trim()||''})).filter(x=>x.value));
  if(!options.length) fail('seller_filter_available','no seller options');
  const chosen=options[0].value;
  await page.selectOption('[data-filter-merchant]',chosen);
  await page.waitForTimeout(200);
  const sellerRows=await page.$$eval('[data-v209-card]',cs=>cs.map(c=>({seller:c.getAttribute('data-v209-seller')||'',title:c.querySelector('h3')?.textContent?.trim()||''})));
  if(!sellerRows.length||sellerRows.some(r=>r.seller!==chosen)) fail('seller_filter_applies',`chosen=${chosen} rows=${JSON.stringify(sellerRows.slice(0,12))}`);
  if(sellerRows.some(r=>/\b(?:power\s*bank|battery)\s+case\b|\bcase\s+(?:for|compatible\s+with)\b/i.test(r.title))) fail('seller_filtered_phone_purity',JSON.stringify(sellerRows.slice(0,12)));
  pass('seller_filter_applies');pass('seller_filtered_phone_purity');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-v209-card]');
  const persisted=await page.inputValue('[data-filter-merchant]');
  if(persisted!==chosen) fail('seller_filter_persists',`expected ${chosen}, got ${persisted}`);
  pass('seller_filter_persists');
  report.samples.seller=chosen;

  const detailHref=await page.locator('.internal-detail').first().getAttribute('href');
  if(!detailHref) fail('detail_link_present','first card has no internal detail href');
  await page.goto(new URL(detailHref,BASE).href,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-tp85-detail]:not([hidden])');
  const title=(await page.textContent('[data-tp85-title]'))?.trim()||'';
  const family=(await page.textContent('[data-tp85-fact-family]'))?.trim()||'';
  const role=(await page.textContent('[data-tp85-fact-role]'))?.trim()||'';
  if(!title||!family||!role) fail('detail_truth_visible',`title=${title} family=${family} role=${role}`);
  if(/\b(?:power\s*bank|battery)\s+case\b|\bcase\s+(?:for|compatible\s+with)\b/i.test(title)) fail('detail_phone_semantic_purity',title);
  pass('detail_truth_visible');pass('detail_phone_semantic_purity');

  const sellerLink=page.locator('[data-tp85-seller-link]');
  const hidden=await sellerLink.getAttribute('hidden');
  if(hidden!==null) fail('seller_link_present','seller link hidden on selected product');
  const sellerHref=await sellerLink.getAttribute('href');
  const sellerText=(await sellerLink.textContent())?.trim()||'';
  if(!sellerHref) fail('seller_link_present','seller href missing');
  const sellerURL=new URL(sellerHref,BASE);
  if(sellerURL.origin===new URL(BASE).origin) fail('seller_link_external',`seller link stayed inside TrendPilot: ${sellerHref}`);
  pass('seller_link_present');pass('seller_link_external');
  report.samples.detail={title,family,role,sellerText,sellerHref};

  const itemURL=new URL(page.url());
  const id=(itemURL.searchParams.get('id')||'').toLowerCase();
  if(!/^[a-f0-9]{14}$/.test(id)) fail('detail_id_valid',id);
  pass('detail_id_valid');
  const bucketRes=await context.request.get(`${BASE}/data/v20-9/products/${id.slice(0,2)}.json?v=20.9.0`);
  if(!bucketRes.ok()) fail('detail_bucket_fetch',String(bucketRes.status()));
  const bucket=await bucketRes.json();
  const rec=bucket[id];
  if(!rec) fail('detail_record_matches','record not found in live bucket');
  if(Boolean(rec.x)!==sellerText.startsWith('Open exact product')){
    if(rec.x) fail('seller_evidence_label',`x=true but button says ${sellerText}`);
    if(!rec.x&&!sellerText.startsWith('Search ')) fail('seller_evidence_label',`x=false but button says ${sellerText}`);
  }
  pass('seller_evidence_label');

  await page.click('[data-tp85-compare]');
  await page.goto(`${BASE}/find/?q=phone&engine=v2064&universal=1&ui=2094`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-v209-card]');
  await page.selectOption('[data-filter-merchant]','');
  await page.waitForTimeout(150);
  const compareButtons=page.locator('[data-v209-compare]');
  const n=await compareButtons.count();
  if(n<2) fail('compare_candidates','fewer than two phone cards');
  let clicked=false;
  for(let i=0;i<n;i++){
    const b=compareButtons.nth(i);
    const text=(await b.textContent())?.trim()||'';
    if(text==='Compare'){
      await b.click();
      const after=(await b.textContent())?.trim()||'';
      if(after.includes('Added')){clicked=true;break;}
    }
  }
  if(!clicked) fail('compare_add_second','could not add second same-family product');
  pass('compare_add_second');
  await page.goto(`${BASE}/compare/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.tp90-product');
  const compareCount=await page.locator('.tp90-product').count();
  if(compareCount<2) fail('compare_renders',`only ${compareCount} product(s)`);
  if(await page.locator('.tp90-warning').count()) fail('compare_same_family','incompatible-family warning rendered');
  const families=await page.$$eval('.tp90-product .tp90-facts .tp90-fact:first-child span',els=>els.map(e=>e.textContent?.trim()||''));
  if(new Set(families).size>1) fail('compare_same_family',JSON.stringify(families));
  pass('compare_renders');pass('compare_same_family');
  report.samples.compare={count:compareCount,families};

  report.passed=Object.values(report.checks).every(Boolean);
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${OUT}/success-mobile.png`,fullPage:true});
  console.log(JSON.stringify(report,null,2));
}catch(err){
  report.passed=false;
  report.error=String(err?.stack||err);
  try{await page.screenshot({path:`${OUT}/failure-mobile.png`,fullPage:true});}catch{}
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));
  await browser.close();
  process.exit(1);
}

await browser.close();
