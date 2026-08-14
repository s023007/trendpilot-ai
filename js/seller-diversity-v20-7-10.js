(() => {
"use strict";
const VERSION="20.7.10";
const clean=v=>String(v??"").replace(/\s+/g," ").trim();
const blocked=new Set(["temu","joom","filamentpro","filamentpro eu cps"]);
const allowed=s=>{const n=clean(s).toLowerCase();return !!n&&!blocked.has(n)&&!n.includes("tiktok")};
const state={sellers:[],type:""};
const originalFetch=window.fetch.bind(window);
function primarySeller(row){
  const sellers=(Array.isArray(row?.sellers)?row.sellers:[]).filter(allowed);
  return sellers.find(s=>!/alibaba/i.test(s))||sellers[0]||"";
}
function diversify(rows){
  const buckets=new Map(),rest=[];
  for(const row of rows){
    const s=primarySeller(row);
    if(!s){rest.push(row);continue}
    if(!buckets.has(s))buckets.set(s,[]);
    buckets.get(s).push(row);
  }
  state.sellers=[...buckets.keys()].sort((a,b)=>{
    if(/alibaba/i.test(a))return 1;
    if(/alibaba/i.test(b))return-1;
    return a.localeCompare(b);
  });
  const out=[]; let more=true;
  while(more){
    more=false;
    for(const s of state.sellers){
      const row=buckets.get(s).shift();
      if(row){out.push(row);more=true}
    }
  }
  return out.concat(rest);
}
function restoreSellerOptions(){
  const sel=document.querySelector("[data-filter-merchant]");
  if(!sel||!state.sellers.length)return;
  const current=clean(sel.value);
  const html=['<option value="">All sellers</option>',...state.sellers.map(s=>`<option value="${s.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${s.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</option>`)].join("");
  if(sel.innerHTML!==html) sel.innerHTML=html;
  if(state.sellers.includes(current)) sel.value=current;
}
window.fetch=async function(input,init){
  const url=typeof input==="string"?input:input?.url||"";
  const res=await originalFetch(input,init);
  if(!/\/browse-lite\/(?:phone|laptop|perfume|smartwatch|headphones|power_bank)\.json/i.test(url)||!res.ok)return res;
  try{
    const data=await res.clone().json();
    if(!Array.isArray(data?.products))return res;
    state.type=(url.match(/\/browse-lite\/([^/.]+)\.json/i)||[])[1]||"";
    const products=diversify(data.products);
    const body=JSON.stringify({...data,products});
    setTimeout(restoreSellerOptions,700);
    setTimeout(restoreSellerOptions,1800);
    return new Response(body,{status:res.status,statusText:res.statusText,headers:res.headers});
  }catch{return res}
};
document.addEventListener("DOMContentLoaded",()=>{
  [900,1800,3200].forEach(ms=>setTimeout(restoreSellerOptions,ms));
  document.addEventListener("change",e=>{
    if(e.target?.matches?.("[data-filter-merchant],[data-filter-price],[data-filter-sort]")){
      setTimeout(restoreSellerOptions,250);
      setTimeout(restoreSellerOptions,900);
    }
  });
  document.addEventListener("click",e=>{
    if(e.target?.closest?.("[data-v2078-load-more]"))setTimeout(restoreSellerOptions,900);
  });
},{once:true});
window.__TP_V20710_SELLER_DIVERSITY__={version:VERSION};
})();