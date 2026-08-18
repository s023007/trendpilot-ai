(()=>{
"use strict";
const VERSION="21.4.1";
const d=document,$=s=>d.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim();
const E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const N=v=>C(v).toLowerCase().replace(/[®™]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const id=C(new URLSearchParams(location.search).get("id")).toLowerCase();
if(!/^[a-f0-9]{14}$/.test(id))return;

function scoreRecord(r,entry){
  const direct=Boolean(r?.x&&r?.u);
  const price=Number(r?.p)>0;
  const seller=Boolean(C(r?.se));
  let score=30;
  if(direct)score+=30;
  if(price)score+=20;
  if(entry)score+=10;
  if(seller)score+=5;
  score=Math.max(0,Math.min(95,score));
  return {score,level:score>=80?"High":score>=60?"Moderate":"Limited",direct,price,seller};
}
function ratingText(s){
  const r=Number(s?.rating),sc=Number(s?.scale);
  return Number.isFinite(r)&&Number.isFinite(sc)?`${r%1?r.toFixed(1):r}/${sc}`:"";
}
function sourceMeta(s){
  const bits=[];const r=ratingText(s);if(r)bits.push(r);
  if(Number(s?.review_count)>0)bits.push(`${Number(s.review_count)} reviews`);
  if(s?.type==="professional_review")bits.push("professional test");
  if(s?.relationship==="same_listing")bits.push("same listing");
  else if(s?.relationship==="same_model_variant_differs")bits.push("same model · different configuration");
  else if(s?.relationship==="same_model")bits.push("same model");
  return bits.join(" · ");
}
async function loadReview(title){
  try{
    const res=await fetch(`/data/review-evidence-v21.json?v=${VERSION}`,{cache:"no-store"});
    if(!res.ok)return null;
    const data=await res.json(),t=N(title);
    return (data?.entries||[]).find(e=>[e?.model,...(e?.aliases||[])].filter(Boolean).map(N).some(a=>a&&t.includes(a)))||null;
  }catch{return null}
}
function addStyle(){
  if($("#tp-item-confidence-style"))return;
  const s=d.createElement("style");s.id="tp-item-confidence-style";
  s.textContent=`
.tp-item-confidence{margin:18px 0 4px;padding:18px;border:1px solid #dfe6ef;border-radius:22px;background:linear-gradient(180deg,#fff,#fbfcff);box-shadow:0 9px 28px rgba(20,31,50,.06);color:#101828}
.tp-ic-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.tp-ic-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;color:#667085}.tp-ic-top h2{margin:4px 0 5px;font-size:24px;line-height:1.08}.tp-ic-top p{margin:0;color:#667085;font-size:13px;line-height:1.45}.tp-ic-score{min-width:72px;padding:10px 9px;border-radius:17px;background:#eaf7f1;color:#08765a;text-align:center}.tp-ic-score strong{font-size:27px;line-height:1}.tp-ic-score span{font-size:11px;font-weight:900}
.tp-ic-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.tp-ic-check{padding:11px;border-radius:14px;background:#f7f9fc}.tp-ic-check b{display:block;font-size:12px}.tp-ic-check small{display:block;margin-top:4px;color:#667085;font-size:10.5px;line-height:1.35}.tp-ic-ok{color:#08765a}.tp-ic-wait{color:#9a6700}
.tp-ic-review{margin-top:14px;padding-top:14px;border-top:1px solid #e6eaf0}.tp-ic-rhead{display:flex;justify-content:space-between;gap:12px}.tp-ic-rhead span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#667085}.tp-ic-rhead strong{display:block;margin-top:2px;font-size:19px;color:#3157e8}.tp-ic-rhead p{margin:0;max-width:58%;text-align:right;font-size:12px;font-weight:850;color:#101828}.tp-ic-summary{margin:9px 0 0;color:#475467;font-size:12.5px;line-height:1.5}.tp-ic-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.tp-ic-cols>div{padding:10px;border-radius:13px;background:#f8fafc}.tp-ic-cols h3{margin:0 0 5px;font-size:11.5px}.tp-ic-cols p{margin:4px 0;color:#475467;font-size:11px;line-height:1.4}.tp-ic-sources{margin-top:10px}.tp-ic-sources summary{cursor:pointer;color:#3157e8;font-size:11.5px;font-weight:900}.tp-ic-source{display:flex;justify-content:space-between;align-items:center;gap:9px;margin-top:6px;padding:9px;border:1px solid #e5e9f0;border-radius:11px;color:#101828;text-decoration:none}.tp-ic-source strong,.tp-ic-source small{display:block}.tp-ic-source strong{font-size:11.5px}.tp-ic-source small{margin-top:2px;color:#667085;font-size:10px}.tp-ic-source b{font-size:10.5px;color:#3157e8;white-space:nowrap}.tp-ic-policy{margin:10px 0 0;color:#667085;font-size:10px;line-height:1.4}
@media(max-width:650px){.tp-item-confidence{padding:14px;margin-top:14px}.tp-ic-top h2{font-size:20px}.tp-ic-score{min-width:62px}.tp-ic-score strong{font-size:23px}.tp-ic-checks,.tp-ic-cols{grid-template-columns:1fr}.tp-ic-rhead{display:block}.tp-ic-rhead p{max-width:none;text-align:left;margin-top:5px}}
`;
  d.head.appendChild(s);
}
function sourcesHtml(entry){
  const src=Array.isArray(entry?.sources)?entry.sources:[];
  if(!src.length)return "";
  return `<details class="tp-ic-sources"><summary>See ${src.length} review source${src.length===1?"":"s"}</summary>${src.map(s=>`<a class="tp-ic-source" href="${E(s.url||"#")}" target="_blank" rel="nofollow noopener"><span><strong>${E(s.name||"Source")}</strong><small>${E(sourceMeta(s)||s.note||"Review evidence")}</small></span><b>View ↗</b></a>`).join("")}</details>`;
}
async function render(){
  if($(".tp-item-confidence"))return true;
  const detail=$("[data-tp85-detail]");
  if(!detail||detail.hasAttribute("hidden"))return false;
  let r;
  try{
    const res=await fetch(`/data/v20-9/products/${id.slice(0,2)}.json?v=20.9.0`,{cache:"force-cache"});
    if(!res.ok)return false;
    const bucket=await res.json();r=bucket?.[id];if(!r)return false;
  }catch{return false}
  const raw=C(r.t||$("[data-tp85-title]")?.textContent||"Product");
  const entry=await loadReview(raw),f=scoreRecord(r,entry),sources=Array.isArray(entry?.sources)?entry.sources:[];
  const same=sources.find(s=>s.relationship==="same_listing"&&Number(s.review_count)>0);
  const headline=same?`${ratingText(same)} from ${same.review_count} ${same.name} reviews`:entry?`${sources.length} exact-model evidence source${sources.length===1?"":"s"}`:"Exact-model review research pending";
  const strengths=(entry?.strengths||[]).slice(0,3),cautions=(entry?.cautions||[]).slice(0,3);
  addStyle();
  const panel=d.createElement("section");panel.className="tp-item-confidence";panel.dataset.version=VERSION;
  panel.innerHTML=`<div class="tp-ic-top"><div><div class="tp-ic-kicker">BUYING CONFIDENCE</div><h2>${E(f.level)} confidence</h2><p>TrendPilot checks whether the seller route, listing price and review evidence match the product shown.</p></div><div class="tp-ic-score"><strong>${f.score}</strong><span>/100</span></div></div>
  <div class="tp-ic-checks"><div class="tp-ic-check"><b class="${f.direct?"tp-ic-ok":"tp-ic-wait"}">${f.direct?"✓":"!"} Product route</b><small>${f.direct?"Direct product destination is available":"Confirm the exact item on the seller page"}</small></div><div class="tp-ic-check"><b class="${f.price?"tp-ic-ok":"tp-ic-wait"}">${f.price?"✓":"!"} Price evidence</b><small>${f.price?"A seller price is attached to this record":"Check the current price with the seller"}</small></div><div class="tp-ic-check"><b class="${entry?"tp-ic-ok":"tp-ic-wait"}">${entry?"✓":"…"} Review evidence</b><small>${entry?`${E(entry.review_confidence||"Moderate")} confidence · ${sources.length} source${sources.length===1?"":"s"}`:"Exact-model evidence is still being verified"}</small></div></div>
  <div class="tp-ic-review"><div class="tp-ic-rhead"><div><span>REVIEW CONFIDENCE</span><strong>${E(entry?.review_confidence||"Pending")}</strong></div><p>${E(headline)}</p></div><p class="tp-ic-summary">${E(entry?.buyer_summary||"TrendPilot will not claim customer satisfaction until review evidence is tied to this exact model.")}</p>${entry?`<div class="tp-ic-cols"><div><h3>What buyers/tests like</h3>${strengths.map(x=>`<p>✓ ${E(x)}</p>`).join("")}</div><div><h3>Watch-outs</h3>${cautions.map(x=>`<p>• ${E(x)}</p>`).join("")}</div></div>`:""}${sourcesHtml(entry)}<p class="tp-ic-policy"><strong>Review policy:</strong> ratings from different products are never merged; different configurations are labelled separately.</p></div>`;
  const highlights=$("[data-tp85-highlights-wrap]");
  const summary=$("[data-tp85-summary]");
  if(highlights&&!highlights.hasAttribute("hidden"))highlights.insertAdjacentElement("afterend",panel);
  else if(summary)summary.insertAdjacentElement("afterend",panel);
  else $(".tp85-copy")?.prepend(panel);
  d.documentElement.dataset.tpItemConfidence=VERSION;
  return true;
}
let tries=0;
const timer=setInterval(async()=>{tries++;if(await render()||tries>=30)clearInterval(timer)},180);
if(d.readyState!=="loading")render();else d.addEventListener("DOMContentLoaded",render,{once:true});
})();
