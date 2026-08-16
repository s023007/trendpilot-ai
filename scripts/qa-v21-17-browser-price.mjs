import { chromium, firefox } from 'playwright';
import fs from 'node:fs';

const BASE=(process.env.TP_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const report={checks:{},passed:false};
const ok=(name,value,detail='')=>{report.checks[name]={ok:Boolean(value),detail};if(!value)throw new Error(`${name}: ${detail}`)};

async function probe(browserType,name,country,abortGeo=false){
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.route('**/visitor-context.json*',route=>abortGeo?route.abort():route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({country})}));
  const started=Date.now();
  await page.goto(`${BASE}/find/?q=tablets&engine=v2064&universal=1`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.tp78-card').length>0,{timeout:30000});
  const data=await page.evaluate(()=>({
    elapsed:0,
    country:window.__TP_VISITOR_COUNTRY__||'',
    allow:window.__TP_ALLOW_TIKTOK_US__===true,
    sellers:[...document.querySelectorAll('[data-filter-merchant] option')].map(x=>(x.textContent||'').trim()),
    cards:[...document.querySelectorAll('.tp78-card')].map(c=>(c.textContent||'').replace(/\s+/g,' ').trim())
  }));
  data.elapsed=Date.now()-started; data.errors=errors;
  await browser.close(); report[name]=data; return data;
}

try{
  const html=fs.readFileSync('find/index.html','utf8');
  ok('new_geo_loader',html.includes('visitor-context-v21-17.js?v=21.17.0'));
  ok('old_blocking_geo_removed',!html.includes('geo-bootstrap.js?v=21.16.0'));
  for(const file of ['js/universal-discovery-v20-9-1.js','js/packed-browse-v21-13-8.js','js/compare-v20-9.js']){
    const s=fs.readFileSync(file,'utf8'); ok(`${file}_price_guard`,s.includes('usablePrice')); ok(`${file}_geo_wait`,s.includes('waitForGeo'));
  }
  const c=await probe(chromium,'chromium_blocked_geo','ZZ',true);
  ok('chromium_no_stall',c.elapsed<12000,`${c.elapsed}ms`); ok('chromium_no_errors',!c.errors.length,c.errors.join(' | '));
  ok('chromium_no_lenovo_one_dollar',!c.cards.some(x=>/Lenovo/i.test(x)&&/US\$\s*1(?:\D|$)/.test(x)),c.cards.find(x=>/Lenovo/i.test(x))||'');
  ok('unknown_hides_tiktok',!c.sellers.some(x=>/TikTok Shop US/i.test(x)),c.sellers.join(', '));
  const f=await probe(firefox,'firefox_oman','OM',false);
  ok('firefox_no_stall',f.elapsed<12000,`${f.elapsed}ms`); ok('firefox_no_errors',!f.errors.length,f.errors.join(' | '));
  ok('firefox_no_lenovo_one_dollar',!f.cards.some(x=>/Lenovo/i.test(x)&&/US\$\s*1(?:\D|$)/.test(x)),f.cards.find(x=>/Lenovo/i.test(x))||'');
  ok('oman_hides_tiktok',!f.allow&&!f.sellers.some(x=>/TikTok Shop US/i.test(x)),f.sellers.join(', '));
  report.passed=true;
  fs.mkdirSync('artifacts/v21-17-browser-price',{recursive:true});fs.writeFileSync('artifacts/v21-17-browser-price/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(e){report.error=String(e.stack||e);fs.mkdirSync('artifacts/v21-17-browser-price',{recursive:true});fs.writeFileSync('artifacts/v21-17-browser-price/report.json',JSON.stringify(report,null,2));console.error(report.error);process.exit(1)}
