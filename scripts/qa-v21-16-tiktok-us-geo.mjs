import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const edgeSource=await fs.readFile('netlify/edge-functions/geo-bootstrap.js','utf8');
const dataUrl='data:text/javascript;base64,'+Buffer.from(edgeSource).toString('base64');
const edge=await import(dataUrl);

async function edgeJS(code){
  const res=await edge.default(new Request('https://trendpilotchoice.com/geo-bootstrap.js'),{geo:{country:code?{code}:null}});
  return await res.text();
}
const us=await edgeJS('US'),om=await edgeJS('OM'),unknown=await edgeJS('');
assert.match(us,/__TP_VISITOR_COUNTRY__="US"/);assert.match(us,/__TP_ALLOW_TIKTOK_US__=true/);
assert.match(om,/__TP_VISITOR_COUNTRY__="OM"/);assert.match(om,/__TP_ALLOW_TIKTOK_US__=false/);
assert.match(unknown,/__TP_VISITOR_COUNTRY__="ZZ"/);assert.match(unknown,/__TP_ALLOW_TIKTOK_US__=false/);

const runtime=await fs.readFile('js/tiktok-us-geo-v21-16.js','utf8');
async function domCase(allow,country){
  const dom=new JSDOM(`<!doctype html><html><head></head><body><main><select data-filter-merchant><option value="">All sellers</option><option>TikTok Shop US</option><option>AliExpress</option></select><div data-v2078-product-grid><article class="tp78-card" data-v209-seller="TikTok Shop US"><a href="https://www.tiktok.com/view/product/123">TikTok item</a></article><article class="tp78-card" data-v209-seller="AliExpress"><a href="/item/?id=abc">Ali item</a></article></div></main></body></html>`,{url:'https://trendpilotchoice.com/find/?q=shoes',runScripts:'outside-only'});
  dom.window.__TP_ALLOW_TIKTOK_US__=allow;dom.window.__TP_VISITOR_COUNTRY__=country;
  dom.window.eval(runtime);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise(r=>setTimeout(r,10));
  return dom;
}
const omDom=await domCase(false,'OM');
assert.equal(omDom.window.document.querySelectorAll('.tp78-card').length,1);
assert.equal([...omDom.window.document.querySelectorAll('option')].some(o=>/TikTok/i.test(o.textContent)),false);
const usDom=await domCase(true,'US');
assert.equal(usDom.window.document.querySelectorAll('.tp78-card').length,2);
assert.equal([...usDom.window.document.querySelectorAll('option')].some(o=>/TikTok/i.test(o.textContent)),true);
assert.ok(usDom.window.document.querySelector('[data-tp-us-only]'));

const packed=await fs.readFile('js/packed-browse-v21-13-8.js','utf8');
assert.match(packed,/sellerAllowed/);assert.match(packed,/__TP_ALLOW_TIKTOK_US__/);
const compare=await fs.readFile('js/compare-v20-9.js','utf8');
assert.match(compare,/sellerAllowed/);assert.match(compare,/TikTok\\s\*Shop\\s\*US/);
const productPreview=await fs.readFile('netlify/functions/product-preview-v20-9-6-mobile-polish.cjs','utf8');
assert.match(productPreview,/geo-bootstrap\.js\?v=21\.16\.0/);assert.match(productPreview,/tiktok-us-geo-v21-16\.js\?v=21\.16\.0/);
const browse=JSON.parse(await fs.readFile('data/v20-9/seller-browse-samples.json','utf8'));
assert.ok(Object.keys(browse.sellers||{}).some(s=>/^TikTok Shop US$/i.test(s)),'TikTok must remain in imported catalogue; geo is display-time only');

const core=['index.html','find/index.html','compare/index.html','deals/index.html','rare-used/index.html','tickets/index.html','products/index.html','price-watch/index.html','guides/index.html','sourcing/index.html','wholesale/index.html','software/index.html','deal/index.html','coupon/index.html','handoff/index.html'];
for(const file of core){const html=await fs.readFile(file,'utf8');assert.match(html,/geo-bootstrap\.js\?v=21\.16\.0/,`${file}: geo bootstrap missing`);assert.match(html,/tiktok-us-geo-v21-16\.js\?v=21\.16\.0/,`${file}: geo runtime missing`)}

const report={version:'21.16.0',passed:true,checks:{edgeUS:true,edgeOM:true,edgeUnknownFailClosed:true,domNonUSRemovesTikTok:true,domUSKeepsTikTok:true,packedFinderGeoAware:true,compareGeoAware:true,dynamicProductGeoAware:true,catalogueImportPreserved:true,coreRoutesWired:true}};
await fs.mkdir('artifacts/v21-16-tiktok-geo',{recursive:true});
await fs.writeFile('artifacts/v21-16-tiktok-geo/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
