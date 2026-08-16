import { chromium, firefox } from 'playwright';
import fs from 'node:fs';

const BASE=(process.env.TP_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const OUT='artifacts/v21-17-3-tablet-browser';
fs.mkdirSync(OUT,{recursive:true});
const report={version:'21.17.3',checks:{},browsers:{},passed:false};
const check=(name,value,detail='')=>{report.checks[name]={ok:Boolean(value),detail};if(!value)throw new Error(`${name}: ${detail}`)};
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

const data=JSON.parse(fs.readFileSync('data/v20-9/tablet-seller-samples.json','utf8'));
const rows=Object.values(data.records||{});
const falseRe=/\b(?:graphic(?:s)? tablet|drawing tablet|pen tablet|signature (?:pad|tablet)|writing (?:pad|tablet)|digitizer|drawing pad|tablet monitor|pen display|digital pen design|stylus pen|tablet case|tablet cover|screen protector)\b/i;
const suspects=data.qa?.lenovoPlaceholderPrices||[];

check('packed_tablet_records',rows.length>=5,`records=${rows.length}`);
check('packed_tablet_sellers',Object.keys(data.sellers||{}).length>=1,JSON.stringify(Object.keys(data.sellers||{})));
check('no_graphic_tablet_false_positives',!rows.some(r=>falseRe.test(clean([r.t,r.ty,r.tyl].join(' ')))),rows.filter(r=>falseRe.test(clean([r.t,r.ty,r.tyl].join(' ')))).slice(0,3).map(r=>r.t).join(' | '));
check('lenovo_placeholder_fixture_present',suspects.length>=1,JSON.stringify(suspects));

async function probe(browserType,name,{country='OM',abortGeo=false,userAgent=''}){
  const browser=await browserType.launch({headless:true});
  const opts={viewport:{width:390,height:844},isMobile:true,hasTouch:true}; if(userAgent)opts.userAgent=userAgent;
  const ctx=await browser.newContext(opts); const page=await ctx.newPage(); page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.route('**/visitor-context.json*',route=>abortGeo?route.abort():route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({country})}));
  const started=Date.now();
  await page.goto(`${BASE}/find/?q=tablets&engine=v2064&universal=1`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.__TP_PACKED_BROWSE__?.ready===true&&document.querySelectorAll('.tp78-card').length>0,{timeout:15000});
  const base=await page.evaluate(()=>({
    elapsed:0,
    cards:document.querySelectorAll('.tp78-card').length,
    sellers:[...document.querySelectorAll('[data-filter-merchant] option')].map(x=>(x.textContent||'').trim()),
    allow:window.__TP_ALLOW_TIKTOK_US__===true,
    country:window.__TP_VISITOR_COUNTRY__||'',
    packed:window.__TP_PACKED_BROWSE__||null,
    texts:[...document.querySelectorAll('.tp78-card')].map(c=>(c.textContent||'').replace(/\s+/g,' ').trim())
  }));
  base.elapsed=Date.now()-started;base.errors=errors;

  // Exercise the exact bad-data class through the rendered listing UI.
  if(base.sellers.some(x=>/^Lenovo$/i.test(x))){
    await page.selectOption('[data-filter-merchant]','Lenovo');
    for(let i=0;i<12;i++){
      const more=page.locator('[data-v2078-load-more]');
      if(!(await more.count())||await more.isHidden())break;
      await more.click();
    }
    base.lenovoTexts=await page.locator('.tp78-card').allTextContents();
  }else base.lenovoTexts=[];

  const suspect=suspects[0];
  if(suspect){
    await page.goto(`${BASE}/item/?id=${encodeURIComponent(suspect.id)}`,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>/Check current price|US\$/i.test(document.querySelector('main')?.textContent||''),{timeout:15000});
    base.suspectDetail=clean(await page.locator('main').innerText());
  }
  await page.screenshot({path:`${OUT}/${name}.png`,fullPage:true});
  await browser.close();report.browsers[name]=base;return base;
}

try{
  const source=fs.readFileSync('find/index.html','utf8');
  check('packed_runtime_21173',source.includes('packed-browse-v21-13-8.js?v=21.17.3'));
  check('nonblocking_geo_loader',source.includes('visitor-context-v21-17.js?v=21.17.0')&&!source.includes('geo-bootstrap.js?v=21.16.0'));
  const packed=fs.readFileSync('js/packed-browse-v21-13-8.js','utf8');
  check('tablet_packed_mode',packed.includes('TABLET.test(ql) ? "tablet"'));
  check('tablet_packed_data',packed.includes('tablet-seller-samples.json?v=21.17.3'));
  check('lenovo_price_guard',packed.includes('function usablePrice'));

  const yandexUA='Mozilla/5.0 (Linux; arm_64; Android 10; STK-L21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/26.8.0.0 Mobile Safari/537.36';
  const firefoxUA='Mozilla/5.0 (Android 10; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0';
  const y=await probe(chromium,'yandex-style',{abortGeo:true,country:'ZZ',userAgent:yandexUA});
  check('yandex_loads_fast',y.elapsed<10000,`${y.elapsed}ms`);
  check('yandex_has_results',y.cards>0,`cards=${y.cards}`);
  check('yandex_no_js_errors',!y.errors.length,y.errors.join(' | '));
  check('unknown_region_hides_tiktok',!y.sellers.some(x=>/TikTok Shop US/i.test(x)),y.sellers.join(', '));
  check('yandex_no_lenovo_one_dollar',!y.lenovoTexts.some(x=>/US\$\s*1(?:\D|$)/i.test(x)),y.lenovoTexts.find(x=>/US\$\s*1(?:\D|$)/i.test(x))||'');
  check('yandex_detail_hides_placeholder',!/(?:^|\s)US\$\s*1(?:\D|$)/i.test(y.suspectDetail||'')&&/Check current price/i.test(y.suspectDetail||''),(y.suspectDetail||'').slice(0,400));

  const f=await probe(firefox,'firefox-oman',{country:'OM',userAgent:firefoxUA});
  check('firefox_loads_fast',f.elapsed<10000,`${f.elapsed}ms`);
  check('firefox_has_results',f.cards>0,`cards=${f.cards}`);
  check('firefox_no_js_errors',!f.errors.length,f.errors.join(' | '));
  check('oman_hides_tiktok',!f.allow&&!f.sellers.some(x=>/TikTok Shop US/i.test(x)),f.sellers.join(', '));
  check('firefox_no_lenovo_one_dollar',!f.lenovoTexts.some(x=>/US\$\s*1(?:\D|$)/i.test(x)),f.lenovoTexts.find(x=>/US\$\s*1(?:\D|$)/i.test(x))||'');
  check('firefox_detail_hides_placeholder',!/(?:^|\s)US\$\s*1(?:\D|$)/i.test(f.suspectDetail||'')&&/Check current price/i.test(f.suspectDetail||''),(f.suspectDetail||'').slice(0,400));

  report.passed=Object.values(report.checks).every(x=>x.ok);
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(err){
  report.error=String(err?.stack||err);report.passed=false;
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.error(JSON.stringify(report,null,2));process.exit(1);
}
