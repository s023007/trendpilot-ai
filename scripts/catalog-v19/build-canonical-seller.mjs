import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  clean,
  extractProducts,
  validUrl
} from "../../netlify/functions/products-v16-lib.mjs";
import {
  PUBLIC_PRODUCT_SELLER_NAMES,
  canonicalProductSeller
} from "../../netlify/functions/product-seller-policy-v17.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const i = arg.indexOf("=");
    return i < 0 ? [arg, ""] : [arg.slice(0, i), arg.slice(i + 1)];
  })
);

const SELLER = args["--seller"];
const SELLER_SLUG = args["--slug"];
const VERSION = args["--version"] || "19.1.1";
const ROLE = args["--role"] || "canonical-seller-catalog";
const ROOT = "data/catalog-v19";
const SOURCE_ROOT = "data/search-catalog/shards";
const SELLER_DIR = `${ROOT}/sellers/${SELLER_SLUG}`;

if (!SELLER || !SELLER_SLUG) throw new Error("Missing --seller or --slug.");
if (!PUBLIC_PRODUCT_SELLER_NAMES.includes(SELLER)) {
  throw new Error(`${SELLER} is not an approved public product seller.`);
}
if (PUBLIC_PRODUCT_SELLER_NAMES.includes("Temu") || PUBLIC_PRODUCT_SELLER_NAMES.includes("Joom")) {
  throw new Error("Blocked seller leaked into public policy.");
}
if (!fs.existsSync(`${ROOT}/schema-v1.json`)) throw new Error("V19 schema-v1.json is missing.");
if (!fs.existsSync(SOURCE_ROOT)) throw new Error(`${SOURCE_ROOT} is missing.`);

const registry = JSON.parse(fs.readFileSync("data/product-seller-registry-v17.json", "utf8"));
const registryRow = registry.sellers.find(x => x.name === SELLER && x.public);
if (!registryRow) throw new Error(`Approved registry row missing for ${SELLER}.`);

fs.mkdirSync(SELLER_DIR, { recursive: true });

const sha = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const norm = value =>
  clean(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const compact = value => norm(value).replace(/\s+/g, "");
const uniq = values => [...new Set(values.filter(Boolean))];

function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) out.push(full);
  }
  return out;
}

function pickDirect(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && clean(value)) return clean(value);
  }
  return "";
}

const FIELD_KEYS = {
  sellerProductId: [
    "sourceProductId","source_product_id","productId","product_id","itemId","item_id",
    "offerId","offer_id","goodsId","goods_id","id"
  ],
  sku: ["sku","SKU","sellerSku","seller_sku","productSku","product_sku","itemSku","item_sku"],
  model: ["model","modelNumber","model_number","modelNo","model_no","partNumber","part_number"],
  mpn: ["mpn","MPN","manufacturerPartNumber","manufacturer_part_number"],
  gtin: ["gtin","GTIN","gtin13","gtin14"],
  ean: ["ean","EAN","ean13","ean_code"],
  upc: ["upc","UPC","upcA","upc_code"],
  isbn: ["isbn","ISBN"],
  brand: ["brand","manufacturer","vendor","maker"]
};

function explicitIds(raw, normalized) {
  return {
    sellerProductId:
      pickDirect(raw, FIELD_KEYS.sellerProductId) ||
      clean(normalized.sourceProductId),
    sku: pickDirect(raw, FIELD_KEYS.sku),
    model: pickDirect(raw, FIELD_KEYS.model),
    mpn: pickDirect(raw, FIELD_KEYS.mpn),
    gtin: pickDirect(raw, FIELD_KEYS.gtin),
    ean: pickDirect(raw, FIELD_KEYS.ean),
    upc: pickDirect(raw, FIELD_KEYS.upc),
    isbn: pickDirect(raw, FIELD_KEYS.isbn)
  };
}

function inferTitleModel(title) {
  const patterns = [
    /\b(iPhone\s*\d{1,2}(?:\s*(?:Pro Max|Pro|Plus|Mini|Air))?)\b/i,
    /\b(Galaxy\s*[ASZF]\s*\d{1,3}(?:\s*(?:Ultra|Plus|FE|Pro))?)\b/i,
    /\b(Pixel\s*\d{1,2}(?:\s*(?:Pro|XL|a))?)\b/i,
    /\b(Galaxy Watch\s*\d+(?:\s*(?:Pro|Classic|Ultra))?)\b/i,
    /\b(MacBook\s+(?:Air|Pro)(?:\s*M\d)?)\b/i,
    /\b(ThinkPad\s+[A-Za-z0-9-]{2,20})\b/i,
    /\b((?:Redmi|Poco|OnePlus|Realme|Oppo|Vivo|Honor)\s+[A-Za-z0-9+._-]{1,24})\b/i,
    /\b((?:FOSSiBOT|CHUWI|Tronsmart|Creality|ERYONE|ALLIWAVA|MINIX|ZIKE|Mecpow|KuKirin|Narwal)\s+[A-Za-z0-9+._-]{1,24})\b/i
  ];
  for (const pattern of patterns) {
    const match = clean(title).match(pattern);
    if (match) return clean(match[1]);
  }
  return "";
}

const KNOWN_BRANDS = [
  "Apple","Samsung","Google","Xiaomi","Redmi","Poco","OnePlus","Realme","Oppo","Vivo","Honor",
  "Huawei","Motorola","Nokia","Lenovo","CHUWI","Tronsmart","Creality","ERYONE","ALLIWAVA","MINIX",
  "ZIKE","FOSSiBOT","Anker","UGREEN","Baseus","Govee","Sony","JBL","Asus","Acer","MSI","Dell","HP",
  "Mecpow","KuKirin","Narwal","DOOGEE","OUKITEL","Blackview","Teclast","XGIMI","Wanbo"
];

function inferBrand(title, explicit) {
  if (clean(explicit)) return clean(explicit);
  const t = ` ${norm(title)} `;
  return KNOWN_BRANDS.find(brand => t.includes(` ${norm(brand)} `)) || "";
}

function flattenPrimitiveFields(obj, max = 100) {
  const ignored = new Set([
    "title","name","product_name","productName","product_title","productTitle",
    "description","shortDescription","short_description","summary","product_description","productDescription",
    "image","imageUrl","image_url","imageLink","image_link","picture","picture_url","photo","mainImage","main_image",
    "affiliateUrl","affiliate_url","deeplink","deep_link","trackingUrl","tracking_url","clickUrl","click_url","goto",
    "destinationUrl","destination_url","productUrl","product_url","url","link","landing_page","landingPage","product_link",
    "seller","merchant","advertiser","advertiserName","advertiser_name","merchantName","merchant_name",
    "price","salePrice","sale_price","currentPrice","current_price","amount"
  ]);
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(obj || {})) {
    if (count >= max || ignored.has(key) || value == null) continue;
    if (["string","number","boolean"].includes(typeof value)) {
      const str = clean(value);
      if (!str || str.length > 500) continue;
      out[key] = typeof value === "string" ? str : value;
      count++;
    }
  }
  return out;
}

function addAttribute(out, name, value) {
  const key = clean(name).slice(0, 120);
  if (!key || value == null) return;
  let text;
  if (Array.isArray(value)) text = value.map(x => clean(x)).filter(Boolean).join(", ");
  else if (typeof value === "object") text = clean(value.value ?? value.text ?? value.label ?? "");
  else text = clean(value);
  if (!text || text.length > 1000) return;
  if (!(key in out)) out[key] = text;
}

function flattenAttributeContainer(container, out, depth = 0) {
  if (depth > 3 || container == null || Object.keys(out).length >= 160) return;
  if (Array.isArray(container)) {
    for (const item of container) {
      if (Object.keys(out).length >= 160) break;
      if (item && typeof item === "object") {
        const name = item.name ?? item.key ?? item.label ?? item.attribute ?? item.property ?? item.specification;
        const value = item.value ?? item.values ?? item.text ?? item.option ?? item.content;
        if (name != null && value != null) addAttribute(out, name, value);
        else flattenAttributeContainer(item, out, depth + 1);
      }
    }
    return;
  }
  if (typeof container === "object") {
    for (const [key, value] of Object.entries(container)) {
      if (Object.keys(out).length >= 160) break;
      if (value == null) continue;
      if (["string","number","boolean"].includes(typeof value)) addAttribute(out, key, value);
      else flattenAttributeContainer(value, out, depth + 1);
    }
  }
}

function structuredAttributes(raw) {
  const out = {};
  for (const key of [
    "attributes","attribute","specifications","specification","specs","properties","property",
    "features","feature","parameters","parameter","params","technicalSpecifications","technical_specs",
    "productSpecifications","product_specs"
  ]) {
    if (raw?.[key] != null) flattenAttributeContainer(raw[key], out);
  }
  return out;
}

function variants(raw) {
  for (const key of ["variants","variant","models","options","skus","items"]) {
    const value = raw?.[key];
    if (!Array.isArray(value) || !value.length || value.length > 250) continue;
    return value.slice(0, 250).map((item, index) => {
      if (item == null) return { index, value:"" };
      if (["string","number","boolean"].includes(typeof item)) return { index, value:clean(item) };
      return {
        index,
        id: pickDirect(item, ["sku","id","model_id","modelId","variantId","variant_id","itemId","item_id"]),
        name: pickDirect(item, ["name","title","label","option","variantName","variant_name"]),
        price: pickDirect(item, ["price","salePrice","sale_price","amount"]),
        availability: pickDirect(item, ["stock","availability","stockStatus","stock_status"]),
        sourceFields: flattenPrimitiveFields(item, 30)
      };
    });
  }
  return [];
}

function derivedSpecs(title) {
  const t = clean(title);
  const out = {};
  const put = (key, value, unit = "") => {
    if (value == null || Number.isNaN(value)) return;
    out[key] = { value, unit, evidence:"title", confidence:"medium" };
  };

  let m;
  m = t.match(/\b(?:RAM\s*)?(2|3|4|6|8|12|16|24|32|64)\s*GB\s*(?:RAM|Memory)\b/i);
  if (!m) m = t.match(/\b(?:RAM|Memory)\s*(2|3|4|6|8|12|16|24|32|64)\s*GB\b/i);
  if (m) put("ramGB", Number(m[1]), "GB");

  m = t.match(/\b(32|64|128|256|512|1024|2048)\s*GB\s*(?:ROM|Storage|SSD|NVMe|eMMC)?\b/i);
  if (m) put("storageGB", Number(m[1]), "GB");

  m = t.match(/\b(\d{4,6})\s*mAh\b/i);
  if (m) put("batteryMah", Number(m[1]), "mAh");

  m = t.match(/\b(\d{2,3})\s*MP\b/i);
  if (m) put("cameraMP", Number(m[1]), "MP");

  m = t.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:inch|inches|")\b/i);
  if (m) {
    const v = Number(m[1]);
    if (v >= 1 && v <= 100) put("screenOrSizeInches", v, "in");
  }

  m = t.match(/\b(\d{1,5})\s*W\b/i);
  if (m) put("watts", Number(m[1]), "W");

  m = t.match(/\b(\d{4,6})\s*BTU\b/i);
  if (m) put("btu", Number(m[1]), "BTU");

  m = t.match(/\b(\d+(?:\.\d+)?)\s*kg\b/i);
  if (m) put("weightKg", Number(m[1]), "kg");

  m = t.match(/\b(1\.75|2\.85)\s*mm\b/i);
  if (m) put("filamentDiameterMm", Number(m[1]), "mm");

  const connectivity = [];
  if (/\b5G\b/i.test(t)) connectivity.push("5G");
  if (/\b4G\b/i.test(t)) connectivity.push("4G");
  if (/\bBluetooth\b/i.test(t)) connectivity.push("Bluetooth");
  if (/\bWi-?Fi\b/i.test(t)) connectivity.push("Wi-Fi");
  if (/\bGPS\b/i.test(t)) connectivity.push("GPS");
  if (connectivity.length) out.connectivity = { value:connectivity, evidence:"title", confidence:"medium" };

  return out;
}

function rawCandidateMap(payload) {
  const byId = new Map();
  const byTitle = new Map();
  const stack = [payload];
  const seen = new Set();

  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const child of value) stack.push(child);
      continue;
    }

    const title = pickDirect(value, [
      "title","name","product_name","productName","product_title","productTitle",
      "offer_name","offerName","product"
    ]);

    if (title) {
      const id = pickDirect(value, [...FIELD_KEYS.sellerProductId, ...FIELD_KEYS.sku]);
      if (id && !byId.has(id)) byId.set(id, value);
      const titleKey = norm(title);
      if (titleKey && !byTitle.has(titleKey)) byTitle.set(titleKey, value);
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") stack.push(child);
    }
  }

  return { byId, byTitle };
}

function identityKeys(record) {
  const exactGlobal = uniq([
    record.identifiers.gtin && `gtin:${compact(record.identifiers.gtin)}`,
    record.identifiers.ean && `ean:${compact(record.identifiers.ean)}`,
    record.identifiers.upc && `upc:${compact(record.identifiers.upc)}`,
    record.identifiers.isbn && `isbn:${compact(record.identifiers.isbn)}`,
    record.identifiers.mpn && record.brand && `mpn:${compact(record.brand)}:${compact(record.identifiers.mpn)}`
  ]);

  const brandModel =
    record.brand && record.identifiers.model
      ? `brand-model:${compact(record.brand)}:${compact(record.identifiers.model)}`
      : "";

  return {
    exactGlobal,
    sellerProduct: record.identifiers.sellerProductId
      ? `seller-product:${SELLER_SLUG}:${compact(record.identifiers.sellerProductId)}`
      : "",
    sku: record.identifiers.sku
      ? `seller-sku:${SELLER_SLUG}:${compact(record.identifiers.sku)}`
      : "",
    brandModel,
    exactName: `name:${record.name.normalized}`,
    compactName: `compact-name:${record.name.compact}`
  };
}

function stableProductKey(ids, normalized) {
  const stable = ids.sellerProductId || ids.sku || normalized.destinationUrl || normalized.affiliateUrl;
  if (stable) return `${SELLER_SLUG}:${sha(stable).slice(0,24)}`;
  const fingerprint = [
    norm(normalized.title), clean(normalized.price), clean(normalized.currency), clean(normalized.imageUrl)
  ].join("|");
  return `${SELLER_SLUG}:fallback:${sha(fingerprint).slice(0,24)}`;
}

function taxonomyFrom(raw, normalized) {
  const primitive = flattenPrimitiveFields(raw, 100);
  const group = clean(raw?.group ?? primitive.group ?? "");
  const family = clean(raw?.family ?? primitive.family ?? "");
  const subtype = clean(raw?.subtype ?? primitive.subtype ?? "");
  const canonicalPath = uniq([group, family, subtype]);
  return {
    sourceCategory: clean(normalized.category),
    sourceSubcategory: clean(normalized.subcategory),
    sourcePath: uniq([clean(normalized.category), clean(normalized.subcategory)]),
    canonicalCategory: group || clean(normalized.category),
    canonicalPath
  };
}

const files = walkJson(SOURCE_ROOT);
const recordsByKey = new Map();
const sourceFiles = new Set();
let normalizedRowsForSeller = 0;

for (const file of files) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    continue;
  }

  const normalizedRows = extractProducts(payload, file, 250000);
  const sellerRows = normalizedRows.filter(row => canonicalProductSeller(row.seller) === SELLER);
  if (!sellerRows.length) continue;

  sourceFiles.add(file);
  const candidates = rawCandidateMap(payload);

  for (const normalized of sellerRows) {
    normalizedRowsForSeller++;
    const raw =
      (normalized.sourceProductId && candidates.byId.get(clean(normalized.sourceProductId))) ||
      candidates.byTitle.get(norm(normalized.title)) ||
      {};

    const ids = explicitIds(raw, normalized);
    const explicitModel = ids.model;
    const inferredModel = explicitModel ? "" : inferTitleModel(normalized.title);
    if (!ids.model && inferredModel) ids.model = inferredModel;

    const brand = inferBrand(
      normalized.title,
      pickDirect(raw, FIELD_KEYS.brand) || normalized.brand
    );

    const modelConfidence = explicitModel ? "explicit" : inferredModel ? "title-inferred" : "none";
    const structured = structuredAttributes(raw);
    const sourceFields = flattenPrimitiveFields(raw, 100);
    const productKey = stableProductKey(ids, normalized);

    const record = {
      schemaVersion: VERSION,
      catalogId: SELLER_SLUG,
      productKey,
      seller: {
        name: SELLER,
        slug: SELLER_SLUG,
        network: clean(registryRow.network)
      },
      identifiers: ids,
      identity: {
        modelConfidence,
        comparableExact: Boolean(
          ids.gtin || ids.ean || ids.upc || ids.isbn ||
          (brand && ids.mpn) ||
          (brand && ids.model && modelConfidence === "explicit")
        )
      },
      name: {
        display: clean(normalized.title),
        normalized: norm(normalized.title),
        compact: compact(normalized.title),
        aliases: []
      },
      brand,
      taxonomy: taxonomyFrom(raw, normalized),
      specs: {
        structured,
        derived: derivedSpecs(normalized.title),
        sourceFields
      },
      variants: variants(raw),
      offer: {
        price: normalized.price,
        currency: clean(normalized.currency),
        condition: clean(normalized.condition),
        availability: clean(normalized.availability)
      },
      media: {
        imageUrl: validUrl(normalized.imageUrl) ? normalized.imageUrl : ""
      },
      links: {
        affiliateUrl: validUrl(normalized.affiliateUrl) ? normalized.affiliateUrl : "",
        destinationUrl: validUrl(normalized.destinationUrl) ? normalized.destinationUrl : ""
      },
      source: {
        network: clean(normalized.network),
        sourceName: clean(normalized.source),
        sourceFile: file,
        kind: "qualified-product-catalog-shard"
      },
      quality: {
        inputQuality: normalized.quality,
        sourceQualified: file.startsWith(`${SOURCE_ROOT}/`),
        hasStableSellerId: Boolean(ids.sellerProductId || ids.sku),
        hasBrand: Boolean(brand),
        hasModel: Boolean(ids.model),
        hasExplicitModel: modelConfidence === "explicit",
        hasStructuredSpecs: Object.keys(structured).length > 0,
        hasDerivedSpecs: Object.keys(derivedSpecs(normalized.title)).length > 0,
        hasPrice: normalized.price != null,
        hasImage: Boolean(normalized.imageUrl),
        hasAffiliateOrDestinationUrl: Boolean(normalized.affiliateUrl || normalized.destinationUrl)
      }
    };

    record.identity.keys = identityKeys(record);

    const old = recordsByKey.get(productKey);
    if (!old) {
      recordsByKey.set(productKey, record);
      continue;
    }

    const richness = x =>
      Object.keys(x.specs.structured).length * 5 +
      Object.keys(x.specs.derived || {}).length * 2 +
      Object.keys(x.specs.sourceFields).length +
      x.variants.length * 2 +
      Number(x.quality.hasBrand) * 3 +
      Number(x.quality.hasModel) * 4 +
      Number(x.quality.hasPrice) * 2 +
      Number(x.quality.hasImage) * 2 +
      Number(x.quality.hasAffiliateOrDestinationUrl) * 2;

    if (richness(record) > richness(old)) recordsByKey.set(productKey, record);
  }
}

const records = [...recordsByKey.values()].sort((a,b) =>
  a.name.normalized.localeCompare(b.name.normalized) || a.productKey.localeCompare(b.productKey)
);

if (!records.length) throw new Error(`No qualified catalog products found for ${SELLER}.`);
if (records.some(x => !x.quality.sourceQualified)) throw new Error("Unqualified source leaked into catalog.");
if (records.some(x => ["Temu","Joom"].includes(x.seller.name))) throw new Error("Blocked seller leaked into catalog.");

const indexes = {
  version: VERSION,
  seller: SELLER,
  byGlobalId: {},
  bySellerProductId: {},
  bySku: {},
  byBrandModel: {},
  byModel: {},
  byExactName: {},
  byCompactName: {}
};

function pushIndex(obj, key, productKey) {
  if (!key) return;
  if (!obj[key]) obj[key] = [];
  if (!obj[key].includes(productKey)) obj[key].push(productKey);
}

for (const record of records) {
  for (const key of record.identity.keys.exactGlobal) pushIndex(indexes.byGlobalId, key, record.productKey);
  if (record.identifiers.sellerProductId) pushIndex(indexes.bySellerProductId, compact(record.identifiers.sellerProductId), record.productKey);
  if (record.identifiers.sku) pushIndex(indexes.bySku, compact(record.identifiers.sku), record.productKey);
  if (record.identity.keys.brandModel) pushIndex(indexes.byBrandModel, record.identity.keys.brandModel, record.productKey);
  if (record.identifiers.model) pushIndex(indexes.byModel, compact(record.identifiers.model), record.productKey);
  pushIndex(indexes.byExactName, record.name.normalized, record.productKey);
  pushIndex(indexes.byCompactName, record.name.compact, record.productKey);
}

const conflicts = { globalId:[], sellerProductId:[], sku:[], brandModel:[] };
for (const [key, values] of Object.entries(indexes.byGlobalId)) if (values.length > 1) conflicts.globalId.push({key,productKeys:values});
for (const [key, values] of Object.entries(indexes.bySellerProductId)) if (values.length > 1) conflicts.sellerProductId.push({key,productKeys:values});
for (const [key, values] of Object.entries(indexes.bySku)) if (values.length > 1) conflicts.sku.push({key,productKeys:values});
for (const [key, values] of Object.entries(indexes.byBrandModel)) if (values.length > 1) conflicts.brandModel.push({key,productKeys:values});

const categoryIndex = {};
for (const record of records) {
  const canonicalKey = record.taxonomy.canonicalPath.length
    ? record.taxonomy.canonicalPath.map(norm).join("/")
    : norm(record.taxonomy.canonicalCategory || record.taxonomy.sourceCategory || "(uncategorized)");
  if (!categoryIndex[canonicalKey]) {
    categoryIndex[canonicalKey] = {
      canonicalCategory: record.taxonomy.canonicalCategory || "",
      canonicalPath: record.taxonomy.canonicalPath || [],
      sourceLabels: [],
      count: 0,
      productKeys: []
    };
  }
  categoryIndex[canonicalKey].count++;
  categoryIndex[canonicalKey].productKeys.push(record.productKey);
  categoryIndex[canonicalKey].sourceLabels = uniq([
    ...categoryIndex[canonicalKey].sourceLabels,
    record.taxonomy.sourceCategory,
    record.taxonomy.sourceSubcategory
  ]);
}

const count = fn => records.filter(fn).length;
const pct = n => Number((n * 100 / records.length).toFixed(1));
const metrics = {
  totalProducts: records.length,
  sourceFiles: sourceFiles.size,
  stableSellerId: count(x => x.quality.hasStableSellerId),
  brand: count(x => x.quality.hasBrand),
  modelAny: count(x => x.quality.hasModel),
  modelExplicit: count(x => x.quality.hasExplicitModel),
  modelInferred: count(x => x.identity.modelConfidence === "title-inferred"),
  comparableExact: count(x => x.identity.comparableExact),
  structuredSpecs: count(x => x.quality.hasStructuredSpecs),
  derivedSpecs: count(x => x.quality.hasDerivedSpecs),
  price: count(x => x.quality.hasPrice),
  image: count(x => x.quality.hasImage),
  link: count(x => x.quality.hasAffiliateOrDestinationUrl),
  variants: count(x => x.variants.length > 0),
  sourceQualified: count(x => x.quality.sourceQualified)
};

const fillRates = Object.fromEntries(
  Object.entries(metrics)
    .filter(([key]) => !["totalProducts","sourceFiles"].includes(key))
    .map(([key,value]) => [key,{count:value,percent:pct(value)}])
);

function resolve(query) {
  const qn = norm(query);
  const qc = compact(query);

  for (const [kind, bucket, key] of [
    ["exact-name", indexes.byExactName, qn],
    ["compact-name", indexes.byCompactName, qc],
    ["model", indexes.byModel, qc],
    ["seller-product-id", indexes.bySellerProductId, qc],
    ["sku", indexes.bySku, qc]
  ]) {
    const values = bucket[key] || [];
    if (values.length) return {kind, productKeys:values};
  }

  const candidates = records.filter(r => r.name.normalized.includes(qn)).slice(0,20);
  return {kind:candidates.length ? "name-contains" : "not-found", productKeys:candidates.map(x=>x.productKey)};
}

const roundTripSamples = [];
for (const record of records.filter(x => x.identifiers.model).slice(0,20)) {
  const result = resolve(record.identifiers.model);
  roundTripSamples.push({
    query:record.identifiers.model,
    expectedProductKey:record.productKey,
    resolutionKind:result.kind,
    resolved:result.productKeys.includes(record.productKey),
    resultCount:result.productKeys.length
  });
}
for (const record of records.filter(x => x.identifiers.sellerProductId).slice(0,20)) {
  const result = resolve(record.identifiers.sellerProductId);
  roundTripSamples.push({
    query:record.identifiers.sellerProductId,
    expectedProductKey:record.productKey,
    resolutionKind:result.kind,
    resolved:result.productKeys.includes(record.productKey),
    resultCount:result.productKeys.length
  });
}

const manifest = {
  version: VERSION,
  architecture: "seller-catalog-first",
  seller: {
    name:SELLER,
    slug:SELLER_SLUG,
    network:clean(registryRow.network),
    mode:clean(registryRow.mode),
    role:ROLE
  },
  generatedAt:new Date().toISOString(),
  schema:"../../schema-v1.json",
  sourcePolicy:"../../source-policy-v1.json",
  files:{
    products:"products.ndjson",
    identityIndex:"identity-index.json",
    categoryIndex:"category-index.json",
    audit:"audit.json"
  },
  metrics,
  fillRates,
  identityPolicy:{
    exactMergeAllowedBy:[
      "GTIN/EAN/UPC/ISBN exact match",
      "brand + explicit MPN exact match",
      "brand + explicit model exact match"
    ],
    neverAutoMergeBy:[
      "title alone",
      "price alone",
      "image alone",
      "title-inferred model alone",
      "semantic clusterKey alone"
    ]
  }
};

const audit = {
  version:VERSION,
  seller:SELLER,
  generatedAt:manifest.generatedAt,
  input:{
    sourceRoot:SOURCE_ROOT,
    sourceFilesContainingSeller:[...sourceFiles].sort(),
    normalizedRowsForSeller
  },
  metrics,
  fillRates,
  conflicts,
  roundTripSamples,
  sourceLeak:records.some(x => !x.source.sourceFile.startsWith(`${SOURCE_ROOT}/`)),
  blockedSellerLeak:records.some(x => ["Temu","Joom"].includes(x.seller.name)),
  duplicateProductKeys:records.length !== new Set(records.map(x=>x.productKey)).size
};

fs.writeFileSync(`${SELLER_DIR}/products.ndjson`, records.map(x=>JSON.stringify(x)).join("\n")+"\n");
fs.writeFileSync(`${SELLER_DIR}/identity-index.json`, JSON.stringify(indexes,null,2)+"\n");
fs.writeFileSync(`${SELLER_DIR}/category-index.json`, JSON.stringify(categoryIndex,null,2)+"\n");
fs.writeFileSync(`${SELLER_DIR}/manifest.json`, JSON.stringify(manifest,null,2)+"\n");
fs.writeFileSync(`${SELLER_DIR}/audit.json`, JSON.stringify(audit,null,2)+"\n");

console.log(JSON.stringify({
  seller:SELLER,
  totalProducts:metrics.totalProducts,
  stableSellerId:metrics.stableSellerId,
  stableSellerIdPercent:fillRates.stableSellerId.percent,
  sourceQualifiedPercent:fillRates.sourceQualified.percent,
  brandPercent:fillRates.brand.percent,
  modelPercent:fillRates.modelAny.percent,
  derivedSpecsPercent:fillRates.derivedSpecs.percent,
  pricePercent:fillRates.price.percent,
  imagePercent:fillRates.image.percent,
  roundTrip:`${roundTripSamples.filter(x=>x.resolved).length}/${roundTripSamples.length}`
}, null, 2));
