import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/v21-15-internal-first';
await fs.mkdir(OUT,{recursive:true});
const report={version:'21.15.0',base:BASE,pages:{},checks:{},failures:[],passed:false};
const ok=(name,value,detail='')=>{report.checks[name]=Boolean(value);if(!value)report.failures.push({name,detail})};
const SELLER_HOST=/(?:rzekl\.com|admitad|aliexpress\.com|alibaba\.com|tiktok\.com|geekbuying\.com|govee\.com|sunsky-online\.com|lenovo\.com|pandahall\.com|karaca\.com|mfimedical\.com|fragranceshop\.com|trip\.com|ticketnetwork\.com|sportsevents365\.com|anrdoezrs\.net|apmebf\.com|awltovhc\.com|commission-junction\.com|dpbolvw\.net|emjcd\.com|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|lduhtrp\.net|qksrv\.net|tkqlhce\.com|awin1\.com)/i;
const CTA=/\b(?:check\s*(?:price|deal|offer|tickets?)|shop\s*(?:now|deal)?|buy\s*now|visit\s*(?:seller|store|shop)|use\s*(?:coupon|code)|seller\s*site|view\s*at)\b/i;

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
page.setDefaultTimeout(35000);

async function inspect(name,path,wait='body'){
  await page.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector(wait,{state:'attached'});
  await page.waitForTimeout(1400);
  const snap=await page.evaluate(({sellerHostSource,ctaSource})=>{
    const sellerHost=new RegExp(sellerHostSource,'i'),cta=new RegExp(ctaSource,'i');
    const origin=location.origin;
    const links=[...document.querySelectorAll('a[href]')].map(a=>{
      const href=a.getAttribute('href')||'';let u=null;try{u=new URL(href,location.href)}catch{}
      const text=(a.textContent||a.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
      const rel=(a.getAttribute('rel')||'').toLowerCase();
      const sellerLike=Boolean(u&&u.origin!==origin&&/^https?:$/.test(u.protocol)&&(sellerHost.test(u.hostname)||rel.includes('sponsored')||cta.test(text)));
      return {href,text,rel,sellerLike,internalFirst:a.dataset.tpInternalFirst||'',handoffReady:a.dataset.tpHandoffReady||''};
    });
    return {
      path:location.pathname+location.search,
      guardLoaded:[...document.scripts].some(s=>String(s.src||'').includes('seller-handoff-v21-15.js')),
      sellerExternal:links.filter(x=>x.sellerLike),
      handoffLinks:links.filter(x=>String(x.href).startsWith('/handoff/?k=')),
      internalFirst:links.filter(x=>x.internalFirst==='1'),
      checkPrice:links.filter(x=>/check\s*price/i.test(x.text)),
      bodyText:(document.body.innerText||'').replace(/\s+/g,' ').trim().slice(0,250)
    };
  },{sellerHostSource:SELLER_HOST.source,ctaSource:CTA.source});
  report.pages[name]=snap;
  ok(`${name}_guard_loaded`,snap.guardLoaded,JSON.stringify(snap));
  ok(`${name}_no_direct_seller_exit`,snap.sellerExternal.length===0,JSON.stringify(snap.sellerExternal.slice(0,5)));
  return snap;
}

try{
  const core=[
    ['home','/'],['find','/find/?q=phone'],['deals','/deals/'],['rare','/rare-used/'],['tickets','/tickets/'],
    ['compare','/compare/'],['products','/products/'],['saved','/price-watch/'],['guides','/guides/'],['sourcing','/sourcing/'],
    ['wholesale','/wholesale/'],['software','/software/']
  ];
  for(const [name,path] of core){
    try{await inspect(name,path)}catch(err){ok(`${name}_reachable`,false,String(err));report.pages[name]={error:String(err)}}
  }

  // Savings cards: any old "Check price" CTA must no longer leave the site directly.
  await page.goto(`${BASE}/deals/`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForTimeout(1800);
  const savings=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('a[href]')].filter(a=>/check\s*price/i.test(a.textContent||''));
    return rows.map(a=>({text:(a.textContent||'').trim(),href:a.getAttribute('href')||'',internalFirst:a.dataset.tpInternalFirst||''}));
  });
  report.pages.deals.checkPriceAfterGuard=savings;
  ok('deals_check_price_never_external',savings.every(x=>x.href.startsWith('/')&&!/^\/\//.test(x.href)),JSON.stringify(savings));

  // Open a real internal deal detail, then verify its seller CTA becomes a TrendPilot handoff.
  const dealHref=await page.locator('a[href^="/deal/?id="]').first().getAttribute('href').catch(()=>null);
  if(dealHref){
    const detail=await inspect('dealDetail',dealHref,'[data-deal-detail]');
    ok('deal_detail_has_handoff',detail.handoffLinks.length>0,JSON.stringify(detail));
    const h=detail.handoffLinks[0]?.href;
    if(h){
      await page.goto(`${BASE}${h}`,{waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForSelector('[data-continue]');
      const hand=await page.evaluate(()=>({path:location.pathname,seller:(document.querySelector('[data-seller]')?.textContent||'').trim(),continueHref:document.querySelector('[data-continue]')?.getAttribute('href')||''}));
      report.pages.handoff=hand;
      ok('handoff_page_is_internal',hand.path==='/handoff/',JSON.stringify(hand));
      ok('handoff_has_final_seller_button',/^https?:\/\//i.test(hand.continueHref),JSON.stringify(hand));
    }
  }else ok('deal_detail_available_for_test',false,'No internal deal detail link found');

  // Coupon detail should also hand off internally before the seller.
  await page.goto(`${BASE}/deals/`,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForTimeout(1200);
  const couponHref=await page.locator('a[href^="/coupon/?id="]').first().getAttribute('href').catch(()=>null);
  if(couponHref){const c=await inspect('couponDetail',couponHref,'[data-coupon-detail]');ok('coupon_detail_has_handoff',c.handoffLinks.length>0,JSON.stringify(c))}

  // Search result product detail should keep its seller CTA behind handoff too.
  await page.goto(`${BASE}/find/?q=phone`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForTimeout(2200);
  const productHref=await page.locator('a[href^="/product/"]').first().getAttribute('href').catch(()=>null);
  if(productHref){const p=await inspect('productDetail',productHref,'body');ok('product_detail_has_handoff',p.handoffLinks.length>0,JSON.stringify(p))}
  else ok('product_detail_link_available_for_test',false,'No internal product link found from finder');

  report.passed=report.failures.length===0;
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
  process.exit(report.passed?0:1);
}catch(err){
  report.failures.push({name:'unhandled',detail:String(err?.stack||err)});report.passed=false;
  try{await page.screenshot({path:`${OUT}/failure.png`,fullPage:true})}catch{}
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));
  await browser.close();process.exit(1);
}
