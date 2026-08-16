import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const html=`<!doctype html><html><body>
<form data-deals-form><input data-deals-search><button>go</button></form>
<button data-deals-cat="all" class="is-active">All</button><button data-deals-cat="toys">Toys</button><button data-deals-cat="shoes">Shoes</button>
<select data-deals-sort><option value="best">Best</option><option value="discount">Discount</option><option value="low">Low</option><option value="ending">Ending</option></select>
<select data-coupon-country><option value="GLOBAL">Global</option><option value="OM">OM</option><option value="ALL">All</option></select>
<select data-coupon-language><option value="en">English</option><option value="all">All</option></select>
<div data-stat-deals></div><div data-stat-coupons></div><div data-stat-sellers></div><h2 data-deals-context></h2>
<div data-tp-deal-products></div><button data-deals-more hidden></button><div data-tp-coupon-grid></div><button data-coupon-toggle hidden></button>
</body></html>`;
const {window}=parseHTML(html);const {document}=window;
const ctx={window,document,console,URL,URLSearchParams,Response,Intl,Date,setTimeout,clearTimeout};
ctx.location={href:'https://trendpilotchoice.com/deals/',search:''};ctx.history={replaceState(){}};ctx.navigator={clipboard:{writeText:async()=>{}}};ctx.Event=window.Event;
const browse=JSON.parse(fs.readFileSync('data/v20-9/seller-browse-samples.json','utf8'));
ctx.fetch=async()=>new Response(JSON.stringify(browse),{status:200,headers:{'content-type':'application/json'}});
vm.createContext(ctx);
for(const f of ['js/matched-products.js','js/coupons-data.js','js/deals-revenue-v21-14.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise(r=>setTimeout(r,30));
const failures=[];const ok=(name,v,detail='')=>{if(!v)failures.push({name,detail});};
const qs=s=>document.querySelector(s),qsa=s=>[...document.querySelectorAll(s)];
ok('initial_deals_present',qsa('.tp214-deal').length>0,`count=${qsa('.tp214-deal').length}`);
ok('initial_coupons_present',qsa('.tp214-coupon').length>0,`count=${qsa('.tp214-coupon').length}`);
ok('coupon_visuals_present',qsa('.tp214-coupon-media').length===qsa('.tp214-coupon').length,`media=${qsa('.tp214-coupon-media').length} coupons=${qsa('.tp214-coupon').length}`);
ok('coupon_images_use_https',qsa('[data-coupon-img]').every(img=>String(img.getAttribute('src')||'').startsWith('https://')),'non-HTTPS coupon image found');
ok('deal_clicks_stay_internal',qsa('.tp214-deal a').some(a=>String(a.getAttribute('href')||'').startsWith('/deal/?id=')),'no internal deal detail link');
ok('coupon_clicks_stay_internal',qsa('.tp214-coupon a').every(a=>String(a.getAttribute('href')||'').startsWith('/coupon/?id=')),'coupon listing has non-internal CTA');
ok('blocked_sellers_absent',!document.body.textContent.match(/\b(?:Temu|Joom|FilamentPRO)\b/i),'blocked seller text present');
const input=qs('[data-deals-search]');input.value='toys';qs('[data-deals-form]').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
ok('toys_never_dead_ends',qsa('.tp214-deal').length>0||!!qs('[data-tp-deal-products] a[href^="/find/?q="]'),qs('[data-tp-deal-products]').textContent.slice(0,300));
ok('toys_coupon_fallback',qsa('.tp214-coupon').length>0,qs('[data-tp-coupon-grid]').textContent.slice(0,300));
ok('toys_coupon_internal_only',qsa('.tp214-coupon a').every(a=>String(a.getAttribute('href')||'').startsWith('/coupon/?id=')),'external coupon CTA found');
const codeButtons=qsa('[data-copy-code]');ok('coupon_copy_supported',codeButtons.length>0||qsa('.tp214-coupon').some(c=>/No code needed/.test(c.textContent)),'no usable coupon UI');
const before=qsa('.tp214-deal').length;if(!qs('[data-deals-more]').hidden){qs('[data-deals-more]').dispatchEvent(new window.Event('click',{bubbles:true}));await new Promise(r=>setTimeout(r,10));ok('show_more_increases_deals',qsa('.tp214-deal').length>before,`${before}->${qsa('.tp214-deal').length}`)}

const css=fs.readFileSync('css/deals-revenue-v21-14.css','utf8');
ok('detail_h1_dark',/\.tp214-detail-card h1\{[^}]*color:#0c1729!important/.test(css),'detail h1 dark override missing');
ok('detail_rules_readable',/\.tp214-rules\{[^}]*color:#334155!important/.test(css),'rules contrast override missing');
ok('coupon_media_css',css.includes('.tp214-coupon-media{'),'coupon media CSS missing');

const couponData=ctx.window.TREND_PILOT_COUPONS?.coupons||[];const coupon=couponData.find(c=>c.image)||couponData[0];
if(coupon){
  const parsed=parseHTML('<!doctype html><html><body><div data-coupon-detail></div></body></html>');
  const cctx={window:parsed.window,document:parsed.document,console,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,navigator:{clipboard:{writeText:async()=>{}}}};
  cctx.window.TREND_PILOT_COUPONS=ctx.window.TREND_PILOT_COUPONS;cctx.location={search:`?id=${encodeURIComponent(coupon.id)}`,href:`https://trendpilotchoice.com/coupon/?id=${encodeURIComponent(coupon.id)}`};cctx.document.title='';
  vm.createContext(cctx);vm.runInContext(fs.readFileSync('js/coupon-detail-v21-14.js','utf8'),cctx,{filename:'js/coupon-detail-v21-14.js'});cctx.document.dispatchEvent(new parsed.window.Event('DOMContentLoaded'));
  const detailImg=cctx.document.querySelector('[data-coupon-detail-img]');
  ok('coupon_detail_visual',!!cctx.document.querySelector('.tp214-coupon-brand'),'coupon detail brand visual missing');
  if(detailImg)ok('coupon_detail_image_https',String(detailImg.getAttribute('src')||'').startsWith('https://'),detailImg.getAttribute('src')||'');
}

const result={version:'21.14.1',passed:failures.length===0,checks:{initialDeals:qsa('.tp214-deal').length,initialCoupons:qsa('.tp214-coupon').length,toysContext:qs('[data-deals-context]').textContent,couponImages:qsa('[data-coupon-img]').length},failures};
fs.mkdirSync('artifacts/v21-14-savings-hub',{recursive:true});fs.writeFileSync('artifacts/v21-14-savings-hub/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exit(result.passed?0:1);