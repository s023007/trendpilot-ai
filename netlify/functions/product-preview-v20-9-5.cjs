const legacy = require("./product-preview-v20-6-8-3.cjs");

const VERSION = "20.9.5";

function clean(v){ return String(v ?? "").replace(/\s+/g," ").trim(); }
function lower(v){ return clean(v).toLowerCase(); }
function decode(v){
  return String(v ?? "")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function esc(v){
  return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function stripTags(v){ return clean(decode(String(v??"").replace(/<[^>]+>/g," "))); }
function stableFacts(body){
  const get = label => {
    const m=body.match(new RegExp(`<div class="spec"><span>${label}</span><strong>([^<]+)</strong></div>`,`i`));
    return clean(decode(m?.[1]||""));
  };
  const screenRaw=get("Screen"),batteryRaw=get("Battery");
  const screen=Number((screenRaw.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|\")/i)||[])[1]||0);
  const battery=Number((batteryRaw.match(/(\d{3,5})\s*mAh/i)||[])[1]||0);
  return {screen,battery,screenRaw,batteryRaw};
}
function parseVariant(label,counts,stable){
  const t=clean(decode(label));
  if(!t || /^(?:configuration|variant|option)\s*\d*$/i.test(t) || /^standard configuration$/i.test(t)) return null;
  const screen=Number((t.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i)||[])[1]||0);
  const battery=Number((t.match(/(\d{3,5})\s*mAh\b/i)||[])[1]||0);
  if(stable.screen&&screen&&Math.abs(stable.screen-screen)>.08)return null;
  if(stable.battery&&battery&&Math.abs(stable.battery-battery)>250)return null;

  const ramRaw=(t.match(/\b(\d{1,3})\s*GB\s*RAM\b/i)||[])[1];
  const ram=ramRaw?`${Number(ramRaw)}GB RAM`:"";
  const storage=[];
  const re=/\b(\d{1,4})\s*(GB|TB)\b/ig;
  let m;
  while((m=re.exec(t))){
    const tail=t.slice(m.index,m.index+m[0].length+6);
    if(/GB\s*RAM/i.test(tail))continue;
    const token=`${Number(m[1])}${m[2].toUpperCase()}`;
    if(!storage.includes(token))storage.push(token);
  }
  if(!ram && !storage.length) return null;
  const parts=[];
  if(ram)parts.push(ram);
  if(storage.length)parts.push(...storage.slice(0,2));
  const normalized=parts.join(" · ");
  const cm=clean(decode(counts)).match(/(\d+)\s+offers?\s*[·•]\s*(\d+)\s+sellers?/i);
  return {
    label:normalized,
    key:lower(normalized),
    offers:Number(cm?.[1]||0),
    sellers:Number(cm?.[2]||0),
    ram,
    storage:storage.slice(0,2)
  };
}
function cleanVariants(body){
  const stable=stableFacts(body);
  const section=body.match(/<section class="panel"><div class="eyebrow">CONFIGURATIONS<\/div>[\s\S]*?<div class="variants">([\s\S]*?)<\/div><\/section>/i);
  if(!section)return {body,count:0,partialCount:0,changed:false};

  const rows=[];
  const rowRe=/<div class="variant"><strong>([\s\S]*?)<\/strong><span>([\s\S]*?)<\/span><\/div>/gi;
  let m;
  while((m=rowRe.exec(section[1]))){
    const v=parseVariant(m[1],m[2],stable);
    if(v)rows.push(v);
  }
  if(!rows.length){
    return {body:body.replace(section[0],""),count:0,partialCount:0,changed:true};
  }

  const merged=new Map();
  for(const v of rows){
    const old=merged.get(v.key);
    if(old){old.offers+=v.offers;old.sellers=Math.max(old.sellers,v.sellers);}
    else merged.set(v.key,{...v});
  }
  const vals=[...merged.values()];
  const specified=vals.filter(v=>v.ram&&v.storage.length);
  const partial=vals.filter(v=>!v.ram&&v.storage.length);

  const card=v=>`<div class="variant"><strong>${esc(v.label)}</strong><span>${v.offers} catalogue record${v.offers===1?"":"s"} · ${v.sellers} seller${v.sellers===1?"":"s"}</span></div>`;
  const specifiedHtml=specified.length
    ? `<h3 class="variant-subhead">RAM + storage specified</h3><div class="variants">${specified.map(card).join("")}</div>`
    : "";
  const partialHtml=partial.length
    ? `<h3 class="variant-subhead secondary">Storage-only records</h3><p class="muted compact">RAM is not specified in these catalogue records, so they are not counted as separate confirmed RAM/storage configurations.</p><div class="variants partial-variants">${partial.map(v=>card({...v,label:`${v.storage.join(" · ")} · RAM not specified`})).join("")}</div>`
    : "";
  const configCount=specified.length;
  const replacement=`<section class="panel technical-panel"><div class="eyebrow">TECHNICAL OPTIONS</div><h2>Specifications & configurations</h2><p class="muted">Secondary technical information for shoppers who need the exact RAM/storage option.</p>${specifiedHtml}${partialHtml}<p class="truth-note"><strong>Variant check:</strong> Stable model facts such as screen size and battery are not treated as separate variants. Rows that conflict with those facts or have no usable configuration evidence are removed.</p></section>`;
  return {body:body.replace(section[0],replacement),count:configCount,partialCount:partial.length,changed:true};
}
function cleanVariableSpecs(body,variantInfo){
  const sectionRe=/<section class="panel"><div class="eyebrow">PRODUCT PREVIEW<\/div>[\s\S]*?<\/section>/i;
  return body.replace(sectionRe,section=>{
    let out=section;
    if((variantInfo?.count||0)>1 || variantInfo?.partialCount>0){
      out=out.replace(/<div class="spec"><span>(?:Storage|RAM)<\/span><strong>[^<]*<\/strong><\/div>/gi,"");
    }
    out=out.replace(/<div class="eyebrow">PRODUCT PREVIEW<\/div>/i,'<div class="eyebrow">MODEL FACTS</div>');
    out=out.replace(/<h2>Important details<\/h2>/i,"<h2>Technical facts</h2>");
    if((variantInfo?.count||0)>1 || variantInfo?.partialCount>0){
      out=out.replace(/<\/div><\/section>$/i,'</div><p class="truth-note"><strong>Configuration note:</strong> RAM and storage vary by seller record and are listed separately below.</p></section>');
    }
    return out.replace('class="panel"','class="panel technical-panel"');
  });
}
function cleanSellerCards(body){
  return body.replace(/<article class="seller-card">[\s\S]*?<\/article>/gi,card=>{
    const generic=/Marketplace search route/i.test(card);
    if(!generic)return card.replace(/(\d+) active listing(s?)/i,(m,n)=>`${n} active exact listing${Number(n)===1?"":"s"}`);
    return card
      .replace(/(\d+) active listing(s?)/i,(m,n)=>`${n} catalogue record${Number(n)===1?"":"s"}`)
      .replace(/<span>Seller listing<\/span>/gi,"<span>Catalogue record</span>")
      .replace(/<span>Supplier listing<\/span>/gi,"<span>Supplier catalogue record</span>");
  });
}
function heroTruth(body,variantCount){
  const hasExact=/Verified exact price|Exact product · price at seller|active exact listing/i.test(body);
  return body.replace(/<section class="hero"><div class="hero-media">([\s\S]*?)<\/div><div class="hero-copy">([\s\S]*?)<p>(\d+) active listing(s?) from (\d+) seller(s?) · \d+ configuration(s?)<\/p><\/div><\/section>/i,
    (all,media,copy,records,_pl,sellers)=>{
      const label=hasExact?`${records} seller record${Number(records)===1?"":"s"}`:`${records} catalogue record${Number(records)===1?"":"s"}`;
      const cfg=variantCount?` · ${variantCount} configuration${variantCount===1?"":"s"} available`:"";
      return `<section class="hero"><div class="hero-media">${media}</div><div class="hero-copy">${copy}<p>${label} from ${sellers} seller${Number(sellers)===1?"":"s"}${cfg}${hasExact?"":" · exact product destination not verified"}</p></div></section>`;
    });
}
function productKind(title){
  const t=lower(title);
  if(/\b(?:smartphone|phone|iphone|galaxy|redmi|pixel)\b/.test(t))return "phone";
  if(/\b(?:laptop|notebook|chromebook|thinkpad|macbook)\b/.test(t))return "laptop";
  if(/\b(?:tablet|ipad)\b/.test(t))return "tablet";
  if(/\b(?:smartwatch|smart watch|apple watch|galaxy watch)\b/.test(t))return "smartwatch";
  if(/\b(?:headphones?|earbuds?|earphones?|headset)\b/.test(t))return "headphones";
  if(/\b(?:perfume|fragrance|eau de parfum|eau de toilette|cologne)\b/.test(t))return "perfume";
  if(/\bpower\s*bank\b/.test(t))return "power_bank";
  if(/\b(?:lamp|lighting|light fixture|led light)\b/.test(t))return "lighting";
  if(/\b(?:air fryer|airfryer)\b/.test(t))return "air_fryer";
  if(/\b(?:camera|dslr|mirrorless)\b/.test(t))return "camera";
  if(/\b(?:cookware|pan|pot|casserole|skillet)\b/.test(t))return "cookware";
  if(/\b(?:filament|pla|petg|abs filament)\b/.test(t))return "3d_filament";
  return "product";
}
function productPurpose(kind){
  return {
    phone:"a smartphone for calls, messaging, apps, photography and everyday connected use",
    laptop:"a portable computer for web use, productivity and compatible applications",
    tablet:"a tablet for portable apps, media, browsing and touch-based use",
    smartwatch:"a wearable smart device for wrist-based notifications and compatible connected features",
    headphones:"a personal audio product for listening to compatible audio sources",
    perfume:"a fragrance product intended for personal scent use",
    power_bank:"a portable battery product intended to recharge compatible devices away from a wall outlet",
    lighting:"a lighting product intended to provide illumination for the use described by the seller",
    air_fryer:"a countertop cooking appliance intended for hot-air cooking",
    camera:"an imaging product intended for capturing photos or video according to its listed configuration",
    cookware:"a cookware product intended for food preparation with compatible cooking methods",
    "3d_filament":"a 3D-printing filament product intended for compatible filament-based printers",
    product:"a product represented in TrendPilot's catalogue"
  }[kind];
}
function generatedDescription(body){
  const title=stripTags((body.match(/<main>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||[])[1]||"");
  if(!title)return "";
  const kind=productKind(title);
  const facts=stableFacts(body);
  const camera=(title.match(/\b\d{1,3}\s*MP\b/i)||[])[0]||"";
  const featureBits=[];
  if(camera)featureBits.push(`${camera.replace(/\s+/g,"")} camera detail stated in the catalogue title`);
  if(facts.screenRaw)featureBits.push(`${facts.screenRaw} screen`);
  if(facts.batteryRaw)featureBits.push(`${facts.batteryRaw} battery`);
  const first=`${title} is ${productPurpose(kind)}.`;
  const second=featureBits.length?` Available model evidence on this page includes ${featureBits.join(" and ")}.`:"";
  const variable=/\b(?:phone|laptop|tablet|smartwatch)\b/.test(kind)
    ? " RAM, storage and other seller-specific configurations are kept separate so they are not mistaken for fixed model facts."
    : " Seller-specific options are shown separately where the catalogue provides them.";
  return clean(`${first}${second}${variable}`);
}
function ensureProductDescription(body){
  const aboutRe=/<section class="panel about">[\s\S]*?<\/section>/i;
  const about=body.match(aboutRe)?.[0]||"";
  const current=stripTags((about.match(/<p class="about-copy">([\s\S]*?)<\/p>/i)||[])[1]||"");
  if(current)return body;
  const summary=generatedDescription(body);
  if(!summary)return body;
  const note="Confirm the exact seller record, configuration, compatibility, current price, stock and delivery details before buying.";
  if(about){
    const replaced=about.replace(/<h2>[^<]*<\/h2>/i,m=>`${m}<p class="about-copy">${esc(summary)}</p>`)
      .replace(/<\/section>$/i,/<p class="buyer-note">/i.test(about)?"</section>":`<p class="buyer-note"><strong>Before you buy:</strong> ${esc(note)}</p></section>`);
    return body.replace(about,replaced);
  }
  const section=`<section class="panel about"><div class="eyebrow">ABOUT THIS PRODUCT</div><h2>What this product is</h2><p class="about-copy">${esc(summary)}</p><p class="buyer-note"><strong>Before you buy:</strong> ${esc(note)}</p></section>`;
  const heroRe=/<section class="hero">[\s\S]*?<\/section>/i;
  return body.replace(heroRe,m=>`${m}${section}`);
}
function promoteProductDescription(body){
  const aboutRe=/<section class="panel about">[\s\S]*?<\/section>/i;
  const match=body.match(aboutRe);
  if(!match)return body;
  let about=match[0]
    .replace(/<div class="eyebrow">ABOUT THIS PRODUCT<\/div>/i,'<div class="eyebrow">PRODUCT OVERVIEW</div>')
    .replace(/<h2>What this product is<\/h2>/i,'<h2>About this product</h2>');
  body=body.replace(match[0],"");
  const heroRe=/<section class="hero">[\s\S]*?<\/section>/i;
  return body.replace(heroRe,m=>`${m}${about}`);
}
function demoteTechnicalSections(body){
  const tech=[];
  body=body.replace(/<section class="panel technical-panel">[\s\S]*?<\/section>/gi,m=>{tech.push(m);return "";});
  if(!tech.length)return body;
  const sellerRe=/<section class="panel" id="seller-offers">[\s\S]*?<\/section>/i;
  const seller=body.match(sellerRe);
  if(seller)return body.replace(seller[0],`${seller[0]}<div class="technical-wrap"><h2 class="technical-heading">Technical details</h2><p class="muted technical-intro">Optional specifications and configuration evidence.</p>${tech.join("")}</div>`);
  return body.replace(/<\/main>/i,`<div class="technical-wrap"><h2 class="technical-heading">Technical details</h2>${tech.join("")}</div></main>`);
}
function truncateDescription(v,max=165){
  let t=clean(v);
  if(t.length<=max)return t;
  t=t.slice(0,max-1).replace(/\s+\S*$/," ").trim();
  return `${t}…`;
}
function upgradeSeoDescription(body){
  const summary=stripTags((body.match(/<p class="about-copy">([\s\S]*?)<\/p>/i)||[])[1]||"");
  const title=stripTags((body.match(/<main>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||[])[1]||"");
  if(!summary)return body;
  const meta=truncateDescription(summary.length>=90?summary:`${title}. ${summary}`);
  body=body.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${esc(meta)}">`);
  body=body.replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${esc(meta)}">`);
  body=body.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,(all,json)=>{
    try{
      const ld=JSON.parse(json);
      ld.description=summary;
      return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,"\\u003c")}</script>`;
    }catch{return all;}
  });
  return body;
}
function injectTruthStyle(body){
  const css=`
.truth-note{margin:14px 0 0;color:#667085;font-size:14px;line-height:1.5}.truth-note strong{color:#172033}
.about{border-color:#d9e5df;background:linear-gradient(180deg,#fff,#fbfdfc)}.about-copy{font-size:18px!important;line-height:1.7!important;color:#344054!important}.buyer-note{font-size:15px}
.technical-wrap{margin-top:28px}.technical-heading{font-size:25px;margin:0 0 4px}.technical-intro{margin:0 0 12px}.technical-panel{background:#fbfcfd!important}.technical-panel h2{font-size:22px!important}
.variant-subhead{margin:20px 0 10px;font-size:17px;color:#172033}.variant-subhead.secondary{margin-top:24px}.muted.compact{margin-top:-2px;font-size:14px;line-height:1.45}.partial-variants .variant{background:#fafbfc}
@media(max-width:650px){main{padding-bottom:118px!important}.hero h1{font-size:clamp(24px,6vw,28px)!important;line-height:1.06!important}.about{margin-top:14px!important}.about h2{font-size:25px!important}.about-copy{font-size:16px!important;line-height:1.65!important}.technical-wrap{margin-top:22px}.variant{padding:14px!important}.bottom{left:14px!important;right:14px!important;bottom:8px!important;padding:5px 7px!important;border-radius:20px!important}.bottom a{min-height:42px!important;font-size:11px!important;padding:0 6px!important}}
`;
  const i=body.lastIndexOf("</style>");
  if(i>=0)body=body.slice(0,i)+css+body.slice(i);
  return body.replace("<body>",`<body data-tp-product-truth="${VERSION}" data-tp-product-content="seo-cpc-product-first">`);
}
function transform(body){
  if(!body||!/<html/i.test(body))return body;
  const cleaned=cleanVariants(body);
  body=cleaned.body;
  body=cleanVariableSpecs(body,cleaned);
  body=cleanSellerCards(body);
  body=heroTruth(body,cleaned.count);
  body=ensureProductDescription(body);
  body=promoteProductDescription(body);
  body=demoteTechnicalSections(body);
  body=upgradeSeoDescription(body);
  body=injectTruthStyle(body);
  return body;
}

exports.handler=async function(event,context){
  const res=await legacy.handler(event,context);
  const type=String(res?.headers?.["content-type"]||res?.headers?.["Content-Type"]||"");
  if(res?.statusCode===200 && /text\/html/i.test(type)){
    res.body=transform(res.body);
    res.headers={...(res.headers||{}),"x-trendpilot-product-truth":VERSION,"x-trendpilot-content-priority":"seo-cpc-product-first"};
  }
  return res;
};
