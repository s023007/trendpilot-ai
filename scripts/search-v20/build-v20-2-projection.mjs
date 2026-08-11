import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION = '20.2.1';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/search-v20');
const BLOCKED = new Set(['Temu', 'Joom', 'FilamentPRO EU CPS', 'FilamentPRO']);

const TYPE_ORDER = [
  'phone','laptop','smartwatch','headphones','perfume','dog_food',
  'power_bank','air_conditioner','3d_filament','cookware','lighting','tools'
];

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

const ACCESSORY_PHRASES = [
  'phone case','protective case','case for','cover for','screen protector','camera lens protector',
  'charging cable','charger for','power adapter','usb adapter','adapter for','holder for','phone holder',
  'mount for','stand for','bracket for','dock for','hub for','bag for','sleeve for','strap for','band for',
  'keyboard for','stylus for','pen for','feeder','dog bowl','pet bowl','slow feeder','storage case',
  'selfie light','camera light','replacement cable','replacement screen','replacement battery','replacement keyboard',
  'filter for','filter core','cleaning brush','dust cover','protective film','car mount','air vent mount',
  'flash drive','card reader','keychain','briefcase','laptop bag','phone light','battery for'
];
const ACCESSORY_TOKENS = new Set([
  'case','cover','protector','charger','charging','cable','adapter','holder','mount','bracket','dock','hub',
  'sleeve','strap','band','stylus','feeder','bowl','keychain','briefcase','screen','digitizer','bumper',
  'housing','shell','replacement','spare','filter','keyboard','stand','pouch','wallet','tripod'
]);
const REPLACEMENT_PHRASES = [
  'replacement','spare part','repair part','lcd assembly','lcd screen','touch screen','digitizer',
  'flex cable','ribbon cable','inner tube for','battery for','keyboard for','module for','filter core',
  'compressor filter','housing for','screen with frame','screen assembly'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function normalize(value='') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function words(value='') {
  const n = normalize(value);
  return n ? n.split(' ') : [];
}
function hasPhrase(text, phrase) {
  const t = ` ${normalize(text)} `;
  const p = ` ${normalize(phrase)} `;
  return t.includes(p);
}
function hasAnyPhrase(text, list) {
  return list.some(p => hasPhrase(text, p));
}
function hasToken(text, token) {
  return new Set(words(text)).has(normalize(token));
}
function hasAnyToken(text, set) {
  const ws = words(text);
  return ws.some(w => set.has(w));
}
function titleAndTaxonomy(p) {
  const title = p?.name?.display || p?.title || '';
  const tax = p?.taxonomy || {};
  return `${title} ${tax.sourceCategory || ''} ${tax.sourceSubcategory || ''} ${(tax.sourcePath || []).join(' ')} ${tax.canonicalCategory || ''} ${(tax.canonicalPath || []).join(' ')}`;
}
function productUrl(p) {
  return String(p?.links?.affiliateUrl || p?.links?.destinationUrl || '').trim();
}
function imageUrl(p) {
  return String(p?.media?.imageUrl || p?.media?.image || '').trim();
}
function priceOf(p) {
  const n = Number(p?.offer?.price);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function qualityOf(p) {
  const n = Number(p?.quality?.inputQuality ?? p?.specs?.sourceFields?.quality ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function isReplacement(title) {
  return hasAnyPhrase(title, REPLACEMENT_PHRASES);
}
function accessorySignal(title) {
  if (hasAnyPhrase(title, ACCESSORY_PHRASES)) return true;
  const ws = words(title);
  const first = new Set(ws.slice(0, 8));
  for (const token of ACCESSORY_TOKENS) if (first.has(token)) return true;
  if (/\bfor\b/.test(normalize(title)) && hasAnyToken(title, ACCESSORY_TOKENS)) return true;
  return false;
}
function hasBtu(title) {
  const m = normalize(title).match(/\b(\d{4,5})\s*btu\b/);
  return Boolean(m && Number(m[1]) >= 5000);
}
function phoneCore(t) {
  return hasAnyPhrase(t, ['smartphone','mobile phone','cell phone','feature phone']) ||
    /\biphone\s?(?:1[0-9]|[6-9])\b/.test(normalize(t)) ||
    /\bgalaxy\s+s\d{1,2}\b/.test(normalize(t)) ||
    /\bpixel\s+\d{1,2}\b/.test(normalize(t));
}
function laptopCore(t) {
  return hasAnyPhrase(t, ['laptop','notebook computer','notebook pc','chromebook','thinkpad','macbook','ideapad']);
}
function smartwatchCore(t) {
  return hasAnyPhrase(t, ['smartwatch','smart watch','kids smartwatch','apple watch','galaxy watch']);
}
function headphonesCore(t) {
  return hasAnyPhrase(t, ['headphones','headphone','earbuds','earbud','earphones','earphone','headset']);
}
function perfumeCore(t) {
  return hasAnyPhrase(t, ['eau de parfum','eau de toilette','perfume','cologne','attar','concentrated perfume oil']);
}
function dogFoodCore(t) {
  const n = normalize(t);
  return hasAnyPhrase(n, ['dog food','puppy food','canine food','dog kibble']) ||
    (/\b(dog|dogs|puppy|puppies|canine)\b/.test(n) && /\b(food|kibble|meal|nutrition)\b/.test(n));
}
function powerBankCore(t) {
  return hasAnyPhrase(t, ['power bank','powerbank','portable battery pack']);
}
function airConditionerCore(t) {
  const n = normalize(t);
  const nameSignal = hasAnyPhrase(n, ['air conditioner','portable ac','window ac','mini split','split ac','duct type air conditioner']);
  if (!nameSignal) return false;
  const hvacSignal = hasBtu(n) || hasAnyPhrase(n, ['compressor','refrigerant','mini split','split ac','window air conditioner','duct type air conditioner','central air conditioner']);
  return hvacSignal;
}
function filamentCore(t) {
  const n = normalize(t);
  if (!hasPhrase(n, 'filament')) return false;
  if (hasAnyPhrase(n, ['rewinder','winder','winding machine','filament dryer','3d printer','printer combo','spool holder','storage box'])) return false;
  return /\b(pla|petg|abs|tpu|asa|nylon|pva|hips|pc|silk)\b/.test(n) || /\b1\s*75\s*mm\b/.test(n) || /\b\d+(?:\.\d+)?\s*kg\b/.test(n);
}
function cookwareCore(t) {
  const n = normalize(t);
  if (hasAnyPhrase(n, ['flower pot','plant pot','paint pan','oil pan'])) return false;
  return hasAnyPhrase(n, ['cookware','frying pan','saucepan','skillet','casserole','dutch oven','stock pot','cooking pot','cookware set']);
}
function lightingCore(t, seller='') {
  const n = normalize(t);
  const govee = seller === 'Govee Many GEOs';
  const signal = hasAnyPhrase(n, ['lighting','light','lights','lamp','bulb','led strip','light strip','light bar','flood light','neon rope','light panels','light projector','rgbic']);
  if (!signal) return false;
  if (!govee && hasAnyPhrase(n, ['phone light','selfie light','camera light','light for phone','light for camera'])) return false;
  return true;
}
function toolsCore(t) {
  const n = normalize(t);
  return hasAnyPhrase(n, ['power drill','cordless drill','screwdriver','wrench','pliers','ratchet wrench','ratchet','socket set','hammer','angle grinder','grinder','circular saw','jigsaw','impact driver','torque wrench']);
}
function detectType(p) {
  const title = p?.name?.display || '';
  const all = titleAndTaxonomy(p);
  // Strong product heads first so phrases like "screwdriver for laptop" stay tools.
  if (toolsCore(title)) return 'tools';
  if (filamentCore(title)) return '3d_filament';
  if (dogFoodCore(title)) return 'dog_food';
  if (powerBankCore(title)) return 'power_bank';
  if (airConditionerCore(title)) return 'air_conditioner';
  if (cookwareCore(title)) return 'cookware';
  if (smartwatchCore(title)) return 'smartwatch';
  if (headphonesCore(title)) return 'headphones';
  if (perfumeCore(title)) return 'perfume';
  if (phoneCore(title)) return 'phone';
  if (laptopCore(title)) return 'laptop';
  if (lightingCore(title, p?.seller?.name || '')) return 'lighting';

  // Taxonomy is supporting evidence only; require a matching title token.
  const tax = normalize(all);
  if (/\bphone\b|\bsmartphone\b/.test(tax) && /\bphone\b|\bsmartphone\b/.test(normalize(title))) return 'phone';
  if (/\blaptop\b|\bnotebook\b/.test(tax) && /\blaptop\b|\bnotebook\b/.test(normalize(title))) return 'laptop';
  return '';
}
function mainPurity(type, p) {
  const title = p?.name?.display || '';
  const n = normalize(title);
  const seller = p?.seller?.name || '';
  if (!title || title.length < 4) return false;
  if (!priceOf(p) || !productUrl(p)) return false;
  if (isReplacement(title) || accessorySignal(title)) return false;

  if (type === 'phone') {
    if (hasAnyPhrase(n, ['smart bracelet','wristband','phone light','solar panel','usb hub','card reader','phone stand','phone holder','tablet'])) return false;
    return phoneCore(title);
  }
  if (type === 'laptop') {
    if (hasAnyPhrase(n, ['keyboard','briefcase','bag','sleeve','ssd','solid state drive','vacuum','screwdriver','pen for','dock','hub','adapter'])) return false;
    if (hasAnyPhrase(n, ['laptops 2 in 1s more','laptops 2 in 1s and more'])) return false;
    return laptopCore(title);
  }
  if (type === 'smartwatch') {
    if (hasAnyPhrase(n, ['smart band','smart wristband','watch band','watch strap','replacement band','protective case'])) return false;
    return smartwatchCore(title);
  }
  if (type === 'headphones') {
    if (hasAnyPhrase(n, ['monitor','tumbler','mug','hoodie','radio','vr glasses','virtual reality','earphone jack'])) return false;
    return headphonesCore(title);
  }
  if (type === 'perfume') {
    if (hasAnyPhrase(n, ['power bank','powerbank','keychain','airpods','empty bottle','phone case','car perfume','cars perfume','car fragrance','air freshener'])) return false;
    return perfumeCore(title);
  }
  if (type === 'dog_food') {
    if (hasAnyPhrase(n, ['feeder','bowl','opener','tab buddy','storage','container','scoop','dispenser','mat'])) return false;
    return dogFoodCore(title);
  }
  if (type === 'power_bank') {
    if (hasAnyPhrase(n, ['case for','cover for','holder for'])) return false;
    return powerBankCore(title);
  }
  if (type === 'air_conditioner') {
    if (hasAnyPhrase(n, ['brush','filter','bracket','cover','drill','cleaning','evaporative air cooler','mist fan','humidifying fan','usb powered'])) return false;
    return airConditionerCore(title);
  }
  if (type === '3d_filament') return filamentCore(title);
  if (type === 'cookware') return cookwareCore(title);
  if (type === 'lighting') return lightingCore(title, seller);
  if (type === 'tools') return toolsCore(title);
  return false;
}
function classify(p) {
  const title = p?.name?.display || '';
  const type = detectType(p);
  if (!type) return { type: '', role: 'unclassified' };
  if (isReplacement(title)) return { type, role: 'replacement_part' };
  if (accessorySignal(title)) return { type, role: 'accessory' };
  if (mainPurity(type, p)) return { type, role: 'main' };
  return { type, role: 'related' };
}
function extractDerivedSpecs(p, title) {
  const out = {};
  const structured = p?.specs?.structured || {};
  const derived = p?.specs?.derived || {};
  for (const [k,v] of Object.entries(structured)) out[k] = v;
  for (const [k,v] of Object.entries(derived)) if (!(k in out)) out[k] = v;
  const raw = String(title || '');
  const add = (key, value, unit='') => { if (value != null && !(key in out)) out[key] = unit ? { value, unit, evidence: 'title' } : value; };
  let m;
  if ((m = raw.match(/\b(\d{1,2})\s*GB\s*(?:RAM|Memory)\b/i))) add('ramGB', Number(m[1]), 'GB');
  if ((m = raw.match(/\b(\d{2,4})\s*GB\b/i))) add('storageGB', Number(m[1]), 'GB');
  if ((m = raw.match(/\b(\d{3,5})\s*mAh\b/i))) add('batteryMah', Number(m[1]), 'mAh');
  if ((m = raw.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:inch|\")\b/i))) add('screenInches', Number(m[1]), 'in');
  if ((m = raw.match(/\b(\d{2,5})\s*BTU\b/i))) add('btu', Number(m[1]), 'BTU');
  if ((m = raw.match(/\b(\d{2,4})\s*W\b/i))) add('watts', Number(m[1]), 'W');
  if (/\b5G\b/i.test(raw)) add('connectivity5G', true);
  if (/\bBluetooth\b/i.test(raw)) add('bluetooth', true);
  return out;
}
function compactProduct(p, type, role, cpcBySeller) {
  const title = String(p?.name?.display || '').trim();
  const seller = String(p?.seller?.name || '').trim();
  const ids = p?.identifiers || {};
  const explicitModel = p?.identity?.modelConfidence === 'explicit' ? String(ids.model || '') : '';
  return {
    key: String(p?.productKey || ''),
    seller,
    sellerSlug: String(p?.seller?.slug || ''),
    network: String(p?.seller?.network || p?.source?.network || ''),
    cpc: Boolean(cpcBySeller.get(seller)),
    title,
    titleNorm: normalize(title),
    brand: String(p?.brand || ''),
    type,
    role,
    price: priceOf(p),
    currency: String(p?.offer?.currency || 'USD'),
    image: imageUrl(p),
    url: productUrl(p),
    quality: qualityOf(p),
    identifiers: {
      sellerProductId: String(ids.sellerProductId || ''),
      sku: String(ids.sku || ''),
      model: explicitModel,
      mpn: String(ids.mpn || ''),
      gtin: String(ids.gtin || ''),
      ean: String(ids.ean || ''),
      upc: String(ids.upc || ''),
      isbn: String(ids.isbn || '')
    },
    specs: extractDerivedSpecs(p, title)
  };
}
function loadNdjson(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  let lineNo = 0;
  for (const line of text.split(/\r?\n/)) {
    lineNo++;
    const s = line.trim();
    if (!s) continue;
    try { rows.push(JSON.parse(s)); }
    catch (e) { throw new Error(`Invalid NDJSON ${file}:${lineNo}: ${e.message}`); }
  }
  return rows;
}
function sellerRoundRobin(rows, limit=12) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.seller)) groups.set(r.seller, []);
    groups.get(r.seller).push(r);
  }
  for (const arr of groups.values()) arr.sort((a,b) => b.quality-a.quality || a.price-b.price || a.title.localeCompare(b.title));
  const sellers = [...groups.keys()].sort((a,b) => (groups.get(b)?.[0]?.quality||0) - (groups.get(a)?.[0]?.quality||0));
  const out=[];
  for (let i=0; out.length<limit; i++) {
    let added=false;
    for (const s of sellers) {
      const r=groups.get(s)?.[i];
      if (!r) continue;
      out.push(r); added=true;
      if (out.length>=limit) break;
    }
    if (!added) break;
  }
  return out;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'types'), { recursive: true });

const registry = readJson(path.join(ROOT, 'data/product-seller-registry-v17.json'));
const catalogSet = readJson(path.join(ROOT, 'data/catalog-v19/catalog-set-v1.json'));
const approved = (registry.sellers || []).filter(s => s.public === true);
if (approved.length !== 13) throw new Error(`Expected 13 public sellers, got ${approved.length}`);
const approvedNames = new Set(approved.map(s => s.name));
const catalogNames = new Set((catalogSet.sellers || []).map(s => s.name));
if (catalogNames.size !== 13) throw new Error(`Expected 13 catalog sellers, got ${catalogNames.size}`);
for (const name of approvedNames) if (!catalogNames.has(name)) throw new Error(`Approved seller missing from catalog set: ${name}`);
for (const name of catalogNames) if (!approvedNames.has(name)) throw new Error(`Catalog seller not approved: ${name}`);
for (const blocked of BLOCKED) if (approvedNames.has(blocked) || catalogNames.has(blocked)) throw new Error(`Blocked seller leaked: ${blocked}`);
const cpcBySeller = new Map(approved.map(s => [s.name, Boolean(s.cpc)]));

const byType = new Map(TYPE_ORDER.map(t => [t, { main: [], related: [] }]));
const roleCounts = { main:0, accessory:0, replacement_part:0, related:0, unclassified:0 };
const sellerCounts = {};
const seen = new Set();
let total = 0;
let blockedLeaks = 0;
for (const entry of catalogSet.sellers || []) {
  const file = path.join(ROOT, 'data/catalog-v19/sellers', entry.slug, 'products.ndjson');
  if (!fs.existsSync(file)) throw new Error(`Missing canonical catalog: ${file}`);
  const rows = loadNdjson(file);
  sellerCounts[entry.name] = { records: rows.length, main:0, related:0, unclassified:0 };
  for (const p of rows) {
    total++;
    const key = String(p?.productKey || '');
    if (!key) throw new Error(`Missing productKey in ${file}`);
    if (seen.has(key)) throw new Error(`Duplicate productKey: ${key}`);
    seen.add(key);
    const seller = String(p?.seller?.name || '');
    if (!approvedNames.has(seller) || BLOCKED.has(seller)) { blockedLeaks++; continue; }
    const { type, role } = classify(p);
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    if (!type) { sellerCounts[entry.name].unclassified++; continue; }
    const compact = compactProduct(p, type, role, cpcBySeller);
    if (role === 'main') {
      byType.get(type).main.push(compact);
      sellerCounts[entry.name].main++;
    } else {
      byType.get(type).related.push(compact);
      sellerCounts[entry.name].related++;
    }
  }
}
if (blockedLeaks) throw new Error(`Blocked seller leaks: ${blockedLeaks}`);
if (total !== 52032) console.warn(`Canonical record count is ${total}; V20.1 baseline was 52032. Continuing with current canonical set.`);

const typeCounts = {};
const samples = {};
for (const type of TYPE_ORDER) {
  const group = byType.get(type);
  group.main.sort((a,b) => b.quality-a.quality || a.price-b.price || a.title.localeCompare(b.title));
  group.related.sort((a,b) => b.quality-a.quality || a.title.localeCompare(b.title));
  const payload = { version: VERSION, type, main: group.main, related: group.related };
  fs.writeFileSync(path.join(OUT, 'types', `${type}.json`), JSON.stringify(payload));
  typeCounts[type] = { main: group.main.length, related: group.related.length, sellers: [...new Set(group.main.map(r=>r.seller))].sort() };
  samples[type] = sellerRoundRobin(group.main, 8).map(r => ({ seller:r.seller, title:r.title, price:r.price, currency:r.currency, cpc:r.cpc }));
}

// Strict trusted identity index. Plain model/name text is discovery only.
const idValueCounts = new Map();
const compactAll = [];
for (const type of TYPE_ORDER) compactAll.push(...byType.get(type).main, ...byType.get(type).related);
for (const r of compactAll) {
  for (const value of [r.identifiers.sellerProductId, r.identifiers.sku].filter(Boolean)) {
    const n = normalize(value);
    if (!n) continue;
    idValueCounts.set(n, (idValueCounts.get(n) || 0) + 1);
  }
}
const trusted = {};
for (const r of compactAll) {
  const add = (kind, value) => {
    const n = normalize(value);
    if (!n) return;
    const key = `${kind}:${n}`;
    if (!trusted[key]) trusted[key] = [];
    trusted[key].push(r.key);
  };
  for (const [kind,value] of [['gtin',r.identifiers.gtin],['ean',r.identifiers.ean],['upc',r.identifiers.upc],['isbn',r.identifiers.isbn]]) add(kind,value);
  for (const value of [r.identifiers.sellerProductId, r.identifiers.sku].filter(Boolean)) {
    const n = normalize(value);
    if (idValueCounts.get(n) === 1) add('seller-id', value);
  }
  if (r.brand && r.identifiers.model) add('brand-model', `${r.brand} ${r.identifiers.model}`);
  if (r.brand && r.identifiers.mpn) add('brand-mpn', `${r.brand} ${r.identifiers.mpn}`);
}
fs.writeFileSync(path.join(OUT, 'trusted-identity-index.json'), JSON.stringify({version:VERSION, entries:trusted}));

const manifest = {
  version: VERSION,
  generatedAt: new Date().toISOString(),
  source: 'data/catalog-v19',
  publicSellers: approved.map(s => ({name:s.name, network:s.network, cpc:Boolean(s.cpc)})),
  catalogFilesLoaded: catalogSet.sellers.length,
  canonicalRecords: total,
  duplicateProductKeys: total - seen.size,
  blockedSellerLeaks: blockedLeaks,
  roleCounts,
  typeCounts,
  sellerCounts,
  trustedIdentityEntries: Object.keys(trusted).length,
  policy: {
    exactIdentity: 'global-id-or-globally-unique-seller-id-or-brand-explicit-model-or-brand-mpn',
    modelNames: 'discovery-only',
    unclassified: 'not-exposed-by-v20.2-shadow',
    productionVisitorUI: 'unchanged'
  }
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify(samples, null, 2));

const report = [
  '# TrendPilot V20.2 — Persistent Shadow Search Projection',
  '',
  '**Production visitor UI/search remains unchanged.** This projection is stored separately under `data/search-v20/` and is consumed only by `/api/products-v20-shadow`.',
  '',
  '## Foundation',
  `- Public sellers: **${approved.length}**`,
  `- Canonical catalogs loaded: **${catalogSet.sellers.length}**`,
  `- Canonical records scanned: **${total.toLocaleString()}**`,
  `- Duplicate product keys: **${total-seen.size}**`,
  `- Blocked seller leaks: **${blockedLeaks}**`,
  '',
  '## Persistent product roles',
  ...Object.entries(roleCounts).map(([k,v]) => `- ${k}: **${v.toLocaleString()}**`),
  '',
  '## Persistent product types',
  '| Type | Main | Related/accessories/parts | Main sellers |',
  '|---|---:|---:|---:|',
  ...TYPE_ORDER.map(t => `| ${t} | ${typeCounts[t].main.toLocaleString()} | ${typeCounts[t].related.toLocaleString()} | ${typeCounts[t].sellers.length} |`),
  '',
  '## Shadow API rule',
  '- Broad queries read the precomputed type projection.',
  '- Specific model/name queries search only within the inferred product type.',
  '- Accessories/replacement parts never enter `main`; they remain in the separate related channel.',
  '- Exact identity uses only trusted identifier keys; inferred model/name text is discovery only.',
  '- Seller-balanced results are returned to support comparison rather than one-seller domination.',
  ''
].join('\n');
fs.writeFileSync(path.join(OUT, 'REPORT.md'), report);
console.log(JSON.stringify(manifest, null, 2));

