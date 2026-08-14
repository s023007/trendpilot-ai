(() => {
  "use strict";

  const DATA_VERSION = "20.9.0";
  const RUNTIME_VERSION = "20.9.4";
  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const C = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const L = v => C(v).toLowerCase();
  const E = v => C(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const p = new URLSearchParams(location.search);
  const q = C(p.get("q"));
  const scope = C(p.get("scope"));
  const BLOCK = new Set(["temu","joom","filamentpro","filamentpro eu cps","filamentpro-eu-cps"]);
  const STOP = new Set(["the","and","for","with","from","this","that","your","our","new","best","buy","original","official","product","products","item","items","of","to","in","on","by","a","an"]);
  const cache = new Map();
  const state = {all:[],filtered:[],page:24,min:0,max:0,exactOnly:false,seller:"",sort:"smart"};

  function roleIntent(value) {
    const x=L(value);
    if (/\b(?:used|refurbished|renewed|pre[- ]?owned|second[- ]?hand|open[- ]?box)\b/i.test(x)) return "used";
    if (/\b(?:replacement|spare|repair|parts?|carbon brush|armature|stator|rotor|carburetor|screen replacement|replacement battery|replacement filter)\b/i.test(x)) return "replacement_part";
    if (/\b(?:accessor(?:y|ies)|case|cover|holder|stand|mount|strap|lanyard|sleeve|screen protector|tempered glass|watch band|watch strap|ear pads?|ear cushions?|charging cable|usb cable|charger|dock)\b/i.test(x)) return "accessory";
    return "main";
  }

  function familyFor(value) {
    const x=L(value);
    const rules=[
      ["phone",/\b(?:phone|smartphone|iphone|galaxy|pixel|redmi|oneplus|phone case|phone holder|phone charger)\b/i],
      ["tablet",/\b(?:tablet|ipad|galaxy tab|surface pro)\b/i],
      ["laptop",/\b(?:laptop|chromebook|notebook computer|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop)\b/i],
      ["computer",/\b(?:computer|pc\b|desktop|monitor|keyboard|mouse|ssd|hard drive|nvme|ram\b|graphics card|gpu\b|motherboard)\b/i],
      ["camera",/\b(?:camera|webcam|camera lens|dash cam|action cam|tripod)\b/i],
      ["printer",/\b(?:printer|label printer|thermal printer|laser printer|inkjet)\b/i],
      ["projector",/\bprojector\b/i],["television",/\b(?:television|smart tv|oled tv|qled tv|led tv)\b/i],
      ["speaker",/\b(?:speaker|soundbar|subwoofer)\b/i],["microphone",/\b(?:microphone|wireless mic|usb mic|lavalier mic)\b/i],
      ["headphones",/\b(?:headphone|headset|earbud|earphone|airpods|tws)\b/i],["smartwatch",/\b(?:smartwatch|smart watch|apple watch|watch band|watch strap)\b/i],
      ["power-bank",/\b(?:power bank|powerbank|portable charger|external battery)\b/i],["3d-printing",/\b(?:3d print|3d printer|filament|pla\b|petg\b|tpu\b|resin printer)\b/i],
      ["tools",/\b(?:tool|drill|saw|grinder|screwdriver|wrench|pliers|multimeter|oscilloscope|caliper|soldering|carbon brush|armature|stator)\b/i],
      ["industrial",/\b(?:industrial|cnc|hydraulic|pneumatic|servo|encoder|solenoid|contactor|plc)\b/i],
      ["home-appliances",/\b(?:vacuum|air fryer|coffee maker|espresso machine|blender|kettle|toaster|rice cooker|humidifier|air purifier|fan\b)\b/i],
      ["air-conditioning",/\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i],
      ["lighting",/\b(?:lighting|lights?|lamps?|ceiling light|wall light|desk lamp|floor lamp|table lamp|solar light|string light|fairy light|night light)\b/i],
      ["kitchen",/\b(?:cookware|pan\b|saucepan|wok|skillet|kitchen knife|cutting board|kitchen utensil)\b/i],
      ["furniture",/\b(?:furniture|desk\b|chair\b|sofa|couch|table\b|cabinet|bookshelf|wardrobe|nightstand|bed frame)\b/i],
      ["home",/\b(?:home decor|bedding|blanket|pillow|curtain|organizer|storage box|cleaning brush|night light)\b/i],
      ["automotive",/\b(?:car\b|automotive|vehicle|brake|spark plug|ignition coil|fuel pump|car charger|car mount|carplay|head unit)\b/i],
      ["pets",/\b(?:pet\b|dog\b|cat\b|puppy|kitten|leash|collar|litter)\b/i],
      ["beauty",/\b(?:beauty|skincare|skin care|makeup|serum|lipstick|mascara|hair dryer|hair straightener|nail care|grooming)\b/i],
      ["perfume",/\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i],
      ["apparel",/\b(?:dress|shirt|t-shirt|hoodie|sweater|jacket|coat|jeans|trousers|pants|skirt|shorts|shoes|sneakers|boots|sandals|hat\b|cap\b)\b/i],
      ["bags",/\b(?:bag\b|handbag|backpack|wallet|cardholder)\b/i],
      ["sports",/\b(?:fitness|gym\b|exercise|treadmill|exercise bike|rowing machine|resistance band|camping|cycling)\b/i],
      ["baby",/\b(?:baby|stroller|infant|diaper|nappy)\b/i],["toys",/\b(?:toy|doll|action figure|building blocks|plush)\b/i],
      ["office",/\b(?:stationery|notebook|pen\b|pencil|office supplies)\b/i],["arts-crafts",/\b(?:diamond painting|diamond art|painting kit|art supplies|craft kit|diy craft)\b/i],
      ["jewelry-craft",/\b(?:jewelry|jewellery|necklace|bracelet|earring|pendant|beads|charms|ring\b)\b/i],
      ["medical",/\b(?:medical|surgical|diagnostic|blood pressure|oximeter|dental|patient monitor)\b/i]
    ];
    for(const [fam,re] of rules) if(re.test(x)) return fam;
    return "";
  }

  const intent=roleIntent(q), family=familyFor(q);
  const tokens=L(q).replace(/[^a-z0-9.+#/-]+/g," ").split(/\s+/).filter(t=>t&&!STOP.has(t)&&(t.length>=3||(/[a-z]/.test(t)&&/\d/.test(t))));
  const GENERIC={
    phone:/^(?:phones?|smartphones?|mobile phones?)$/i,
    laptop:/^(?:laptops?|notebooks?)$/i,
    perfume:/^(?:perfumes?|fragrances?|colognes?)$/i,
    "power-bank":/^(?:power\s*banks?|powerbanks?|portable chargers?)$/i,
    lighting:/^(?:lighting|lights?|lamps?)$/i
  };
  const genericFamily=Boolean(family&&GENERIC[family]?.test(L(q)));
  const fetchJSON=url=>{if(!cache.has(url))cache.set(url,fetch(url,{cache:"force-cache"}).then(r=>r.ok?r.json():null).catch(()=>null));return cache.get(url)};
  const prefix=t=>(t.replace(/[^a-z0-9]/g,"").slice(0,2)||"__").padEnd(2,"_");
  const unique=a=>[...new Set(a)], intersect=(a,b)=>{const s=new Set(b);return a.filter(x=>s.has(x))};

  async function idsFor(t){
    const shard=await fetchJSON(`/data/v20-9/terms/${prefix(t)}.json?v=${DATA_VERSION}`);if(!shard)return[];
    if(shard[t])return shard[t];
    if(t.length>=3){const out=[];for(const[k,ids]of Object.entries(shard)){if(!k.startsWith(t))continue;out.push(...ids);if(out.length>=1400)break}return unique(out)}
    return[];
  }

  async function candidates(){
    const groups=[];
    for(const t of tokens.slice(0,7)){const ids=await idsFor(t);if(ids.length)groups.push(ids)}
    let text=[];
    if(groups.length){groups.sort((a,b)=>a.length-b.length);text=groups[0].slice();for(const g of groups.slice(1)){const z=intersect(text,g);if(z.length)text=z}if(!text.length)text=unique(groups.flat()).slice(0,500)}
    let fam=[];
    if(family){const f=await fetchJSON(`/data/v20-9/families.json?v=${DATA_VERSION}`);fam=f?.[family]||[]}
    let ids=text;
    if(fam.length&&text.length){const strict=intersect(text,fam);ids=genericFamily?unique([...strict,...fam]):strict.length>=8?strict:unique([...strict,...text,...fam])}else if(fam.length)ids=fam;
    return unique(ids).slice(0,720);
  }

  async function loadRows(ids){
    const groups={};for(const id of ids)(groups[id.slice(0,2)]??=[]).push(id);const out=[];
    await Promise.all(Object.entries(groups).map(async([pre,list])=>{const b=await fetchJSON(`/data/v20-9/products/${pre}.json?v=${DATA_VERSION}`)||{};for(const id of list)if(b[id])out.push(b[id])}));return out;
  }

  const roleName=r=>({main:"Main product",accessory:"Accessory",replacement_part:"Replacement part",used:"Used / refurbished"}[C(r)]||C(r||"Product").replaceAll("_"," "));
  const familyName=r=>C(r||"Product").replaceAll("-"," ").replace(/\b\w/g,m=>m.toUpperCase());
  const money=r=>`${r.cu==="USD"?"US$":E((r.cu||"")+" ")}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  function priceInfo(r){if(!r.p)return{label:"Check current price",proof:"Confirm with seller",kind:"check"};if(r.x)return{label:money(r),proof:"✓ Exact-product price",kind:"verified"};return{label:money(r),proof:"Seller-feed price",kind:"feed"}}

  function score(r){
    const title=L(r.t),search=L(r.s),type=L(r.ty),fam=L(r.fa),role=C(r.ro||"main");let n=Number(r.r||0)/12;
    if(title===L(q))n+=120;if(title.includes(L(q)))n+=48;if((r.ids||[]).some(x=>L(x)===L(q)))n+=130;
    for(const t of tokens){if(title.includes(t))n+=16;else if(search.includes(t))n+=7}
    if(family&&(fam===family||type===family))n+=38;
    if(intent==="main")n+=role==="main"?36:role==="used"?20:-60;else if(intent==="used")n+=role==="used"?55:-35;else n+=role===intent?55:-42;
    if(r.x)n+=10;if(r.im)n+=5;if(r.p)n+=2;return n;
  }
  function roleOK(r){const role=C(r.ro||"main");if(intent==="main")return role==="main"||role==="used";if(intent==="used")return role==="used";return role===intent}
  function semanticOK(r){
    if(!genericFamily||intent!=="main")return true;
    const title=L(r.t),fam=L(r.fa||r.ty);
    if(fam!==family)return false;
    const bad={
      phone:/\b(?:(?:battery|power\s*bank|charging|protective|shockproof|wallet|silicone|leather)\s+case|case\s+(?:for|fits?|compatible\s+with)|screen\s+protector|tempered\s+glass|phone\s+(?:holder|mount)|replacement\s+(?:screen|battery)|motherboard|charging\s+port|flex\s+cable)\b/i,
      laptop:/\b(?:motherboard|mainboard|replacement\s+battery|battery\s+for|charger\s+for|adapter\s+for|keyboard\s+for|screen\s+for|lcd\s+for|hinge|palmrest|bottom\s+case|top\s+case|cooling\s+fan|heatsink|dc\s+jack|charging\s+port|laptop\s+(?:sleeve|bag|stand|dock)|docking\s+station)\b/i,
      perfume:/\b(?:vending\s+machine|dispensing\s+machine|empty\s+(?:perfume\s+)?bottle|refillable\s+perfume\s+bottle|perfume\s+atomizer|perfume\s+sprayer|filling\s+machine|packaging\s+machine|bottle\s+cap|display\s+stand)\b/i,
      "power-bank":/\b(?:battery\s+adapter|adapter\s+converter|converter\s+charger|power\s*bank\s+case|powerbank\s+case|housing|shell|pcb|circuit\s+board|power\s+module|battery\s+holder)\b/i,
      lighting:/\b(?:scooter|e-?bike|bicycle|motorcycle|car\b|vehicle|automotive|headlight|tail\s*light|taillight|turn\s+signal|indicator|helmet)\b/i
    };
    return !(bad[family]?.test(title));
  }

  function compareItems(){try{const x=JSON.parse(localStorage.getItem("tp-v209-compare")||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
  function setCompare(items){try{localStorage.setItem("tp-v209-compare",JSON.stringify(items.slice(0,3)))}catch{};$$('[data-compare-count]').forEach(el=>{el.textContent=String(items.length);el.toggleAttribute("hidden",!items.length)})}
  function addCompare(r,b){const items=compareItems();if(items.some(x=>(typeof x==="string"?x:x.id)===r.id)){location.href="/compare/";return}const first=items[0],ff=typeof first==="object"?C(first.fa):"";if(ff&&C(r.fa)&&ff!==C(r.fa)){b.textContent="Choose the same family";setTimeout(()=>b.textContent="Compare",1400);return}if(items.length>=3){b.textContent="Comparison is full";setTimeout(()=>b.textContent="Compare",1400);return}items.push({id:r.id,fa:C(r.fa),t:C(r.t),ty:C(r.ty)});setCompare(items);b.textContent="Added ✓"}

  function card(r){const pi=priceInfo(r),href=`/item/?id=${encodeURIComponent(r.id)}&q=${encodeURIComponent(q)}`;return `<article class="tp78-card tp90-search-card" data-v209-card data-v209-seller="${E(r.se)}" data-v209-role="${E(r.ro||"main")}" data-v209-family="${E(r.fa||r.ty)}"><a class="tp78-media" href="${E(href)}" aria-label="View ${E(r.t)} details">${r.im?`<img src="${E(r.im)}" alt="${E(r.t)}" width="360" height="360" loading="lazy">`:"<span class=\"tp78-fallback\">TP</span>"}</a><div class="tp78-body"><div class="tp78-top"><b>${E(r.b||r.tyl||"Product")}</b><span>${E(r.se)}</span></div><h3><a href="${E(href)}">${E(r.t)}</a></h3><strong class="tp78-price">${E(pi.label)}</strong><span class="tp80-price-proof ${pi.kind}">${E(pi.proof)}</span><p class="tp80-universal-meta">${E(r.tyl||r.ty)} · ${E(roleName(r.ro))} · ${E(familyName(r.fa||r.ty))}</p><div class="tp78-actions"><a class="tp78-primary internal-detail" href="${E(href)}">View details →</a><button class="tp78-secondary" type="button" data-v209-compare="${E(r.id)}">Compare</button></div>${!r.x&&r.p?'<small class="tp80-route-note">Seller catalogue price. Review the TrendPilot detail page before opening the seller.</small>':""}</div></article>`}

  function buildBudget(){const host=$("[data-budget-tools]");if(!host||host.dataset.v209==="1")return;host.dataset.v209="1";host.innerHTML=`<div class="tp-budget-title"><strong>Your budget</strong><button type="button" data-v209-budget-clear>Clear</button></div><div class="tp-budget-numbers"><label>Min $<input data-v209-min type="number" min="0" step="1" placeholder="0"></label><span>to</span><label>Max $<input data-v209-max type="number" min="0" step="1" placeholder="Any"></label></div><label class="tp-verified-only"><input data-v209-exact type="checkbox"><span><strong>Exact-product prices only</strong><small>Hide seller-feed prices and check-at-seller rows.</small></span></label><div class="tp-budget-status" data-v209-budget-status>No budget selected.</div>`;host.addEventListener("input",e=>{if(e.target.matches("[data-v209-min]"))state.min=Math.max(0,Number(e.target.value)||0);if(e.target.matches("[data-v209-max]"))state.max=Math.max(0,Number(e.target.value)||0);if(e.target.matches("[data-v209-exact]"))state.exactOnly=e.target.checked;filter()});host.addEventListener("change",e=>{if(e.target.matches("[data-v209-exact]")){state.exactOnly=e.target.checked;filter()}});host.addEventListener("click",e=>{if(!e.target.closest("[data-v209-budget-clear]"))return;state.min=state.max=0;state.exactOnly=false;const a=$("[data-v209-min]"),b=$("[data-v209-max]"),c=$("[data-v209-exact]");if(a)a.value="";if(b)b.value="";if(c)c.checked=false;filter()})}

  function filter(){
    state.filtered=state.all.filter(r=>{if(state.seller&&C(r.se)!==state.seller)return false;const price=Number(r.p)||0;if(state.min&&(price<state.min||!price))return false;if(state.max&&(price>state.max||!price))return false;if(state.exactOnly&&!r.x)return false;return true});
    if(state.sort==="price-low")state.filtered.sort((a,b)=>(a.p||Infinity)-(b.p||Infinity));else if(state.sort==="price-high")state.filtered.sort((a,b)=>(b.p||0)-(a.p||0));else if(state.sort==="best-value")state.filtered.sort((a,b)=>(Number(b.x)-Number(a.x))||((a.p||Infinity)-(b.p||Infinity))||(b._score-a._score));else state.filtered.sort((a,b)=>b._score-a._score);state.page=24;draw();
  }

  function draw(){const grid=$("[data-v2078-product-grid]");if(!grid)return;const shown=state.filtered.slice(0,state.page);grid.innerHTML=shown.length?shown.map(card).join(""):`<div class="tp80-no-result"><h2>No products match these filters.</h2><p>Try All sellers, remove the budget filter, or search a more specific model/part number.</p></div>`;const count=$("[data-v2078-results-count]");if(count)count.textContent=`${state.filtered.length} matching`;const status=$("[data-v209-budget-status]");if(status)status.textContent=[`${state.filtered.length} shown by current filters`,state.exactOnly?"exact-product prices only":"all price evidence"].join(" · ");const more=$("[data-v2078-load-more]");if(more){more.hidden=state.page>=state.filtered.length;more.textContent=`Show more products (${Math.max(0,state.filtered.length-state.page)} remaining)`}$$('[data-v209-compare]').forEach(b=>b.addEventListener("click",()=>{const r=state.all.find(x=>x.id===b.dataset.v209Compare);if(r)addCompare(r,b)}));setCompare(compareItems())}

  function sellerFilter(){const sel=$("[data-filter-merchant]");if(!sel)return;const sellers=unique(state.all.map(r=>C(r.se)).filter(Boolean)).sort((a,b)=>a.localeCompare(b));const key=`tp-v209-seller:${L(q)}`;let saved="";try{saved=sessionStorage.getItem(key)||""}catch{}sel.innerHTML='<option value="">All sellers</option>'+sellers.map(s=>`<option value="${E(s)}">${E(s)}</option>`).join("");if(saved&&sellers.includes(saved)){sel.value=saved;state.seller=saved}sel.addEventListener("change",()=>{state.seller=sel.value;try{sessionStorage.setItem(key,state.seller)}catch{}filter()});const sort=$("[data-filter-sort]");if(sort){state.sort=sort.value||"smart";sort.addEventListener("change",()=>{state.sort=sort.value||"smart";filter()})}}

  function navigation(){
    const form=$("[data-v2078-finder-form]"),input=$("[data-tp-finder-input]"),scopeEl=$("[data-tp-finder-scope]");if(input&&q)input.value=q;if(scopeEl&&scope)scopeEl.value=scope;
    const go=(value,sc="")=>{const x=C(value);if(!x)return;const n=new URLSearchParams({q:x,engine:"v2064",universal:"1",ui:"2094"});if(C(sc))n.set("scope",C(sc));location.assign(`/find/?${n}`)};
    form?.addEventListener("submit",e=>{e.preventDefault();go(input?.value,scopeEl?.value)});
    $$('[data-search-suggestion]').forEach(b=>b.addEventListener("click",()=>go(b.dataset.searchSuggestion,b.dataset.searchScope||scopeEl?.value||"")));
    const nav=$("[data-tp-nav]"),open=$("[data-tp-menu-button]"),close=$("[data-tp-menu-close]"),back=$("[data-tp-nav-backdrop]");if(nav&&open){const set=v=>{nav.classList.toggle("is-open",v);back?.classList.toggle("is-open",v);d.body.classList.toggle("tp-menu-open",v);open.setAttribute("aria-expanded",String(v))};open.addEventListener("click",()=>set(!nav.classList.contains("is-open")));close?.addEventListener("click",()=>set(false));back?.addEventListener("click",()=>set(false));d.addEventListener("keydown",e=>{if(e.key==="Escape")set(false)})}
    $$('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());
    const more=$("[data-v2078-load-more]");more?.addEventListener("click",()=>{state.page+=24;draw()});
  }

  async function logDemand(){const body=JSON.stringify({q,source:document.referrer||"",path:location.pathname+location.search});try{await fetch("/.netlify/functions/discovery-demand-v20-8",{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true})}catch{try{localStorage.setItem("tp-v20-9-missed:"+L(q),new Date().toISOString())}catch{}}}

  async function boot(){
    navigation();buildBudget();setCompare(compareItems());if(!q)return;
    const grid=$("[data-v2078-product-grid]");if(!grid)return;grid.innerHTML='<div class="tp78-empty"><h3>Searching the full catalogue…</h3><p>Checking product family, role, identifiers and seller evidence.</p></div>';
    const ids=await candidates();let found=await loadRows(ids);found=found.filter(r=>!BLOCK.has(L(r.se))&&roleOK(r)&&semanticOK(r)).map(r=>({...r,_score:score(r)})).filter(r=>r._score>-10).sort((a,b)=>b._score-a._score);
    if(!found.length){await logDemand();grid.innerHTML='<div class="tp80-no-result"><h2>We could not verify this product yet.</h2><p>Try a model, MPN, SKU, part number or a more specific phrase. TrendPilot recorded the search for future catalogue updates.</p><a href="/rare-used/">Explore Rare Finds</a></div>';const c=$("[data-v2078-results-count]");if(c)c.textContent="0 matching";return}
    state.all=found.slice(0,240);const head=$("[data-v2078-results-title]");if(head)head.textContent=`Results for “${q}”`;const sub=$("[data-v2078-results-sub]");if(sub)sub.textContent=intent==="main"?"Main and used/refurbished products are shown; accessories and replacement parts stay out unless you ask for them.":`Showing ${roleName(intent).toLowerCase()} results matched to the requested product family.`;sellerFilter();filter();
  }

  window.__TP_V2091_UNIVERSAL__={dataVersion:DATA_VERSION,runtimeVersion:RUNTIME_VERSION};
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();