import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT=path.resolve('artifacts/v21-13-finder');
fs.mkdirSync(OUT,{recursive:true});
const report={version:'21.13.2',base:BASE,passed:false,checks:{},failures:[],evidence:{}};
const check=(name,ok,detail='')=>{report.checks[name]=!!ok;if(!ok)report.failures.push({name,detail:String(detail)})};
const blocked=/\b(?:Temu|Joom|FilamentPRO)\b/i;
const badFoot=/(?:cosplay|costume|snow\s*blower|skid\s*(?:plate|shoe)|flooring\s*installation|epoxy\s*shoe|temperature\s*control\s*iron|shoe\s*(?:rack|bag|box|cover|accessor|machine|making|repair|glue|charm|clip|buckle)|brake\s*shoe|trunk\s*boot|steering\s*boot|tie\s*rod\s*boot|shock\s*boot|fall\s*management|therapy\s*foot|pain\s*relief\s*slipper|medical\s*boot|walking\s*boot\s*brace)/i;
const goodFoot=/\b(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|moccasin|moccasins|oxford|oxfords|cleat|cleats|footwear|clog|clogs|flip[- ]?flop|ballet shoe|running shoe|walking shoe|work boot|hiking boot|high[- ]?heel|heeled shoe|heeled sandal|heeled boot)\b/i;

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
page.setDefaultTimeout(30000);
const consoleErrors=[]; const pageErrors=[]; const failedRequests=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e)));
page.on('requestfailed',r=>failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||''}`));

async function waitCards(min=1){
  await page.waitForFunction(n=>document.querySelectorAll('[data-v209-card]').length>=n,min,{timeout:45000});
}
async function sellers(){return page.locator('[data-filter-merchant] option').allTextContents()}
async function titles(){return page.locator('[data-v209-card] h3').allTextContents()}
async function cards(){return page.locator('[data-v209-card]').count()}

try{
  await page.goto(`${BASE}/find/?q=shoes&engine=v2064&universal=1&ui=2130`,{waitUntil:'domcontentloaded',timeout:60000});
  await waitCards(3);
  await page.waitForTimeout(800);
  const shoeSellers=await sellers();
  report.evidence.shoeSellers=shoeSellers;
  const expected=['Alibaba','AliExpress','TikTok Shop US'];
  check('shoes_seller_options_exact',JSON.stringify(shoeSellers.slice(1).sort())===JSON.stringify(expected.slice().sort()),`actual=${JSON.stringify(shoeSellers)}`);
  check('shoes_no_blocked_seller_option',!shoeSellers.some(x=>blocked.test(x)),shoeSellers.join(', '));
  check('shoes_no_medical_seller_option',!shoeSellers.includes('MFI Medical'),shoeSellers.join(', '));

  const firstTitles=await titles();
  report.evidence.shoeTitlesInitial=firstTitles;
  check('shoes_initial_all_look_like_footwear',firstTitles.length>=3&&firstTitles.every(t=>goodFoot.test(t)&&!badFoot.test(t)),firstTitles.join(' | '));

  const before=await cards();
  const more=page.locator('[data-v2078-load-more]');
  check('show_more_visible_before_click',await more.isVisible().catch(()=>false),'button hidden');
  if(await more.isVisible().catch(()=>false)){
    await more.click();
    await page.waitForFunction(n=>document.querySelectorAll('[data-v209-card]').length>n,before,{timeout:45000}).catch(()=>{});
  }
  const after=await cards();
  report.evidence.showMore={before,after};
  check('show_more_increases_visible_cards',after>before,`before=${before} after=${after}`);
  const deepTitles=await titles();
  report.evidence.shoeTitlesAfterMore=deepTitles;
  check('shoes_deep_results_all_look_like_footwear',deepTitles.length>=after&&deepTitles.every(t=>goodFoot.test(t)&&!badFoot.test(t)),deepTitles.join(' | '));

  for(const seller of expected){
    await page.locator('[data-filter-merchant]').selectOption({label:seller});
    await page.waitForTimeout(500);
    await waitCards(1);
    const sellerNames=await page.locator('[data-v209-card]').evaluateAll(els=>els.map(e=>e.getAttribute('data-v209-seller')||''));
    const sellerTitles=await titles();
    report.evidence[`seller_${seller}`]={count:sellerNames.length,titles:sellerTitles.slice(0,8)};
    check(`seller_filter_${seller.replace(/\W+/g,'_')}`,sellerNames.length>0&&sellerNames.every(x=>x===seller),sellerNames.join(', '));
    check(`seller_filter_${seller.replace(/\W+/g,'_')}_footwear`,sellerTitles.every(t=>goodFoot.test(t)&&!badFoot.test(t)),sellerTitles.join(' | '));
  }
  await page.locator('[data-filter-merchant]').selectOption('');

  await page.goto(`${BASE}/find/?q=popular%20products&engine=v2064&universal=1&ui=2130`,{waitUntil:'domcontentloaded',timeout:60000});
  await waitCards(8);
  await page.waitForTimeout(800);
  const popularSellers=await sellers();
  report.evidence.popularSellers=popularSellers;
  const popularRequired=['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying'];
  check('popular_products_has_broad_seller_universe',popularSellers.length>=10,`options=${JSON.stringify(popularSellers)}`);
  check('popular_products_key_sellers_present',popularRequired.every(x=>popularSellers.includes(x)),`options=${JSON.stringify(popularSellers)}`);
  check('popular_products_no_blocked_sellers',!popularSellers.some(x=>blocked.test(x)),popularSellers.join(', '));
  const snap=JSON.stringify(popularSellers);
  await page.waitForTimeout(2200);
  check('popular_products_seller_options_stable',JSON.stringify(await sellers())===snap,`before=${snap} after=${JSON.stringify(await sellers())}`);

  check('no_page_errors',pageErrors.length===0,pageErrors.join(' | '));
  check('no_critical_console_errors',!consoleErrors.some(x=>/uncaught|syntaxerror|referenceerror|typeerror/i.test(x)),consoleErrors.join(' | '));
  check('no_failed_core_requests',!failedRequests.some(x=>/\/find\/|universal-discovery-v20-9-1\.js|footwear-seller-samples\.json|seller-browse-samples\.json/i.test(x)),failedRequests.join(' | '));
} catch(e){
  report.failures.push({name:'qa_exception',detail:String(e?.stack||e)});
} finally {
  report.evidence.consoleErrors=consoleErrors;
  report.evidence.pageErrors=pageErrors;
  report.evidence.failedRequests=failedRequests;
  report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(OUT,'final-mobile.png'),fullPage:true}).catch(()=>{});
  await browser.close();
}

console.log(JSON.stringify({passed:report.passed,checks:report.checks,failures:report.failures,evidence:{shoeSellers:report.evidence.shoeSellers,showMore:report.evidence.showMore,popularSellers:report.evidence.popularSellers}},null,2));
process.exit(report.passed?0:1);
