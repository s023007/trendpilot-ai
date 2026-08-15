import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/v21-calm-dark';
await fs.mkdir(OUT,{recursive:true});
const report={version:'21.11.2',base:BASE,checks:{},details:{},passed:false};
const pass=n=>report.checks[n]=true;
const fail=(n,m)=>{report.checks[n]=false;throw new Error(`${n}: ${m}`)};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
page.setDefaultTimeout(30000);

try{
  await page.goto(`${BASE}/rare-used/?q=phone`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('[data-rare-grid]');
  await page.waitForFunction(()=>!String(document.querySelector('[data-rare-stats]')?.textContent||'').includes('Loading'),{timeout:25000});
  const rare=await page.evaluate(()=>({
    pathname:location.pathname,
    query:document.querySelector('[data-rare-query]')?.value||'',
    stats:(document.querySelector('[data-rare-stats]')?.textContent||'').trim(),
    cards:document.querySelectorAll('.tp80-rare-card').length,
    fallbackHref:document.querySelector('.tp80-no-result a')?.getAttribute('href')||''
  }));
  report.details.rare=rare;
  if(!/^\/rare-used\/?$/.test(rare.pathname))fail('rare_search_stays_in_rare',rare.pathname);pass('rare_search_stays_in_rare');
  if(rare.query.toLowerCase()!=='phone')fail('rare_query_preserved',rare.query);pass('rare_query_preserved');
  await page.screenshot({path:`${OUT}/rare-phone-mobile.png`,fullPage:true});

  await page.goto(`${BASE}/tickets/`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('.tp-ticket-v141-card',{timeout:30000});
  const tickets=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.tp-ticket-v141-card')];
    const body=(document.querySelector('main')?.innerText||'').replace(/\s+/g,' ').trim();
    return {
      cards:cards.length,
      directSellerLinks:cards.filter(c=>c.querySelector('a.primary[target="_blank"]')).length,
      descriptions:cards.filter(c=>c.querySelector('.tp-ticket-v141-description')).length,
      badDetailCards:cards.filter(c=>c.querySelector('a[href^="/ticket/?id="]')&&!c.querySelector('.tp-ticket-v141-facts')).length,
      detailLinks:cards.filter(c=>c.querySelector('a[href^="/ticket/?id="]')).length,
      hasQuickView:/\bQuick view\b/i.test(body),
      hasCheckWithSeller:/\bCheck with seller\b/i.test(body),
      firstTitle:cards[0]?.querySelector('h3')?.textContent?.trim()||'',
      firstDescription:cards[0]?.querySelector('.tp-ticket-v141-description')?.textContent?.trim()||''
    };
  });
  report.details.tickets=tickets;
  if(tickets.cards<1)fail('tickets_have_results','no cards');pass('tickets_have_results');
  if(tickets.directSellerLinks<1)fail('tickets_have_direct_seller_links','no seller CTA');pass('tickets_have_direct_seller_links');
  if(tickets.descriptions<1)fail('tickets_have_descriptions','no ticket descriptions');pass('tickets_have_descriptions');
  if(tickets.badDetailCards>0)fail('tickets_hide_empty_details',`${tickets.badDetailCards} empty detail links`);pass('tickets_hide_empty_details');
  if(tickets.hasQuickView)fail('tickets_remove_quick_view','Quick view still visible');pass('tickets_remove_quick_view');
  if(tickets.hasCheckWithSeller)fail('tickets_remove_placeholder_price','Check with seller still visible');pass('tickets_remove_placeholder_price');
  await page.screenshot({path:`${OUT}/tickets-mobile.png`,fullPage:true});

  report.passed=Object.values(report.checks).every(Boolean);
  await fs.writeFile(`${OUT}/tickets-rare-report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(err){
  report.error=String(err?.stack||err);report.passed=false;
  try{await page.screenshot({path:`${OUT}/tickets-rare-failure.png`,fullPage:true})}catch{}
  await fs.writeFile(`${OUT}/tickets-rare-report.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));
  await browser.close();process.exit(1);
}
await browser.close();
