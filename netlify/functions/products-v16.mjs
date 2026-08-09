import { getStore } from "@netlify/blobs";
import {
  STORE_NAME,
  clean,
  lower,
  queryTokens,
  tokenBucket
} from "./products-v16-lib.mjs";

const VERSION = "16.0.4";

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

const escapeRegex = value =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const words = value =>
  lower(value).normalize("NFKC").match(/[\p{L}\p{N}]+/gu) || [];

const accessoryWords = new Set([
  "case","cases","cover","covers","protector","protectors",
  "charger","chargers","charging","cable","cables",
  "holder","holders","stand","stands","mount","mounts",
  "repair","replacement","part","parts","tool","tools","kit","kits",
  "accessory","accessories","adapter","adapters","dock","docks",
  "screen","screens","stylus","pen","pens","strap","straps",
  "band","bands","sleeve","sleeves","pouch","pouches",
  "feeder","feeders","feeding","bowl","bowls","toy","toys",
  "storage","container","containers","dispenser","dispensers",
  "remover","tester","testing","fixture","fixtures",
  "frame","frames","shell","shells","housing","housings",
  "battery","batteries","lock","locks","box","boxes",
  "spoon","spoons","scoop","scoops","scooper","scoopers",
  "organizer","organizers","bracket","brackets","clip","clips",
  "tripod","tripods","lunch","timer","timers"
]);

function tokenSet(value) {
  return new Set(words(value));
}

function countCoverage(tokens, set, textLower = "") {
  let count = 0;
  for (const token of tokens) {
    if (set.has(token) || (token.length >= 4 && textLower.includes(token))) count++;
  }
  return count;
}

function relevanceFor(doc, q, tokens, baseRank) {
  const title = lower(doc.title);
  const brand = lower(doc.brand);
  const category = lower(`${doc.category || ""} ${doc.subcategory || ""}`);
  const description = lower(doc.description || "").slice(0, 1200);

  const titleWords = words(title);
  const categoryWords = words(category);
  const titleSet = new Set(titleWords);
  const brandSet = tokenSet(brand);
  const categorySet = new Set(categoryWords);
  const descriptionSet = tokenSet(description);

  const titleCoverage = countCoverage(tokens, titleSet, title);
  const brandCoverage = countCoverage(tokens, brandSet, brand);
  const categoryCoverage = countCoverage(tokens, categorySet, category);
  const descriptionCoverage = countCoverage(tokens, descriptionSet, description);

  const allInTitle = tokens.length > 0 && titleCoverage >= tokens.length;
  const allInCategory = tokens.length > 0 && categoryCoverage >= tokens.length;
  const phraseInTitle = Boolean(q && title.includes(q));
  const phraseAtStart = Boolean(
    q && (title === q || title.startsWith(q + " ") || title.startsWith(q + "-"))
  );

  const queryLooksAccessory = tokens.some(t => accessoryWords.has(t));
  const titleHasAccessory = titleWords.some(w => accessoryWords.has(w));
  const categoryHasAccessory = categoryWords.some(w => accessoryWords.has(w));

  let score = Number(baseRank.score || 0) + Number(baseRank.matches || 0) * 18;

  if (title === q) score += 260;
  else if (phraseAtStart) score += 145;
  else if (phraseInTitle) score += 95;

  if (allInTitle) score += 115;
  else score += titleCoverage * 34;

  if (allInCategory) score += 120;
  else score += categoryCoverage * 42;

  score += brandCoverage * 22;
  score += Math.min(descriptionCoverage, 2) * 4;

  if (brand === q) score += 55;

  // A clean title that contains the requested product phrase, without
  // accessory/repair intent, receives a strong generic "core product"
  // boost. This is why "smart watch" beats "watch repair tool", and
  // actual dog food can beat bowls/feeders.
  const cleanCoreMatch =
    phraseInTitle &&
    !titleHasAccessory &&
    (!categoryHasAccessory || allInCategory);

  if (cleanCoreMatch) score += 165;
  if (phraseAtStart && cleanCoreMatch) score += 70;

  let penalty = 0;

  if (!queryLooksAccessory && q) {
    const qPattern = escapeRegex(q).replace(/\s+/g, "\\s+");
    const accessoryPattern =
      "(?:case|cover|protector|charger|charging|cable|holder|stand|mount|" +
      "repair|replacement|parts?|tools?|kits?|accessor(?:y|ies)|adapter|dock|" +
      "screen|stylus|strap|band|sleeve|pouch|feeder|feeding|bowl|toy|storage|" +
      "container|dispenser|remover|tester|testing|fixture|frame|shell|housing|" +
      "batter(?:y|ies)|locks?|boxes?|spoons?|scoops?|scoopers?|organizers?|" +
      "brackets?|clips?|tripods?|lunch|timers?)";

    // Query followed by an accessory:
    //   phone battery, dog food spoon, watch repair tool
    const queryThenAccessory = new RegExp(
      qPattern + ".{0,55}\\b" + accessoryPattern + "\\b",
      "i"
    );

    // Accessory before the query:
    //   bowl ... dog food, protective case for watch
    const accessoryThenQuery = new RegExp(
      "\\b" + accessoryPattern + "\\b.{0,70}" + qPattern,
      "i"
    );

    // Explicit relation:
    //   case for phone, compatible with watch
    const accessoryForQuery = new RegExp(
      "\\b" + accessoryPattern +
      "\\b.{0,25}\\b(?:for|compatible\\s+with|replacement\\s+for|used\\s+for)\\s+" +
      qPattern,
      "i"
    );

    if (queryThenAccessory.test(title)) penalty += 270;
    if (accessoryThenQuery.test(title)) penalty += 250;
    if (accessoryForQuery.test(title)) penalty += 290;

    // Any accessory language in a title that also contains the core
    // query is weaker evidence than a clean core-product title.
    if (phraseInTitle && titleHasAccessory) penalty += 105;
    if (phraseInTitle && categoryHasAccessory) penalty += 65;

    // Description-only or incidental matches should not outrank core
    // products merely because the word appears somewhere.
    if (titleHasAccessory && titleCoverage == 0) penalty += 85;
    if (categoryHasAccessory && titleCoverage == 0) penalty += 55;
  }

  if (titleCoverage == 0 && categoryCoverage == 0 && brandCoverage == 0) {
    score -= 180;
  }

  if (titleCoverage == 0 && descriptionCoverage > 0) {
    score -= 80;
  }

  score -= penalty;

  return {
    score,
    signals: {
      titleCoverage,
      categoryCoverage,
      brandCoverage,
      phraseInTitle,
      phraseAtStart,
      cleanCoreMatch,
      accessoryPenalty: penalty
    }
  };
}

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
    const debug = url.searchParams.get("debug") === "1";

    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const meta = await safeGetJSON(store, "meta");

    if (!meta?.ready) {
      return json({
        ok: false,
        version: VERSION,
        storage: "netlify-blobs",
        error: "Universal product index is not ready yet.",
        next: "Run /api/products-v16/rebuild once, then re-check /api/products-v16/health."
      }, 503);
    }

    const tokens = queryTokens(q);
    if (!tokens.length) {
      return json({
        ok: true,
        version: VERSION,
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

    const candidateLimit = 1800;
    const ranked = [...scores.entries()]
      .sort((a, b) =>
        b[1].matches - a[1].matches ||
        b[1].score - a[1].score
      )
      .slice(0, candidateLimit);

    if (!ranked.length) {
      return json({
        ok: true,
        version: VERSION,
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

    const qLower = lower(q);
    const products = [];

    for (const [id, rank] of ranked) {
      const doc = docShards.get(id.slice(0, 1))?.[id];
      if (!doc) continue;

      const relevance = relevanceFor(doc, qLower, tokens, rank);

      const result = {
        ...doc,
        url: doc.affiliateUrl || doc.destinationUrl,
        image: doc.imageUrl,
        matchScore: relevance.score,
        matchedTokens: rank.matches
      };

      if (debug) result.relevance = relevance.signals;
      products.push(result);
    }

    products.sort((a, b) =>
      b.matchScore - a.matchScore ||
      b.quality - a.quality ||
      a.title.localeCompare(b.title)
    );

    const paged = products.slice(offset, offset + limit);

    return json({
      ok: true,
      version: VERSION,
      storage: "netlify-blobs",
      query: q,
      queryTokens: tokens,
      seller: seller || null,
      network: network || null,
      indexedProducts: meta.products || 0,
      totalCandidates: products.length,
      totalReturned: paged.length,
      products: paged
    });
  } catch (error) {
    console.error("TrendPilot V16.0.4 search failed", error);
    return json({
      ok: false,
      version: VERSION,
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
