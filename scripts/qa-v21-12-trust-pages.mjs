import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=(process.env.TP_BASE_URL||'https://trendpilotchoice.com').replace(/\/$/,'');
const OUT='artifacts/v21-12-trust';
await fs.mkdir(OUT,{recursive:true});
const pages=['/about.html','/editorial-methodology.html','/how-we-test.html','/affiliate-disclosure.html','/privacy.html','/terms.html','/contact.html','/corrections.html'];
const report={version:'21.12.0',checks:{},failures:[],pages:{},passed:false};
const ck=(n,ok,d='')=>{report.checks[n]=!!ok;if(!ok)report.failures.push({name:n,detail:String(d)})};
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'});
const page=await ctx.newPage();page.setDefaultTimeout(30000);
for(const path of pages){
  const key=path.slice(1).replace(/\.html$/,'').replace(/\W+/g,'_');
  try{await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForSelector('.tp-trust-page');
    const data=await page.evaluate(()=>({headers:document.querySelectorAll('header').length,footers:document.querySelectorAll('footer').length,html:document.documentElement.innerHTML,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,trust:document.body.dataset.tpPage,css:[...document.styleSheets].some(s=>String(s.href||'').includes('trendpilot-v21-2-1-final.css?v=21.12.0')),h1:(document.querySelector('h1')?.textContent||'').trim(),p:(document.querySelector('.tp-trust-page p')?.textContent||'').trim()}));
    report.pages[key]=data;
    ck(`${key}_single_header`,data.headers===1,data.headers);ck(`${key}_single_footer`,data.footers===1,data.footers);ck(`${key}_v21_shell`,data.trust==='trust'&&data.css,JSON.stringify({trust:data.trust,css:data.css}));ck(`${key}_no_old_domain`,!data.html.includes('trendpilot-ai.netlify.app'));ck(`${key}_no_horizontal_overflow`,data.sw<=data.cw+3,`${data.sw}/${data.cw}`);ck(`${key}_meaningful_content`,data.h1.length>12&&data.p.length>40,JSON.stringify({h1:data.h1,p:data.p}));
    if(path==='/contact.html'){ck('contact_form_exists',await page.locator('form[name="contact"]').count()===1);ck('contact_email_field',await page.locator('form[name="contact"] input[type="email"]').count()===1);ck('contact_message_field',await page.locator('form[name="contact"] textarea').count()===1)}
  }catch(e){ck(`${key}_loads`,false,String(e))}
}
const dc=await browser.newContext({viewport:{width:1365,height:900}}),dp=await dc.newPage();
for(const path of ['/editorial-methodology.html','/privacy.html','/contact.html']){const key='desktop_'+path.slice(1).replace(/\.html$/,'').replace(/\W+/g,'_');try{await dp.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:90000});const ok=await dp.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+3);ck(`${key}_no_horizontal_overflow`,ok)}catch(e){ck(`${key}_loads`,false,String(e))}}
await dc.close();
report.passed=report.failures.length===0&&Object.values(report.checks).every(Boolean);await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:Object.keys(report.checks).length,failures:report.failures},null,2));await browser.close();if(!report.passed)process.exit(1);
