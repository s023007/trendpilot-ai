import fs from "node:fs";
import path from "node:path";
import { extractProducts } from "../../netlify/functions/products-v16-lib.mjs";
import {
  PUBLIC_PRODUCT_SELLER_NAMES,
  canonicalProductSeller
} from "../../netlify/functions/product-seller-policy-v17.mjs";

const ROOT = "data/catalog-v19";
const SOURCE = "data/search-catalog/shards";
const BUILT = new Set(["Geekbuying","AliExpress","Alibaba"]);

function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) out.push(full);
  }
  return out;
}

const ids = new Map();
for (const seller of PUBLIC_PRODUCT_SELLER_NAMES) {
  if (!BUILT.has(seller)) ids.set(seller,new Set());
}

for (const file of walkJson(SOURCE)) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(file,"utf8")); }
  catch { continue; }

  for (const row of extractProducts(payload,file,250000)) {
    const seller = canonicalProductSeller(row.seller);
    if (!ids.has(seller)) continue;
    ids.get(seller).add(row.id || row.sourceProductId || `${row.title}|${row.price}|${row.currency}`);
  }
}

const queue = [...ids.entries()]
  .map(([seller,set]) => ({seller,qualifiedProducts:set.size}))
  .sort((a,b)=>b.qualifiedProducts-a.qualifiedProducts || a.seller.localeCompare(b.seller));

const result = {
  version:"19.2.0",
  generatedAt:new Date().toISOString(),
  completedSellers:["Geekbuying","AliExpress","Alibaba"],
  remaining:queue,
  recommendedNext:queue.find(x=>x.qualifiedProducts>0) || null
};

fs.writeFileSync(`${ROOT}/seller-build-queue-v1.json`,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
