(()=>{
'use strict';
const d=document,q=new URLSearchParams(location.search),product=(q.get('id')||'').toLowerCase(),creative=(q.get('creative_id')||'').toLowerCase();
if(product!=='bcba2c15f61566'||!creative)return;
const variants={
  'first-look-v1':{
    headline:'A rugged phone built around endurance and field utility.',
    lead:'The FOSSiBOT F106 Pro prioritises long battery life, durability and practical outdoor features over slim design or flagship speed.',
    best:['Camping & outdoor work','Long days away from a charger','Buyers who value rugged utility'],
    avoid:['Heavy gaming','Lightweight-phone buyers']
  },
  'screen-usability-v1':{
    headline:'A practical 6.58-inch FHD+ rugged phone — with one screen caveat.',
    lead:'The display is large enough for everyday use, but professional testing raises a brightness caution for demanding outdoor viewing.',
    best:['Everyday navigation & apps','Outdoor users who value durability','Long battery-focused use'],
    avoid:['Maximum screen brightness','Demanding gaming']
  },
  'honest-review-v1':{
    headline:'Strong on battery and ruggedness; modest on speed and portability.',
    lead:'Buyer evidence is positive for endurance and outdoor usefulness, while performance, bulk and software support remain the main trade-offs.',
    best:['Battery-first buyers','Camping & field use','Rugged-phone shoppers'],
    avoid:['Performance-first buyers','Slim, light-phone buyers']
  }
};
const v=variants[creative];if(!v)return;
function apply(){const card=d.querySelector('.tp-conv-card');if(!card)return false;const h=card.querySelector('h2'),lead=card.querySelector('.tp-conv-lead'),yes=card.querySelector('.tp-conv-yes'),no=card.querySelector('.tp-conv-no');if(!h||!lead||!yes||!no)return false;h.textContent=v.headline;lead.textContent=v.lead;yes.innerHTML='<b>Best for</b>'+v.best.map(x=>`<p>✓ ${x}</p>`).join('');no.innerHTML='<b>Watch-outs</b>'+v.avoid.map(x=>`<p>• ${x}</p>`).join('');card.dataset.campaignCreative=creative;d.documentElement.dataset.tpCampaignCreative=creative;return true}
let n=0;const t=setInterval(()=>{n++;if(apply()||n>80)clearInterval(t)},120);d.readyState==='loading'?d.addEventListener('DOMContentLoaded',apply,{once:true}):apply();
})();