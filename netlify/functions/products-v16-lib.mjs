import { createHash } from "node:crypto";

export const STORE_NAME = "trendpilot-products-v16";

export const clean = value =>
  String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const lower = value => clean(value).toLocaleLowerCase("en-US");

export function validUrl(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && clean(value)) return value;
  }
  return "";
}

export function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = clean(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function hashHex(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function tokenBucket(token) {
  return createHash("sha1").update(token).digest("hex").slice(0, 2);
}

function baseTokens(value, max = 80) {
  const raw = lower(value)
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]+/gu) || [];

  const out = [];
  const seen = new Set();

  for (const rawToken of raw) {
    const token = rawToken.slice(0, 80);
    if (token.length < 2 || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }

  return out;
}

function tokenForms(token) {
  const forms = new Set([token]);

  if (/^[a-z0-9]+$/i.test(token)) {
    if (token.length > 4 && token.endsWith("ies")) forms.add(token.slice(0, -3) + "y");
    if (token.length > 4 && token.endsWith("es")) forms.add(token.slice(0, -2));
    if (token.length > 3 && token.endsWith("s")) forms.add(token.slice(0, -1));
  }

  return [...forms].filter(x => x.length >= 2);
}

export function queryTokens(value) {
  const tokens = baseTokens(value, 12);
  const out = [];
  const seen = new Set();

  for (const token of tokens) {
    for (const form of tokenForms(token)) {
      if (!seen.has(form)) {
        seen.add(form);
        out.push(form);
      }
    }
  }

  return out.slice(0, 20);
}

function weightedTokens(product) {
  const fields = [
    [product.title, 12, 36],
    [product.brand, 8, 12],
    [product.category, 6, 20],
    [product.subcategory, 6, 20],
    [product.seller, 4, 12],
    [product.network, 3, 8],
    [product.description.slice(0, 500), 1, 50]
  ];

  const weights = new Map();

  for (const [text, weight, max] of fields) {
    for (const token of baseTokens(text, max)) {
      for (const form of tokenForms(token)) {
        weights.set(form, Math.max(weights.get(form) || 0, weight));
      }
    }
  }

  return weights;
}

export function normalizeProduct(obj, sourceHint = "") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

  const title = clean(pick(obj, [
    "title", "name", "product_name", "productName", "product_title", "productTitle",
    "offer_name", "offerName", "product"
  ]));
  if (title.length < 2 || title.length > 900) return null;

  const affiliateUrl = clean(pick(obj, [
    "affiliateUrl", "affiliate_url", "deeplink", "deep_link", "trackingUrl",
    "tracking_url", "clickUrl", "click_url", "goto", "affiliate_link", "tracking_link"
  ]));
  const destinationUrl = clean(pick(obj, [
    "destinationUrl", "destination_url", "productUrl", "product_url", "url",
    "link", "landing_page", "landingPage", "product_link"
  ]));
  const imageUrl = clean(pick(obj, [
    "image", "imageUrl", "image_url", "imageLink", "image_link", "picture",
    "picture_url", "photo", "mainImage", "main_image"
  ]));

  if (!validUrl(affiliateUrl) && !validUrl(destinationUrl) && !validUrl(imageUrl)) return null;

  const seller = clean(pick(obj, [
    "advertiser", "advertiserName", "advertiser_name", "seller", "merchant",
    "merchantName", "merchant_name", "store", "storeName", "store_name", "shop"
  ])).slice(0, 300);

  const explicitNetwork = clean(pick(obj, [
    "network", "affiliateNetwork", "affiliate_network", "sourceNetwork", "source_network"
  ])).slice(0, 120);

  const network =
    explicitNetwork &&
    !explicitNetwork.includes("/") &&
    !/\.json(?:$|\?)/i.test(explicitNetwork)
      ? explicitNetwork
      : "catalog";

  const source =
    clean(pick(obj, ["source", "sourceName", "source_name"])).slice(0, 300) ||
    sourceHint.slice(0, 300) ||
    network;

  const sourceProductId = clean(pick(obj, [
    "sourceProductId", "source_product_id", "productId", "product_id", "id",
    "sku", "offerId", "offer_id", "itemId", "item_id"
  ])).slice(0, 300);

  const advertiserId = clean(pick(obj, [
    "advertiserId", "advertiser_id", "merchantId", "merchant_id", "sellerId", "seller_id"
  ])).slice(0, 120);

  const description = clean(pick(obj, [
    "description", "shortDescription", "short_description", "summary",
    "product_description", "productDescription"
  ])).slice(0, 6000);

  const brand = clean(pick(obj, ["brand", "manufacturer", "vendor"])).slice(0, 300);
  const category = clean(pick(obj, [
    "category", "categoryName", "category_name", "group", "department", "vertical"
  ])).slice(0, 300);
  const subcategory = clean(pick(obj, [
    "subcategory", "subCategory", "subcategoryName", "subcategory_name", "family"
  ])).slice(0, 300);

  const currency = clean(pick(obj, [
    "currency", "currencyCode", "currency_code", "priceCurrency", "price_currency"
  ])).slice(0, 12);

  const price = numberValue(pick(obj, [
    "price", "salePrice", "sale_price", "currentPrice", "current_price", "amount"
  ]));

  const conditionText = clean(pick(obj, [
    "condition", "productCondition", "product_condition"
  ])).slice(0, 120);

  const availability = clean(pick(obj, [
    "availability", "stock", "stockStatus", "stock_status"
  ])).slice(0, 160);

  const qualityRaw = Number(pick(obj, ["quality", "score", "matchScore", "match_score"]));
  const quality = Number.isFinite(qualityRaw)
    ? Math.max(1, Math.min(100, Math.round(qualityRaw)))
    : 60;

  const identity = [
    lower(network),
    lower(seller),
    sourceProductId || affiliateUrl || destinationUrl || lower(title)
  ].join("|");

  const id = hashHex(identity);

  return {
    id,
    source,
    network,
    seller,
    advertiserId,
    sourceProductId,
    title: title.slice(0, 900),
    description,
    brand,
    category,
    subcategory,
    price,
    currency,
    imageUrl: validUrl(imageUrl) ? imageUrl : "",
    affiliateUrl: validUrl(affiliateUrl) ? affiliateUrl : "",
    destinationUrl: validUrl(destinationUrl) ? destinationUrl : "",
    condition: conditionText,
    availability,
    quality
  };
}

export function extractProducts(root, sourceHint = "", max = 160000) {
  const found = [];
  const stack = [root];
  const seenObjects = new Set();

  while (stack.length && found.length < max) {
    const value = stack.pop();

    if (!value || typeof value !== "object") continue;
    if (seenObjects.has(value)) continue;
    seenObjects.add(value);

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) stack.push(value[i]);
      continue;
    }

    const product = normalizeProduct(value, sourceHint);
    if (product) found.push(product);

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") stack.push(child);
    }
  }

  return found;
}

export function collectCatalogJsonPaths(root, max = 250) {
  const paths = new Set();
  const stack = [root];
  const seenObjects = new Set();

  const add = raw => {
    let value = clean(raw);
    if (!value || !/\.json(?:\?|$)/i.test(value)) return;

    try {
      if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
    } catch {}

    value = value.split("?")[0].replace(/^\/+/, "");

    if (value.startsWith("data/search-catalog/")) {
      paths.add("/" + value);
    } else if (value.startsWith("search-catalog/")) {
      paths.add("/data/" + value);
    } else if (/^(?:shards|product-index|segments)\//i.test(value)) {
      paths.add("/data/search-catalog/" + value);
    }
  };

  while (stack.length && paths.size < max) {
    const value = stack.pop();

    if (typeof value === "string") {
      add(value);
      continue;
    }
    if (!value || typeof value !== "object") continue;
    if (seenObjects.has(value)) continue;
    seenObjects.add(value);

    if (Array.isArray(value)) {
      for (const child of value) stack.push(child);
    } else {
      for (const child of Object.values(value)) {
        if (typeof child === "string") add(child);
        else if (child && typeof child === "object") stack.push(child);
      }
    }
  }

  return [...paths];
}

export function buildIndex(products) {
  const docs = new Map();
  const postings = new Map();
  const sellers = new Map();
  const networks = new Map();

  for (const product of products) {
    docs.set(product.id, product);

    const sellerKey = product.seller || "(unknown seller)";
    sellers.set(sellerKey, (sellers.get(sellerKey) || 0) + 1);

    const networkKey = product.network || "(unknown network)";
    networks.set(networkKey, (networks.get(networkKey) || 0) + 1);

    const weights = weightedTokens(product);
    for (const [token, score] of weights) {
      let byId = postings.get(token);
      if (!byId) {
        byId = new Map();
        postings.set(token, byId);
      }

      const current = byId.get(product.id);
      if (!current || score > current.score) {
        byId.set(product.id, {
          id: product.id,
          score,
          seller: lower(product.seller),
          network: lower(product.network)
        });
      }
    }
  }

  return { docs, postings, sellers, networks };
}
