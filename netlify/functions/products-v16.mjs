import { getStore } from "@netlify/blobs";
import {
  STORE_NAME,
  clean,
  lower,
  queryTokens,
  tokenBucket
} from "./products-v16-lib.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      "x-content-type-options": "nosniff"
    }
  });

const safeGetJSON = async (store, key) => {
  try {
    return await store.get(key, { type: "json" });
  } catch {
    return null;
  }
};

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q") || "").slice(0, 180);
    const seller = clean(url.searchParams.get("seller") || "").slice(0, 140);
    const network = clean(url.searchParams.get("network") || "").slice(0, 100);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 48) || 48));
    const offset = Math.max(0, Math.min(1000, Number(url.searchParams.get("offset") || 0) || 0));

    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const meta = await safeGetJSON(store, "meta");

    if (!meta?.ready) {
      return json({
        ok: false,
        version: "16.0.1",
        storage: "netlify-blobs",
        error: "Universal product index is not ready yet.",
        next: "Run /api/products-v16/rebuild once, then re-check /api/products-v16/health."
      }, 503);
    }

    const tokens = queryTokens(q);
    if (!tokens.length) {
      return json({
        ok: true,
        version: "16.0.1",
        storage: "netlify-blobs",
        query: q,
        seller: seller || null,
        network: network || null,
        totalReturned: 0,
        products: []
      });
    }

    const bucketNames = [...new Set(tokens.map(tokenBucket))];
    const bucketPairs = await Promise.all(
      bucketNames.map(async bucket => [bucket, await safeGetJSON(store, `tokens/${bucket}`)])
    );
    const buckets = new Map(bucketPairs);

    const sellerLower = lower(seller);
    const networkLower = lower(network);
    const scores = new Map();

    for (const token of tokens) {
      const bucket = buckets.get(tokenBucket(token)) || {};
      const rows = Array.isArray(bucket[token]) ? bucket[token] : [];

      for (const row of rows) {
        if (!row?.id) continue;
        if (sellerLower && row.seller !== sellerLower) continue;
        if (networkLower && row.network !== networkLower) continue;

        const previous = scores.get(row.id) || { score: 0, matches: 0 };
        previous.score += Number(row.score || 0);
        previous.matches += 1;
        scores.set(row.id, previous);
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) =>
        b[1].matches - a[1].matches ||
        b[1].score - a[1].score
      )
      .slice(offset, offset + Math.max(limit * 4, 120));

    if (!ranked.length) {
      return json({
        ok: true,
        version: "16.0.1",
        storage: "netlify-blobs",
        query: q,
        seller: seller || null,
        network: network || null,
        totalReturned: 0,
        products: []
      });
    }

    const docShardNames = [...new Set(ranked.map(([id]) => id.slice(0, 1)))];
    const docPairs = await Promise.all(
      docShardNames.map(async shard => [shard, await safeGetJSON(store, `docs/${shard}`)])
    );
    const docShards = new Map(docPairs);

    const products = [];
    const qLower = lower(q);

    for (const [id, rank] of ranked) {
      const doc = docShards.get(id.slice(0, 1))?.[id];
      if (!doc) continue;

      const titleLower = lower(doc.title);
      const brandLower = lower(doc.brand);
      const categoryLower = lower(doc.category);

      let exactBoost = 0;
      if (titleLower === qLower) exactBoost = 80;
      else if (titleLower.startsWith(qLower)) exactBoost = 45;
      else if (titleLower.includes(qLower)) exactBoost = 30;
      if (brandLower === qLower) exactBoost += 15;
      if (categoryLower.includes(qLower)) exactBoost += 10;

      products.push({
        ...doc,
        url: doc.affiliateUrl || doc.destinationUrl,
        image: doc.imageUrl,
        matchScore: rank.score + rank.matches * 20 + exactBoost,
        matchedTokens: rank.matches
      });
    }

    products.sort((a, b) =>
      b.matchScore - a.matchScore ||
      b.quality - a.quality ||
      a.title.localeCompare(b.title)
    );

    return json({
      ok: true,
      version: "16.0.1",
      storage: "netlify-blobs",
      query: q,
      queryTokens: tokens,
      seller: seller || null,
      network: network || null,
      indexedProducts: meta.products || 0,
      totalReturned: Math.min(limit, products.length),
      products: products.slice(0, limit)
    });
  } catch (error) {
    console.error("TrendPilot V16 Blobs search failed", error);
    return json({
      ok: false,
      version: "16.0.1",
      storage: "netlify-blobs",
      error: "Universal product search failed.",
      detail: String(error?.message || error).slice(0, 500)
    }, 503);
  }
}

export const config = {
  path: "/api/products-v16",
  method: "GET"
};
