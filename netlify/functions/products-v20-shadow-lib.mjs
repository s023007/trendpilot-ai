const TYPE_ALIASES = {
  phone: ['phone','phones','smartphone','smartphones','mobile phone','cell phone','iphone','galaxy s','pixel'],
  laptop: ['laptop','laptops','notebook','notebooks','chromebook','thinkpad','macbook','ideapad'],
  smartwatch: ['smartwatch','smartwatches','smart watch','smart watches','apple watch','galaxy watch'],
  headphones: ['headphones','headphone','earbuds','earbud','earphones','earphone','headset','headsets'],
  perfume: ['perfume','perfumes','eau de parfum','eau de toilette','cologne','fragrance','attar'],
  dog_food: ['dog food','puppy food','canine food','dog kibble','kibble'],
  power_bank: ['power bank','power banks','powerbank','powerbanks','portable charger'],
  air_conditioner: ['air conditioner','air conditioners','portable ac','window ac','mini split','split ac'],
  '3d_filament': ['3d filament','filament','pla filament','petg filament','abs filament','tpu filament'],
  cookware: ['cookware','cookware set','frying pan','saucepan','skillet','casserole','dutch oven'],
  lighting: ['lighting','light','lights','lamp','lamps','bulb','bulbs','led strip','light strip','light bar','flood light','neon rope'],
  tools: ['tools','tool','drill','screwdriver','wrench','pliers','ratchet','socket set','hammer','grinder','circular saw','jigsaw']
};
const MODEL_HINTS = [
  ['phone', /\biphone\s?(?:1[0-9]|[6-9])\b/],
  ['phone', /\bgalaxy\s+s\d{1,2}\b/],
  ['phone', /\bpixel\s+\d{1,2}\b/],
  ['laptop', /\bthinkpad\b/],
  ['laptop', /\bmacbook\b/],
  ['laptop', /\bideapad\b/],
  ['smartwatch', /\bapple watch\b/],
  ['smartwatch', /\bgalaxy watch\b/]
];
export function normalize(value='') {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
export function inferType(query='') {
  const q = normalize(query);
  if (!q) return '';
  for (const [type,re] of MODEL_HINTS) if (re.test(q)) return type;
  const exact = Object.entries(TYPE_ALIASES).find(([,aliases]) => aliases.some(a => normalize(a) === q));
  if (exact) return exact[0];
  const contained = Object.entries(TYPE_ALIASES).find(([,aliases]) => aliases.some(a => {
    const n = normalize(a); return n.length >= 4 && (` ${q} `).includes(` ${n} `);
  }));
  return contained?.[0] || '';
}
function queryMode(query, type) {
  const q = normalize(query);
  if (!type) return 'unknown';
  return TYPE_ALIASES[type].some(a => normalize(a) === q) ? 'broad' : 'specific';
}
function tokenList(q) {
  return normalize(q).split(' ').filter(Boolean).filter(t => !['for','the','with','and','of','a','an'].includes(t));
}
function score(row, query) {
  const q = normalize(query);
  const t = row.titleNorm || normalize(row.title);
  const tokens = tokenList(query);
  let s = Number(row.quality || 0);
  if (t === q) s += 2000;
  if (t.startsWith(q + ' ')) s += 900;
  if (t.includes(q)) s += 700;
  const hits = tokens.filter(x => (` ${t} `).includes(` ${x} `) || (x.length >= 4 && t.includes(x))).length;
  s += hits * 180;
  if (tokens.length && hits === tokens.length) s += 650;
  if (row.image) s += 20;
  if (row.url) s += 20;
  if (row.price > 0) s += 20;
  return s;
}
function allTokensMatch(row, query) {
  const t = row.titleNorm || normalize(row.title);
  const tokens = tokenList(query);
  return tokens.length > 0 && tokens.every(x => (` ${t} `).includes(` ${x} `) || (x.length >= 4 && t.includes(x)));
}
function sellerBalanced(rows, limit) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.seller)) groups.set(row.seller, []);
    groups.get(row.seller).push(row);
  }
  for (const arr of groups.values()) arr.sort((a,b) => (b._score||0)-(a._score||0) || Number(b.quality||0)-Number(a.quality||0) || Number(a.price||0)-Number(b.price||0));
  const sellers = [...groups.keys()].sort((a,b) => (groups.get(b)?.[0]?._score||0)-(groups.get(a)?.[0]?._score||0));
  const out=[];
  for (let i=0; out.length<limit; i++) {
    let added=false;
    for (const seller of sellers) {
      const r=groups.get(seller)?.[i];
      if (!r) continue;
      out.push(r); added=true;
      if (out.length>=limit) break;
    }
    if (!added) break;
  }
  return out;
}
function publicRow(r) {
  const { titleNorm, _score, ...rest } = r;
  return rest;
}
function median(values) {
  const a = values.filter(x=>Number.isFinite(x)&&x>0).sort((x,y)=>x-y);
  if (!a.length) return 0;
  const m=Math.floor(a.length/2);
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
}
function priceBandAlternatives(rows, target, limit) {
  let pool = rows;
  if (target > 0) {
    const lo = target * 0.55, hi = target * 1.8;
    const near = rows.filter(r => r.price > 0 && r.price >= lo && r.price <= hi);
    if (near.length >= 4) pool = near;
  }
  return sellerBalanced(pool, limit);
}
export async function runShadowSearch({query='', seller='', limit=12, includeRelated=true}, manifest, loadType) {
  const type = inferType(query);
  if (!type || !manifest?.typeCounts?.[type]) {
    return { version:manifest?.version||'20.2.1', ready:true, query, mode:'unknown', type:'', message:'Query is outside the currently validated V20.2.1 shadow taxonomy.', main:[], alternatives:[], related:[], relatedCount:0, sellers:[] };
  }
  const mode = queryMode(query, type);
  const data = await loadType(type);
  const sellerNorm = normalize(seller);
  const mainBase = (data.main||[]).filter(r => !sellerNorm || normalize(r.seller)===sellerNorm);
  const relatedBase = (data.related||[]).filter(r => !sellerNorm || normalize(r.seller)===sellerNorm);
  const lim = Math.max(1, Math.min(Number(limit)||12, 48));
  let main=[]; let alternatives=[]; let related=[];
  if (mode === 'broad') {
    const ranked = mainBase.map(r => ({...r,_score:Number(r.quality||0)}));
    main = sellerBalanced(ranked, lim);
  } else {
    const specific = mainBase.filter(r => allTokensMatch(r,query)).map(r => ({...r,_score:score(r,query)})).sort((a,b)=>b._score-a._score);
    main = sellerBalanced(specific, lim);
    const target = median(main.map(r=>Number(r.price||0)));
    if (main.length < Math.min(4,lim)) {
      const used = new Set(main.map(r=>r.key));
      const altPool = mainBase.filter(r=>!used.has(r.key)).map(r=>({...r,_score:Number(r.quality||0)}));
      alternatives = priceBandAlternatives(altPool,target,Math.min(6,lim));
    }
    if (includeRelated) {
      related = relatedBase.filter(r => allTokensMatch(r,query)).map(r=>({...r,_score:score(r,query)})).sort((a,b)=>b._score-a._score).slice(0,Math.min(8,lim));
    }
  }
  const sellers = [...new Set([...main,...alternatives].map(r=>r.seller))];
  return {
    version:manifest.version,
    ready:true,
    query,
    mode,
    type,
    main:main.map(publicRow),
    alternatives:alternatives.map(publicRow),
    related:related.map(publicRow),
    relatedCount: mode==='broad' ? Number(manifest.typeCounts[type]?.related||0) : relatedBase.filter(r=>allTokensMatch(r,query)).length,
    totalMainForType:Number(manifest.typeCounts[type]?.main||0),
    sellers
  };
}

