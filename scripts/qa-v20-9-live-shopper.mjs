import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/live-shopper';
await fs.mkdir(OUT,{recursive:true});

const report={version:'20.9.4',mode:'restored-working-finder',base:BASE,queries:[],checks:{},samples:{}};
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
page.setDefaultTimeout(25000);

async function search(query){
  const url=`${BASE}/find/?q=${encodeURIComponent(query)}&engine=v2064&ui=2079`;
  const started=Date.now();
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('.tp78-card',{state:'visible',timeout:20000});
  const renderMs=Date.now()-started;
  const rows=await page.$$eval('.tp78-card',cards=>cards.slice(0,12).map(c=>({
    title:c.querySelector('h3')?.textContent?.trim()||'',
    source:c.querySelector('.tp78-source')?.textContent?.trim()||'',
    href:c.querySelector('.tp78-view')?.getAttribute('href')||c.querySelector('h3 a')?.getAttribute('href')||''
  })));
  if(!rows.length) fail(`search_${query}`,'no product cards rendered');
  if(renderMs>20000) fail(`speed_${query}`,`results took ${renderMs}ms`);
  report.queries.push({query,count:await page.locator('.tp78-card').count(),renderMs,first:rows[0]});
  pass(`search_${query}`);pass(`speed_${query}`);
  return rows;
}

function rejectBad(key,rows,re){
  const bad=rows.filter(r=>re.test(r.title));
  if(bad.length) fail(`semantic_${key}`,JSON.stringify(bad.slice(0,4)));
  pass(`semantic_${key}`);
}

try{
  const resultSets={};
  const firstTitles=[];
  for(const q of ['phone','laptop','perfume','power bank','lighting']){
    const rows=await search(q);resultSets[q]=rows;firstTitles.push(rows[0].title);
  }
  if(new Set(firstTitles).size<4) fail('query_changes_results',`first results did not change enough: ${JSON.stringify(firstTitles)}`);
  pass('query_changes_results');

  rejectBad('phone',resultSets.phone,/\b(?:case|cover|screen protector|tempered glass|replacement screen|replacement battery|motherboard|charging port|flex cable|phone holder|phone mount|repair tool|power bank case)\b/i);
  rejectBad('laptop',resultSets.laptop,/\b(?:motherboard|mainboard|replacement battery|battery for|charger for|adapter for|keyboard for|screen for|lcd for|hinge|palmrest|bottom case|top case|cooling fan|heatsink|dc jack|docking station|laptop sleeve|laptop bag|laptop stand)\b/i);
  rejectBad('perfume',resultSets.perfume,/\b(?:vending machine|dispensing machine|empty perfume bottle|refillable perfume bottle|perfume atomizer|filling machine|packaging machine|display stand)\b/i);
  rejectBad('power_bank',resultSets['power bank'],/\b(?:jump starter|battery adapter|adapter converter|power ?bank case|housing|shell|pcb|circuit board|battery holder)\b/i);
  rejectBad('lighting',resultSets.lighting,/\b(?:scooter|e-?bike|bicycle|motorcycle|automotive|headlight|taillight|turn signal|helmet|laryngoscope|otoscope|ophthalmoscope|medical lamp|surgical lamp)\b/i);

  await search('phone');
  const options=await page.$$eval('[data-filter-merchant] option',os=>os.map(o=>({value:o.value,text:o.textContent?.trim()||''})).filter(x=>x.value));
  if(!options.length) fail('seller_filter_available','no seller options were populated');
  pass('seller_filter_available');
  const toggle=page.locator('[data-tp-filter-toggle]');
  if(await toggle.isVisible()){
    const expanded=await toggle.getAttribute('aria-expanded');
    if(expanded!=='true')await toggle.click();
  }
  await page.waitForSelector('[data-filter-merchant]',{state:'visible',timeout:10000});
  pass('mobile_filters_open');
  const chosen=options[0].value;
  await page.selectOption('[data-filter-merchant]',chosen);
  await page.waitForFunction(v=>document.querySelector('[data-filter-merchant]')?.value===v,chosen);
  await page.waitForSelector('.tp78-card',{state:'visible',timeout:15000});
  if(await page.inputValue('[data-filter-merchant]')!==chosen) fail('seller_filter_stays_selected',`seller reverted from ${chosen}`);
  pass('seller_filter_stays_selected');
  report.samples.seller=chosen;

  const detailHref=await page.locator('.tp78-view').first().getAttribute('href');
  if(!detailHref) fail('detail_link_present','first managed card has no detail link');
  const detailURL=new URL(detailHref,BASE);
  if(detailURL.origin!==new URL(BASE).origin||!detailURL.pathname.startsWith('/product/')) fail('detail_link_internal',detailURL.href);
  pass('detail_link_present');pass('detail_link_internal');
  report.samples.detailHref=detailURL.href;

  const countText=(await page.textContent('[data-v2078-results-count]'))?.trim()||'';
  if(!countText||/ready|try again|no matches/i.test(countText)) fail('results_state_final',countText);
  pass('results_state_final');

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
