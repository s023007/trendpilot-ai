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

const VERSION = "19.8.0";
const ROOT = "data";
const CATALOG_SET = "data/catalog-v19/catalog-set-v1.json";

const set = JSON.parse(fs.readFileSync(CATALOG_SET,"utf8"));
const completed = new Set((set.sellers || []).map(x=>x.name));

if (completed.has("Temu") || completed.has("Joom")) {
  throw new Error("Blocked seller leaked into completed catalog set.");
}

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

  if ([
    "coupons.json",
    "product-seller-registry-v17.json",
    "approved-product-sellers-v16.json",
    "seller-coverage-v15-1.json",
    "cj-affiliate-status-v18.json"
  ].includes(base)) return true;

  return (
    /(^|\/)(audit|audits|reports?|summaries|health|manifests?|resolver|queue)(\/|$)/i.test(lower) ||
    /(seller-audit|coverage-report|comparison-sets|search-routes|same-model|lab-report|benchmark|verification)/i.test(base)
  );
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

const remaining = PUBLIC_PRODUCT_SELLER_NAMES.filter(
  seller => !completed.has(seller) && !["Temu","Joom"].includes(seller)
);

const sellers = new Map(
  remaining.map(seller=>[seller,{
    seller,
    allCandidateKeys:new Set(),
    qualifiedKeys:new Set(),
    candidateFiles:new Set(),
    qualifiedFiles:new Set()
  }])
);

for (const file of walkJson(ROOT)) {
  if (forbiddenPath(file)) continue;

  let payload;
  try { payload = JSON.parse(fs.readFileSync(file,"utf8")); }
  catch { continue; }

  let rows;
  try { rows = extractProducts(payload,file,250000); }
  catch { continue; }

  const perSeller = new Map();

  for (const row of rows) {
    const seller = canonicalProductSeller(row.seller);
    if (!sellers.has(seller)) continue;
    if (!perSeller.has(seller)) perSeller.set(seller,[]);
    perSeller.get(seller).push(row);
  }

  for (const [seller,sellerRows] of perSeller) {
    const stat = sellers.get(seller);
    stat.candidateFiles.add(file);

    const uniq = new Map();
    for (const row of sellerRows) {
      const key = keyFor(row);
      if (key && !uniq.has(key)) uniq.set(key,row);
      if (key) stat.allCandidateKeys.add(key);
    }

    const values = [...uniq.values()];
    const n = values.length;
    if (!n) continue;

    const stable = values.filter(x=>clean(x.sourceProductId || x.id)).length;
    const price = values.filter(x=>x.price != null).length;
    const image = values.filter(x=>clean(x.imageUrl)).length;
    const link = values.filter(x=>clean(x.affiliateUrl || x.destinationUrl)).length;
    const title = values.filter(x=>clean(x.title)).length;

    const rate = x => n ? x/n : 0;

    const qualifies =
      title === n &&
      rate(stable) >= 0.50 &&
      rate(link) >= 0.50 &&
      (rate(price) >= 0.25 || rate(image) >= 0.25);

    if (qualifies) {
      stat.qualifiedFiles.add(file);
      for (const [key] of uniq) stat.qualifiedKeys.add(key);
    }
  }
}

const rows = [...sellers.values()]
  .map(x=>({
    seller:x.seller,
    candidateFiles:x.candidateFiles.size,
    qualifiedFiles:x.qualifiedFiles.size,
    allCandidateUniqueProducts:x.allCandidateKeys.size,
    qualifiedProducts:x.qualifiedKeys.size
  }))
  .sort((a,b)=>
    b.qualifiedProducts-a.qualifiedProducts ||
    b.allCandidateUniqueProducts-a.allCandidateUniqueProducts ||
    a.seller.localeCompare(b.seller)
  );

const result = {
  version:VERSION,
  generatedAt:new Date().toISOString(),
  completedSellers:[...completed],
  sourceAware:true,
  remaining:rows,
  recommendedNext:rows.find(x=>x.qualifiedProducts>0) || null
};

fs.writeFileSync("data/catalog-v19/seller-build-queue-v3.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
