import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT=path.resolve('artifacts/v21-13-8-packed-browse');
fs.mkdirSync(OUT,{recursive:true});
const report={version:'21.13.8',passed:false,checks:{},failures:[],evidence:{}};
const check=(name,ok,detail='')=>{report.checks[name]=!!ok;if(!ok)report.failures.push({name,detail:String(detail)})};
const BAD=/(?:cosplay|costume|snow\s*blower|skid\s*(?:plate|shoe)|flooring\s*installation|epoxy\s*shoe|temperature\s*control\s*iron|bunion|toe\s*(?:separator|corrector)|labubu|doll\s*(?:clothes|shoes)|pet\s*(?:shoes|bed|house)|dog\s*(?:boots|shoes|booties)|cleaning\s*cream|shoe\s*(?:cleaner|rack|bag|box|cover|accessor|machine|making|repair|glue|charm|clip|buckle|pendant)|boot\s*cut|bootcut|baggy\s*jeans|straight\s*jeans|phone\s*case|airpods?|cold\s*shoe|hot\s*shoe|bottle\s*opener|wine\s*rack|anti-clog|clog\s*remover|brake\s*shoe|medical\s*boot|walking\s*boot\s*brace|christmas|xmas)/i;
let browser;
const timer=setTimeout(()=>process.exit(124),55000);
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.setDefaultTimeout(10000);
  await page.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));

  await page.goto(`${BASE}/find/?q=shoes&engine=v2064&universal=1&ui=2138`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.__TP_PACKED_BROWSE__?.ready===true,{timeout:12000});
  const runtime=await page.evaluate(()=>window.__TP_PACKED_BROWSE__);
  const initialCount=await page.locator('[data-v209-card]').count();
  const initialTitles=await page.locator('[data-v209-card] h3').allTextContents();
  const shoeOptions=await page.locator('[data-filter-merchant] option').allTextContents();
  report.evidence.shoes={runtime,initialCount,shoeOptions,initialTitles:initialTitles.slice(0,30)};
  check('packed_runtime_ready',runtime?.version==='21.13.8'&&runtime?.mode==='footwear',JSON.stringify(runtime));
  check('shoes_initial_cards',initialCount>=20,`count=${initialCount}`);
  check('shoes_clean',initialTitles.length===initialCount&&initialTitles.every(t=>!BAD.test(t)),initialTitles.join(' | '));
  check('shoes_sellers_stable',JSON.stringify(shoeOptions)===JSON.stringify(['All sellers','AliExpress','TikTok Shop US']),JSON.stringify(shoeOptions));
  check('shoes_no_fake_alibaba',!shoeOptions.includes('Alibaba'),JSON.stringify(shoeOptions));

  const more=page.locator('[data-v2078-load-more]');
  check('more_visible',await more.isVisible().catch(()=>false),'not visible');
  const before=initialCount;
  if(await more.isVisible().catch(()=>false)) await more.click();
  await page.waitForFunction(n=>document.querySelectorAll('[data-v209-card]').length>n,before,{timeout:5000});
  const after=await page.locator('[data-v209-card]').count();
  const afterTitles=await page.locator('[data-v209-card] h3').allTextContents();
  report.evidence.showMore={before,after};
  check('more_adds_products',after>before,`${before}->${after}`);
  check('deep_shoes_clean',afterTitles.every(t=>!BAD.test(t)),afterTitles.join(' | '));

  for(const seller of ['AliExpress','TikTok Shop US']){
    await page.locator('[data-filter-merchant]').selectOption({label:seller});
    await page.waitForTimeout(100);
    const names=await page.locator('[data-v209-card]').evaluateAll(a=>a.map(x=>x.getAttribute('data-v209-seller')));
    check(`filter_${seller.replace(/\W+/g,'_')}`,names.length>0&&names.every(x=>x===seller),names.join(', '));
  }

  await page.goto(`${BASE}/find/?q=popular%20products&engine=v2064&universal=1&ui=2138`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.__TP_PACKED_BROWSE__?.ready===true,{timeout:12000});
  const popularRuntime=await page.evaluate(()=>window.__TP_PACKED_BROWSE__);
  const popularOptions=await page.locator('[data-filter-merchant] option').allTextContents();
  const popularCards=await page.locator('[data-v209-card]').count();
  report.evidence.popular={runtime:popularRuntime,popularOptions,popularCards};
  check('popular_packed_runtime',popularRuntime?.mode==='broad',JSON.stringify(popularRuntime));
  check('popular_cards',popularCards>=20,`count=${popularCards}`);
  check('popular_many_sellers',popularOptions.length>=10,JSON.stringify(popularOptions));
  check('popular_key_sellers',['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying'].every(s=>popularOptions.includes(s)),JSON.stringify(popularOptions));
  check('popular_blocked_absent',!popularOptions.some(s=>/^(?:Temu|Joom|FilamentPRO)$/i.test(s)),JSON.stringify(popularOptions));
  const snapshot=JSON.stringify(popularOptions);await page.waitForTimeout(500);check('popular_sellers_do_not_change',JSON.stringify(await page.locator('[data-filter-merchant] option').allTextContents())===snapshot,'changed after render');
  check('no_page_errors',errors.length===0,errors.join(' | '));
  report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);
  await page.screenshot({path:path.join(OUT,'mobile-popular.png'),fullPage:false,timeout:5000}).catch(()=>{});
}catch(e){report.failures.push({name:'exception',detail:String(e?.stack||e)});report.passed=false}
finally{clearTimeout(timer);try{await Promise.race([browser?.close(),new Promise(r=>setTimeout(r,2000))])}catch{};fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2));
process.exit(report.passed?0:1);
