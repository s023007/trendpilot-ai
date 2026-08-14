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
function stableFacts(body){
  const get = label => {
    const m=body.match(new RegExp(`<div class="spec"><span>${label}</span><strong>([^<]+)</strong></div>`,`i`));
    return clean(decode(m?.[1]||""));
  };
  const screenRaw=get("Screen"),batteryRaw=get("Battery");
  const screen=Number((screenRaw.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|\")/i)||[])[1]||0);
  const battery=Number((batteryRaw.match(/(\d{3,5})\s*mAh/i)||[])[1]||0);
  return {screen,battery};
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
  const replacement=`<section class="panel"><div class="eyebrow">CONFIGURATIONS</div><h2>Available configurations</h2><p class="muted">RAM/storage combinations are separated from incomplete storage-only evidence.</p>${specifiedHtml}${partialHtml}<p class="truth-note"><strong>Variant check:</strong> Stable model facts such as screen size and battery are not treated as separate variants. Rows that conflict with those facts or have no usable configuration evidence are removed.</p></section>`;
  return {body:body.replace(section[0],replacement),count:configCount,partialCount:partial.length,changed:true};
}
function cleanVariableSpecs(body,variantInfo){
  if((variantInfo?.count||0)<=1 && !(variantInfo?.partialCount>0)) return body;
  const sectionRe=/<section class="panel"><div class="eyebrow">PRODUCT PREVIEW<\/div>[\s\S]*?<\/section>/i;
  return body.replace(sectionRe,section=>{
    let out=section.replace(/<div class="spec"><span>(?:Storage|RAM)<\/span><strong>[^<]*<\/strong><\/div>/gi,"");
    out=out.replace(/<h2>Important details<\/h2>/i,"<h2>Model facts</h2>");
    out=out.replace(/<\/div><\/section>$/i,'</div><p class="truth-note"><strong>Configuration note:</strong> RAM and storage vary by seller record and are shown in the configuration section below.</p></section>');
    return out;
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
      const cfg=variantCount?` · ${variantCount} RAM/storage configuration${variantCount===1?"":"s"}`:"";
      return `<section class="hero"><div class="hero-media">${media}</div><div class="hero-copy">${copy}<p>${label} from ${sellers} seller${Number(sellers)===1?"":"s"}${cfg}${hasExact?"":" · exact product destination not verified"}</p></div></section>`;
    });
}
function injectTruthStyle(body){
  const css=`
.truth-note{margin:14px 0 0;color:#667085;font-size:14px;line-height:1.5}.truth-note strong{color:#172033}
.variant-subhead{margin:20px 0 10px;font-size:17px;color:#172033}.variant-subhead.secondary{margin-top:24px}.muted.compact{margin-top:-2px;font-size:14px;line-height:1.45}.partial-variants .variant{background:#fafbfc}
@media(max-width:650px){main{padding-bottom:118px!important}.hero h1{font-size:clamp(24px,6vw,28px)!important;line-height:1.06!important}.variant{padding:14px!important}.bottom-nav{left:14px!important;right:14px!important;bottom:8px!important;padding:6px 8px calc(6px + env(safe-area-inset-bottom))!important;border-radius:24px!important}.bottom-nav a{padding:8px 6px!important;min-height:46px!important}}
`;
  const i=body.lastIndexOf("</style>");
  if(i>=0)body=body.slice(0,i)+css+body.slice(i);
  return body.replace("<body>",`<body data-tp-product-truth="${VERSION}">`);
}
function transform(body){
  if(!body||!/<html/i.test(body))return body;
  const cleaned=cleanVariants(body);
  body=cleaned.body;
  body=cleanVariableSpecs(body,cleaned);
  body=cleanSellerCards(body);
  body=heroTruth(body,cleaned.count);
  body=injectTruthStyle(body);
  return body;
}

exports.handler=async function(event,context){
  const res=await legacy.handler(event,context);
  const type=String(res?.headers?.["content-type"]||res?.headers?.["Content-Type"]||"");
  if(res?.statusCode===200 && /text\/html/i.test(type)){
    res.body=transform(res.body);
    res.headers={...(res.headers||{}),"x-trendpilot-product-truth":VERSION};
  }
  return res;
};
