(() => {
  'use strict';
  const VERSION='21.4.1';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const exact=new Map([
    ['Universal product discovery & comparison','Search the catalogue'],
    ['Product role checked','Main products first'],
    ['Universal long-tail discovery','Searches the full catalogue'],
    ['Rare finds scored by evidence','Rare products included'],
    ['TikTok availability not verified','Check TikTok availability'],
    ['TrendPilot does not treat this TikTok feed item as buyable until live availability is verified.','Open TikTok to check whether this product is currently available.'],
    ['TikTok live-only price is excluded until availability is verified.','TikTok price is shown only after current availability is confirmed.'],
    ['TikTok availability from this feed is dynamic and is not presented as a confirmed buyable offer.','TikTok availability can change quickly. Check the product on TikTok before buying.'],
    ['This listing is marked unavailable in the current source data. Choose another seller or configuration.','This product is currently unavailable from this seller. Try another seller or option.'],
    ['This partner link opens a broader marketplace/seller page, not the exact item shown here.','This link may open the seller’s search page. Check that the exact product is shown before buying.'],
    ['View exact supplier listing ↗','View product ↗'],
    ['Visit exact product ↗','View product ↗']
  ]);
  function simpleText(t){
    let s=clean(t);
    if(!s)return s;
    if(exact.has(s))return exact.get(s);
    s=s.replace(/^Variant check:\s*/i,'Product choices: ');
    s=s.replace(/^Seller evidence:\s*/i,'Before buying: ');
    s=s.replace(/\bverified phone products\b/gi,'phone products');
    s=s.replace(/\bmaster products\b/gi,'products');
    s=s.replace(/\bcatalogue records?\b/gi,'seller options');
    s=s.replace(/\bexact product destination not verified\b/gi,'check the exact product before buying');
    s=s.replace(/These are seller options\. The available route is a broader marketplace\/search destination, so TrendPilot does not call them active exact listings\.?/i,'We found this product with these sellers, but the link may open a search page. Check that the exact product is shown before buying.');
    s=s.replace(/The available route is a broader marketplace\/search destination, so TrendPilot does not call them active exact listings\.?/i,'The link may open a seller search page. Check that the exact product is shown before buying.');
    s=s.replace(/TrendPilot shows distinct RAM\/storage choices and removes configuration rows that conflict with stable model-level facts such as screen size or battery capacity\.?/i,'TrendPilot keeps the RAM and storage choices that match this product and hides conflicting options.');
    return s;
  }
  function relevant(t){return /(?:Variant check:|Seller evidence:|verified phone products|master products|catalogue records?|exact product destination not verified|feed item|live-only price|source data|broader marketplace\/(?:seller page|search destination)|Universal product discovery|Product role checked|long-tail discovery|scored by evidence|View exact supplier listing|Visit exact product)/i.test(t);}
  function transformNode(node){
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,noscript,code,pre,textarea,select,option'))return;
    const raw=String(node.nodeValue??'');
    if(!relevant(raw))return;
    const lead=(raw.match(/^\s*/)||[''])[0],trail=(raw.match(/\s*$/)||[''])[0];
    const before=clean(raw),after=simpleText(before);
    if(after&&after!==before)node.nodeValue=lead+after+trail;
  }
  function sweep(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let n;
    while((n=walker.nextNode()))nodes.push(n);
    for(const node of nodes)transformNode(node);
    document.documentElement.dataset.tpShopperLanguage=VERSION;
  }
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>sweep(document.body||document),40);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const root=document.documentElement;
  if(root){
    const mo=new MutationObserver(schedule);
    mo.observe(root,{subtree:true,childList:true,characterData:true});
    setTimeout(()=>mo.disconnect(),15000);
  }
})();
