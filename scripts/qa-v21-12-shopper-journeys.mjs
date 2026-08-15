import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/v21-12-journeys';await fs.mkdir(OUT,{recursive:true});
const report={version:'21.12.0',checks:{},failures:[],journeys:{},passed:false};
const ck=(n,ok,d='')=>{report.checks[n]=!!ok;if(!ok)report.failures.push({name:n,detail:String(d)})};
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await ctx.newPage();page.setDefaultTimeout(30000);

// Journey 1: Home -> typed search -> results -> internal product detail -> seller exit.
try{
  await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:90000});
  const q=page.locator('[data-tp-finder-input]').first();await q.fill('phone');await q.press('Enter');await page.waitForURL(u=>u.pathname.startsWith('/find/'),{timeout:30000});
  ck('journey_home_to_search_query_preserved',new URL(page.url()).searchParams.get('q')==='phone',page.url());
  await page.waitForFunction(()=>document.querySelectorAll('.tp78-card').length>0,{timeout:35000});
  const href=await page.locator('.tp78-card a[href*="/item/?id="]').first().getAttribute('href').catch(()=>null);
  ck('journey_search_has_internal_detail',!!href,href||'');
  if(href){await page.goto(new URL(href,BASE).href,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-tp85-detail]:not([hidden])',{timeout:30000});const seller=await page.locator('[data-tp85-seller-link]').getAttribute('href').catch(()=>null);ck('journey_product_has_seller_exit',!!seller&&/^https?:/i.test(seller),seller||'');}
  report.journeys.product={url:page.url()};
}catch(e){ck('journey_home_search_product',false,String(e))}

// Journey 2: Finder UI save/compare actions must change browser state if those controls are present.
try{
  await page.goto(BASE+'/find/?q=phone&engine=v2064',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>document.querySelectorAll('.tp78-card').length>0,{timeout:35000});
  const before=await page.evaluate(()=>({...localStorage}));
  const first=page.locator('.tp78-card').first();
  const save=first.getByRole('button',{name:/save|watch/i}).first();
  if(await save.count()){await save.click();await page.waitForTimeout(250);const after=await page.evaluate(()=>({...localStorage}));ck('journey_save_action_persists_state',JSON.stringify(after)!==JSON.stringify(before),JSON.stringify({before:Object.keys(before),after:Object.keys(after)}));}
  else ck('journey_save_control_present',false,'No Save/Watch control found on a product result card');
  const compare=first.getByRole('button',{name:/compare/i}).first();
  if(await compare.count()){const b=JSON.stringify(await page.evaluate(()=>({...localStorage})));await compare.click();await page.waitForTimeout(250);const a=JSON.stringify(await page.evaluate(()=>({...localStorage})));ck('journey_compare_action_persists_state',a!==b,'Compare did not change local state');}
  else ck('journey_compare_control_present',false,'No Compare control found on a product result card');
}catch(e){ck('journey_save_compare',false,String(e))}

// Journey 3: Rare listing -> maintained detail -> seller exit.
try{
  await page.goto(BASE+'/rare-used/',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>document.querySelectorAll('.tp80-rare-card').length>0,{timeout:30000});
  const href=await page.locator('.tp80-rare-card .tp80-primary').first().getAttribute('href');ck('journey_rare_uses_internal_detail',String(href).startsWith('/rare-used/view/?id='),href||'');
  await page.goto(new URL(href,BASE).href,{waitUntil:'domcontentloaded'});await page.waitForSelector('.tp80-detail-summary',{timeout:30000});const seller=await page.locator('.tp80-seller-exit').getAttribute('href').catch(()=>null);ck('journey_rare_detail_has_seller_exit',!!seller&&/^https?:/i.test(seller),seller||'');
  report.journeys.rare={url:page.url()};
}catch(e){ck('journey_rare',false,String(e))}

// Journey 4: Tickets -> event card -> direct provider exit; no useless internal detail unless facts exist.
try{
  await page.goto(BASE+'/tickets/',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>document.querySelectorAll('.tp-ticket-v141-card').length>0,{timeout:30000});
  const provider=await page.locator('.tp-ticket-v141-card a.primary[target="_blank"]').first().getAttribute('href').catch(()=>null);ck('journey_ticket_has_provider_exit',!!provider&&/^https?:/i.test(provider),provider||'');
  const bad=await page.locator('.tp-ticket-v141-card').evaluateAll(cs=>cs.filter(c=>c.querySelector('a[href^="/ticket/?id="]')&&!c.querySelector('.tp-ticket-v141-facts')).length);ck('journey_ticket_no_empty_internal_detail',bad===0,bad);
}catch(e){ck('journey_tickets',false,String(e))}

// Journey 5: Business sourcing -> wholesale query preservation -> marketplace destination.
try{
  await page.goto(BASE+'/sourcing/',{waitUntil:'domcontentloaded',timeout:90000});const form=page.locator('[data-tp-tool-form]').first();await form.locator('input[name="q"]').fill('power bank');await form.locator('button[type="submit"]').click();await page.waitForURL(u=>u.pathname.startsWith('/wholesale/'),{timeout:15000});ck('journey_sourcing_query_preserved',new URL(page.url()).searchParams.get('q')==='power bank',page.url());await page.waitForFunction(()=>document.querySelectorAll('.tp-wholesale-card').length>0,{timeout:30000});const out=await page.locator('.tp-wholesale-card a.primary[target="_blank"]').first().getAttribute('href').catch(()=>null);ck('journey_wholesale_has_provider_exit',!!out&&/^https?:/i.test(out),out||'');
}catch(e){ck('journey_sourcing',false,String(e))}

// Journey 6: Known production SEO product route remains functional and shopper-readable.
try{
  const path='/product/hot-sale-original-global-official-version-xiaomi-redmi-note-8-48mp-quad-ai-back---d0f4e3ec74717f/';await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:90000});const body=(await page.locator('main').innerText().catch(()=>''));ck('journey_seo_product_route_loads',body.length>120,body.slice(0,120));ck('journey_seo_product_has_seller_section',await page.locator('#seller-offers').count()>0||/seller|provider/i.test(body),body.slice(0,240));
}catch(e){ck('journey_seo_product_route',false,String(e))}

report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:Object.keys(report.checks).length,failures:report.failures},null,2));await browser.close();if(!report.passed)process.exit(1);
