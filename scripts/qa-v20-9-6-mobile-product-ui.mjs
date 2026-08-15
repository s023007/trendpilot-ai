import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/live-shopper';
await fs.mkdir(OUT,{recursive:true});
const url=`${BASE}/product/hot-sale-original-global-official-version-xiaomi-redmi-note-8-48mp-quad-ai-back---d0f4e3ec74717f/`;
const report={version:'20.9.6',base:BASE,url,checks:{},passed:false};
const pass=n=>report.checks[n]=true;
const fail=(n,m)=>{report.checks[n]=false;throw new Error(`${n}: ${m}`)};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
page.setDefaultTimeout(25000);

try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('body[data-tp-product-truth="20.9.5"][data-tp-product-ui="20.9.6"]',{state:'attached'});
  await page.waitForSelector('.panel.about',{state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.technical-disclosure')&&document.querySelector('.catalogue-records'));

  const snap=await page.evaluate(()=>{
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const tech=document.querySelector('.technical-disclosure');
    const records=document.querySelector('.catalogue-records');
    const decision=document.querySelector('.decision');
    const bottom=document.querySelector('.bottom');
    const h1=document.querySelector('.hero h1');
    const about=document.querySelector('.about-copy');
    const hero=document.querySelector('.hero-copy p');
    const seller=document.querySelector('#seller-offers');
    return {
      title:clean(h1?.textContent),
      description:clean(about?.textContent),
      heroTruth:clean(hero?.textContent),
      technicalOpen:!!tech?.open,
      technicalSummary:clean(tech?.querySelector('summary')?.textContent),
      catalogueOpen:!!records?.open,
      catalogueSummary:clean(records?.querySelector('summary')?.textContent),
      visibleSuboffers:[...document.querySelectorAll('.catalogue-records a.suboffer')].filter(a=>a.getClientRects().length>0).length,
      catalogueLinks:[...document.querySelectorAll('.catalogue-records a.suboffer')].map(a=>({href:a.href,rel:a.rel,target:a.target})),
      decisionHeight:decision?.getBoundingClientRect().height||0,
      bottomHeight:bottom?.getBoundingClientRect().height||0,
      h1Size:parseFloat(getComputedStyle(h1).fontSize),
      aboutTop:document.querySelector('.panel.about')?.getBoundingClientRect().top||0,
      sellerExists:!!seller,
      oldTruth:/exact product destination not verified/i.test(document.body.innerText),
      repeatedVisibleSellerRows:[...document.querySelectorAll('.seller-card .offer-list > .suboffer')].filter(a=>a.getClientRects().length>0).length
    };
  });
  report.sample=snap;

  if(snap.description.length<100)fail('product_description_kept_primary',snap.description);pass('product_description_kept_primary');
  if(!/Xiaomi Redmi Note 8 is a smartphone/i.test(snap.description))fail('product_description_naturalized',snap.description);pass('product_description_naturalized');
  if(snap.oldTruth)fail('friendly_exact_route_language',snap.heroTruth);pass('friendly_exact_route_language');
  if(!/Exact seller listing not confirmed/i.test(snap.heroTruth))fail('hero_truth_clear',snap.heroTruth);pass('hero_truth_clear');
  if(snap.technicalOpen)fail('technical_details_collapsed_by_default','technical details opened by default');pass('technical_details_collapsed_by_default');
  if(!/Technical specifications/i.test(snap.technicalSummary))fail('technical_summary_present',snap.technicalSummary);pass('technical_summary_present');
  if(snap.catalogueOpen)fail('catalogue_records_collapsed_by_default','catalogue records opened by default');pass('catalogue_records_collapsed_by_default');
  if(!/Show 11 catalogue records/i.test(snap.catalogueSummary))fail('catalogue_summary_count',snap.catalogueSummary);pass('catalogue_summary_count');
  if(snap.visibleSuboffers!==0||snap.repeatedVisibleSellerRows!==0)fail('no_repeated_seller_rows_by_default',JSON.stringify(snap));pass('no_repeated_seller_rows_by_default');
  if(snap.decisionHeight>165)fail('price_status_compact',`decision height ${snap.decisionHeight}`);pass('price_status_compact');
  if(snap.bottomHeight>60)fail('bottom_nav_compact',`bottom nav height ${snap.bottomHeight}`);pass('bottom_nav_compact');
  if(snap.h1Size>28)fail('mobile_title_compact',`h1 ${snap.h1Size}px`);pass('mobile_title_compact');
  if(!snap.sellerExists)fail('seller_section_preserved','seller section missing');pass('seller_section_preserved');

  await page.locator('.technical-disclosure > summary').click();
  await page.waitForFunction(()=>document.querySelector('.technical-disclosure')?.open===true);
  const techText=(await page.locator('.technical-disclosure').innerText()).replace(/\s+/g,' ').trim();
  if(!/6\.3 in/.test(techText)||!/4000mAh/i.test(techText)||!/6GB RAM/.test(techText))fail('technical_details_accessible',techText);pass('technical_details_accessible');

  await page.locator('.catalogue-records > summary').click();
  await page.waitForFunction(()=>document.querySelector('.catalogue-records')?.open===true);
  const links=await page.$$eval('.catalogue-records a.suboffer',as=>as.map(a=>({href:a.href,rel:a.rel,target:a.target})));
  if(links.length<1)fail('catalogue_records_accessible','no catalogue links after expand');
  for(const a of links){
    if(!/^https?:/.test(a.href))fail('catalogue_links_http',a.href);
    const rel=new Set(a.rel.toLowerCase().split(/\s+/).filter(Boolean));
    for(const x of ['sponsored','nofollow','noopener'])if(!rel.has(x))fail('catalogue_links_affiliate_rel',JSON.stringify(a));
    if(a.target!=='_blank')fail('catalogue_links_new_tab',JSON.stringify(a));
  }
  pass('catalogue_records_accessible');pass('catalogue_links_http');pass('catalogue_links_affiliate_rel');pass('catalogue_links_new_tab');

  report.passed=Object.values(report.checks).every(Boolean);
  await page.screenshot({path:`${OUT}/product-ui-v20-9-6.png`,fullPage:true});
  await fs.writeFile(`${OUT}/product-ui-v20-9-6.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(err){
  report.error=String(err?.stack||err);report.passed=false;
  try{await page.screenshot({path:`${OUT}/product-ui-v20-9-6-failure.png`,fullPage:true})}catch{}
  await fs.writeFile(`${OUT}/product-ui-v20-9-6.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));
  await browser.close();process.exit(1);
}
await browser.close();
