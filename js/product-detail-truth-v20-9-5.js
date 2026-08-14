(() => {
  "use strict";

  const VERSION = "20.9.5";
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = v => clean(v).toLowerCase();
  const suffix = (location.pathname.match(/--([a-f0-9]{10,})(?:\/|$)/i) || [])[1]?.toLowerCase() || "";
  if (!suffix || !location.pathname.startsWith("/product/")) return;

  const style = document.createElement("style");
  style.id = "tp-product-detail-truth-v20-9-5-style";
  style.textContent = `
    [data-tp-v2095-hidden="1"]{display:none!important}
    .tp-v2095-truth-note{margin:.65rem 0 0;font-size:.82rem;line-height:1.45;color:#637083}
    .tp-v2095-truth-note strong{color:#162033}
    @media (max-width:820px){
      body[data-tp-page="product-detail"]{padding-bottom:calc(156px + env(safe-area-inset-bottom,0px))!important}
      body[data-tp-page="product-detail"] main{padding-bottom:72px!important}
      body[data-tp-page="product-detail"] main h1{font-size:clamp(2rem,8.2vw,2.72rem)!important;line-height:1.06!important;letter-spacing:-.035em!important}
      body[data-tp-page="product-detail"] .tp-bottom-nav{bottom:max(10px,env(safe-area-inset-bottom,0px))!important}
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const modelFacts = p => {
    const facts = p?.facts || {};
    const screenRaw = clean(facts.screen || facts.display || "");
    const batteryRaw = clean(facts.battery || facts.batteryCapacity || "");
    const screen = Number((screenRaw.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|\")/i) || [])[1] || 0);
    const battery = Number((batteryRaw.match(/(\d{3,5})\s*mAh/i) || [])[1] || 0);
    return {screen,battery};
  };

  const exactGroup = g => Boolean(
    g?.destination_exact === true ||
    /^(?:exact-tracked|exact-direct)$/i.test(clean(g?.primary?.kind))
  );

  const fetchMeta = async () => {
    const url = `/data/shopper-v20-6-8-4/products/${suffix.slice(0,2)}.json?v=${VERSION}`;
    const r = await fetch(url,{cache:"no-store",headers:{accept:"application/json"}});
    if (!r.ok) return null;
    const bucket = await r.json();
    return bucket?.[suffix] || null;
  };

  const leafNodes = root => [...root.querySelectorAll("strong,b,h3,h4,p,span,div")].filter(el => {
    if (el.children.length) return false;
    const t = clean(el.textContent);
    return Boolean(t);
  });

  function sectionByHeading(re){
    const h=[...document.querySelectorAll("main h1,main h2,main h3")].find(x=>re.test(clean(x.textContent)));
    if(!h)return null;
    let n=h;
    for(let i=0;i<5 && n?.parentElement;i++,n=n.parentElement){
      const t=clean(n.textContent);
      if(t.length>clean(h.textContent).length+20 && t.length<6000)return n;
    }
    return h.parentElement;
  }

  const variantish = t => /\b(?:\d{1,4}\s*(?:GB|TB)(?:\s*RAM)?|\d{3,5}\s*mAh|\d+(?:\.\d+)?\s*(?:in|inch|inches))\b/i.test(clean(t));
  const offerish = t => /\b\d+\s+offers?\s*[·•]\s*\d+\s+sellers?\b/i.test(clean(t));

  function variantCardFor(label,section){
    let n=label;
    for(let i=0;i<5 && n && n!==section;i++,n=n.parentElement){
      const t=clean(n.textContent);
      if(offerish(t) && variantish(t)) return n;
      if(n.matches?.("article,li,[class*='config'],[class*='variant'],[class*='option']")) return n;
    }
    return label.parentElement;
  }

  function parseVariant(text,stable){
    const t=clean(text);
    const screen=Number((t.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i)||[])[1]||0);
    const battery=Number((t.match(/(\d{3,5})\s*mAh\b/i)||[])[1]||0);
    if(stable.screen && screen && Math.abs(stable.screen-screen)>.08)return{valid:false,label:"",key:""};
    if(stable.battery && battery && Math.abs(stable.battery-battery)>250)return{valid:false,label:"",key:""};

    const ram=(t.match(/\b(\d{1,3})\s*GB\s*RAM\b/i)||[])[1];
    const storage=[];
    const re=/\b(\d{1,4})\s*(GB|TB)\b/ig;
    let m;
    while((m=re.exec(t))){
      const tail=t.slice(m.index,m.index+m[0].length+6);
      if(/GB\s*RAM/i.test(tail))continue;
      const s=`${Number(m[1])}${m[2].toUpperCase()}`;
      if(!storage.includes(s))storage.push(s);
    }
    const parts=[];
    if(ram)parts.push(`${Number(ram)}GB RAM`);
    if(storage.length)parts.push(...storage.slice(0,2));
    if(!parts.length)return{valid:true,label:t,key:lower(t)};
    return{valid:true,label:parts.join(" · "),key:lower(parts.join("|"))};
  }

  function addNote(section,text){
    if(!section || section.querySelector("[data-tp-v2095-note]"))return;
    const p=document.createElement("p");
    p.className="tp-v2095-truth-note";
    p.dataset.tpV2095Note="1";
    p.innerHTML=`<strong>Variant check:</strong> ${text}`;
    const heading=[...section.querySelectorAll("h1,h2,h3")].find(h=>/configuration|variant/i.test(clean(h.textContent)));
    (heading?.parentElement||section).appendChild(p);
  }

  function repairVariants(p){
    const section=sectionByHeading(/available configurations|configurations|variants/i);
    if(!section)return;
    const stable=modelFacts(p);
    const labels=leafNodes(section).filter(el=>variantish(el.textContent) && !offerish(el.textContent));
    const seen=new Map();
    let hidden=0,normalized=0,merged=0;

    for(const label of labels){
      const card=variantCardFor(label,section);
      if(!card || card===section || card.dataset.tpV2095Done==="1")continue;
      const parsed=parseVariant(label.textContent,stable);
      if(!parsed.valid){card.dataset.tpV2095Hidden="1";card.dataset.tpV2095Done="1";hidden++;continue;}
      if(parsed.label && clean(label.textContent)!==parsed.label){label.textContent=parsed.label;normalized++;}
      if(parsed.key){
        if(seen.has(parsed.key)){
          card.dataset.tpV2095Hidden="1";
          merged++;
        }else seen.set(parsed.key,card);
      }
      card.dataset.tpV2095Done="1";
    }

    if(hidden||normalized||merged){
      addNote(section,"TrendPilot shows distinct RAM/storage choices and removes configuration rows that conflict with stable model-level facts such as screen size or battery capacity.");
    }
  }

  function replaceLeafText(root,re,fn){
    for(const el of leafNodes(root)){
      const t=clean(el.textContent);
      if(!re.test(t))continue;
      re.lastIndex=0;
      const next=fn(t);
      if(next && next!==t)el.textContent=next;
    }
  }

  function repairSellerTruth(p){
    const groups=(Array.isArray(p?.sellerGroups)?p.sellerGroups:[]).filter(g=>clean(g?.seller));
    if(!groups.length)return;
    const exact=groups.filter(exactGroup);
    if(exact.length)return;

    const sellers=[...new Set(groups.map(g=>clean(g.seller)).filter(Boolean))];
    const records=groups.reduce((n,g)=>n+Math.max(0,Number(g?.offerCount||0)),0) || Number(p?.offerCount||0);
    const main=document.querySelector("main")||document.body;

    replaceLeafText(main,/\b\d+\s+active listings?\s+from\s+\d+\s+sellers?(?:\s*[·•].*)?$/i,()=>`${records||"Seller"} catalogue record${records===1?"":"s"} from ${sellers.length} seller${sellers.length===1?"":"s"} · exact product destination not verified`);
    replaceLeafText(main,/\b(\d+)\s+active listings?\b/i,t=>t.replace(/active listings?/i,"catalogue records"));
    replaceLeafText(main,/\b(\d+)\s+offers?\s*[·•]\s*(\d+)\s+sellers?\b/i,t=>t.replace(/offers?/i,"catalogue records"));

    const sellerSection=sectionByHeading(/seller offers|seller option|compare seller/i);
    if(sellerSection && !sellerSection.querySelector("[data-tp-v2095-seller-note]")){
      const n=document.createElement("p");
      n.className="tp-v2095-truth-note";
      n.dataset.tpV2095SellerNote="1";
      n.innerHTML="<strong>Seller evidence:</strong> These are catalogue records. The available route is a broader marketplace/search destination, so TrendPilot does not call them active exact listings.";
      const head=[...sellerSection.querySelectorAll("h1,h2,h3")].find(h=>/seller/i.test(clean(h.textContent)));
      (head?.parentElement||sellerSection).appendChild(n);
    }
  }

  let running=false;
  async function run(){
    if(running)return;
    running=true;
    try{
      const p=await fetchMeta();
      if(!p)return;
      repairVariants(p);
      repairSellerTruth(p);
      document.documentElement.dataset.tpProductDetailTruth=VERSION;
    }catch(e){console.warn("[TrendPilot V20.9.5 product detail truth]",e)}
    finally{running=false;}
  }

  const schedule=()=>setTimeout(run,80);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});else schedule();
  const main=document.querySelector("main");
  if(main){
    const mo=new MutationObserver(schedule);
    mo.observe(main,{subtree:true,childList:true});
    setTimeout(()=>mo.disconnect(),12000);
  }
})();
