const previous = require("./product-preview-v20-9-5.cjs");

const UI_VERSION = "20.9.6";

function clean(v){ return String(v ?? "").replace(/\s+/g," ").trim(); }
function decode(v){
  return String(v ?? "")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function esc(v){
  return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function stripTags(v){ return clean(decode(String(v ?? "").replace(/<[^>]+>/g," "))); }
function shortModel(title){
  const patterns=[
    /\b((?:Xiaomi\s+)?Redmi\s+Note\s+\d+(?:\s+(?:Pro|Pro\+|S|T|5G))?)\b/i,
    /\b((?:Apple\s+)?iPhone\s+(?:SE|\d+)(?:\s+(?:Pro Max|Pro|Plus|Mini|Max))?)\b/i,
    /\b(Samsung\s+Galaxy\s+[A-Z]\s?\d+(?:\s+(?:Ultra|Plus|FE))?)\b/i,
    /\b(Google\s+Pixel\s+\d+(?:a|\s+(?:Pro|XL))?)\b/i,
    /\b(OnePlus\s+\d+[A-Z]?(?:\s+Pro)?)\b/i,
    /\b((?:Lenovo\s+)?(?:ThinkPad|IdeaPad|ThinkBook|Legion|Yoga|Slim)\s+[A-Z0-9][A-Z0-9 +\-]{0,18})\b/i
  ];
  for(const p of patterns){ const m=clean(title).match(p); if(m) return clean(m[1]); }
  const words=clean(title).replace(/…/g,"").split(" ").filter(Boolean);
  return words.slice(0,Math.min(7,words.length)).join(" ");
}
function naturalizeDescription(body){
  const title=stripTags((body.match(/<main>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||[])[1]||"");
  const aboutMatch=body.match(/<p class="about-copy">([\s\S]*?)<\/p>/i);
  if(!title||!aboutMatch)return body;
  let text=stripTags(aboutMatch[1]);
  const model=shortModel(title);
  if(model && text.toLowerCase().startsWith(title.toLowerCase())){
    text=model+text.slice(title.length);
  }
  text=text
    .replace(/Available model evidence on this page includes\s+/i,"Key details include ")
    .replace(/camera detail stated in the catalogue title/ig,"camera")
    .replace(/RAM, storage and other seller-specific configurations are kept separate so they are not mistaken for fixed model facts\./i,"RAM and storage vary by seller record and are shown separately in the technical section.")
    .replace(/Seller-specific options are shown separately where the catalogue provides them\./i,"Seller-specific options are shown in the technical section when available.")
    .replace(/\s+and\s+(\d+(?:\.\d+)?\s+in\s+screen)\s+and\s+/i,", $1 and ");
  text=clean(text);
  return body.replace(aboutMatch[0],`<p class="about-copy">${esc(text)}</p>`);
}
function friendlierTruth(body){
  return body
    .replace(/exact product destination not verified/ig,"Exact seller listing not confirmed")
    .replace(/exact product destination/ig,"exact seller listing")
    .replace(/Marketplace search route/ig,"Marketplace search")
    .replace(/This opens a broader seller or marketplace search\. Confirm the exact item before buying\./ig,"This opens a broader marketplace search. Confirm the exact product before buying.");
}
function truncate(v,max=165){
  let t=clean(v);
  if(t.length<=max)return t;
  t=t.slice(0,max-1).replace(/\s+\S*$/," ").trim();
  return `${t}…`;
}
function syncSeo(body){
  const description=stripTags((body.match(/<p class="about-copy">([\s\S]*?)<\/p>/i)||[])[1]||"");
  if(!description)return body;
  const meta=truncate(description);
  body=body.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${esc(meta)}">`);
  body=body.replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${esc(meta)}">`);
  body=body.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,(all,json)=>{
    try{
      const ld=JSON.parse(json);
      ld.description=description;
      return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,"\\u003c")}</script>`;
    }catch{return all;}
  });
  return body;
}
function injectUi(body){
  const css=`
/* V20.9.6 compact mobile product UI: presentation only; product/seller truth remains V20.9.5. */
.about{padding:20px!important}.about-copy{max-width:72ch}.buyer-note{padding:11px 13px!important;margin-top:12px!important;font-size:13px!important;line-height:1.45!important}
.decision{padding:13px 15px!important;margin:12px 0!important;border-radius:17px!important}.decision>div{gap:5px!important}.decision strong{font-size:13px!important}.decision span{font-size:17px!important}.decision p{font-size:13px!important;line-height:1.4!important;margin-top:4px!important}
.seller-card{padding:15px!important}.seller-card h3{font-size:20px!important}.seller-card .seller-top p{font-size:14px!important}.seller-card .cta{margin-top:10px!important;padding:11px 14px!important}.route-note{font-size:12px!important;margin-top:7px!important}
.catalogue-records{margin-top:10px;border-top:1px solid #e8edeb;padding-top:9px}.catalogue-records>summary{font-size:13px;list-style:none;cursor:pointer;color:#3157e8;font-weight:850}.catalogue-records>summary::-webkit-details-marker{display:none}.catalogue-records>summary:after{content:" +"}.catalogue-records[open]>summary:after{content:" −"}.catalogue-records .suboffer{margin-top:7px}
.technical-disclosure{margin:16px 0 0;background:#fff;border:1px solid #e1e6ef;border-radius:18px;overflow:hidden}.technical-disclosure>summary{list-style:none;cursor:pointer;padding:15px 17px;display:flex;flex-direction:column;gap:3px;color:#172033}.technical-disclosure>summary::-webkit-details-marker{display:none}.technical-disclosure>summary span{font-size:17px;font-weight:900}.technical-disclosure>summary small{font-size:12px;color:#667085;font-weight:600}.technical-disclosure>summary:after{content:"Show +";position:absolute;right:18px;color:#3157e8;font-size:12px;font-weight:900}.technical-disclosure[open]>summary:after{content:"Hide −"}.technical-disclosure>summary{position:relative;padding-right:78px}.technical-disclosure-content{padding:0 13px 13px}.technical-disclosure .technical-heading,.technical-disclosure .technical-intro{display:none}.technical-disclosure .technical-panel{margin:10px 0!important;padding:15px!important}.technical-disclosure .technical-panel h2{font-size:20px!important}.technical-disclosure .variant{padding:11px 12px!important}.technical-disclosure .variant strong{font-size:15px!important}.technical-disclosure .variant span{font-size:12px!important}.technical-disclosure .truth-note{font-size:12px!important}
@media(max-width:650px){main{padding:12px 12px 82px!important}.hero{gap:10px!important;margin-bottom:12px!important}.hero h1{font-size:clamp(22px,5.7vw,26px)!important;line-height:1.05!important;margin:4px 0 7px!important}.hero p{font-size:12px!important;line-height:1.35!important}.hero-media{min-height:220px!important;max-width:310px!important}.hero-media>img{height:196px!important}.about{padding:15px!important;margin-top:10px!important}.about h2{font-size:22px!important;margin-bottom:7px!important}.about-copy{font-size:15px!important;line-height:1.55!important}.decision{padding:11px 13px!important}.seller-card{padding:13px!important}.seller-card h3{font-size:19px!important}.bottom{left:18px!important;right:18px!important;bottom:5px!important;padding:3px 5px!important;border-radius:18px!important}.bottom a{min-height:38px!important;font-size:10px!important;padding:0 5px!important}.technical-disclosure{margin-top:12px}.technical-disclosure>summary{padding:13px 15px;padding-right:72px}}
`;
  const i=body.lastIndexOf("</style>");
  if(i>=0)body=body.slice(0,i)+css+body.slice(i);
  body=body.replace(/<body([^>]*)>/i,(m,attrs)=>{
    if(/data-tp-product-ui=/i.test(attrs))return m;
    return `<body${attrs} data-tp-product-ui="${UI_VERSION}">`;
  });
  const script=`<script>(()=>{const run=()=>{const clean=v=>String(v??'').replace(/\\s+/g,' ').trim();const tech=document.querySelector('.technical-wrap');if(tech&&!tech.closest('.technical-disclosure')){const d=document.createElement('details');d.className='technical-disclosure';const s=document.createElement('summary');s.innerHTML='<span>Technical specifications & configurations</span><small>Screen, battery, RAM, storage and catalogue evidence</small>';const c=document.createElement('div');c.className='technical-disclosure-content';while(tech.firstChild)c.appendChild(tech.firstChild);d.append(s,c);tech.replaceWith(d)}document.querySelectorAll('.seller-card').forEach(card=>{const confidence=clean(card.querySelector('.confidence')?.textContent);if(!/Marketplace search/i.test(confidence))return;card.classList.add('generic-route');const list=card.querySelector('.offer-list');if(!list||list.closest('.catalogue-records'))return;const links=[...list.querySelectorAll('a.suboffer')].map(a=>a.cloneNode(true));if(!links.length)return;const count=Number((clean(card.querySelector('.seller-top p')?.textContent).match(/(\\d+)\\s+catalogue record/i)||[])[1]||links.length);const d=document.createElement('details');d.className='catalogue-records';const s=document.createElement('summary');s.textContent='Show '+count+' catalogue record'+(count===1?'':'s');d.appendChild(s);for(const a of links)d.appendChild(a);list.replaceWith(d)});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();})();</script>`;
  return body.replace(/<\/body>/i,`${script}</body>`);
}
function transform(body){
  if(!body||!/<html/i.test(body))return body;
  body=naturalizeDescription(body);
  body=friendlierTruth(body);
  body=syncSeo(body);
  body=injectUi(body);
  return body;
}

exports.handler=async function(event,context){
  const res=await previous.handler(event,context);
  const type=String(res?.headers?.["content-type"]||res?.headers?.["Content-Type"]||"");
  if(res?.statusCode===200 && /text\/html/i.test(type)){
    res.body=transform(res.body);
    res.headers={...(res.headers||{}),"x-trendpilot-product-ui":UI_VERSION};
  }
  return res;
};
