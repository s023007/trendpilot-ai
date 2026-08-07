(() => {
  "use strict";
  let cache=null;
  async function config(){if(cache)return cache;try{const r=await fetch(`/data/monetization-routing-v14-1.json?v=14.1-${Date.now()}`,{cache:"no-store"});cache=r.ok?await r.json():{};}catch{cache={};}return cache;}
  window.TP_MONETIZATION_V141={
    async modelFor(text){const data=await config(),q=String(text||"").toLowerCase();for(const p of data.programs||[]){const names=[p.seller,...(p.aliases||[])].map(x=>String(x||"").toLowerCase());if(names.some(x=>x&&q.includes(x)))return p.model||"";}return"";},
    async tieBreak(a,b){const ma=await this.modelFor(a?.seller||a?.advertiser||a?.brand||""),mb=await this.modelFor(b?.seller||b?.advertiser||b?.brand||"");const score=m=>m==="CPC"?2:m==="CPC-candidate"?1:0;return score(mb)-score(ma);}
  };
})();
