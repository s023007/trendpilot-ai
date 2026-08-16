import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const VERSION='21.13.7';
const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT=path.resolve('artifacts/v21-13-7-finder-fast');
fs.mkdirSync(OUT,{recursive:true});
const report={version:VERSION,base:BASE,passed:false,checks:{},failures:[],evidence:{}};
const check=(name,ok,detail='')=>{report.checks[name]=!!ok;if(!ok)report.failures.push({name,detail:String(detail)})};
const bad=/(?:cosplay|costume|snow\s*blower|skid\s*(?:plate|shoe)|flooring\s*installation|epoxy\s*shoe|temperature\s*control\s*iron|bunion|toe\s*(?:separator|corrector)|labubu|doll\s*(?:clothes|shoes)|pet\s*(?:shoes|bed|house)|dog\s*(?:boots|shoes|booties)|cleaning\s*cream|shoe\s*(?:cleaner|rack|bag|box|cover|accessor|machine|making|repair|glue|charm|clip|buckle|pendant)|boot\s*cut|bootcut|baggy\s*jeans|straight\s*jeans|phone\s*case|airpods?|cold\s*shoe|hot\s*shoe|bottle\s*opener|wine\s*rack|anti-clog|clog\s*remover|brake\s*shoe|medical\s*boot|walking\s*boot\s*brace|christmas|xmas)/i;

let browser;
const hardExit=setTimeout(()=>{report.failures.push({name:'global_timeout',detail:'QA exceeded 70 seconds'});try{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2))}catch{};process.exit(2)},70000);
const safeClose=async()=>{if(!browser)return;await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))])};

try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  page.setDefaultTimeout(10000);
  const consoleErrors=[],pageErrors=[],failed=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('requestfailed',r=>{if(r.resourceType()!=='image')failed.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||''}`)});

  await page.goto(`${BASE}/find/?q=shoes&engine=v2064&universal=1&ui=2130`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(7000);
  const diag=await page.evaluate(()=>({
    cards:document.querySelectorAll('[data-v209-card]').length,
    grid:document.querySelector('[data-v2078-product-grid]')?.innerText?.slice(0,1200)||'',
    count:document.querySelector('[data-v2078-results-count]')?.textContent||'',
    universal:window.__TP_V2091_UNIVERSAL__||null,
    packed:window.__TP_PACKED_SEARCH_CACHE__||null,
    scripts:[...document.scripts].map(s=>s.src).filter(Boolean).filter(s=>/packed-search|universal-discovery/.test(s))
  }));
  report.evidence.runtime=diag;report.evidence.consoleErrors=consoleErrors;report.evidence.pageErrors=pageErrors;report.evidence.failedRequests=failed;
  check('finder_runtime_loaded',!!diag.universal&&!!diag.packed,JSON.stringify(diag));
  check('shoes_render_within_7s',diag.cards>=3,JSON.stringify({diag,consoleErrors,pageErrors,failed}));
  if(diag.cards>=3){
    const idx=await page.evaluate(v=>fetch(`/data/v20-9/footwear-seller-samples.json?v=${v}`,{cache:'reload'}).then(r=>r.json()),VERSION);
    const expected=Object.keys(idx.sellers||{}).sort();
    const options=await page.locator('[data-filter-merchant] option').allTextContents();
    const initial=await page.locator('[data-v209-card] h3').allTextContents();
    report.evidence.shoes={indexVersion:idx.version,expected,options,initialCount:initial.length,initial:initial.slice(0,12)};
    check('index_version',idx.version===VERSION,idx.version);
    check('verified_seller_options_match',JSON.stringify(options.slice(1).sort())===JSON.stringify(expected),JSON.stringify({options,expected}));
    check('verified_sellers_include_aliexpress_tiktok',expected.includes('AliExpress')&&expected.includes('TikTok Shop US'),expected.join(', '));
    check('alibaba_not_invented_without_strict_inventory',!expected.includes('Alibaba'),expected.join(', '));
    check('initial_shoes_clean',initial.every(t=>!bad.test(t)),initial.join(' | '));

    const before=await page.locator('[data-v209-card]').count();
    const more=page.locator('[data-v2078-load-more]');
    const visible=await more.isVisible().catch(()=>false);check('more_visible',visible,'hidden');
    if(visible){await more.click({timeout:5000});await page.waitForFunction(n=>document.querySelectorAll('[data-v209-card]').length>n,before,{timeout:10000}).catch(()=>{})}
    const after=await page.locator('[data-v209-card]').count();
    const afterTitles=await page.locator('[data-v209-card] h3').allTextContents();
    report.evidence.shoes.showMore={before,after,titles:afterTitles.slice(0,30)};
    check('more_increases_cards',after>before,`${before}->${after}`);
    check('deep_shoes_clean',afterTitles.every(t=>!bad.test(t)),afterTitles.join(' | '));

    for(const seller of expected){
      await page.locator('[data-filter-merchant]').selectOption({label:seller},{timeout:5000});
      await page.waitForFunction(s=>{const a=[...document.querySelectorAll('[data-v209-card]')];return a.length&&a.every(x=>x.getAttribute('data-v209-seller')===s)},seller,{timeout:8000}).catch(()=>{});
      const names=await page.locator('[data-v209-card]').evaluateAll(a=>a.map(x=>x.getAttribute('data-v209-seller')));
      check(`seller_${seller.replace(/\W+/g,'_')}`,names.length>0&&names.every(x=>x===seller),names.join(', '));
    }

    await page.goto(`${BASE}/find/?q=popular%20products&engine=v2064&universal=1&ui=2130`,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(5000);
    const popularCount=await page.locator('[data-v209-card]').count();
    const popular=await page.locator('[data-filter-merchant] option').allTextContents();
    report.evidence.popular={cardCount:popularCount,sellers:popular};
    check('popular_products_render',popularCount>=8,`cards=${popularCount}`);
    check('popular_has_broad_seller_set',popular.length>=10,popular.join(', '));
    check('popular_key_sellers',['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying'].every(x=>popular.includes(x)),popular.join(', '));
    check('popular_no_blocked_sellers',!popular.some(x=>/^(?:Temu|Joom|FilamentPRO)$/i.test(x)),popular.join(', '));
    const snap=JSON.stringify(popular);await page.waitForTimeout(800);check('popular_sellers_stable',JSON.stringify(await page.locator('[data-filter-merchant] option').allTextContents())===snap,'seller options changed');
  }
  check('no_page_errors',pageErrors.length===0,pageErrors.join(' | '));
  report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);
  await page.screenshot({path:path.join(OUT,'mobile.png'),fullPage:false,timeout:5000}).catch(()=>{});
} catch(e){report.failures.push({name:'exception',detail:String(e?.stack||e)});report.passed=false}
finally{clearTimeout(hardExit);await safeClose();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2));
process.exit(report.passed?0:1);
