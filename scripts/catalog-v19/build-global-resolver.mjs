import fs from "node:fs";
import crypto from "node:crypto";

const VERSION = "19.1.1";
const ROOT = "data/catalog-v19";
const SELLERS = [
  {name:"Geekbuying",slug:"geekbuying"},
  {name:"AliExpress",slug:"aliexpress"}
];

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
  return fs.readFileSync(file,"utf8").split(/\n/).filter(Boolean).map(JSON.parse);
}

const records = [];
for (const seller of SELLERS) {
  const file = `${ROOT}/sellers/${seller.slug}/products.ndjson`;
  if (!fs.existsSync(file)) throw new Error(`Missing seller catalog ${file}`);
  for (const row of loadNdjson(file)) {
    if (row.seller?.name !== seller.name) throw new Error(`Seller mismatch in ${file}`);
    records.push(row);
  }
}

if (records.some(x => ["Temu","Joom"].includes(x.seller?.name))) {
  throw new Error("Blocked seller leaked into global resolver.");
}

const byKey = Object.fromEntries(records.map(r => [r.productKey, r]));
const resolver = {
  version:VERSION,
  sellers:SELLERS,
  byGlobalId:{},
  byBrandExplicitModel:{},
  byScopedSellerProductId:{},
  byScopedSku:{},
  byModelDiscovery:{},
  byExactName:{},
  byCompactName:{},
  byNameToken:{},
  autoGroups:[],
  discoveryOverlaps:{
    exactName:[],
    brandModelInferred:[]
  }
};

function push(bucket,key,productKey) {
  if (!key) return;
  if (!bucket[key]) bucket[key]=[];
  if (!bucket[key].includes(productKey)) bucket[key].push(productKey);
}

for (const row of records) {
  for (const key of row.identity?.keys?.exactGlobal || []) push(resolver.byGlobalId,key,row.productKey);

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

  const nameTokens = uniq(
    row.name.normalized
      .split(/\s+/)
      .filter(token => token.length >= 2 && !/^\d$/.test(token))
  );
  for (const token of nameTokens) push(resolver.byNameToken, token, row.productKey);
}

const autoCandidates = new Map();
for (const [key, productKeys] of Object.entries(resolver.byGlobalId)) {
  autoCandidates.set(`global:${key}`, {reason:key, productKeys});
}
for (const [key, productKeys] of Object.entries(resolver.byBrandExplicitModel)) {
  autoCandidates.set(`explicit-model:${key}`, {reason:key, productKeys});
}

const autoConflicts = [];
for (const [groupKey, group] of autoCandidates) {
  const rows = group.productKeys.map(k => byKey[k]).filter(Boolean);
  const sellerNames = uniq(rows.map(x => x.seller.name));
  if (sellerNames.length < 2) continue;

  const perSellerCounts = {};
  for (const row of rows) perSellerCounts[row.seller.name] = (perSellerCounts[row.seller.name] || 0) + 1;
  const sameSellerCollision = Object.values(perSellerCounts).some(n => n > 1);

  if (sameSellerCollision) {
    autoConflicts.push({groupKey,reason:group.reason,productKeys:group.productKeys,perSellerCounts});
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

for (const [name, productKeys] of Object.entries(resolver.byExactName)) {
  const sellers = uniq(productKeys.map(k => byKey[k]?.seller?.name));
  if (sellers.length >= 2) {
    resolver.discoveryOverlaps.exactName.push({
      name,
      sellerCount:sellers.length,
      sellers:sellers.sort(),
      productKeys
    });
  }
}

const inferredBrandModel = {};
for (const row of records) {
  if (!row.brand || !row.identifiers?.model) continue;
  const key = `brand-model:${compact(row.brand)}:${compact(row.identifiers.model)}`;
  push(inferredBrandModel,key,row.productKey);
}
for (const [key,productKeys] of Object.entries(inferredBrandModel)) {
  const sellers = uniq(productKeys.map(k => byKey[k]?.seller?.name));
  if (sellers.length >= 2) {
    resolver.discoveryOverlaps.brandModelInferred.push({
      key,
      sellerCount:sellers.length,
      sellers:sellers.sort(),
      productKeys
    });
  }
}

function tokenSearch(query, limit=30) {
  const ts = uniq(
    norm(query).split(/\s+/).filter(token => token.length >= 2 && !/^\d$/.test(token))
  );
  if (!ts.length) return [];
  let current = null;
  for (const token of ts) {
    const bucket = new Set(resolver.byNameToken[token] || []);
    current = current == null ? bucket : new Set([...current].filter(x => bucket.has(x)));
    if (!current.size) break;
  }
  return [...(current || [])].slice(0,limit);
}

const roundTrips = [];
for (const seller of SELLERS) {
  const sellerRows = records.filter(x => x.seller.slug === seller.slug);

  for (const row of sellerRows.filter(x => x.identifiers?.sellerProductId).slice(0,15)) {
    const key = `${seller.slug}:${compact(row.identifiers.sellerProductId)}`;
    roundTrips.push({
      seller:seller.name,
      kind:"seller-product-id",
      query:row.identifiers.sellerProductId,
      resolved:(resolver.byScopedSellerProductId[key] || []).includes(row.productKey)
    });
  }

  for (const row of sellerRows.slice(0,10)) {
    roundTrips.push({
      seller:seller.name,
      kind:"exact-name",
      query:row.name.display,
      resolved:(resolver.byExactName[row.name.normalized] || []).includes(row.productKey)
    });
  }
}

const tokenSamples = [];
for (const row of records.filter(x => x.identifiers?.model).slice(0,20)) {
  tokenSamples.push({
    seller:row.seller.name,
    query:row.identifiers.model,
    expected:row.productKey,
    resolved:tokenSearch(row.identifiers.model,100).includes(row.productKey)
  });
}

const audit = {
  version:VERSION,
  generatedAt:new Date().toISOString(),
  sellers:SELLERS,
  totalRecords:records.length,
  sellerCounts:Object.fromEntries(
    SELLERS.map(s => [s.name, records.filter(x=>x.seller.slug===s.slug).length])
  ),
  autoExactGroups:resolver.autoGroups.length,
  autoGroupConflicts:autoConflicts,
  exactNameCrossSellerOverlaps:resolver.discoveryOverlaps.exactName.length,
  brandModelDiscoveryOverlaps:resolver.discoveryOverlaps.brandModelInferred.length,
  roundTrips,
  tokenSamples,
  blockedSellerLeak:records.some(x => ["Temu","Joom"].includes(x.seller?.name)),
  duplicateGlobalProductKeys:records.length !== new Set(records.map(x=>x.productKey)).size
};

fs.writeFileSync(`${ROOT}/global-resolver-v1.json`,JSON.stringify(resolver,null,2)+"\n");
fs.writeFileSync(`${ROOT}/cross-seller-audit-v1.json`,JSON.stringify(audit,null,2)+"\n");

console.log(JSON.stringify({
  totalRecords:audit.totalRecords,
  sellerCounts:audit.sellerCounts,
  autoExactGroups:audit.autoExactGroups,
  exactNameCrossSellerOverlaps:audit.exactNameCrossSellerOverlaps,
  brandModelDiscoveryOverlaps:audit.brandModelDiscoveryOverlaps,
  roundTrips:`${roundTrips.filter(x=>x.resolved).length}/${roundTrips.length}`,
  tokenSamples:`${tokenSamples.filter(x=>x.resolved).length}/${tokenSamples.length}`
},null,2));
