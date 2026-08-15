import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/v21-12-search-matrix';await fs.mkdir(OUT,{recursive:true});
const blocked=/\b(?:Temu|Joom|FilamentPRO)\b/i;
const badAccessory=/\b(?:case|cover|protector|tempered glass|holder|mount|stand|strap|lanyard|charger|charging cable|usb cable|replacement|spare part|repair|screen|digitizer|battery for|tool kit|shoe rack|shoe bag|shoelace|insole)\b/i;
const cases=[
  {q:'shoes',good:/\b(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels)\b/i,min:.65},
  {q:'phone',good:/\b(?:smartphone|mobile phone|cell phone|iphone|galaxy|pixel|redmi|oneplus|poco|honor|huawei|oppo|vivo|realme|motorola|moto|nokia|zte|nubia|doogee|oukitel|ulefone|blackview|cubot|umidigi)\b/i,min:.65},
  {q:'laptop',good:/\b(?:laptop|chromebook|notebook computer|macbook|thinkpad|ideapad|thinkbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop)\b/i,min:.65},
  {q:'MacBook',good:/\bmacbook\b/i,min:.8},
  {q:'headphones',good:/\b(?:headphone|headphones|headset|headsets|earbud|earbuds|earphone|earphones|airpods|tws)\b/i,min:.7},
  {q:'smartwatch',good:/\b(?:smartwatch|smart watch|apple watch)\b/i,min:.7},
  {q:'perfume',good:/\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i,min:.7},
  {q:'power bank',good:/\b(?:power bank|powerbank|portable charger)\b/i,min:.7},
  {q:'air conditioner',good:/\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i,min:.6},
  {q:'dog food',good:/\b(?:dog food|pet food|dog kibble)\b/i,min:.6,bad:/\b(?:machine|manufacturing|production line|packaging machine|mold)\b/i},
  {q:'tools',good:/\b(?:tool|tools|drill|saw|grinder|screwdriver|wrench|pliers|multimeter|soldering)\b/i,min:.55}
];
const report={version:'21.12.0',cases:[],checks:{},failures:[],passed:false};
const ck=(n,ok,d='')=>{report.checks[n]=!!ok;if(!ok)report.failures.push({name:n,detail:String(d)});};
const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});const page=await ctx.newPage();page.setDefaultTimeout(30000);
for(const c of cases){
  const path=`/find/?q=${encodeURIComponent(c.q)}&engine=v2064`;
  let loaded=true;try{await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>document.querySelectorAll('.tp78-card').length>0,{timeout:30000})}catch{loaded=false}
  const titles=loaded?(await page.locator('.tp78-card h3').allTextContents()).slice(0,12).map(x=>x.replace(/\s+/g,' ').trim()):[];
  const good=titles.filter(t=>c.good.test(t)&&!badAccessory.test(t)&&!(c.bad&&c.bad.test(t)));
  const ratio=titles.length?good.length/titles.length:0;const sellerText=loaded?(await page.locator('.tp78-card').allTextContents()).join(' '):'';
  report.cases.push({q:c.q,loaded,count:titles.length,good:good.length,ratio,titles});
  ck(`query_${c.q.replace(/\W+/g,'_').toLowerCase()}_returns`,loaded&&titles.length>0,JSON.stringify(titles));
  ck(`query_${c.q.replace(/\W+/g,'_').toLowerCase()}_purity`,ratio>=c.min,JSON.stringify({ratio,min:c.min,titles}));
  ck(`query_${c.q.replace(/\W+/g,'_').toLowerCase()}_no_blocked_seller`,!blocked.test(sellerText),sellerText.match(blocked)?.[0]||'');
}
// Prefix autocomplete and seller/sort controls.
await page.goto(`${BASE}/find/`,{waitUntil:'domcontentloaded'});const input=page.locator('[data-tp-finder-input]');for(const [prefix,target] of [['p','phone'],['sho','shoes'],['lap','laptop'],['per','perfume']]){await input.fill(prefix);await page.waitForTimeout(700);const vals=(await page.locator('.tp-v20-suggest .tp-amazon-row b').allTextContents()).map(x=>x.trim().toLowerCase());ck(`autocomplete_${prefix}_${target}`,vals.some(v=>v===target||v.startsWith(target)),vals.join(' | '));}
await page.goto(`${BASE}/find/?q=phone&engine=v2064`,{waitUntil:'domcontentloaded'});try{await page.waitForFunction(()=>document.querySelectorAll('.tp78-card').length>0,{timeout:30000})}catch{}
const seller=page.locator('[data-filter-merchant]');if(await seller.count()){const opts=await seller.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:o.textContent.trim()})).filter(x=>x.v));if(opts.length){await seller.selectOption(opts[0].v);await page.waitForTimeout(500);ck('seller_filter_selection_sticks',(await seller.inputValue())===opts[0].v,opts[0].t)}}
const sort=page.locator('[data-filter-sort]');if(await sort.count()){await sort.selectOption('price-low');await page.waitForTimeout(250);ck('sort_selection_sticks',(await sort.inputValue())==='price-low',await sort.inputValue())}
report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failures:report.failures,cases:report.cases.map(x=>({q:x.q,count:x.count,ratio:x.ratio}))},null,2));await browser.close();if(!report.passed)process.exit(1);
