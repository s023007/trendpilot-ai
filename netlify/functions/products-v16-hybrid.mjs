import { getStore } from "@netlify/blobs";
import {
  STORE_NAME,
  clean,
  lower,
  queryTokens,
  normalizeProduct,
  hashHex
} from "./products-v16-lib.mjs";
import { canonicalProductSeller, canonicalizePublicProduct } from "./product-seller-policy-v17.mjs";

const VERSION = "17.3.1";
const CORE_MIN = 20;
const STRONG_CORE_MIN = 12;
const QUERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MANIFEST_MEMORY_TTL_MS = 10 * 60 * 1000;
const CJ_LIVE_SELLERS = new Set([
  "PandaHall",
  "FragranceShop.com",
  "Karaca EU",
  "TikTok Shop US"
]);

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
  "frame","frames","shell","shells","housing","housings",
  "battery","batteries","lock","locks","box","boxes",
  "spoon","spoons","scoop","scoops","scooper","scoopers",
  "organizer","organizers","bracket","brackets","clip","clips",
  "tripod","tripods","timer","timers","sticker","stickers",
  "skin","skins","decal","decals","film","films","memory",
  "card","cards","flash","drive","drives","ring","light","lights",
  "microphone","microphones","speaker","speakers","headset","headsets",
  "earphone","earphones","keyboard","keyboards","mouse","mice",
  "gamepad","gamepads","controller","controllers","remote","remotes",
  "lens","lenses","module","modules","sensor","sensors",
  "bag","bags","wallet","wallets","bumper","bumpers",
  "mat","mats","placemat","placemats","tray","trays"
]);

let manifestMemory = { savedAt: 0, value: null };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      "x-content-type-options": "nosniff"
    }
  });

const words = value =>
  lower(value).normalize("NFKC").match(/[\p{L}\p{N}]+/gu) || [];

const unique = rows => {
  const seen = new Set();
  return rows.filter(row => {
    const key = clean(
      row?.id ||
      row?.sourceProductId ||
      row?.affiliateUrl ||
      row?.destinationUrl ||
      row?.url ||
      `${lower(row?.seller || row?.advertiser)}|${lower(row?.title || row?.name)}`
    );
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function runLimited(items, concurrency, fn) {
  if (!items.length) return [];
  const output = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        output[index] = { status: "fulfilled", value: await fn(items[index], index) };
      } catch (error) {
        output[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return output;
}


const misleadingPhraseTails = new Set([
  "grade","style","styled","theme","themed","pattern","patterns",
  "shaped","shape","print","printed","design","designed",
  "mold","mould","molds","moulds","label","labels"
]);

function querySpanInfo(titleWords, query, tokens) {
  if (!tokens.length) {
    return {
      exactPhrase: false,
      minSpan: 999,
      nextWord: "",
      misleadingTail: false
    };
  }

  const exactPhraseWords = words(query);
  let exactStart = -1;

  if (exactPhraseWords.length) {
    outer:
    for (let i = 0; i <= titleWords.length - exactPhraseWords.length; i++) {
      for (let j = 0; j < exactPhraseWords.length; j++) {
        if (titleWords[i + j] !== exactPhraseWords[j]) continue outer;
      }
      exactStart = i;
      break;
    }
  }

  const nextWord =
    exactStart >= 0
      ? (titleWords[exactStart + exactPhraseWords.length] || "")
      : "";

  let minSpan = 999;

  if (tokens.length === 1) {
    minSpan = titleWords.includes(tokens[0]) ? 1 : 999;
  } else {
    for (let start = 0; start < titleWords.length; start++) {
      const have = new Set();
      for (let end = start; end < titleWords.length; end++) {
        const word = titleWords[end];
        for (const token of tokens) {
          if (
            word === token ||
            (token.length >= 4 && word.includes(token))
          ) {
            have.add(token);
          }
        }
        if (have.size >= tokens.length) {
          minSpan = Math.min(minSpan, end - start + 1);
          break;
        }
      }
    }
  }

  return {
    exactPhrase: exactStart >= 0,
    minSpan,
    nextWord,
    misleadingTail: misleadingPhraseTails.has(nextWord)
  };
}

function relationBeforeQueryV16_1_3(titleWords, tokens) {
  if (!tokens.length || !titleWords.length) return false;

  const directRelations = new Set([
    "for","fits","fit","compatible","replacement","repair",
    "adapter","accessory","accessories"
  ]);

  for (let i = 0; i < titleWords.length; i++) {
    const word = titleWords[i];
    const queryHit = tokens.some(token =>
      word === token ||
      (token.length >= 4 && word.includes(token))
    );
    if (!queryHit) continue;

    const before = titleWords.slice(Math.max(0, i - 5), i);
    if (before.some(w => directRelations.has(w))) return true;

    const joined = before.join(" ");
    if (
      joined.includes("compatible with") ||
      joined.includes("replacement for") ||
      joined.includes("used with") ||
      joined.includes("works with") ||
      joined.includes("designed for") ||
      joined.includes("made for")
    ) return true;
  }

  return false;
}

function intentRank(product, query, tokens) {
  const title = lower(product?.title || product?.name);
  const category = lower(
    `${product?.category || ""} ${product?.subcategory || ""} ` +
    `${product?.group || ""} ${product?.family || ""}`
  );
  const description = lower(product?.description || "").slice(0, 1000);

  const titleWords = words(title);
  const categoryWords = words(category);
  const titleSet = new Set(titleWords);
  const categorySet = new Set(categoryWords);

  const allInTitle = tokens.length > 0 && tokens.every(t =>
    titleSet.has(t) || (t.length >= 4 && title.includes(t))
  );

  const allInCategory = tokens.length > 0 && tokens.every(t =>
    categorySet.has(t) || (t.length >= 4 && category.includes(t))
  );

  const titleHits = tokens.filter(t =>
    titleSet.has(t) || (t.length >= 4 && title.includes(t))
  ).length;

  const categoryHits = tokens.filter(t =>
    categorySet.has(t) || (t.length >= 4 && category.includes(t))
  ).length;

  const descriptionHits = tokens.filter(t =>
    description.includes(t)
  ).length;

  const phrase = querySpanInfo(titleWords, query, tokens);
  const phraseInTitle = phrase.exactPhrase;
  const phraseAtStart = Boolean(
    query &&
    (title === query ||
     title.startsWith(query + " ") ||
     title.startsWith(query + "-"))
  );

  const queryLooksAccessory = tokens.some(t => accessoryWords.has(t));
  const titleHasAccessory = titleWords.some(t => accessoryWords.has(t));
  const categoryHasAccessory = categoryWords.some(t => accessoryWords.has(t));

  const multiWordQuery = tokens.length >= 2;

  // For two-word searches such as "dog food", "dog paw print food"
  // must not be treated like the exact product phrase.
  const tightTokenSpan =
    !multiWordQuery ||
    phrase.minSpan <= Math.max(tokens.length + 1, 3);

  const looseTokenSpan =
    multiWordQuery &&
    phrase.minSpan > Math.max(tokens.length + 3, 5);

  const misleadingExactPhrase =
    multiWordQuery &&
    phraseInTitle &&
    phrase.misleadingTail;

  // Examples: "dog food bowl", "phone case", "dog food dispenser".
  // When the requested phrase is immediately followed by an
  // accessory/product-support word, it is related rather than core.
  const accessoryPhraseTail =
    phraseInTitle &&
    !queryLooksAccessory &&
    accessoryWords.has(phrase.nextWord);

  // Examples: "projector for phone", "speaker for mobile phone",
  // "replacement screen for iPhone".
  const relationBeforeQuery =
    !queryLooksAccessory &&
    relationBeforeQueryV16_1_3(titleWords, tokens);

  let intentTier = 0;

  if (queryLooksAccessory) {
    if (phraseInTitle && allInTitle && !misleadingExactPhrase) intentTier = 5;
    else if (allInTitle && tightTokenSpan) intentTier = 4;
    else if (phraseInTitle) intentTier = 3;
    else if (allInCategory) intentTier = 2;
    else intentTier = 1;
  } else {
    const cleanTitleCore =
      allInTitle &&
      !titleHasAccessory &&
      tightTokenSpan &&
      !misleadingExactPhrase &&
      !accessoryPhraseTail &&
      !relationBeforeQuery;

    const cleanPhraseCore =
      phraseInTitle &&
      !titleHasAccessory &&
      !misleadingExactPhrase &&
      !accessoryPhraseTail &&
      !relationBeforeQuery;

    // Category is supporting evidence only. It must never promote
    // an accessory title back to a core product.
    const cleanCategoryCore =
      allInCategory &&
      !categoryHasAccessory &&
      !titleHasAccessory &&
      !relationBeforeQuery;

    if (
      (cleanPhraseCore && phraseAtStart) ||
      (cleanPhraseCore && cleanCategoryCore)
    ) {
      intentTier = 5;
    } else if (cleanTitleCore || cleanCategoryCore) {
      intentTier = 4;
    } else if (cleanPhraseCore) {
      intentTier = 3;
    } else if (
      (allInTitle || phraseInTitle) &&
      !looseTokenSpan &&
      !misleadingExactPhrase &&
      !accessoryPhraseTail &&
      !relationBeforeQuery
    ) {
      intentTier = 2;
    } else if (
      allInCategory ||
      (titleHits > 0 && !looseTokenSpan)
    ) {
      intentTier = 1;
    }
  }

  // Hard caps for derived/related products.
  if (accessoryPhraseTail) intentTier = Math.min(intentTier, 2);
  if (relationBeforeQuery) intentTier = Math.min(intentTier, 1);
  if (misleadingExactPhrase) intentTier = Math.min(intentTier, 1);

  let score =
    intentTier * 1000 +
    titleHits * 90 +
    categoryHits * 65 +
    Math.min(descriptionHits, 2) * 8 +
    Number(product?.quality || 0);

  if (phraseInTitle && !misleadingExactPhrase && !accessoryPhraseTail) {
    score += 180;
  }
  if (phraseAtStart && !misleadingExactPhrase && !accessoryPhraseTail) {
    score += 120;
  }

  if (tightTokenSpan && multiWordQuery) score += 70;
  if (looseTokenSpan) score -= 260;
  if (misleadingExactPhrase) score -= 700;
  if (accessoryPhraseTail) score -= 620;
  if (relationBeforeQuery) score -= 760;

  if (!queryLooksAccessory && titleHasAccessory) score -= 320;
  if (!queryLooksAccessory && categoryHasAccessory && !allInCategory) {
    score -= 140;
  }

  return {
    intentTier,
    score,
    phraseIntegrity: {
      exactPhrase: phrase.exactPhrase,
      minSpan: phrase.minSpan,
      nextWord: phrase.nextWord,
      misleadingTail: phrase.misleadingTail,
      accessoryPhraseTail,
      relationBeforeQuery
    }
  };
}

function rankedNormalize(rows, sourceHint, query, tokens, sellerFilter = "", networkFilter = "") {
  const sellerLower = lower(sellerFilter);
  const networkLower = lower(networkFilter);

  return rows
    .map(row => {
      const rawNormalized = normalizeProduct(row, sourceHint);
      const normalized = canonicalizePublicProduct(rawNormalized);
      if (!normalized) return null;

      if (sellerLower && lower(normalized.seller) !== sellerLower) return null;
      if (
        networkLower &&
        lower(normalized.network) !== networkLower &&
        lower(row?.network) !== networkLower
      ) return null;

      const rank = intentRank(normalized, query, tokens);

      return {
        ...normalized,
        name: normalized.title,
        image: normalized.imageUrl,
        url: normalized.affiliateUrl || normalized.destinationUrl,
        advertiser: normalized.seller,
        matchScore: rank.score,
        intentTier: rank.intentTier,
        fallbackSource: sourceHint
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      b.intentTier - a.intentTier ||
      b.matchScore - a.matchScore ||
      b.quality - a.quality
    );
}

async function loadBaseIndex(origin, query, seller, network) {
  const params = new URLSearchParams({
    q: query,
    limit: "100",
    test: "161"
  });
  if (seller) params.set("seller", seller);
  if (network) params.set("network", network);

  return fetchJson(`${origin}/api/products-v16?${params.toString()}`, 6000);
}

async function getManifest(origin) {
  const now = Date.now();
  if (
    manifestMemory.value &&
    now - manifestMemory.savedAt < MANIFEST_MEMORY_TTL_MS
  ) {
    return manifestMemory.value;
  }

  const manifest = await fetchJson(
    `${origin}/data/search-catalog/manifest.json?v=16-1`,
    7000
  );

  if (!manifest || !Array.isArray(manifest.segments)) {
    throw new Error("Catalog manifest has no segments");
  }

  manifestMemory = { savedAt: now, value: manifest };
  return manifest;
}

function routeSegmentKeys(manifest, tokens) {
  const keys = [];
  const seen = new Set();

  for (const token of tokens) {
    for (const key of manifest?.tokenRoutes?.[token] || []) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }

  if (keys.length) return keys.slice(0, 18);

  const scored = (manifest.segments || [])
    .map(segment => {
      const text = lower(
        `${segment?.key || ""} ${segment?.group || ""} ` +
        `${segment?.family || ""} ${segment?.audience || ""}`
      );
      const score = tokens.filter(t => text.includes(t)).length;
      return { key: segment?.key, score };
    })
    .filter(row => row.key && row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(row => row.key);

  return [...new Set(scored)].slice(0, 18);
}

function roundRobinFiles(manifest, segmentKeys, maxFiles = 24) {
  const byKey = new Map(
    (manifest.segments || []).map(segment => [segment.key, segment])
  );
  const rows = segmentKeys
    .map(key => byKey.get(key))
    .filter(Boolean)
    .map(segment => ({
      key: segment.key,
      files: Array.isArray(segment.files) ? segment.files.slice(0, 3) : []
    }));

  const output = [];
  for (let page = 0; page < 3 && output.length < maxFiles; page++) {
    for (const row of rows) {
      const file = row.files[page];
      if (!file) continue;
      output.push({ key: row.key, file });
      if (output.length >= maxFiles) break;
    }
  }
  return output;
}

async function loadCatalogFallback(origin, query, tokens, seller, network) {
  const manifest = await getManifest(origin);
  const segmentKeys = routeSegmentKeys(manifest, tokens);
  const files = roundRobinFiles(manifest, segmentKeys, 24);

  const settled = await runLimited(files, 6, async item => {
    const payload = await fetchJson(
      new URL(item.file, origin).toString(),
      4500
    );
    return Array.isArray(payload?.products) ? payload.products : [];
  });

  const raw = settled
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value);

  const ranked = rankedNormalize(
    raw,
    "catalog-live-router",
    query,
    tokens,
    seller,
    network
  );

  return {
    products: unique(ranked).slice(0, 140),
    segmentKeys,
    filesTried: files.length,
    filesLoaded: settled.filter(x => x.status === "fulfilled").length
  };
}

async function loadCjFallback(origin, query, tokens, seller, network) {
  if (network && lower(network) !== "cj" && lower(network) !== "catalog") {
    return { products: [], attempted: false };
  }

  if (seller && !CJ_LIVE_SELLERS.has(seller)) {
    return { products: [], attempted: false };
  }

  const params = new URLSearchParams({ q: query });
  if (seller) params.set("seller", seller);

  const payload = await fetchJson(
    `${origin}/api/cj-live-products?${params.toString()}`,
    9500
  );

  const rows = Array.isArray(payload?.products) ? payload.products : [];
  const ranked = rankedNormalize(
    rows,
    "cj-live",
    query,
    tokens,
    seller,
    ""
  );

  return {
    products: unique(ranked).slice(0, 120),
    attempted: true,
    coverage: payload?.coverage || []
  };
}

function queryCacheKey(query, seller, network) {
  return `query-cache/${hashHex(
    `${lower(query)}|${lower(seller)}|${lower(network)}|${VERSION}`
  ).slice(0, 40)}`;
}

async function readQueryCache(store, key) {
  try {
    const cached = await store.get(key, { type: "json" });
    if (
      cached &&
      Array.isArray(cached.products) &&
      Date.now() - Number(cached.savedAt || 0) < QUERY_CACHE_TTL_MS
    ) {
      return cached;
    }
  } catch {}
  return null;
}

async function saveQueryCache(store, key, value) {
  try {
    await store.setJSON(key, value);
    return true;
  } catch (error) {
    console.warn("V16.1 query cache write failed", error?.message || error);
    return false;
  }
}


function diversifyBySellerWithinTier(rows) {
  const tiers = new Map();
  for (const row of rows) {
    const tier = Number(row?.intentTier || 0);
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier).push(row);
  }

  const out = [];
  for (const tier of [...tiers.keys()].sort((a, b) => b - a)) {
    const groups = new Map();
    for (const row of tiers.get(tier)) {
      const key = lower(row?.seller || row?.advertiser || "(unknown seller)");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const keys = [...groups.keys()].sort((a, b) => {
      const as = Number(groups.get(a)?.[0]?.matchScore || 0);
      const bs = Number(groups.get(b)?.[0]?.matchScore || 0);
      return bs - as || a.localeCompare(b);
    });

    let round = 0;
    while (true) {
      let added = false;
      for (const key of keys) {
        const row = groups.get(key)?.[round];
        if (!row) continue;
        out.push(row);
        added = true;
      }
      if (!added) break;
      round += 1;
    }
  }
  return out;
}

function mergeAndRank(baseProducts, fallbackProducts, query, tokens, limit, offset, sellerFilter = "") {
  const rows = unique([
    ...(baseProducts || []),
    ...(fallbackProducts || [])
  ]).map(canonicalizePublicProduct).filter(Boolean).map(product => {
    const rank = intentRank(product, query, tokens);
    return {
      ...product,
      name: clean(product?.name || product?.title),
      image: clean(product?.image || product?.imageUrl),
      url: clean(
        product?.url ||
        product?.affiliateUrl ||
        product?.destinationUrl
      ),
      matchScore: rank.score,
      intentTier: rank.intentTier
    };
  });

  rows.sort((a, b) =>
    b.intentTier - a.intentTier ||
    b.matchScore - a.matchScore ||
    Number(b.quality || 0) - Number(a.quality || 0)
  );

  const coreCandidates = rows.filter(p => p.intentTier >= 4).length;
  const strongCoreCandidates = rows.filter(p => p.intentTier >= 5).length;

  return {
    rows,
    coreCandidates,
    strongCoreCandidates,
    paged: (sellerFilter ? rows : diversifyBySellerWithinTier(rows)).slice(offset, offset + limit)
  };
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const origin = url.origin;
    const query = clean(url.searchParams.get("q") || "").slice(0, 160);
    const requestedSeller = clean(url.searchParams.get("seller") || "").slice(0, 140);
    const seller = requestedSeller ? canonicalProductSeller(requestedSeller) : "";
    if (requestedSeller && !seller) {
      return json({
        ok: true,
        version: VERSION,
        storage: "netlify-blobs",
        mode: "index-first-hybrid",
        query,
        seller: requestedSeller,
        products: [],
        totalReturned: 0,
        sellerPolicy: "rejected-unapproved-seller"
      });
    }
    const network = clean(url.searchParams.get("network") || "").slice(0, 100);
    const limit = Math.max(
      1,
      Math.min(100, Number(url.searchParams.get("limit") || 48) || 48)
    );
    const offset = Math.max(
      0,
      Math.min(1000, Number(url.searchParams.get("offset") || 0) || 0)
    );

    if (query.length < 2) {
      return json({
        ok: true,
        version: VERSION,
        query,
        products: [],
        totalReturned: 0,
        fallbackUsed: false
      });
    }

    const tokens = queryTokens(query);
    const base = await loadBaseIndex(origin, query, seller, network);
    const baseProducts = Array.isArray(base?.products) ? base.products : [];
    const baseCore = Number(base?.coreCandidates || 0);
    const baseStrong = Number(base?.strongCoreCandidates || 0);

    const fallbackNeeded =
      baseStrong < STRONG_CORE_MIN ||
      baseCore < CORE_MIN;

    const store = getStore({
      name: STORE_NAME,
      consistency: "strong"
    });

    const cacheKey = queryCacheKey(query, seller, network);
    let cacheStatus = "not-needed";
    let cachedProducts = [];
    let liveProducts = [];
    let catalogInfo = null;
    let cjInfo = null;
    let savedToBlobs = false;
    const fallbackSources = [];

    if (fallbackNeeded) {
      const cached = await readQueryCache(store, cacheKey);

      if (cached) {
        cacheStatus = "hit";
        cachedProducts = cached.products;
        fallbackSources.push("netlify-blobs-query-cache");
      } else {
        cacheStatus = "miss";

        const [catalogResult, cjResult] = await Promise.allSettled([
          loadCatalogFallback(origin, query, tokens, seller, network),
          loadCjFallback(origin, query, tokens, seller, network)
        ]);

        if (catalogResult.status === "fulfilled") {
          catalogInfo = catalogResult.value;
          liveProducts.push(...catalogResult.value.products);
          if (catalogResult.value.products.length) {
            fallbackSources.push("catalog-live-router");
          }
        }

        if (cjResult.status === "fulfilled") {
          cjInfo = cjResult.value;
          liveProducts.push(...cjResult.value.products);
          if (cjResult.value.products.length) {
            fallbackSources.push("cj-live");
          }
        }

        liveProducts = unique(liveProducts).slice(0, 180);

        if (liveProducts.length) {
          savedToBlobs = await saveQueryCache(store, cacheKey, {
            version: VERSION,
            savedAt: Date.now(),
            query,
            seller: seller || null,
            network: network || null,
            products: liveProducts,
            sources: fallbackSources
          });
        }
      }
    }

    const fallbackProducts = cachedProducts.length
      ? cachedProducts
      : liveProducts;

    const merged = mergeAndRank(
      baseProducts,
      fallbackProducts,
      lower(query),
      tokens,
      limit,
      offset,
      seller
    );

    return json({
      ok: true,
      version: VERSION,
      storage: "netlify-blobs",
      mode: "index-first-hybrid",
      query,
      queryTokens: tokens,
      seller: seller || null,
      network: network || null,
      indexedProducts: Number(base?.indexedProducts || 0),
      baseCoreCandidates: baseCore,
      baseStrongCoreCandidates: baseStrong,
      fallbackNeeded,
      fallbackUsed: fallbackProducts.length > 0,
      fallbackSources,
      fallbackAdded: fallbackProducts.length,
      cacheStatus,
      savedToBlobs,
      coreCandidates: merged.coreCandidates,
      strongCoreCandidates: merged.strongCoreCandidates,
      totalCandidates: merged.rows.length,
      totalReturned: merged.paged.length,
      catalogFallback: catalogInfo ? {
        segmentKeys: catalogInfo.segmentKeys,
        filesTried: catalogInfo.filesTried,
        filesLoaded: catalogInfo.filesLoaded
      } : null,
      cjFallback: cjInfo ? {
        attempted: cjInfo.attempted,
        coverage: cjInfo.coverage
      } : null,
      products: merged.paged
    });
  } catch (error) {
    console.error("TrendPilot V17.3.1 hybrid search failed", error);
    return json({
      ok: false,
      version: VERSION,
      error: "Hybrid product search failed.",
      detail: String(error?.message || error).slice(0, 600)
    }, 503);
  }
}

export const config = {
  path: "/api/products-v16-hybrid",
  method: "GET",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 30
  }
};
