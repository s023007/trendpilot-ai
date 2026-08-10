import { getStore } from "@netlify/blobs";
import {
  STORE_NAME,
  extractProducts,
  collectCatalogJsonPaths,
  buildIndex,
  tokenBucket
} from "./products-v16-lib.mjs";
import { canonicalizePublicProduct } from "./product-seller-policy-v17.mjs";

async function fetchJson(url, timeoutMs = 40000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function runLimited(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index], index) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}


function balancedCatalogPaths(paths, max = 360) {
  const groups = new Map();

  for (const path of paths) {
    const match = String(path).match(/\/shards\/([^/]+)\//i);
    const group = match?.[1] || "other";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(path);
  }

  for (const rows of groups.values()) {
    rows.sort((a, b) => {
      const aAll = /\/all\/|\/all\d|\/all\./i.test(a) ? 0 : 1;
      const bAll = /\/all\/|\/all\d|\/all\./i.test(b) ? 0 : 1;
      return aAll - bAll || a.localeCompare(b);
    });
  }

  const names = [...groups.keys()].sort();
  const out = [];
  let round = 0;

  while (out.length < max) {
    let added = false;

    for (const name of names) {
      const row = groups.get(name)?.[round];
      if (!row) continue;
      out.push(row);
      added = true;
      if (out.length >= max) break;
    }

    if (!added) break;
    round++;
  }

  return out;
}

export default async function handler(request) {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const origin = new URL(request.url).origin;
  const startedAt = new Date().toISOString();

  await store.setJSON("meta", {
    ready: false,
    version: "17.2.0",
    storage: "netlify-blobs",
    status: "building",
    startedAt
  });

  try {
    const seeds = [
      "/data/search-catalog/manifest.json",
      "/data/product-discovery-v15.json",
      "/data/admitad-products-new-account-v15-3-2.json",
      "/data/cj-products.json",
      "/data/seller-coverage-v15-1.json"
    ];

    const byId = new Map();
    const sourceStats = {};
    const discoveredPaths = new Set();

    for (const path of seeds) {
      try {
        const payload = await fetchJson(origin + path, 45000);
        const rows = extractProducts(payload, path, 50000);
        sourceStats[path] = rows.length;

        for (const row of rows) byId.set(row.id, row);

        if (path.endsWith("/manifest.json")) {
          for (const extra of collectCatalogJsonPaths(payload, 3000)) discoveredPaths.add(extra);
        }

        console.log("V17.2.0 seed", path, "products", rows.length);
      } catch (error) {
        sourceStats[path] = `error:${String(error?.message || error).slice(0, 120)}`;
        console.warn("V17.2.0 seed failed", path, String(error?.message || error));
      }
    }

    const extras = balancedCatalogPaths([...discoveredPaths].filter(path => !seeds.includes(path)), 360);
    const settled = await runLimited(extras, 6, async path => {
      const payload = await fetchJson(origin + path, 35000);
      return { path, rows: extractProducts(payload, path, 50000) };
    });

    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      sourceStats[result.value.path] = result.value.rows.length;
      for (const row of result.value.rows) byId.set(row.id, row);
    }

    const products = [...byId.values()].map(canonicalizePublicProduct).filter(Boolean);
    const { docs, postings, sellers, networks } = buildIndex(products);

    const docBuckets = new Map();
    for (const [id, product] of docs) {
      const shard = id.slice(0, 1);
      if (!docBuckets.has(shard)) docBuckets.set(shard, {});
      docBuckets.get(shard)[id] = product;
    }

    const tokenBuckets = new Map();
    for (const [token, byProduct] of postings) {
      const bucket = tokenBucket(token);
      if (!tokenBuckets.has(bucket)) tokenBuckets.set(bucket, {});

      const rows = [...byProduct.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 1800);

      tokenBuckets.get(bucket)[token] = rows;
    }

    const old = await store.list();
    const oldKeys = new Set(old.blobs?.map(blob => blob.key) || []);

    const writes = [];

    for (const [shard, value] of docBuckets) {
      const key = `docs/${shard}`;
      oldKeys.delete(key);
      writes.push([key, value]);
    }

    for (const [bucket, value] of tokenBuckets) {
      const key = `tokens/${bucket}`;
      oldKeys.delete(key);
      writes.push([key, value]);
    }

    await runLimited(writes, 6, async ([key, value]) => {
      await store.setJSON(key, value);
      return key;
    });

    for (const keep of ["meta"]) oldKeys.delete(keep);

    const stale = [...oldKeys].filter(key => key.startsWith("docs/") || key.startsWith("tokens/"));
    await runLimited(stale, 6, async key => {
      await store.delete(key);
      return key;
    });

    const sellerRows = [...sellers.entries()]
      .map(([seller, count]) => ({ seller, products: count }))
      .sort((a, b) => b.products - a.products || a.seller.localeCompare(b.seller))
      .slice(0, 100);

    const networkRows = [...networks.entries()]
      .map(([network, count]) => ({ network, products: count }))
      .sort((a, b) => b.products - a.products || a.network.localeCompare(b.network));

    const meta = {
      ready: true,
      version: "17.2.0",
      storage: "netlify-blobs",
      status: "ready",
      products: products.length,
      tokens: postings.size,
      sellers: sellers.size,
      networks: networks.size,
      documentShards: docBuckets.size,
      tokenShards: tokenBuckets.size,
      catalogFilesDiscovered: extras.length,
      topSellers: sellerRows,
      networkCounts: networkRows,
      sourceStats,
      startedAt,
      completedAt: new Date().toISOString()
    };

    await store.setJSON("meta", meta);

    console.log("TrendPilot V17.2.0 Blobs rebuild completed", meta);
  } catch (error) {
    console.error("TrendPilot V17.2.0 Blobs rebuild failed", error);

    await store.setJSON("meta", {
      ready: false,
      version: "17.2.0",
      storage: "netlify-blobs",
      status: "failed",
      startedAt,
      failedAt: new Date().toISOString(),
      detail: String(error?.message || error).slice(0, 1200)
    });

    throw error;
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
