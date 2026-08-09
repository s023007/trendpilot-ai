import { createHash } from "node:crypto";
import { getDatabase } from "@netlify/database";

const clean = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const pick = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && clean(value)) return value;
  }
  return "";
};

const validUrl = value => {
  try {
    const url = new URL(clean(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const numberValue = value => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = clean(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

function normalizeProduct(obj, sourceHint = "") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

  const title = clean(pick(obj, [
    "title", "name", "product_name", "productName", "product_title", "productTitle", "offer_name", "offerName"
  ]));
  if (title.length < 2 || title.length > 800) return null;

  const affiliateUrl = clean(pick(obj, [
    "affiliateUrl", "affiliate_url", "deeplink", "deep_link", "trackingUrl", "tracking_url",
    "clickUrl", "click_url", "goto", "affiliate_link"
  ]));
  const destinationUrl = clean(pick(obj, [
    "destinationUrl", "destination_url", "productUrl", "product_url", "url", "link", "landing_page", "landingPage"
  ]));
  const imageUrl = clean(pick(obj, [
    "image", "imageUrl", "image_url", "imageLink", "image_link", "picture", "picture_url", "photo"
  ]));

  if (!validUrl(affiliateUrl) && !validUrl(destinationUrl) && !validUrl(imageUrl)) return null;

  const seller = clean(pick(obj, [
    "advertiser", "advertiserName", "advertiser_name", "seller", "merchant", "merchantName",
    "merchant_name", "store", "storeName", "store_name", "shop"
  ]));
  const network = clean(pick(obj, [
    "network", "affiliateNetwork", "affiliate_network", "sourceNetwork", "source_network"
  ])) || clean(sourceHint).split(":")[0] || "catalog";
  const source = clean(pick(obj, ["source", "sourceName", "source_name"])) || sourceHint || network;
  const sourceProductId = clean(pick(obj, [
    "sourceProductId", "source_product_id", "productId", "product_id", "id", "sku", "offerId", "offer_id"
  ]));
  const advertiserId = clean(pick(obj, [
    "advertiserId", "advertiser_id", "merchantId", "merchant_id", "sellerId", "seller_id"
  ]));

  const description = clean(pick(obj, [
    "description", "shortDescription", "short_description", "summary", "product_description"
  ])).slice(0, 6000);
  const brand = clean(pick(obj, ["brand", "manufacturer", "vendor"])).slice(0, 300);
  const category = clean(pick(obj, [
    "category", "categoryName", "category_name", "group", "department"
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
  const conditionText = clean(pick(obj, ["condition", "productCondition", "product_condition"])).slice(0, 120);
  const availability = clean(pick(obj, ["availability", "stock", "stockStatus", "stock_status"])).slice(0, 160);
  const qualityRaw = Number(pick(obj, ["quality", "score", "matchScore", "match_score"]));
  const quality = Number.isFinite(qualityRaw) ? Math.max(1, Math.min(100, Math.round(qualityRaw))) : 60;

  const identity = [
    network.toLowerCase(),
    seller.toLowerCase(),
    sourceProductId || affiliateUrl || destinationUrl || title.toLowerCase()
  ].join("|");
  const sourceKey = createHash("sha256").update(identity).digest("hex");

  return {
    sourceKey,
    source: source.slice(0, 300),
    network: network.slice(0, 120),
    seller: seller.slice(0, 300),
    advertiserId: advertiserId.slice(0, 120),
    sourceProductId: sourceProductId.slice(0, 300),
    title: title.slice(0, 800),
    description,
    brand,
    category,
    subcategory,
    price,
    currency,
    imageUrl: validUrl(imageUrl) ? imageUrl : "",
    affiliateUrl: validUrl(affiliateUrl) ? affiliateUrl : "",
    destinationUrl: validUrl(destinationUrl) ? destinationUrl : "",
    conditionText,
    availability,
    quality
  };
}

function extractProducts(root, sourceHint, max = 120000) {
  const found = [];
  const seenObjects = new Set();
  const stack = [root];

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

function collectCatalogJsonPaths(root, max = 120) {
  const paths = new Set();
  const seenObjects = new Set();
  const stack = [root];

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
    } else if (/^(?:shards|product-index)\//.test(value)) {
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

async function fetchJson(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "accept": "application/json" },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function upsertBatch(client, products) {
  if (!products.length) return 0;

  const columns = [
    "source_key", "source", "network", "seller", "advertiser_id", "source_product_id",
    "title", "description", "brand", "category", "subcategory", "price", "currency",
    "image_url", "affiliate_url", "destination_url", "condition_text", "availability", "quality"
  ];

  const params = [];
  const groups = products.map(product => {
    const values = [
      product.sourceKey, product.source, product.network, product.seller, product.advertiserId,
      product.sourceProductId, product.title, product.description, product.brand, product.category,
      product.subcategory, product.price, product.currency, product.imageUrl, product.affiliateUrl,
      product.destinationUrl, product.conditionText, product.availability, product.quality
    ];
    const placeholders = values.map(value => {
      params.push(value);
      return `$${params.length}`;
    });
    return `(${placeholders.join(",")})`;
  });

  const sql = `
    INSERT INTO tp_products_v16 (${columns.join(",")})
    VALUES ${groups.join(",")}
    ON CONFLICT (source_key) DO UPDATE SET
      source = EXCLUDED.source,
      network = EXCLUDED.network,
      seller = EXCLUDED.seller,
      advertiser_id = EXCLUDED.advertiser_id,
      source_product_id = EXCLUDED.source_product_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      brand = EXCLUDED.brand,
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      image_url = EXCLUDED.image_url,
      affiliate_url = EXCLUDED.affiliate_url,
      destination_url = EXCLUDED.destination_url,
      condition_text = EXCLUDED.condition_text,
      availability = EXCLUDED.availability,
      quality = GREATEST(tp_products_v16.quality, EXCLUDED.quality),
      active = TRUE,
      last_seen_at = NOW(),
      updated_at = NOW()
  `;

  await client.query(sql, params);
  return products.length;
}

export default async function handler(request) {
  const db = getDatabase();
  const client = await db.pool.connect();
  let jobId = null;
  let lockHeld = false;

  try {
    const lock = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [160016]);
    lockHeld = Boolean(lock.rows?.[0]?.locked);

    if (!lockHeld) {
      console.log("TrendPilot V16 rebuild skipped: another rebuild is already running.");
      return;
    }

    const recent = await client.query(`
      SELECT completed_at
      FROM tp_index_jobs_v16
      WHERE job_type = 'catalog-rebuild' AND status = 'completed'
      ORDER BY id DESC
      LIMIT 1
    `);

    const completedAt = recent.rows?.[0]?.completed_at ? new Date(recent.rows[0].completed_at).getTime() : 0;
    if (completedAt && Date.now() - completedAt < 20 * 60 * 1000) {
      console.log("TrendPilot V16 rebuild skipped: a successful rebuild completed less than 20 minutes ago.");
      return;
    }

    const insertedJob = await client.query(
      "INSERT INTO tp_index_jobs_v16 (job_type, status, detail) VALUES ($1, $2, $3) RETURNING id",
      ["catalog-rebuild", "running", "V16 trusted static catalog import"]
    );
    jobId = insertedJob.rows[0].id;

    const origin = new URL(request.url).origin;
    const seeds = [
      "/data/search-catalog/manifest.json",
      "/data/product-discovery-v15.json",
      "/data/admitad-products-new-account-v15-3-2.json",
      "/data/cj-products.json"
    ];

    const byKey = new Map();
    const extraPaths = new Set();
    let rowsSeen = 0;

    for (const path of seeds) {
      try {
        const payload = await fetchJson(origin + path, 45000);
        const rows = extractProducts(payload, path);
        rowsSeen += rows.length;
        for (const row of rows) byKey.set(row.sourceKey, row);

        if (path.endsWith("/manifest.json") && rows.length < 1000) {
          for (const extra of collectCatalogJsonPaths(payload, 120)) extraPaths.add(extra);
        }
        console.log("V16 seed", path, "products", rows.length);
      } catch (error) {
        console.warn("V16 seed failed", path, String(error?.message || error));
      }
    }

    if (byKey.size < 1000 && extraPaths.size) {
      const paths = [...extraPaths].slice(0, 120);
      const concurrency = 4;

      for (let i = 0; i < paths.length; i += concurrency) {
        const group = paths.slice(i, i + concurrency);
        const settled = await Promise.allSettled(
          group.map(async path => {
            const payload = await fetchJson(origin + path, 30000);
            return { path, rows: extractProducts(payload, path, 25000) };
          })
        );

        for (const item of settled) {
          if (item.status !== "fulfilled") continue;
          rowsSeen += item.value.rows.length;
          for (const row of item.value.rows) byKey.set(row.sourceKey, row);
          console.log("V16 catalog part", item.value.path, "products", item.value.rows.length);
        }
      }
    }

    const all = [...byKey.values()];
    let written = 0;
    const batchSize = 120;

    await client.query("BEGIN");
    try {
      for (let i = 0; i < all.length; i += batchSize) {
        written += await upsertBatch(client, all.slice(i, i + batchSize));
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    await client.query(
      `UPDATE tp_index_jobs_v16
       SET status = 'completed',
           completed_at = NOW(),
           rows_seen = $2,
           rows_written = $3,
           detail = $4
       WHERE id = $1`,
      [jobId, rowsSeen, written, `Unique products indexed: ${all.length}`]
    );

    console.log("TrendPilot V16 rebuild completed", {
      rowsSeen,
      unique: all.length,
      written
    });
  } catch (error) {
    console.error("TrendPilot V16 rebuild failed", error);

    if (jobId) {
      try {
        await client.query(
          `UPDATE tp_index_jobs_v16
           SET status = 'failed',
               completed_at = NOW(),
               detail = $2
           WHERE id = $1`,
          [jobId, String(error?.message || error).slice(0, 1200)]
        );
      } catch {}
    }

    throw error;
  } finally {
    if (lockHeld) {
      try { await client.query("SELECT pg_advisory_unlock($1)", [160016]); } catch {}
    }
    client.release();
  }
}

export const config = {
  path: "/api/products-v16/rebuild",
  method: "GET",
  background: true,
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 3600,
    windowLimit: 2
  }
};
