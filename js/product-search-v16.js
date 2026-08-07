(() => {
  "use strict";

  const VERSION = "16.0.0";
  const APPROVED = [
    "AliExpress","Alibaba","Geekbuying","Lenovo","Joom",
    "Diecast","FragranceShop.com","Karaca EU","MFI Medical","PandaHall","Temu"
  ];
  const ALIASES = {
    "aliexpress":["aliexpress","ali express"],
    "alibaba":["alibaba","alibaba.com"],
    "geekbuying":["geekbuying","geek buying"],
    "lenovo":["lenovo","lenovo many geos"],
    "joom":["joom","joom.com"],
    "diecast":["diecast","diecast.com","diecast models wholesale"],
    "fragranceshop.com":["fragranceshop.com","fragrance shop","the fragrance shop"],
    "karaca eu":["karaca eu","karaca europe","karaca"],
    "mfi medical":["mfi medical","mfimedical","mfi"],
    "pandahall":["pandahall","panda hall"],
    "temu":["temu","temu.com","shop temu"]
  };

  const POPULAR = [
    "phone cases","power banks","perfume","pencils","pens","pencil cases","printers","pet supplies","projectors",
    "phones","smartphones","phone chargers","phone cables","screen protectors","phone holders","wireless chargers",
    "portable chargers","tablets","laptops","laptop bags","keyboards","mice","monitors","storage drives","USB hubs",
    "earbuds","headphones","speakers","microphones","smartwatches","watches","security cameras","dash cams",
    "wireless CarPlay adapters","car chargers","car accessories","digital cameras","camera lenses","tripods",
    "women's clothing","women's dresses","women's tops","women's shoes","women's handbags","women's jewelry",
    "men's T-shirts","men's shirts","men's shorts","men's shoes","men's watches","kids clothing","kids shoes",
    "necklaces","bracelets","rings","earrings","handbags","backpacks","wallets","sneakers","sandals","boots",
    "makeup","skin care","hair care","nail care","fragrance","cosmetics","makeup brushes","hair styling tools",
    "school supplies","notebooks","calculators","stationery","desk organizers","school bags",
    "tools","power tools","hand tools","drills","saws","screwdrivers","multimeters","tool storage","soldering tools",
    "home decor","furniture","cookware","dinnerware","kitchen appliances","coffee makers","bedding","curtains",
    "toys","puzzles","board games","building toys","dolls","educational toys","pet toys","pet feeders",
    "sports equipment","fitness equipment","camping","cycling","fishing","running shoes","yoga",
    "medical equipment","blood pressure monitors","stethoscopes","patient monitors","wheelchairs",
    "beads","jewelry making supplies","craft supplies","sewing supplies","DIY supplies",
    "3D printers","3D filament","thermal printers","labels","office printers",
    "wholesale products","bulk products","OEM products","private label products"
  ];

  const SYNONYMS = {
    "power bank":["power bank","power banks","portable charger","portable chargers","battery pack","battery packs","powerbank"],
    "phone case":["phone case","phone cases","mobile case","mobile cases","iphone case","android case","protective case","cover"],
    "pen":["pen","pens","ballpoint pen","gel pen","rollerball pen","writing pen"],
    "pencil":["pencil","pencils","mechanical pencil","colored pencils","colour pencils"],
    "necklace":["necklace","necklaces","pendant","pendants","chain necklace","jewelry necklace","jewellery necklace"],
    "women clothing":["women clothing","women's clothing","womens clothing","ladies clothing","female clothing","women fashion","women's fashion"],
    "perfume":["perfume","fragrance","eau de parfum","eau de toilette","cologne"],
    "earbuds":["earbuds","earphones","tws","wireless earbuds","in ear headphones"],
    "laptop":["laptop","laptops","notebook computer","notebook computers"],
    "school supplies":["school supplies","stationery","school stationery","student supplies"],
    "carplay":["carplay","wireless carplay","carplay adapter","wireless carplay adapter"],
    "jewelry":["jewelry","jewellery","necklace","bracelet","ring","earrings","pendant"]
  };

  const norm = v => String(v ?? "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const uniq = a => [...new Set(a.filter(Boolean))];
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const validUrl = v => /^https?:\/\//i.test(String(v||""));
  const sellerName = p => String(p?.advertiser || p?.seller || p?.merchant || "").trim();

  function canonicalSeller(value) {
    const n = norm(value);
    for (const approved of APPROVED) {
      const keys = ALIASES[norm(approved)] || [approved];
      if (keys.some(x => {
        const a = norm(x);
        return n === a || (a.length >= 4 && (n.includes(a) || a.includes(n)));
      })) return approved;
    }
    return "";
  }

  function normalizeProduct(p) {
    const x = {...p};
    x.id = String(x.id || x.clusterKey || x.url || x.name || crypto.randomUUID?.() || Math.random());
    x.name = String(x.name || "").trim();
    x.url = String(x.url || x.affiliateUrl || x.productUrl || "").trim();
    x.image = String(x.image || x.imageUrl || "").trim();
    x.advertiser = canonicalSeller(sellerName(x));
    x.group = String(x.group || "other");
    x.family = String(x.family || x.group || "other");
    x.audience = String(x.audience || "all");
    x.price = Number(x.price || 0) || 0;
    x.oldPrice = Number(x.oldPrice || 0) || 0;
    x.quality = Number(x.quality || x.qualityScore || 0) || 0;
    x.currency = String(x.currency || "USD");
    x.description = String(x.description || "");
    x.brand = String(x.brand || "");
    return x;
  }

  function money(v, currency="USD") {
    if (!Number(v)) return "Check current price";
    try { return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(v); }
    catch { return `${currency} ${Number(v).toFixed(2)}`; }
  }

  function tokenise(q) { return norm(q).split(/\s+/).filter(x=>x.length>1); }

  function expandQuery(q) {
    const base = norm(q);
    const out = new Set(tokenise(base));
    for (const [key, values] of Object.entries(SYNONYMS)) {
      const pool = [key, ...values].map(norm);
      if (pool.some(v => base.includes(v) || v.includes(base))) {
        pool.forEach(v => tokenise(v).forEach(t => out.add(t)));
      }
    }
    return [...out];
  }

  function queryPhrases(q) {
    const n = norm(q);
    const out = [n];
    for (const [key, vals] of Object.entries(SYNONYMS)) {
      const pool=[key,...vals].map(norm);
      if (pool.some(v => n.includes(v) || v.includes(n))) out.push(...pool);
    }
    return uniq(out);
  }

  function textOf(p) {
    return norm([p.name,p.brand,p.category,p.group,p.family,p.description].join(" "));
  }

  function productMatch(p, q) {
    const text = textOf(p);
    const phrases = queryPhrases(q);
    if (phrases.some(ph => ph.length >= 3 && text.includes(ph))) return true;
    const tokens = expandQuery(q).filter(t => !["product","products","item","items","buy","best"].includes(t));
    if (!tokens.length) return true;
    const hits = tokens.filter(t => text.includes(t)).length;
    return hits >= Math.max(1, Math.ceil(tokens.length * 0.55));
  }

  function scoreProduct(p, q) {
    const text = textOf(p), nq = norm(q), tokens=expandQuery(q);
    let s = p.quality / 10 + (p.image?8:0) + (p.price?5:0);
    if (nq && text.includes(nq)) s += 140;
    for (const t of tokens) {
      if (norm(p.name).includes(t)) s += 26;
      else if (text.includes(t)) s += 8;
    }
    if (p.advertiser) s += 3;
    return s;
  }

  function candidateKeys(manifest, q) {
    const keys = [];
    const tokens = expandQuery(q);
    tokens.forEach(t => (manifest.tokenRoutes?.[t] || []).forEach(k => keys.push(k)));

    const familyAliases = manifest.familyAliases || {};
    const families = new Set();
    const nq = norm(q);
    Object.entries(familyAliases).forEach(([alias,family]) => {
      const a=norm(alias);
      if ((a.length>=3 && nq.includes(a)) || (nq.length>=3 && a.startsWith(nq))) families.add(family);
    });
    const familyLabels = manifest.familyLabels || {};
    Object.entries(familyLabels).forEach(([family,label]) => {
      const l=norm(label);
      if ((l.length>=3 && nq.includes(l)) || (nq.length>=3 && l.startsWith(nq))) families.add(family);
    });

    if (families.size) {
      (manifest.segments||[]).forEach(s => { if (families.has(s.family)) keys.push(s.key); });
    }

    if (!keys.length) {
      const qtokens=tokenise(q);
      (manifest.segments||[]).forEach(s => {
        const meta=norm(`${s.key} ${s.group||""} ${s.family||""} ${s.audience||""}`);
        if (qtokens.some(t=>meta.includes(t))) keys.push(s.key);
      });
    }

    return uniq(keys).slice(0, 48);
  }

  async function fetchJson(url) {
    const r = await fetch(url,{cache:"force-cache"});
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  let manifestPromise;
  function loadManifest() {
    if (!manifestPromise) manifestPromise = fetchJson(`/data/search-catalog/manifest.json?v=v16-${Date.now()}`);
    return manifestPromise;
  }

  async function loadKey(meta, allPages=false) {
    const files = Array.isArray(meta?.files) ? meta.files : [];
    const chosen = allPages ? files : files.slice(0, Math.min(2, files.length));
    const pages = await Promise.all(chosen.map(async file => {
      try {
        const data = await fetchJson(`${file}?v=${encodeURIComponent(meta.generatedAt || VERSION)}`);
        return (data.products||[]).map(normalizeProduct).filter(p=>p.advertiser);
      } catch { return []; }
    }));
    return pages.flat();
  }

  async function federatedSearch(q, seller="") {
    const manifest = await loadManifest();
    let keys = candidateKeys(manifest,q);
    if (!keys.length) keys=(manifest.segments||[]).slice(0,30).map(s=>s.key);

    const metas = keys.map(k => (manifest.segments||[]).find(s=>s.key===k)).filter(Boolean);
    const allPages = Boolean(seller);
    const queue = metas.slice(0, allPages ? 36 : 22);
    const chunks = [];
    for (let i=0;i<queue.length;i+=6) {
      const batch = await Promise.all(queue.slice(i,i+6).map(m=>loadKey(m,allPages)));
      chunks.push(...batch);
    }

    const map=new Map();
    chunks.flat().forEach(p=>{
      if (!p.advertiser || !APPROVED.includes(p.advertiser)) return;
      const k=p.clusterKey||p.id||`${p.advertiser}|${p.name}|${p.url}`;
      if (!map.has(k) || scoreProduct(p,q)>scoreProduct(map.get(k),q)) map.set(k,p);
    });

    let rows=[...map.values()].filter(p=>productMatch(p,q));
    if (seller) rows=rows.filter(p=>p.advertiser===seller);
    rows.sort((a,b)=>scoreProduct(b,q)-scoreProduct(a,q));
    return {rows, manifest, keys};
  }

  function balanced(rows, limit=48) {
    const groups=new Map();
    APPROVED.forEach(s=>groups.set(s,[]));
    rows.forEach(p=>groups.get(p.advertiser)?.push(p));
    const out=[];
    let index=0;
    while(out.length<limit) {
      let added=false;
      for(const seller of APPROVED) {
        const row=groups.get(seller)?.[index];
        if(row){out.push(row);added=true;if(out.length>=limit)break;}
      }
      if(!added)break;
      index++;
    }
    return out;
  }

  function image(p) {
    return validUrl(p.image)
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `<span class="tpv16-img-fallback">${esc((p.advertiser||"TP").slice(0,2))}</span>`;
  }

  function card(p) {
    return `<article class="tpv16-card">
      <div class="tpv16-media">${image(p)}<button type="button" class="tpv16-quick" data-v16-quick="${esc(p.id)}">Quick view</button></div>
      <div class="tpv16-body">
        <div class="tpv16-seller">${esc(p.advertiser)}</div>
        <h3>${esc(p.name)}</h3>
        <div class="tpv16-price">${esc(money(p.price,p.currency))}</div>
        <div class="tpv16-actions">
          <button type="button" data-v16-quick="${esc(p.id)}">Quick view</button>
          <a href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-v16-outbound>Check price ↗</a>
        </div>
      </div>
    </article>`;
  }

  const resultCache=new Map();

  function ensureModal() {
    let m=document.querySelector("[data-v16-modal]");
    if(m)return m;
    m=document.createElement("div");m.className="tpv16-modal";m.dataset.v16Modal="";m.hidden=true;
    m.innerHTML=`<button class="tpv16-backdrop" data-v16-close aria-label="Close"></button>
      <section class="tpv16-dialog" role="dialog" aria-modal="true">
        <button class="tpv16-close" data-v16-close aria-label="Close">×</button>
        <div data-v16-modal-content></div>
      </section>`;
    document.body.appendChild(m);return m;
  }

  function openQuick(id){
    const p=resultCache.get(id);if(!p)return;
    const m=ensureModal(), host=m.querySelector("[data-v16-modal-content]");
    host.innerHTML=`<div class="tpv16-quick-grid">
      <div class="tpv16-quick-image">${image(p)}</div>
      <div><span class="tpv16-seller">${esc(p.advertiser)}</span><h2>${esc(p.name)}</h2>
      <div class="tpv16-price">${esc(money(p.price,p.currency))}</div>
      ${p.description?`<p>${esc(p.description.slice(0,420))}</p>`:""}
      <p class="tpv16-note">Price, stock and delivery can change. Confirm them on the seller page.</p>
      <a class="tpv16-primary" href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-v16-outbound>Check current price ↗</a>
      </div></div>`;
    m.hidden=false;requestAnimationFrame(()=>m.classList.add("is-open"));document.body.classList.add("tp-modal-open");
  }

  function closeQuick(){
    const m=document.querySelector("[data-v16-modal]");if(!m)return;
    m.classList.remove("is-open");document.body.classList.remove("tp-modal-open");setTimeout(()=>m.hidden=true,140);
  }

  function fixedSellerDropdown(){
    const s=document.querySelector("[data-filter-merchant]");if(!s)return;
    const current=s.value;
    s.innerHTML='<option value="">All approved sellers</option>'+APPROVED.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
    if(APPROVED.includes(current))s.value=current;
  }

  function suggestionVocabulary(manifest) {
    const rows=[...POPULAR];
    Object.values(manifest?.familyLabels||{}).forEach(x=>rows.push(String(x)));
    Object.keys(manifest?.familyAliases||{}).forEach(x=>{if(String(x).length>=3)rows.push(String(x));});
    return uniq(rows.map(x=>String(x).trim()).filter(x=>x.length>=2 && x.length<=42));
  }

  function rankSuggestion(x,q) {
    const a=norm(x), n=norm(q);
    let s=0;
    if(a.startsWith(n))s+=100;
    if(a.split(" ").some(w=>w.startsWith(n)))s+=55;
    if(a.includes(n))s+=20;
    if(POPULAR.includes(x))s+=12;
    s-=Math.max(0,a.length-24)*0.25;
    return s;
  }

  async function installAutocomplete(){
    const input=document.querySelector("[data-tp-finder-input]");
    if(!input)return;
    const manifest=await loadManifest().catch(()=>({}));
    const vocab=suggestionVocabulary(manifest);
    let box=document.querySelector("[data-v16-suggest]");
    if(!box){
      box=document.createElement("div");box.className="tpv16-suggest";box.dataset.v16Suggest="";box.hidden=true;
      input.closest(".tp-search-input")?.appendChild(box);
    }
    let moved=false,startY=0;
    box.addEventListener("touchstart",e=>{moved=false;startY=e.touches?.[0]?.clientY||0;},{passive:true});
    box.addEventListener("touchmove",e=>{if(Math.abs((e.touches?.[0]?.clientY||0)-startY)>8)moved=true;},{passive:true});
    box.addEventListener("click",e=>{
      const b=e.target.closest("[data-v16-suggestion]");if(!b||moved)return;
      input.value=b.dataset.v16Suggestion;box.hidden=true;input.focus();
    });
    const paint=()=>{
      const q=input.value.trim();
      if(!q){box.hidden=true;return;}
      const n=norm(q);
      const rows=vocab.filter(x=>{
        const a=norm(x);return a.startsWith(n)||a.split(" ").some(w=>w.startsWith(n))||a.includes(n);
      }).sort((a,b)=>rankSuggestion(b,q)-rankSuggestion(a,q)).slice(0,9);
      box.innerHTML=rows.length?rows.map(x=>`<button type="button" data-v16-suggestion="${esc(x)}"><span class="tpv16-search-icon">⌕</span><span><b>${esc(x)}</b><small>Search products</small></span></button>`).join(""):"";
      box.hidden=!rows.length;
    };
    input.addEventListener("input",paint);
    input.addEventListener("focus",paint);
    document.addEventListener("pointerdown",e=>{if(!box.contains(e.target)&&e.target!==input)box.hidden=true;});
  }

  function message(html){
    const grid=document.querySelector("[data-tp-product-grid]");if(grid)grid.innerHTML=html;
  }

  async function runSearch(q,seller,push=true){
    const grid=document.querySelector("[data-tp-product-grid]");
    const title=document.querySelector("[data-tp-results-title]");
    const status=document.querySelector("[data-tp-finder-status]");
    const count=document.querySelector("[data-tp-results-count]");
    if(!grid)return;
    fixedSellerDropdown();
    if(title)title.textContent=`Searching for “${q}”`;
    if(status)status.textContent=seller?`Checking the indexed catalogue for ${seller} across all relevant product pages.`:"Checking approved sellers and balancing relevant products across them.";
    if(count)count.textContent="Checking";
    grid.innerHTML='<div class="tpv16-loading"><span></span><b>Searching all relevant catalogue pages…</b></div>';

    try{
      const {rows}=await federatedSearch(q,seller);
      resultCache.clear();rows.forEach(p=>resultCache.set(p.id,p));
      const view=seller?rows.slice(0,72):balanced(rows,72);
      if(title)title.textContent=`Exact product matches for “${q}”`;
      if(count)count.textContent=`${rows.length} matches`;
      if(status){
        const sellers=uniq(rows.map(p=>p.advertiser));
        status.textContent=rows.length
          ? `${rows.length} relevant indexed products found across ${sellers.length} approved seller${sellers.length===1?"":"s"}.`
          : seller
            ? `No current indexed ${seller} listing closely matches “${q}”. This does not mean the seller never carries it.`
            : `No current indexed approved-seller listing closely matches “${q}”.`;
      }
      if(view.length) grid.innerHTML=view.map(card).join("");
      else {
        const alt=seller?`<button class="tpv16-primary" type="button" data-v16-all-sellers>Search all approved sellers</button>`:"";
        grid.innerHTML=`<div class="tp-empty tpv16-empty"><h3>No matching ${seller?esc(seller)+" ":""}products found.</h3><p>Try a synonym, a shorter product name, or another approved seller. TrendPilot will not invent a product match.</p>${alt}</div>`;
      }
      if(push){
        const params=new URLSearchParams({q});if(seller)params.set("seller",seller);
        history.replaceState(null,"",`/find/?${params.toString()}`);
      }
    }catch(err){
      console.error("TrendPilot V16 search failed",err);
      message('<div class="tp-empty"><h3>Search could not finish.</h3><p>Please retry. The existing catalogue has not been changed.</p></div>');
      if(status)status.textContent="The catalogue request failed before results were changed.";
      if(count)count.textContent="Retry";
    }
  }

  function installSearchOverride(){
    const form=document.querySelector("[data-tp-finder-form]");
    const input=document.querySelector("[data-tp-finder-input]");
    const seller=document.querySelector("[data-filter-merchant]");
    if(!form||!input||!seller)return;
    fixedSellerDropdown();

    form.addEventListener("submit",e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const q=input.value.trim()||"popular products";
      runSearch(q,seller.value,true);
    },true);

    seller.addEventListener("change",e=>{
      e.stopImmediatePropagation();
      const q=input.value.trim()||new URLSearchParams(location.search).get("q")||"popular products";
      runSearch(q,seller.value,true);
    },true);

    document.addEventListener("click",e=>{
      const qv=e.target.closest("[data-v16-quick]");if(qv){e.preventDefault();openQuick(qv.dataset.v16Quick);return;}
      if(e.target.closest("[data-v16-close]")){e.preventDefault();closeQuick();return;}
      if(e.target.closest("[data-v16-all-sellers]")){seller.value="";runSearch(input.value.trim()||"popular products","",true);return;}
    });

    const params=new URLSearchParams(location.search);
    const sellerParam=params.get("seller")||"";
    if(APPROVED.includes(sellerParam))seller.value=sellerParam;

    // Keep the seller list stable even when legacy V13 repopulates filters.
    new MutationObserver(()=>fixedSellerDropdown()).observe(seller,{childList:true});

    // If this URL was explicitly opened with a seller, run the federated seller search after legacy initialization.
    if(sellerParam && input.value.trim()) setTimeout(()=>runSearch(input.value.trim(),sellerParam,false),350);
  }

  async function init(){
    if(!location.pathname.startsWith("/find"))return;
    fixedSellerDropdown();
    await installAutocomplete();
    installSearchOverride();
    document.documentElement.classList.add("tp-v16-products");
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
