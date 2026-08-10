import fs from "node:fs";
import crypto from "node:crypto";
import { PUBLIC_PRODUCT_SELLER_NAMES } from "../../netlify/functions/product-seller-policy-v17.mjs";

const VERSION = "19.5.0";
const ROOT = "data/catalog-v19";
const SET_FILE = `${ROOT}/catalog-set-v1.json`;

if (!fs.existsSync(SET_FILE)) throw new Error(`Missing ${SET_FILE}`);

const catalogSet = JSON.parse(fs.readFileSync(SET_FILE,"utf8"));
const SELLERS = catalogSet.sellers || [];

if (SELLERS.length < 2) throw new Error("At least two validated seller catalogs are required.");

for (const seller of SELLERS) {
  if (!seller?.name || !seller?.slug) throw new Error("Invalid catalog-set seller.");
  if (!PUBLIC_PRODUCT_SELLER_NAMES.includes(seller.name)) {
    throw new Error(`Unapproved seller in catalog set: ${seller.name}`);
  }
}
if (SELLERS.some(x => ["Temu","Joom"].includes(x.name))) {
  throw new Error("Blocked seller leaked into catalog set.");
}

const norm = value => {
  const base = String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’'`]/g,"");
  const searchable = base.replace(/[^\p{L}\p{N}]+/gu," ").trim();
  return searchable || base.replace(/\s+/g," ").trim();
};

const compact = value => norm(value).replace(/\s+/g,"");
const uniq = values => [...new Set(values.filter(Boolean))];
const sha = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const exactNameKey = row => norm(row?.name?.display || row?.name?.normalized || "");

function loadNdjson(file) {
  return fs.readFileSync(file,"utf8").split(/\n/).filter(Boolean).map(JSON.parse);
}

const maps = {
  byGlobalId:new Map(),
  byBrandExplicitModel:new Map(),
  byScopedSellerProductId:new Map(),
  byScopedSku:new Map(),
  byModelDiscovery:new Map(),
  byExactName:new Map(),
  byCompactName:new Map(),
  byNameToken:new Map(),
  byCanonicalCategory:new Map()
};

function push(map,key,productKey) {
  if (!key) return;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key,set);
  }
  set.add(productKey);
}

function mapToObject(map) {
  const out = Object.create(null);
  for (const [key,set] of map) out[key] = [...set];
  return out;
}

const records = [];

for (const seller of SELLERS) {
  const productsFile = `${ROOT}/sellers/${seller.slug}/products.ndjson`;
  const manifestFile = `${ROOT}/sellers/${seller.slug}/manifest.json`;

  if (!fs.existsSync(productsFile) || !fs.existsSync(manifestFile)) {
    throw new Error(`Missing validated canonical catalog for ${seller.name}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile,"utf8"));
  if (manifest.seller?.name !== seller.name || manifest.seller?.slug !== seller.slug) {
    throw new Error(`Manifest seller mismatch for ${seller.name}`);
  }

  for (const row of loadNdjson(productsFile)) {
    if (row.seller?.name !== seller.name || row.seller?.slug !== seller.slug) {
      throw new Error(`Product seller mismatch in ${productsFile}`);
    }
    if (!row.quality?.sourceQualified) {
      throw new Error(`Unqualified source row leaked into ${seller.name}`);
    }
    if (!row.name?.display || !exactNameKey(row)) {
      throw new Error(`Unsearchable canonical name in ${seller.name}: ${row.productKey}`);
    }
    records.push(row);
  }
}

if (records.some(x => ["Temu","Joom"].includes(x.seller?.name))) {
  throw new Error("Blocked seller leaked into canonical records.");
}
if (records.length !== new Set(records.map(x=>x.productKey)).size) {
  throw new Error("Duplicate productKey across canonical seller catalogs.");
}

const byKey = new Map(records.map(row => [row.productKey,row]));

for (const row of records) {
  for (const key of row.identity?.keys?.exactGlobal || []) {
    push(maps.byGlobalId,key,row.productKey);
  }

  if (row.brand && row.identifiers?.model && row.identity?.modelConfidence === "explicit") {
    push(
      maps.byBrandExplicitModel,
      `brand-model:${compact(row.brand)}:${compact(row.identifiers.model)}`,
      row.productKey
    );
  }

  if (row.identifiers?.sellerProductId) {
    push(
      maps.byScopedSellerProductId,
      `${row.seller.slug}:${compact(row.identifiers.sellerProductId)}`,
      row.productKey
    );
  }

  if (row.identifiers?.sku) {
    push(
      maps.byScopedSku,
      `${row.seller.slug}:${compact(row.identifiers.sku)}`,
      row.productKey
    );
  }

  if (row.identifiers?.model) {
    push(maps.byModelDiscovery,compact(row.identifiers.model),row.productKey);
  }

  const nameKey = exactNameKey(row);
  push(maps.byExactName,nameKey,row.productKey);
  push(maps.byCompactName,compact(row.name.display),row.productKey);

  for (const token of uniq(nameKey.split(/\s+/).filter(x => x.length >= 2 && !/^\d$/.test(x)))) {
    push(maps.byNameToken,token,row.productKey);
  }

  for (const category of uniq([
    ...(row.taxonomy?.canonicalPath || []).map(norm),
    norm(row.taxonomy?.canonicalCategory || ""),
    norm(row.taxonomy?.sourceCategory || ""),
    norm(row.taxonomy?.sourceSubcategory || "")
  ])) {
    push(maps.byCanonicalCategory,category,row.productKey);
  }
}

const insertionFailures = [];

for (const row of records) {
  if (row.identifiers?.sellerProductId) {
    const key = `${row.seller.slug}:${compact(row.identifiers.sellerProductId)}`;
    if (!maps.byScopedSellerProductId.get(key)?.has(row.productKey)) {
      insertionFailures.push({
        seller:row.seller.name,
        kind:"seller-product-id",
        key,
        productKey:row.productKey
      });
    }
  }

  const nameKey = exactNameKey(row);
  if (!maps.byExactName.get(nameKey)?.has(row.productKey)) {
    insertionFailures.push({
      seller:row.seller.name,
      kind:"exact-name",
      key:nameKey,
      productKey:row.productKey
    });
  }
}

if (insertionFailures.length) {
  throw new Error(`Resolver insertion failures: ${JSON.stringify(insertionFailures.slice(0,10))}`);
}

const resolver = {
  version:VERSION,
  catalogSetVersion:catalogSet.version,
  sellers:SELLERS,
  generatedAt:new Date().toISOString(),
  byGlobalId:mapToObject(maps.byGlobalId),
  byBrandExplicitModel:mapToObject(maps.byBrandExplicitModel),
  byScopedSellerProductId:mapToObject(maps.byScopedSellerProductId),
  byScopedSku:mapToObject(maps.byScopedSku),
  byModelDiscovery:mapToObject(maps.byModelDiscovery),
  byExactName:mapToObject(maps.byExactName),
  byCompactName:mapToObject(maps.byCompactName),
  byNameToken:mapToObject(maps.byNameToken),
  byCanonicalCategory:mapToObject(maps.byCanonicalCategory),
  autoGroups:[],
  discoveryOverlaps:{exactName:[],brandModelInferred:[]}
};

const autoCandidates = new Map();

for (const [key,set] of maps.byGlobalId) {
  autoCandidates.set(`global:${key}`,{reason:key,productKeys:[...set]});
}
for (const [key,set] of maps.byBrandExplicitModel) {
  autoCandidates.set(`explicit-model:${key}`,{reason:key,productKeys:[...set]});
}

const autoConflicts = [];

for (const [groupKey,group] of autoCandidates) {
  const rows = group.productKeys.map(k=>byKey.get(k)).filter(Boolean);
  const sellerNames = uniq(rows.map(x=>x.seller.name));
  if (sellerNames.length < 2) continue;

  const perSellerCounts = {};
  for (const row of rows) {
    perSellerCounts[row.seller.name] = (perSellerCounts[row.seller.name] || 0) + 1;
  }

  if (Object.values(perSellerCounts).some(n=>n>1)) {
    autoConflicts.push({
      groupKey,
      reason:group.reason,
      productKeys:group.productKeys,
      perSellerCounts
    });
    continue;
  }

  resolver.autoGroups.push({
    groupId:`exact-${sha(groupKey).slice(0,20)}`,
    reason:group.reason,
    sellerCount:sellerNames.length,
    sellers:sellerNames.sort(),
    productKeys:group.productKeys
  });
}

for (const [name,set] of maps.byExactName) {
  const productKeys = [...set];
  const sellers = uniq(productKeys.map(k=>byKey.get(k)?.seller?.name));
  if (sellers.length >= 2) {
    resolver.discoveryOverlaps.exactName.push({
      name,
      sellerCount:sellers.length,
      sellers:sellers.sort(),
      productKeys
    });
  }
}

const inferredBrandModel = new Map();

for (const row of records) {
  if (!row.brand || !row.identifiers?.model) continue;
  push(
    inferredBrandModel,
    `brand-model:${compact(row.brand)}:${compact(row.identifiers.model)}`,
    row.productKey
  );
}

for (const [key,set] of inferredBrandModel) {
  const productKeys = [...set];
  const sellers = uniq(productKeys.map(k=>byKey.get(k)?.seller?.name));
  if (sellers.length >= 2) {
    resolver.discoveryOverlaps.brandModelInferred.push({
      key,
      sellerCount:sellers.length,
      sellers:sellers.sort(),
      productKeys
    });
  }
}

const roundTrips = [];

for (const seller of SELLERS) {
  const sellerRows = records.filter(x=>x.seller.slug===seller.slug);

  for (const row of sellerRows.filter(x=>x.identifiers?.sellerProductId).slice(0,20)) {
    const indexKey = `${seller.slug}:${compact(row.identifiers.sellerProductId)}`;
    roundTrips.push({
      seller:seller.name,
      kind:"seller-product-id",
      query:row.identifiers.sellerProductId,
      indexKey,
      expectedProductKey:row.productKey,
      resolved:Boolean(maps.byScopedSellerProductId.get(indexKey)?.has(row.productKey))
    });
  }

  for (const row of sellerRows.slice(0,10)) {
    const indexKey = exactNameKey(row);
    roundTrips.push({
      seller:seller.name,
      kind:"exact-name",
      query:row.name.display,
      indexKey,
      expectedProductKey:row.productKey,
      resolved:Boolean(maps.byExactName.get(indexKey)?.has(row.productKey))
    });
  }
}

const failedRoundTrips = roundTrips.filter(x=>!x.resolved);
if (failedRoundTrips.length) {
  throw new Error(`Resolver round-trip failures: ${JSON.stringify(failedRoundTrips.slice(0,10))}`);
}

const audit = {
  version:VERSION,
  generatedAt:resolver.generatedAt,
  catalogSetVersion:catalogSet.version,
  sellers:SELLERS,
  totalRecords:records.length,
  sellerCounts:Object.fromEntries(
    SELLERS.map(s=>[s.name,records.filter(x=>x.seller.slug===s.slug).length])
  ),
  autoExactGroups:resolver.autoGroups.length,
  autoGroupConflicts:autoConflicts,
  exactNameCrossSellerOverlaps:resolver.discoveryOverlaps.exactName.length,
  brandModelDiscoveryOverlaps:resolver.discoveryOverlaps.brandModelInferred.length,
  insertionFailures,
  roundTrips,
  failedRoundTrips,
  blockedSellerLeak:false,
  duplicateGlobalProductKeys:false
};

fs.writeFileSync(`${ROOT}/global-resolver-v1.json`,JSON.stringify(resolver,null,2)+"\n");
fs.writeFileSync(`${ROOT}/cross-seller-audit-v1.json`,JSON.stringify(audit,null,2)+"\n");

console.log(JSON.stringify({
  totalRecords:audit.totalRecords,
  sellerCounts:audit.sellerCounts,
  autoExactGroups:audit.autoExactGroups,
  exactNameCrossSellerOverlaps:audit.exactNameCrossSellerOverlaps,
  brandModelDiscoveryOverlaps:audit.brandModelDiscoveryOverlaps,
  roundTrips:`${roundTrips.length}/${roundTrips.length}`
},null,2));
