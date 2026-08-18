const previous = require("./product-preview-v20-9-6-mobile-polish.cjs");
let reviewData={entries:[]};
try{ reviewData=require("../../data/review-evidence-v21.json"); }catch{}

const VERSION="21.4.0";
const clean=v=>String(v??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>clean(v).toLowerCase().replace(/[®™]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();

function titleFrom(body){return clean((String(body).match(/<main>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||[])[1]||"");}
function reviewFor(body){
  const title=norm(titleFrom(body));
  if(!title)return null;
  return (reviewData.entries||[]).find(e=>[e.model,...(e.aliases||[])].filter(Boolean).map(norm).some(a=>a&&title.includes(a)))||null;
}
function ratingText(s){const r=Number(s?.rating),sc=Number(s?.scale);return Number.isFinite(r)&&Number.isFinite(sc)?`${r%1?r.toFixed(1):r}/${sc}`:"";}
function sourceMeta(s){
  const bits=[]; const r=ratingText(s); if(r)bits.push(r);
  if(Number(s?.review_count)>0)bits.push(`${Number(s.review_count)} reviews`);
  if(s?.type==="professional_review")bits.push("professional test");
  if(s?.relationship==="same_listing")bits.push("same listing");
  else if(s?.relationship==="same_model_variant_differs")bits.push("same model · different configuration");
  else if(s?.relationship==="same_model")bits.push("same model");
  return bits.join(" · ");
}
function facts(body){
  const text=clean(body);
  const exact=/(direct product link|exact seller listing|verified exact price|active exact listing)/i.test(text);
  const price=/(price for this listing|displayed price is tied to the listed product|verified exact price|exact-product price)/i.test(text);
  const generic=/(marketplace search|broader marketplace|exact seller listing not confirmed)/i.test(text);
  let score=35+(exact?30:0)+(price?20:0); if(generic&&!exact)score=Math.min(score,48); score=Math.max(0,Math.min(90,score));
  return {score,level:score>=75?"High":score>=55?"Moderate":"Limited",exact,price};
}
function panel(body){
  if(/tp-prod-confidence/i.test(body))return "";
  const f=facts(body),entry=reviewFor(body),sources=Array.isArray(entry?.sources)?entry.sources:[];
  const same=sources.find(s=>s.relationship==="same_listing"&&Number(s.review_count)>0);
  const headline=same?`${ratingText(same)} from ${same.review_count} ${same.name} reviews`:entry?`${sources.length} exact-model evidence sources`:"Exact-model review research pending";
  const strengths=(entry?.strengths||[]).slice(0,3),cautions=(entry?.cautions||[]).slice(0,3);
  const sourceHtml=sources.length?`<details class="tp-prod-sources"><summary>See ${sources.length} review sources</summary>${sources.map(s=>`<a href="${esc(s.url||"#")}" target="_blank" rel="nofollow noopener"><span><strong>${esc(s.name||"Source")}</strong><small>${esc(sourceMeta(s)||s.note||"Review evidence")}</small></span><b>View ↗</b></a>`).join("")}</details>`:"";
  return `<section class="tp-prod-confidence" data-version="${VERSION}"><div class="tp-prod-top"><div><span>BUYING CONFIDENCE</span><h2>${esc(f.level)} confidence</h2><p>TrendPilot checks product identity, seller destination, price evidence and exact-model review evidence before recommending a purchase route.</p></div><div class="tp-prod-score"><strong>${f.score}</strong><small>/100</small></div></div><div class="tp-prod-grid"><div><b>${f.exact?"✓":"!"} Product route</b><small>${f.exact?"Direct/exact product evidence found":"Confirm the exact item on the seller page"}</small></div><div><b>${f.price?"✓":"!"} Price evidence</b><small>${f.price?"Displayed price is tied to this listing":"Recheck the final seller price"}</small></div><div><b>${entry?"✓":"…"} Review evidence</b><small>${entry?`${esc(entry.review_confidence||"Moderate")} · ${sources.length} sources`:"Exact-model evidence pending"}</small></div></div><div class="tp-prod-review"><div class="tp-prod-review-head"><div><span>REVIEW CONFIDENCE</span><strong>${esc(entry?.review_confidence||"Pending")}</strong></div><p>${esc(headline)}</p></div><p>${esc(entry?.buyer_summary||"TrendPilot will not claim customer satisfaction until review evidence is tied to the exact model.")}</p>${entry?`<div class="tp-prod-cols"><div><h3>What buyers/tests like</h3>${strengths.map(x=>`<p>✓ ${esc(x)}</p>`).join("")}</div><div><h3>Watch-outs</h3>${cautions.map(x=>`<p>• ${esc(x)}</p>`).join("")}</div></div>`:""}${sourceHtml}<p class="tp-prod-policy"><strong>Review policy:</strong> ratings from different products are never merged. Different configurations are labelled separately.</p></div></section>`;
}
function inject(body){
  let out=String(body||""); if(!/<html/i.test(out))return out;
  const p=panel(out); if(!p)return out;
  const css=`<style>.tp-prod-confidence{margin:14px 0 18px;padding:18px;border:1px solid #dfe6ef;border-radius:22px;background:#fff;color:#172033;box-shadow:0 8px 26px rgba(20,31,50,.06)}.tp-prod-top{display:flex;gap:14px;justify-content:space-between}.tp-prod-top span,.tp-prod-review-head span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#667085}.tp-prod-top h2{margin:3px 0 5px;font-size:23px}.tp-prod-top p,.tp-prod-review>p{margin:0;color:#667085;font-size:12px;line-height:1.5}.tp-prod-score{min-width:72px;padding:10px;border-radius:16px;text-align:center;background:#eaf7f1;color:#08765a}.tp-prod-score strong{font-size:26px}.tp-prod-score small{font-weight:800}.tp-prod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}.tp-prod-grid>div,.tp-prod-cols>div{padding:11px;border-radius:14px;background:#f7f9fc}.tp-prod-grid b{display:block;font-size:12px}.tp-prod-grid small{display:block;margin-top:4px;color:#667085;font-size:10.5px;line-height:1.35}.tp-prod-review{margin-top:14px;padding-top:14px;border-top:1px solid #e6eaf0}.tp-prod-review-head{display:flex;justify-content:space-between;gap:12px}.tp-prod-review-head strong{display:block;margin-top:2px;font-size:19px;color:#3157e8}.tp-prod-review-head p{margin:0;max-width:58%;text-align:right;font-size:12px;font-weight:800}.tp-prod-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.tp-prod-cols h3{margin:0 0 5px;font-size:11.5px}.tp-prod-cols p{margin:4px 0;color:#475467;font-size:11px;line-height:1.4}.tp-prod-sources{margin-top:10px}.tp-prod-sources summary{font-size:11.5px;font-weight:900;color:#3157e8}.tp-prod-sources a{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:6px;padding:9px;border:1px solid #e5e9f0;border-radius:11px;color:#172033;text-decoration:none}.tp-prod-sources strong,.tp-prod-sources small{display:block}.tp-prod-sources strong{font-size:11.5px}.tp-prod-sources small{margin-top:2px;font-size:10px;color:#667085}.tp-prod-sources b{font-size:10.5px;color:#3157e8;white-space:nowrap}.tp-prod-policy{margin-top:10px!important;font-size:10px!important}@media(max-width:650px){.tp-prod-confidence{padding:14px}.tp-prod-top h2{font-size:20px}.tp-prod-score{min-width:62px}.tp-prod-grid,.tp-prod-cols{grid-template-columns:1fr}.tp-prod-review-head{display:block}.tp-prod-review-head p{max-width:none;text-align:left;margin-top:5px}}</style>`;
  out=out.replace(/<\/head>/i,`${css}</head>`);
  const about=/<section class="panel about">[\s\S]*?<\/section>/i;
  if(about.test(out))out=out.replace(about,m=>`${m}${p}`); else out=out.replace(/<section id="seller-offers"/i,`${p}<section id="seller-offers"`);
  return out;
}
exports.handler=async function(event,context){
  const res=await previous.handler(event,context);
  const type=String(res?.headers?.["content-type"]||res?.headers?.["Content-Type"]||"");
  if(res?.statusCode===200&&/text\/html/i.test(type)){
    res.body=inject(res.body);
    res.headers={...(res.headers||{}),"x-trendpilot-production-confidence":VERSION,"cache-control":"no-store, max-age=0"};
  }
  return res;
};
