import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const html=`<!doctype html><html><body>
<article class="tp214-deal"><a id="image" href="/deal/?id=abc">Product image</a><a id="check" href="https://rzekl.com/g/test" rel="nofollow sponsored">Check price</a></article>
<section class="detail"><a id="buy" href="https://www.aliexpress.com/item/123.html" rel="nofollow sponsored">Check deal at AliExpress</a></section>
<footer><a id="docs" href="https://example.org/help">External documentation</a></footer>
</body></html>`;
const {window}=parseHTML(html);const {document}=window;
const store=new Map();
const storage={setItem(k,v){store.set(k,String(v))},getItem(k){return store.get(k)||null},removeItem(k){store.delete(k)}};
const ctx={window,document,console,URL,Math,Date,setTimeout,clearTimeout,MutationObserver:window.MutationObserver,HTMLAnchorElement:window.HTMLAnchorElement,Element:window.Element,Document:window.Document,location:{origin:'https://trendpilotchoice.com',href:'https://trendpilotchoice.com/deals/',pathname:'/deals/',search:''},localStorage:storage,sessionStorage:storage};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/seller-handoff-v21-15.js','utf8'),ctx,{filename:'seller-handoff-v21-15.js'});
document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise(r=>setTimeout(r,15));

const check=document.querySelector('#check'),buy=document.querySelector('#buy'),docs=document.querySelector('#docs');
const failures=[];const ok=(name,v,detail='')=>{if(!v)failures.push({name,detail})};
ok('listing_check_price_goes_to_internal_detail',check.getAttribute('href')==='/deal/?id=abc',check.getAttribute('href'));
ok('listing_check_price_label_becomes_view_details',/View details/i.test(check.textContent),check.textContent);
ok('detail_seller_cta_goes_to_handoff',String(buy.getAttribute('href')||'').startsWith('/handoff/?k='),buy.getAttribute('href'));
ok('non_commerce_external_link_untouched',docs.getAttribute('href')==='https://example.org/help',docs.getAttribute('href'));
ok('handoff_payload_preserves_affiliate_url',[...store.values()].some(v=>String(v).includes('aliexpress.com/item/123.html')),'payload missing');
const result={version:'21.15.0',passed:failures.length===0,checkHref:check.getAttribute('href'),buyHref:buy.getAttribute('href'),failures};
console.log(JSON.stringify(result,null,2));
process.exit(result.passed?0:1);
