import fs from "node:fs";
import path from "node:path";
import {
  clean,
  extractProducts
} from "../../netlify/functions/products-v16-lib.mjs";
import {
  PUBLIC_PRODUCT_SELLER_NAMES,
  canonicalProductSeller
} from "../../netlify/functions/product-seller-policy-v17.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const i = arg.indexOf("=");
    return i < 0 ? [arg, ""] : [arg.slice(0,i), arg.slice(i+1)];
  })
);

const SELLER = args["--seller"];
const SLUG = args["--slug"];
const VERSION = args["--version"] || "19.3.3";

if (!SELLER || !SLUG) throw new Error("Missing --seller or --slug.");
if (!PUBLIC_PRODUCT_SELLER_NAMES.includes(SELLER)) {
  throw new Error(`${SELLER} is not an approved public product seller.`);
}
if (PUBLIC_PRODUCT_SELLER_NAMES.includes("Temu") || PUBLIC_PRODUCT_SELLER_NAMES.includes("Joom")) {
  throw new Error("Blocked seller leaked into public seller policy.");
}

const ROOT = "data";
const OUT_DIR = "data/catalog-v19/source-manifests";
fs.mkdirSync(OUT_DIR,{recursive:true});

const norm = v => clean(v).normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g," ").trim();

function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) {
      if (
        full.startsWith("data/catalog-v19") ||
        full.startsWith("data/commercial-v19")
      ) continue;
      out.push(...walkJson(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function forbiddenPath(file) {
  const lower = file.toLowerCase();
  const base = path.basename(lower);
  const explicit = [
    "coupons.json",
    "product-seller-registry-v17.json",
    "approved-product-sellers-v16.json",
    "seller-coverage-v15-1.json",
    "cj-affiliate-status-v18.json"
  ];
  if (explicit.includes(base)) return "explicit-metadata-or-commercial-file";

  if (
    /(^|\/)(audit|audits|reports?|summaries|health|manifests?|resolver|queue)(\/|$)/i.test(lower)
  ) return "generated-or-audit-directory";

  if (
    /(seller-audit|coverage-report|comparison-sets|search-routes|same-model|lab-report|benchmark|verification)/i.test(base)
  ) return "generated-analysis-file";

  return "";
}

function keyFor(row) {
  return clean(
    row.id ||
    row.sourceProductId ||
    row.affiliateUrl ||
    row.destinationUrl ||
    `${row.seller}|${row.title}|${row.price}|${row.currency}`
  );
}

const stats = [];
const qualifiedFiles = [];
const allUnique = new Set();
const qualifiedUnique = new Set();

for (const file of walkJson(ROOT)) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file,"utf8"));
  } catch {
    continue;
  }

  let rows;
  try {
    rows = extractProducts(payload,file,250000)
      .filter(row => canonicalProductSeller(row.seller) === SELLER);
  } catch {
    continue;
  }
  if (!rows.length) continue;

  const uniq = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (key && !uniq.has(key)) uniq.set(key,row);
    if (key) allUnique.add(key);
  }

  const values = [...uniq.values()];
  const n = values.length;
  const stable = values.filter(x => clean(x.sourceProductId || x.id)).length;
  const price = values.filter(x => x.price != null).length;
  const image = values.filter(x => clean(x.imageUrl)).length;
  const link = values.filter(x => clean(x.affiliateUrl || x.destinationUrl)).length;
  const title = values.filter(x => clean(x.title)).length;

  const rate = x => n ? x/n : 0;
  const forbidden = forbiddenPath(file);

  // Qualified source rule:
  // - actual normalized product records for this seller
  // - not commercial/audit/registry metadata
  // - stable identity on most records
  // - working product destination/tracking link on most records
  // - at least price or image coverage proving this behaves like a product feed
  const isShard = file.startsWith("data/search-catalog/shards/");
  const qualifies =
    !forbidden &&
    title === n &&
    rate(stable) >= 0.50 &&
    rate(link) >= 0.50 &&
    (rate(price) >= 0.25 || rate(image) >= 0.25);

  let reason = "qualified-product-source";
  if (forbidden) reason = forbidden;
  else if (!qualifies) {
    reason = [
      rate(stable) < 0.50 ? "low-stable-id" : "",
      rate(link) < 0.50 ? "low-product-link" : "",
      (rate(price) < 0.25 && rate(image) < 0.25) ? "no-price-or-image-signal" : ""
    ].filter(Boolean).join("+") || "failed-product-source-rule";
  }

  stats.push({
    file,
    rows:rows.length,
    uniqueProducts:n,
    stableIdPercent:Number((rate(stable)*100).toFixed(1)),
    pricePercent:Number((rate(price)*100).toFixed(1)),
    imagePercent:Number((rate(image)*100).toFixed(1)),
    linkPercent:Number((rate(link)*100).toFixed(1)),
    alreadyQualifiedShard:isShard,
    qualifies,
    reason
  });

  if (qualifies) {
    qualifiedFiles.push(file);
    for (const [key] of uniq) qualifiedUnique.add(key);
  }
}

stats.sort((a,b) =>
  Number(b.qualifies)-Number(a.qualifies) ||
  b.uniqueProducts-a.uniqueProducts ||
  a.file.localeCompare(b.file)
);

if (!qualifiedFiles.length) throw new Error(`No qualified product sources discovered for ${SELLER}.`);

const result = {
  version:VERSION,
  seller:SELLER,
  slug:SLUG,
  generatedAt:new Date().toISOString(),
  policy:{
    purpose:"Discover all repository product-feed sources for one approved seller before building its canonical V19 catalog.",
    productCatalogOnly:true,
    couponsAndPromotionsExcluded:true,
    auditsAndGeneratedAnalysisExcluded:true
  },
  candidateFiles:stats.length,
  qualifiedFileCount:qualifiedFiles.length,
  discoveredUniqueProductsAcrossAllCandidateFiles:allUnique.size,
  qualifiedUniqueProducts:qualifiedUnique.size,
  qualifiedFiles:qualifiedFiles.sort(),
  files:stats
};

fs.writeFileSync(`${OUT_DIR}/${SLUG}.json`,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({
  seller:SELLER,
  candidateFiles:result.candidateFiles,
  qualifiedFileCount:result.qualifiedFileCount,
  allCandidateUniqueProducts:result.discoveredUniqueProductsAcrossAllCandidateFiles,
  qualifiedUniqueProducts:result.qualifiedUniqueProducts,
  qualifiedFiles:result.qualifiedFiles
},null,2));
