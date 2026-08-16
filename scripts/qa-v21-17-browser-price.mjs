import { chromium, firefox } from 'playwright';
import fs from 'node:fs';

const BASE=(process.env.TP_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const report={version:'21.17.1',checks:{},passed:false};
const ok=(name,value,detail='')=>{report.checks[name]={ok:Boolean(value),detail};if(!value)throw new Error(`${name}: ${detail}`)};

async function probe(browserType,name,{country='OM',abortGeo=false,userAgent='',query='tablets'}={}){
  const browser=await browserType.launch({headless:true});
  const options={viewport:{width:390,height:844},isMobile:true,hasTouch:true};
  if(userAgent)options.userAgent=userAgent;
  const context=await browser.newContext(options);
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.route('**/visitor-context.json*',route=>abortGeo?route.abort():route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({country})}));
  const started=Date.now();
  await page.goto(`${BASE}/find/?q=${encodeURIComponent(query)}&engine=v2064&universal=1`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.tp78-card').length>0,{timeout:30000});
  const data=await page.evaluate(()=>({
    country:window.__TP_VISITOR_COUNTRY__||'',
    allow:window.__TP_ALLOW_TIKTOK_US__===true,
    sellers:[...document.querySelectorAll('[data-filter-merchant] option')].map(x=>(x.textContent||'').trim()),
    cards:[...document.querySelectorAll('.tp78-card')].map(c=>(c.textContent||'').replace(/\s+/g,' ').trim()),
    count:(document.querySelector('[data-v2078-results-count]')?.textContent||'').trim()
  }));
  data.elapsed=Date.now()-started;
  data.errors=errors;
  await browser.close();
  report[name]=data;
  return data;
}

try{
  const html=fs.readFileSync('find/index.html','utf8');
  ok('new_geo_loader',html.includes('visitor-context-v21-17.js?v=21.17.0'));
  ok('old_blocking_geo_removed',!html.includes('geo-bootstrap.js?v=21.16.0'));

  const universal=fs.readFileSync('js/universal-discovery-v20-9-1.js','utf8');
  ok('tablet_plural_family_supported',/\["tablet",\/\\b\(\?:tablets\?\|/i.test(universal)||universal.includes('["tablet",/\\b(?:tablets?|'));
  ok('tablet_generic_route_supported',universal.includes('tablet:/^(?:tablets?'));

  for(const file of ['js/universal-discovery-v20-9-1.js','js/packed-browse-v21-13-8.js','js/compare-v20-9.js']){
    const s=fs.readFileSync(file,'utf8');
    ok(`${file}_price_guard`,s.includes('usablePrice'));
    ok(`${file}_geo_wait`,s.includes('waitForGeo'));
  }

  const yandexUA='Mozilla/5.0 (Linux; arm_64; Android 10; STK-L21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/26.8.0.0 Mobile Safari/537.36';
  const firefoxUA='Mozilla/5.0 (Android 10; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0';

  const y=await probe(chromium,'yandex_style_blocked_geo',{country:'ZZ',abortGeo:true,userAgent:yandexUA,query:'tablets'});
  ok('yandex_no_stall',y.elapsed<12000,`${y.elapsed}ms`);
  ok('yandex_results_load',y.cards.length>0,`count=${y.count}`);
  ok('yandex_no_page_errors',!y.errors.length,y.errors.join(' | '));
  ok('yandex_no_lenovo_one_dollar',!y.cards.some(x=>/Lenovo/i.test(x)&&/US\$\s*1(?:\D|$)/.test(x)),y.cards.find(x=>/Lenovo/i.test(x))||'');
  ok('unknown_region_hides_tiktok',!y.sellers.some(x=>/TikTok Shop US/i.test(x)),y.sellers.join(', '));

  const f=await probe(firefox,'firefox_oman',{country:'OM',userAgent:firefoxUA,query:'tablets'});
  ok('firefox_no_stall',f.elapsed<12000,`${f.elapsed}ms`);
  ok('firefox_results_load',f.cards.length>0,`count=${f.count}`);
  ok('firefox_no_page_errors',!f.errors.length,f.errors.join(' | '));
  ok('firefox_no_lenovo_one_dollar',!f.cards.some(x=>/Lenovo/i.test(x)&&/US\$\s*1(?:\D|$)/.test(x)),f.cards.find(x=>/Lenovo/i.test(x))||'');
  ok('oman_hides_tiktok',!f.allow&&!f.sellers.some(x=>/TikTok Shop US/i.test(x)),f.sellers.join(', '));

  report.passed=true;
  fs.mkdirSync('artifacts/v21-17-browser-price',{recursive:true});
  fs.writeFileSync('artifacts/v21-17-browser-price/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(e){
  report.error=String(e.stack||e);
  fs.mkdirSync('artifacts/v21-17-browser-price',{recursive:true});
  fs.writeFileSync('artifacts/v21-17-browser-price/report.json',JSON.stringify(report,null,2));
  console.error(report.error);
  process.exit(1);
}
