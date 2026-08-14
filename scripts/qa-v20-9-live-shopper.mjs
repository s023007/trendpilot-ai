import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/live-shopper';
await fs.mkdir(OUT,{recursive:true});

const report={version:'20.9.3',base:BASE,queries:[],checks:{},samples:{}};
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
  const url=`${BASE}/find/?q=${encodeURIComponent(query)}&engine=v2064&universal=1&ui=2091`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__TP_V2091_UNIVERSAL__?.runtimeVersion==='20.9.1');
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

try{
  const firstTitles=[];
  for(const q of ['phone','laptop','perfume','power bank','lighting']){
    const rows=await search(q);
    firstTitles.push(rows[0].title);
  }
  if(new Set(firstTitles).size<4) fail('query_changes_results',`first results did not change enough: ${JSON.stringify(firstTitles)}`);
  pass('query_changes_results');

  const phone=await search('phone');
  if(phone.some(r=>!['main','used'].includes(r.role))) fail('phone_role_purity',JSON.stringify(phone));
  pass('phone_role_purity');
  const accessoryGrammar=/\b(?:case|cover|holder|mount|strap|lanyard|screen protector|tempered glass|replacement|spare part|charger cable|charging cable)\b/i;
  if(phone.slice(0,8).some(r=>accessoryGrammar.test(r.title))) fail('phone_title_purity',JSON.stringify(phone.slice(0,8)));
  pass('phone_title_purity');

  const options=await page.$$eval('[data-filter-merchant] option',os=>os.map(o=>({value:o.value,text:o.textContent?.trim()||''})).filter(x=>x.value));
  if(!options.length) fail('seller_filter_available','no seller options');
  const chosen=options[0].value;
  await page.selectOption('[data-filter-merchant]',chosen);
  await page.waitForTimeout(200);
  const sellerRows=await page.$$eval('[data-v209-card]',cs=>cs.map(c=>c.getAttribute('data-v209-seller')||''));
  if(!sellerRows.length||sellerRows.some(s=>s!==chosen)) fail('seller_filter_applies',`chosen=${chosen} rows=${JSON.stringify(sellerRows.slice(0,12))}`);
  pass('seller_filter_applies');
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
  pass('detail_truth_visible');

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
  await page.goto(`${BASE}/find/?q=phone&engine=v2064&universal=1&ui=2091`,{waitUntil:'domcontentloaded'});
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
