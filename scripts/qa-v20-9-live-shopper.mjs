import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/live-shopper';
await fs.mkdir(OUT,{recursive:true});
const report={version:'20.9.6',mode:'restored-working-finder+product-first-seo-cpc',base:BASE,queries:[],checks:{},samples:{}};
const pass=n=>report.checks[n]=true;
const fail=(n,m)=>{report.checks[n]=false;throw new Error(`${n}: ${m}`)};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
page.setDefaultTimeout(25000);

async function search(query){
  const started=Date.now();
  await page.goto(`${BASE}/find/?q=${encodeURIComponent(query)}&engine=v2064&ui=2079`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('.tp78-card',{state:'visible',timeout:20000});
  const renderMs=Date.now()-started;
  const rows=await page.$$eval('.tp78-card',cards=>cards.slice(0,12).map(c=>({title:c.querySelector('h3')?.textContent?.trim()||'',source:c.querySelector('.tp78-source')?.textContent?.trim()||'',href:c.querySelector('.tp78-view')?.getAttribute('href')||''})));
  if(!rows.length)fail(`search_${query}`,'no product cards rendered');
  if(renderMs>20000)fail(`speed_${query}`,`${renderMs}ms`);
  report.queries.push({query,count:await page.locator('.tp78-card').count(),renderMs,first:rows[0]});
  pass(`search_${query}`);pass(`speed_${query}`);return rows;
}
function semantic(name,rows,re){const bad=rows.filter(x=>re.test(x.title));if(bad.length)fail(`semantic_${name}`,JSON.stringify(bad.slice(0,4)));pass(`semantic_${name}`)}

try{
  const sets={};
  for(const q of ['phone','laptop','perfume','power bank','lighting'])sets[q]=await search(q);
  if(new Set(Object.values(sets).map(r=>r[0]?.title)).size<4)fail('query_changes_results','results did not vary');pass('query_changes_results');
  semantic('phone',sets.phone,/\b(?:case|cover|screen protector|tempered glass|replacement screen|replacement battery|motherboard|charging port|flex cable|phone holder|phone mount|repair tool|power bank case)\b/i);
  semantic('laptop',sets.laptop,/\b(?:motherboard|mainboard|replacement battery|battery for|charger for|adapter for|keyboard for|screen for|lcd for|hinge|palmrest|bottom case|top case|cooling fan|heatsink|dc jack|docking station|laptop sleeve|laptop bag|laptop stand)\b/i);
  semantic('perfume',sets.perfume,/\b(?:vending machine|dispensing machine|empty perfume bottle|refillable perfume bottle|perfume atomizer|filling machine|packaging machine|display stand)\b/i);
  semantic('power_bank',sets['power bank'],/\b(?:jump starter|battery adapter|adapter converter|power ?bank case|housing|shell|pcb|circuit board|battery holder)\b/i);
  semantic('lighting',sets.lighting,/\b(?:scooter|e-?bike|bicycle|motorcycle|automotive|headlight|taillight|turn signal|helmet|laryngoscope|otoscope|ophthalmoscope|medical lamp|surgical lamp)\b/i);

  await search('phone');
  const toggle=page.locator('[data-tp-filter-toggle]');
  if(await toggle.isVisible()&&(await toggle.getAttribute('aria-expanded'))!=='true')await toggle.click();
  await page.waitForSelector('[data-filter-merchant]',{state:'visible'});
  const options=await page.$$eval('[data-filter-merchant] option',os=>os.map(o=>o.value).filter(Boolean));
  if(!options.length)fail('seller_filter_available','no sellers');pass('seller_filter_available');pass('mobile_filters_open');
  await page.selectOption('[data-filter-merchant]',options[0]);
  await page.waitForFunction(v=>document.querySelector('[data-filter-merchant]')?.value===v,options[0]);
  if(await page.inputValue('[data-filter-merchant]')!==options[0])fail('seller_filter_stays_selected','seller reset');pass('seller_filter_stays_selected');report.samples.seller=options[0];
  const href=await page.locator('.tp78-view').first().getAttribute('href');
  if(!href||!href.startsWith('/product/'))fail('detail_link_internal',href||'missing');pass('detail_link_present');pass('detail_link_internal');report.samples.detailHref=new URL(href,BASE).href;

  const redmi=`${BASE}/product/hot-sale-original-global-official-version-xiaomi-redmi-note-8-48mp-quad-ai-back---d0f4e3ec74717f/`;
  await page.goto(redmi,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('body[data-tp-product-truth="20.9.5"][data-tp-product-ui="20.9.6"]',{state:'attached'});
  await page.waitForSelector('.panel.about',{state:'visible'});
  const d=await page.evaluate(()=>{
    const c=v=>String(v??'').replace(/\s+/g,' ').trim();
    const main=document.querySelector('main'),kids=[...main.children];
    const about=main.querySelector('.panel.about'),seller=main.querySelector('#seller-offers'),tech=main.querySelector('.technical-disclosure,.technical-wrap');
    const facts=[...main.querySelectorAll('.technical-panel')].find(x=>/MODEL FACTS/i.test(x.textContent||''));
    let ld='';try{for(const s of document.querySelectorAll('script[type="application/ld+json"]')){const x=JSON.parse(s.textContent||'{}');if(x?.['@type']==='Product'){ld=c(x.description);break}}}catch{}
    return {title:c(main.querySelector('h1')?.textContent),description:c(about?.querySelector('.about-copy')?.textContent),meta:c(document.querySelector('meta[name="description"]')?.content),ld,structural:c(main.textContent),facts:c(facts?.textContent),factLabels:[...(facts?.querySelectorAll('.spec span')||[])].map(x=>c(x.textContent)),order:{hero:kids.findIndex(x=>x.matches('.hero')),about:kids.indexOf(about),seller:kids.indexOf(seller),technical:kids.indexOf(tech)},bottom:document.querySelector('.bottom')?.getBoundingClientRect().height||0,h1Size:parseFloat(getComputedStyle(main.querySelector('h1')).fontSize)};
  });
  report.samples.redmiDetail=d;
  if(!/redmi note 8/i.test(d.title)||/redmi note 8\s+pro/i.test(d.title))fail('detail_identity_redmi_note_8',d.title);pass('detail_identity_redmi_note_8');
  if(d.description.length<80)fail('detail_product_description_primary',d.description);pass('detail_product_description_primary');
  if(d.order.about!==d.order.hero+1)fail('detail_description_immediately_after_hero',JSON.stringify(d.order));pass('detail_description_immediately_after_hero');
  if(d.order.technical<=d.order.seller)fail('detail_technical_after_seller',JSON.stringify(d.order));pass('detail_technical_after_seller');
  if(/Compare available seller options/i.test(d.meta)||d.meta.length<70)fail('detail_unique_meta_description',d.meta);pass('detail_unique_meta_description');
  if(!d.meta.toLowerCase().includes(d.description.slice(0,28).toLowerCase()))fail('detail_meta_uses_product_description',d.meta);pass('detail_meta_uses_product_description');
  if(d.ld!==d.description)fail('detail_jsonld_uses_product_description',JSON.stringify({ld:d.ld,description:d.description}));pass('detail_jsonld_uses_product_description');
  if(/\b6\.53\s*(?:in|inch|inches)\b/i.test(d.structural))fail('detail_variant_screen_truth','6.53 leaked');pass('detail_variant_screen_truth');
  if(!/RAM \+ storage specified/i.test(d.structural))fail('detail_specified_variant_group','missing');pass('detail_specified_variant_group');
  if(!/Storage-only records/i.test(d.structural)||!/RAM not specified/i.test(d.structural))fail('detail_partial_variant_group','missing');pass('detail_partial_variant_group');
  if(d.factLabels.some(x=>/^(RAM|Storage)$/i.test(x)))fail('detail_variable_specs_not_fixed',JSON.stringify(d.factLabels));pass('detail_variable_specs_not_fixed');
  if(!d.factLabels.includes('Screen')||!d.factLabels.includes('Battery'))fail('detail_model_facts_present',JSON.stringify(d.factLabels));pass('detail_model_facts_present');
  if(!/RAM and storage vary by seller record/i.test(d.facts))fail('detail_configuration_note',d.facts);pass('detail_configuration_note');
  if(/\bactive listings?\b/i.test(d.structural))fail('detail_generic_route_not_active','active listing claim');pass('detail_generic_route_not_active');
  if(!/catalogue records?/i.test(d.structural))fail('detail_catalogue_record_label','missing');pass('detail_catalogue_record_label');
  if(!/search on alibaba|browse alibaba/i.test(d.structural))fail('detail_alibaba_route_truth','missing');pass('detail_alibaba_route_truth');
  if(!/no exact verified price yet|check current price/i.test(d.structural))fail('detail_price_truth','missing');pass('detail_price_truth');
  if(d.h1Size>30)fail('detail_mobile_title_size',`${d.h1Size}px`);pass('detail_mobile_title_size');
  if(d.bottom>60)fail('detail_mobile_nav_compact',`${d.bottom}px`);pass('detail_mobile_nav_compact');

  report.passed=Object.values(report.checks).every(Boolean);
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${OUT}/success-mobile.png`,fullPage:true});console.log(JSON.stringify(report,null,2));
}catch(e){report.passed=false;report.error=String(e?.stack||e);try{await page.screenshot({path:`${OUT}/failure-mobile.png`,fullPage:true})}catch{}await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.error(JSON.stringify(report,null,2));await browser.close();process.exit(1)}
await browser.close();
