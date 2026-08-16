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
const deadline=setTimeout(async()=>{try{await browser?.close()}catch{};report.failures.push({name:'global_timeout',detail:'QA exceeded 75 seconds'});fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));process.exit(2)},75000);

try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  page.setDefaultTimeout(12000);

  await page.goto(`${BASE}/find/?q=shoes&engine=v2064&universal=1&ui=2130`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-v209-card]').length>=3,{timeout:15000});
  const idx=await page.evaluate(v=>fetch(`/data/v20-9/footwear-seller-samples.json?v=${v}`,{cache:'reload'}).then(r=>r.json()),VERSION);
  const expected=Object.keys(idx.sellers||{}).sort();
  const options=await page.locator('[data-filter-merchant] option').allTextContents();
  const initial=await page.locator('[data-v209-card] h3').allTextContents();
  report.evidence.shoes={indexVersion:idx.version,expected,options,initialCount:initial.length,initial:initial.slice(0,12)};
  check('index_version',idx.version===VERSION,idx.version);
  check('verified_seller_options_match',JSON.stringify(options.slice(1).sort())===JSON.stringify(expected),JSON.stringify({options,expected}));
  check('verified_sellers_include_aliexpress_tiktok',expected.includes('AliExpress')&&expected.includes('TikTok Shop US'),expected.join(', '));
  check('alibaba_not_invented_without_strict_inventory',!expected.includes('Alibaba'),expected.join(', '));
  check('initial_shoes_clean',initial.length>=3&&initial.every(t=>!bad.test(t)),initial.join(' | '));

  const before=await page.locator('[data-v209-card]').count();
  const more=page.locator('[data-v2078-load-more]');
  check('more_visible',await more.isVisible().catch(()=>false),'hidden');
  if(await more.isVisible().catch(()=>false)){
    await more.click({timeout:7000});
    await page.waitForFunction(n=>document.querySelectorAll('[data-v209-card]').length>n,before,{timeout:15000});
  }
  const after=await page.locator('[data-v209-card]').count();
  const afterTitles=await page.locator('[data-v209-card] h3').allTextContents();
  report.evidence.shoes.showMore={before,after,titles:afterTitles.slice(0,30)};
  check('more_increases_cards',after>before,`${before}->${after}`);
  check('deep_shoes_clean',afterTitles.every(t=>!bad.test(t)),afterTitles.join(' | '));

  for(const seller of expected){
    await page.locator('[data-filter-merchant]').selectOption({label:seller});
    await page.waitForFunction(s=>{const a=[...document.querySelectorAll('[data-v209-card]')];return a.length&&a.every(x=>x.getAttribute('data-v209-seller')===s)},seller,{timeout:12000});
    const names=await page.locator('[data-v209-card]').evaluateAll(a=>a.map(x=>x.getAttribute('data-v209-seller')));
    check(`seller_${seller.replace(/\W+/g,'_')}`,names.length>0&&names.every(x=>x===seller),names.join(', '));
  }

  await page.goto(`${BASE}/find/?q=popular%20products&engine=v2064&universal=1&ui=2130`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-v209-card]').length>=8,{timeout:15000});
  const popular=await page.locator('[data-filter-merchant] option').allTextContents();
  report.evidence.popularSellers=popular;
  check('popular_has_broad_seller_set',popular.length>=10,popular.join(', '));
  check('popular_key_sellers', ['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying'].every(x=>popular.includes(x)),popular.join(', '));
  check('popular_no_blocked_sellers',!popular.some(x=>/^(?:Temu|Joom|FilamentPRO)$/i.test(x)),popular.join(', '));
  await page.waitForTimeout(1000);
  check('popular_sellers_stable',JSON.stringify(await page.locator('[data-filter-merchant] option').allTextContents())===JSON.stringify(popular),'seller options changed after render');

  report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);
  await page.screenshot({path:path.join(OUT,'mobile.png'),fullPage:false,timeout:8000}).catch(()=>{});
} catch(e){
  report.failures.push({name:'exception',detail:String(e?.stack||e)});
  report.passed=false;
} finally {
  clearTimeout(deadline);
  try{await browser?.close()}catch{}
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));
process.exit(report.passed?0:1);
