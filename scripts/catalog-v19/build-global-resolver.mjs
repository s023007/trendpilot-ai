import fs from "node:fs";
import crypto from "node:crypto";
import { PUBLIC_PRODUCT_SELLER_NAMES } from "../../netlify/functions/product-seller-policy-v17.mjs";

const VERSION = "19.2.0";
const ROOT = "data/catalog-v19";
const SET_FILE = `${ROOT}/catalog-set-v1.json`;

if (!fs.existsSync(SET_FILE)) throw new Error(`Missing ${SET_FILE}`);

const catalogSet = JSON.parse(fs.readFileSync(SET_FILE, "utf8"));
const SELLERS = catalogSet.sellers || [];

if (SELLERS.length < 2) throw new Error("Global resolver requires at least two seller catalogs.");

for (const seller of SELLERS) {
  if (!seller?.name || !seller?.slug) throw new Error("Invalid seller entry in catalog-set-v1.json.");
  if (!PUBLIC_PRODUCT_SELLER_NAMES.includes(seller.name)) {
    throw new Error(`Unapproved seller in catalog set: ${seller.name}`);
  }
}
if (SELLERS.some(s => ["Temu","Joom"].includes(s.name))) {
  throw new Error("Blocked seller leaked into catalog set.");
}

const norm = value =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const compact = value => norm(value).replace(/\s+/g, "");
const uniq = values => [...new Set(values.filter(Boolean))];
const sha = value => crypto.createHash("sha256").update(String(value)).digest("hex");

function loadNdjson(file) {
  return fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean).map(JSON.parse);
}

const records = [];
for (const seller of SELLERS) {
  const file = `${ROOT}/sellers/${seller.slug}/products.ndjson`;
  const manifestFile = `${ROOT}/sellers/${seller.slug}/manifest.json`;
  if (!fs.existsSync(file) || !fs.existsSync(manifestFile)) {
    throw new Error(`Missing canonical catalog for ${seller.name}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest.seller?.name !== seller.name) throw new Error(`Manifest mismatch for ${seller.name}`);

  for (const row of loadNdjson(file)) {
    if (row.seller?.name !== seller.name || row.seller?.slug !== seller.slug) {
      throw new Error(`Seller mismatch in ${file}`);
    }
    if (!row.quality?.sourceQualified) {
      throw new Error(`Unqualified source row leaked into ${seller.name}`);
    }
    records.push(row);
  }
}

if (records.some(x => ["Temu","Joom"].includes(x.seller?.name))) {
  throw new Error("Blocked seller leaked into global resolver.");
}
if (records.length !== new Set(records.map(r => r.productKey)).size) {
  throw new Error("Duplicate productKey across canonical seller catalogs.");
}

const byKey = Object.fromEntries(records.map(r => [r.productKey, r]));

const resolver = {
  version: VERSION,
  catalogSetVersion: catalogSet.version,
  sellers: SELLERS,
  generatedAt: new Date().toISOString(),

  byGlobalId: {},
  byBrandExplicitModel: {},
  byScopedSellerProductId: {},
  byScopedSku: {},
  byModelDiscovery: {},
  byExactName: {},
  byCompactName: {},
  byNameToken: {},
  byCanonicalCategory: {},

  autoGroups: [],
  discoveryOverlaps: {
    exactName: [],
    brandModelInferred: []
  }
};

function push(bucket, key, productKey) {
  if (!key) return;
  if (!bucket[key]) bucket[key] = [];
  if (!bucket[key].includes(productKey)) bucket[key].push(productKey);
}

for (const row of records) {
  for (const key of row.identity?.keys?.exactGlobal || []) {
    push(resolver.byGlobalId, key, row.productKey);
  }

  if (row.brand && row.identifiers?.model && row.identity?.modelConfidence === "explicit") {
    push(
      resolver.byBrandExplicitModel,
      `brand-model:${compact(row.brand)}:${compact(row.identifiers.model)}`,
      row.productKey
    );
  }

  if (row.identifiers?.sellerProductId) {
    push(
      resolver.byScopedSellerProductId,
      `${row.seller.slug}:${compact(row.identifiers.sellerProductId)}`,
      row.productKey
    );
  }

  if (row.identifiers?.sku) {
    push(
      resolver.byScopedSku,
      `${row.seller.slug}:${compact(row.identifiers.sku)}`,
      row.productKey
    );
  }

  if (row.identifiers?.model) {
    push(resolver.byModelDiscovery, compact(row.identifiers.model), row.productKey);
  }

  push(resolver.byExactName, row.name.normalized, row.productKey);
  push(resolver.byCompactName, row.name.compact, row.productKey);

  for (const token of uniq(
    row.name.normalized
      .split(/\s+/)
      .filter(token => token.length >= 2 && !/^\d$/.test(token))
  )) {
    push(resolver.byNameToken, token, row.productKey);
  }

  const categoryKeys = uniq([
    ...(row.taxonomy?.canonicalPath || []).map(norm),
    norm(row.taxonomy?.canonicalCategory || ""),
    norm(row.taxonomy?.sourceCategory || ""),
    norm(row.taxonomy?.sourceSubcategory || "")
  ]);
  for (const key of categoryKeys) push(resolver.byCanonicalCategory, key, row.productKey);
}

const autoCandidates = new Map();

for (const [key, productKeys] of Object.entries(resolver.byGlobalId)) {
  autoCandidates.set(`global:${key}`, { reason:key, productKeys });
}
for (const [key, productKeys] of Object.entries(resolver.byBrandExplicitModel)) {
  autoCandidates.set(`explicit-model:${key}`, { reason:key, productKeys });
}

const autoConflicts = [];

for (const [groupKey, group] of autoCandidates) {
  const rows = group.productKeys.map(k => byKey[k]).filter(Boolean);
  const sellerNames = uniq(rows.map(x => x.seller.name));
  if (sellerNames.length < 2) continue;

  const perSellerCounts = {};
  for (const row of rows) {
    perSellerCounts[row.seller.name] = (perSellerCounts[row.seller.name] || 0) + 1;
  }

  if (Object.values(perSellerCounts).some(n => n > 1)) {
    autoConflicts.push({
      groupKey,
      reason: group.reason,
      productKeys: group.productKeys,
      perSellerCounts
    });
    continue;
  }

  resolver.autoGroups.push({
    groupId: `exact-${sha(groupKey).slice(0,20)}`,
    reason: group.reason,
    sellerCount: sellerNames.length,
    sellers: sellerNames.sort(),
    productKeys: group.productKeys
  });
}

for (const [name, productKeys] of Object.entries(resolver.byExactName)) {
  const sellers = uniq(productKeys.map(k => byKey[k]?.seller?.name));
  if (sellers.length >= 2) {
    resolver.discoveryOverlaps.exactName.push({
      name,
      sellerCount: sellers.length,
      sellers: sellers.sort(),
      productKeys
    });
  }
}

const inferredBrandModel = {};
for (const row of records) {
  if (!row.brand || !row.identifiers?.model) continue;
  const key = `brand-model:${compact(row.brand)}:${compact(row.identifiers.model)}`;
  push(inferredBrandModel, key, row.productKey);
}
for (const [key, productKeys] of Object.entries(inferredBrandModel)) {
  const sellers = uniq(productKeys.map(k => byKey[k]?.seller?.name));
  if (sellers.length >= 2) {
    resolver.discoveryOverlaps.brandModelInferred.push({
      key,
      sellerCount: sellers.length,
      sellers: sellers.sort(),
      productKeys
    });
  }
}

function tokenSearch(query, limit=100) {
  const tokens = uniq(
    norm(query)
      .split(/\s+/)
      .filter(token => token.length >= 2 && !/^\d$/.test(token))
  );
  if (!tokens.length) return [];

  let current = null;
  for (const token of tokens) {
    const bucket = new Set(resolver.byNameToken[token] || []);
    current = current == null
      ? bucket
      : new Set([...current].filter(x => bucket.has(x)));
    if (!current.size) break;
  }
  return [...(current || [])].slice(0, limit);
}

const roundTrips = [];
for (const seller of SELLERS) {
  const sellerRows = records.filter(x => x.seller.slug === seller.slug);

  for (const row of sellerRows.filter(x => x.identifiers?.sellerProductId).slice(0, 20)) {
    const key = `${seller.slug}:${compact(row.identifiers.sellerProductId)}`;
    roundTrips.push({
      seller:seller.name,
      kind:"seller-product-id",
      query:row.identifiers.sellerProductId,
      expectedProductKey:row.productKey,
      resolved:(resolver.byScopedSellerProductId[key] || []).includes(row.productKey)
    });
  }

  for (const row of sellerRows.slice(0, 10)) {
    roundTrips.push({
      seller:seller.name,
      kind:"exact-name",
      query:row.name.display,
      expectedProductKey:row.productKey,
      resolved:(resolver.byExactName[row.name.normalized] || []).includes(row.productKey)
    });
  }
}

const tokenSamples = [];
for (const seller of SELLERS) {
  for (const row of records.filter(x => x.seller.slug === seller.slug && x.identifiers?.model).slice(0, 10)) {
    tokenSamples.push({
      seller:seller.name,
      query:row.identifiers.model,
      expectedProductKey:row.productKey,
      resolved:tokenSearch(row.identifiers.model, 500).includes(row.productKey)
    });
  }
}

const audit = {
  version:VERSION,
  generatedAt:resolver.generatedAt,
  catalogSetVersion:catalogSet.version,
  sellers:SELLERS,
  totalRecords:records.length,
  sellerCounts:Object.fromEntries(
    SELLERS.map(s => [s.name, records.filter(x => x.seller.slug === s.slug).length])
  ),
  autoExactGroups:resolver.autoGroups.length,
  autoGroupConflicts:autoConflicts,
  exactNameCrossSellerOverlaps:resolver.discoveryOverlaps.exactName.length,
  brandModelDiscoveryOverlaps:resolver.discoveryOverlaps.brandModelInferred.length,
  roundTrips,
  tokenSamples,
  blockedSellerLeak:false,
  duplicateGlobalProductKeys:false
};

fs.writeFileSync(`${ROOT}/global-resolver-v1.json`, JSON.stringify(resolver,null,2)+"\n");
fs.writeFileSync(`${ROOT}/cross-seller-audit-v1.json`, JSON.stringify(audit,null,2)+"\n");

console.log(JSON.stringify({
  totalRecords:audit.totalRecords,
  sellerCounts:audit.sellerCounts,
  autoExactGroups:audit.autoExactGroups,
  exactNameCrossSellerOverlaps:audit.exactNameCrossSellerOverlaps,
  brandModelDiscoveryOverlaps:audit.brandModelDiscoveryOverlaps,
  roundTrips:`${roundTrips.filter(x=>x.resolved).length}/${roundTrips.length}`,
  tokenSamples:`${tokenSamples.filter(x=>x.resolved).length}/${tokenSamples.length}`
},null,2));
