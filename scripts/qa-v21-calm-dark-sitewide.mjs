import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/v21-calm-dark';
await fs.mkdir(OUT,{recursive:true});
const report={version:'21.0.0',base:BASE,pages:{},checks:{},passed:false};
const pass=n=>report.checks[n]=true;
const fail=(n,m)=>{report.checks[n]=false;throw new Error(`${n}: ${m}`)};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
page.setDefaultTimeout(25000);

async function inspect(name,path,waitFor='main'){
  await page.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector(waitFor,{state:'attached'});
  await page.waitForFunction(()=>[...document.styleSheets].some(s=>String(s.href||'').includes('trendpilot-calm-dark-v21.css')),{timeout:20000});
  const snap=await page.evaluate(()=>{
    const cs=getComputedStyle(document.body);
    const header=document.querySelector('.tp-header,.tp80-minihead,header');
    const hs=header?getComputedStyle(header):null;
    return {
      title:document.title,
      bodyColor:cs.color,
      bodyBackgroundImage:cs.backgroundImage,
      headerBackground:hs?.backgroundColor||'',
      theme:document.querySelector('meta[name="theme-color"]')?.content||'',
      stylesheet:[...document.styleSheets].map(s=>s.href||'').find(x=>x.includes('trendpilot-calm-dark-v21.css'))||'',
      text:(document.querySelector('main')?.innerText||'').replace(/\s+/g,' ').trim().slice(0,220)
    };
  });
  report.pages[name]=snap;
  if(!snap.stylesheet)fail(`${name}_theme_loaded`,'calm-dark stylesheet missing');
  pass(`${name}_theme_loaded`);
  if(!/gradient/i.test(snap.bodyBackgroundImage))fail(`${name}_dark_gradient`,`background=${snap.bodyBackgroundImage}`);
  pass(`${name}_dark_gradient`);
  if(!/rgb\(247, 249, 253\)|rgb\(255, 255, 255\)|rgb\(247, 249, 252\)/.test(snap.bodyColor))fail(`${name}_light_text`,`body color=${snap.bodyColor}`);
  pass(`${name}_light_text`);
  return snap;
}

try{
  await inspect('home','/');

  await inspect('finder','/find/?q=phone&engine=v2064','.tp78-card');
  const finder=await page.evaluate(()=>{
    const card=document.querySelector('.tp78-card');
    const media=document.querySelector('.tp78-media');
    return {cards:document.querySelectorAll('.tp78-card').length,cardBg:getComputedStyle(card).backgroundImage,mediaBg:getComputedStyle(media).backgroundColor,title:card?.querySelector('h3')?.innerText||''};
  });
  report.pages.finder.result=finder;
  if(finder.cards<1)fail('finder_results_preserved','no product cards');pass('finder_results_preserved');
  if(!/rgb\((?:24[0-9]|25[0-5]),\s*(?:24[0-9]|25[0-5]),\s*(?:24[0-9]|25[0-5])\)/.test(finder.mediaBg))fail('finder_images_stay_light',finder.mediaBg);pass('finder_images_stay_light');

  const productPath='/product/hot-sale-original-global-official-version-xiaomi-redmi-note-8-48mp-quad-ai-back---d0f4e3ec74717f/';
  await inspect('product',productPath,'.panel.about');
  const product=await page.evaluate(()=>({
    about:(document.querySelector('.about-copy')?.textContent||'').replace(/\s+/g,' ').trim(),
    seller:!!document.querySelector('#seller-offers'),
    technical:!!document.querySelector('.technical-disclosure'),
    ui:document.body.getAttribute('data-tp-product-ui')||''
  }));
  report.pages.product.result=product;
  if(product.about.length<80)fail('product_description_preserved',product.about);pass('product_description_preserved');
  if(!product.seller)fail('product_seller_preserved','seller section missing');pass('product_seller_preserved');
  if(!product.technical)fail('product_technical_preserved','technical disclosure missing');pass('product_technical_preserved');

  await inspect('compare','/compare/');
  await inspect('deals','/deals/');
  await inspect('rare','/rare-used/','.tp80-rare-hero');
  const rare=await page.evaluate(()=>({heroBg:getComputedStyle(document.querySelector('.tp80-rare-hero')).backgroundImage,heroColor:getComputedStyle(document.querySelector('.tp80-rare-hero h1')).color}));
  report.pages.rare.result=rare;
  if(!/gradient/i.test(rare.heroBg))fail('rare_identity_preserved',rare.heroBg);pass('rare_identity_preserved');

  report.passed=Object.values(report.checks).every(Boolean);
  await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});
  await page.screenshot({path:`${OUT}/home-mobile.png`,fullPage:true});
  await page.goto(`${BASE}/find/?q=phone&engine=v2064`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.tp78-card');
  await page.screenshot({path:`${OUT}/finder-mobile.png`,fullPage:true});
  await page.goto(`${BASE}${productPath}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.panel.about');
  await page.screenshot({path:`${OUT}/product-mobile.png`,fullPage:true});
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(err){
  report.error=String(err?.stack||err);report.passed=false;
  try{await page.screenshot({path:`${OUT}/failure.png`,fullPage:true})}catch{}
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));
  await browser.close();process.exit(1);
}
await browser.close();
