const CJ_ENDPOINT = "https://ads.api.cj.com/query";
const CJ_LINK_SEARCH_ENDPOINT = "https://link-search.api.cj.com/v2/link-search";

const SELLERS = {
  "Temu": { advertiserId: "6293473", adIds: ["15501511"] },
  "PandaHall": { advertiserId: "4295086", adIds: ["15609716"] },
  "FragranceShop.com": { advertiserId: "7287203", adIds: ["16941446"] },
  "Karaca EU": { advertiserId: "5893489", adIds: ["15171094"] },
  "TikTok Shop US": { advertiserId: "7563286", adIds: ["17099898"], strictProductTracking: true, disableLinkSearch: true }
};

const COMPANY_ID =
  process.env.CJ_COMPANY_ID ||
  process.env.CJ_CID ||
  process.env.CJ_PUBLISHER_CID ||
  "5917965";

const PID =
  process.env.CJ_WEBSITE_PID ||
  process.env.CJ_PID ||
  process.env.CJ_WEBSITE_ID ||
  "100655394";

const productCache = new Map();
const linkSearchCache = new Map();
const rateWindows = new Map();

const CJ_TRACKING_HOST_RE =
  /(?:^|\.)(?:anrdoezrs\.net|apmebf\.com|awltovhc\.com|commission-junction\.com|dpbolvw\.net|emjcd\.com|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|lduhtrp\.net|qksrv\.net|tkqlhce\.com)$/i;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=180, stale-while-revalidate=600",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validHttp(value) {
  try {
    const u = new URL(clean(value));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isCjTrackingUrl(value) {
  if (!validHttp(value)) return false;
  try {
    return CJ_TRACKING_HOST_RE.test(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function words(value) {
  const stop = new Set([
    "the","and","for","with","from","this","that","best","new","sale","buy",
    "shop","product","products","official","store","online"
  ]);
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]+/g, " ")
    .split(/\s+/)
    .filter(x => x.length > 1 && !stop.has(x));
}

function canonicalSeller(value) {
  const raw = clean(value).toLowerCase();
  if (["temu","temu.com","shop temu"].includes(raw)) return "Temu";
  if (["pandahall","panda hall"].includes(raw)) return "PandaHall";
  if (["fragranceshop.com","fragranceshop","fragrance shop","the fragrance shop"].includes(raw)) return "FragranceShop.com";
  if (["karaca eu","karaca europe","karaca"].includes(raw)) return "Karaca EU";
  if (["tiktok shop us","tiktok shop","tiktok","tiktokshop"].includes(raw)) return "TikTok Shop US";
  return "";
}

function affiliateToken() {
  return (
    process.env.CJ_API_TOKEN ||
    process.env.CJ_TOKEN ||
    process.env.CJ_PAT ||
    process.env.CJ_PERSONAL_ACCESS_TOKEN ||
    ""
  ).trim();
}

function rateAllowed(request) {
  const ip =
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const now = Date.now();
  const current = rateWindows.get(ip);

  if (!current || now - current.started > 60_000) {
    rateWindows.set(ip, { started: now, count: 1 });
    return true;
  }

  current.count += 1;

  if (rateWindows.size > 1200) {
    for (const [key, value] of rateWindows) {
      if (now - value.started > 120_000) rateWindows.delete(key);
    }
  }

  return current.count <= 30;
}

function relevance(product, query) {
  const q = clean(query).toLowerCase();
  const tokens = words(q);
  const text = clean([
    product?.title,
    product?.description,
    product?.brand,
    product?.advertiserName
  ].join(" ")).toLowerCase();

  if (!text) return 0;

  let score = 0;
  if (q && text.includes(q)) score += 120;
  if (tokens.length && tokens.every(t => text.includes(t))) score += 80;
  score += tokens.filter(t => text.includes(t)).length * 12;
  if (clean(product?.title).toLowerCase().includes(q)) score += 40;
  if (clean(product?.imageLink)) score += 6;
  if (product?.price?.amount) score += 4;
  return score;
}

function buildSelection(alias, seller, query) {
  const adIds = SELLERS[seller].adIds.join(", ");
  const safeQuery = JSON.stringify(query);

  return `
    ${alias}: shoppingProducts(
      companyId: ${COMPANY_ID}
      adIds: [${adIds}]
      keywords: [${safeQuery}]
      limit: 40
    ) {
      totalCount
      count
      resultList {
        advertiserId
        advertiserName
        catalogId
        id
        title
        description
        link
        imageLink
        brand
        availability
        condition
        price {
          amount
          currency
        }
        linkCode(pid: ${JSON.stringify(PID)}) {
          clickUrl
        }
      }
    }`;
}

async function queryCj(query, sellers, token) {
  const aliases = new Map();
  const selections = sellers.map((seller, index) => {
    const alias = `seller${index + 1}`;
    aliases.set(alias, seller);
    return buildSelection(alias, seller, query);
  }).join("\n");

  const graphql = `query TrendPilotLiveSearchV1585 {\n${selections}\n}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);

  try {
    const response = await fetch(CJ_ENDPOINT, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${token}`,
        "content-type": "application/json",
        "accept": "application/json",
        "user-agent": "TrendPilot-CJ-Live-Search/15.8.5"
      },
      body: JSON.stringify({ query: graphql }),
      signal: controller.signal
    });

    const raw = await response.text();
    let payload;

    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`CJ returned non-JSON HTTP ${response.status}`);
    }

    if (!response.ok) throw new Error(`CJ HTTP ${response.status}`);

    if (payload.errors?.length) {
      const message = payload.errors
        .map(e => e.message)
        .filter(Boolean)
        .join(" | ");
      throw new Error(`CJ GraphQL: ${message.slice(0, 700)}`);
    }

    return { data: payload.data || {}, aliases };
  } finally {
    clearTimeout(timer);
  }
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function xmlField(block, names) {
  for (const name of names) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
    const m = block.match(re);
    if (m) return clean(decodeXml(m[1]));
  }
  return "";
}

function parseLinkSearchXml(xml, seller) {
  const cfg = SELLERS[seller];
  const blocks = String(xml || "").match(/<link\b[\s\S]*?<\/link>/gi) || [];
  const rows = [];

  for (const block of blocks) {
    const advertiserId = xmlField(block, ["advertiser-id","advertiserId"]);
    const relationship = xmlField(block, ["relationship-status","relationshipStatus"]);
    const clickUrl = xmlField(block, ["clickUrl","click-url","clickurl"]);
    const destination = xmlField(block, ["destination"]);
    const name = xmlField(block, ["link-name","linkName"]);
    const description = xmlField(block, ["description","ad-content"]);
    const linkType = xmlField(block, ["link-type","linkType"]);
    const allowDeepLinking = xmlField(block, ["allow-deep-linking","allowDeepLinking"]);

    if (advertiserId && advertiserId !== cfg.advertiserId) continue;
    if (relationship && relationship.toLowerCase() !== "joined") continue;
    if (!isCjTrackingUrl(clickUrl)) continue;

    rows.push({
      clickUrl,
      destination: validHttp(destination) ? destination : "",
      name,
      description,
      linkType,
      allowDeepLinking: /^(true|yes|1)$/i.test(allowDeepLinking)
    });
  }

  return rows;
}

function linkCandidateScore(candidate, query) {
  const q = clean(query).toLowerCase();
  const tokens = words(q);
  const text = clean([
    candidate?.name,
    candidate?.description,
    candidate?.destination
  ].join(" ")).toLowerCase();

  let score = 0;
  if (q && text.includes(q)) score += 100;
  score += tokens.filter(t => text.includes(t)).length * 14;
  if (candidate?.allowDeepLinking) score += 8;
  if (clean(candidate?.linkType).toLowerCase() === "text link") score += 4;
  if (isCjTrackingUrl(candidate?.clickUrl)) score += 20;
  return score;
}

async function loadSellerTrackingLinks(seller, token) {
  const cached = linkSearchCache.get(seller);
  const now = Date.now();

  if (cached && now - cached.savedAt < 30 * 60_000) {
    return cached.rows;
  }

  const cfg = SELLERS[seller];
  const params = new URLSearchParams({
    "website-id": PID,
    "advertiser-ids": cfg.advertiserId,
    "records-per-page": "100",
    "page-number": "1"
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);

  try {
    const response = await fetch(`${CJ_LINK_SEARCH_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        "authorization": `Bearer ${token}`,
        "accept": "application/xml, text/xml;q=0.9, */*;q=0.5",
        "user-agent": "TrendPilot-CJ-Link-Fallback/15.8.5"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn("CJ Link Search fallback HTTP", response.status, seller);
      linkSearchCache.set(seller, { savedAt: now, rows: [] });
      return [];
    }

    const raw = await response.text();
    const rows = parseLinkSearchXml(raw, seller);

    linkSearchCache.set(seller, { savedAt: now, rows });
    return rows;
  } catch (error) {
    console.warn("CJ Link Search fallback failed", seller, error?.message || error);
    linkSearchCache.set(seller, { savedAt: now, rows: [] });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function bestSellerTrackingLink(seller, query, token) {
  const rows = await loadSellerTrackingLinks(seller, token);
  if (!rows.length) return null;

  return [...rows]
    .map(row => ({ ...row, score: linkCandidateScore(row, query) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function normalizeRows(result, seller, query, trackingFallback) {
  const rows = Array.isArray(result?.resultList) ? result.resultList : [];
  const cfg = SELLERS[seller];

  return rows
    .map(row => {
      const price = Number(row?.price?.amount || 0) || 0;
      const currency = clean(row?.price?.currency || "USD");
      const title = clean(row?.title);
      const description = clean(row?.description);
      const image = clean(row?.imageLink);
      const productDestination = clean(row?.link);
      const productClickUrl = clean(row?.linkCode?.clickUrl);
      const brand = clean(row?.brand);
      const advertiserName = clean(row?.advertiserName);

      if (
        advertiserName &&
        !advertiserName.toLowerCase().includes(seller.replace(".com","").toLowerCase().split(" ")[0])
      ) {
        return null;
      }

      const trackedProductUrl =
        isCjTrackingUrl(productClickUrl) ? productClickUrl : "";

      if (cfg.strictProductTracking && !trackedProductUrl) return null;

      const trackedFallbackUrl =
        isCjTrackingUrl(trackingFallback?.clickUrl)
          ? trackingFallback.clickUrl
          : "";

      const directProductUrl =
        validHttp(productDestination) ? productDestination : "";

      const url =
        trackedProductUrl ||
        trackedFallbackUrl ||
        directProductUrl;

      let trackingStatus = "none";
      if (trackedProductUrl) trackingStatus = "product-linkCode";
      else if (trackedFallbackUrl) trackingStatus = "link-search-fallback";
      else if (directProductUrl) trackingStatus = "destination-only";

      const liveScore = relevance(row, query);

      return {
        id: `cj-live-${cfg.advertiserId}-${clean(row?.catalogId)}-${clean(row?.id)}`,
        clusterKey: `cj-live-${cfg.advertiserId}-${clean(row?.id)}`,
        name: title,
        title,
        description,
        image,
        imageUrl: image,
        images: image ? [image] : [],
        url,
        affiliateUrl: trackedProductUrl || trackedFallbackUrl,
        destinationUrl: directProductUrl,
        advertiser: seller,
        advertiserId: cfg.advertiserId,
        network: "CJ",
        source: "CJ Live Product Feed API",
        catalogId: clean(row?.catalogId),
        cjProductId: clean(row?.id),
        brand,
        category: "",
        group: "other",
        family: "other",
        audience: "all",
        quality: trackedProductUrl ? 96 : trackedFallbackUrl ? 90 : 82,
        price,
        currency,
        condition: clean(row?.condition),
        delivery: clean(row?.availability),
        offerCount: 1,
        storeCount: 1,
        liveCj: true,
        liveScore,
        trackingStatus,
        trackingDestination: clean(trackingFallback?.destination)
      };
    })
    .filter(Boolean)
    .filter(row => row.name && validHttp(row.url) && validHttp(row.image))
    .filter(row => row.liveScore >= 12)
    .sort((a, b) => {
      const rank = status =>
        status === "product-linkCode" ? 3 :
        status === "link-search-fallback" ? 2 :
        status === "destination-only" ? 1 : 0;

      return rank(b.trackingStatus) - rank(a.trackingStatus) ||
        b.liveScore - a.liveScore;
    })
    .slice(0, 28);
}

export default async (request) => {
  if (request.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      { allow: "GET" }
    );
  }

  if (!rateAllowed(request)) {
    return jsonResponse(
      { ok: false, error: "Too many searches. Try again shortly." },
      429
    );
  }

  const token = affiliateToken();

  if (!token) {
    return jsonResponse({
      ok: false,
      configured: false,
      error: "CJ live search is not configured in Netlify environment variables."
    }, 503);
  }

  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q") || "");
  const requestedSeller = canonicalSeller(url.searchParams.get("seller") || "");

  if (
    query.length < 2 ||
    query.length > 120 ||
    query.toLowerCase() === "popular products"
  ) {
    return jsonResponse({
      ok: true,
      version: "15.8.5",
      products: [],
      total: 0,
      coverage: []
    });
  }

  const sellers = requestedSeller
    ? [requestedSeller]
    : Object.keys(SELLERS);

  const cacheKey = `${query.toLowerCase()}|${requestedSeller || "all"}|15.8.5`;
  const cached = productCache.get(cacheKey);

  if (cached && Date.now() - cached.savedAt < 180_000) {
    return jsonResponse({ ...cached.body, cache: "memory" });
  }

  try {
    const { data, aliases } = await queryCj(query, sellers, token);

    const fallbackPairs = await Promise.all(
      sellers.map(async seller => {
        const resultAlias = [...aliases.entries()]
          .find(([, name]) => name === seller)?.[0];

        const result = resultAlias ? data?.[resultAlias] : null;
        const rows = Array.isArray(result?.resultList) ? result.resultList : [];

        if (SELLERS[seller]?.disableLinkSearch) return [seller, null];

        const hasMissingProductClickUrl = rows.some(
          row => !isCjTrackingUrl(clean(row?.linkCode?.clickUrl))
        );

        if (!hasMissingProductClickUrl) return [seller, null];

        const fallback = await bestSellerTrackingLink(seller, query, token);
        return [seller, fallback];
      })
    );

    const trackingFallbacks = new Map(fallbackPairs);
    const products = [];
    const coverage = [];

    for (const [alias, seller] of aliases) {
      const result = data?.[alias] || {};
      const rawRows = Array.isArray(result?.resultList) ? result.resultList : [];
      const fallback = trackingFallbacks.get(seller) || null;
      const rows = normalizeRows(result, seller, query, fallback);

      products.push(...rows);

      coverage.push({
        seller,
        totalCount: Number(result?.totalCount || 0),
        rawReturned: rawRows.length,
        returned: rows.length,
        productLinkCode: rows.filter(x => x.trackingStatus === "product-linkCode").length,
        linkSearchFallback: rows.filter(x => x.trackingStatus === "link-search-fallback").length,
        destinationOnly: rows.filter(x => x.trackingStatus === "destination-only").length,
        fallbackTrackingAvailable: Boolean(fallback?.clickUrl)
      });
    }

    const seen = new Set();
    const unique = products.filter(row => {
      const key = row.clusterKey || row.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const tracking = {
      productLinkCode: unique.filter(x => x.trackingStatus === "product-linkCode").length,
      linkSearchFallback: unique.filter(x => x.trackingStatus === "link-search-fallback").length,
      destinationOnly: unique.filter(x => x.trackingStatus === "destination-only").length
    };

    const body = {
      ok: true,
      version: "15.8.5",
      query,
      requestedSeller: requestedSeller || null,
      products: unique,
      total: unique.length,
      tracking,
      coverage
    };

    productCache.set(cacheKey, {
      savedAt: Date.now(),
      body
    });

    if (productCache.size > 250) {
      const oldest = [...productCache.entries()]
        .sort((a, b) => a[1].savedAt - b[1].savedAt)
        .slice(0, 60);

      oldest.forEach(([key]) => productCache.delete(key));
    }

    return jsonResponse(body);
  } catch (error) {
    console.error("TrendPilot CJ live search V15.8.5 failed", {
      message: error?.message,
      query,
      seller: requestedSeller || "all"
    });

    return jsonResponse({
      ok: false,
      version: "15.8.5",
      error: "CJ live search is temporarily unavailable.",
      detail: String(error?.message || "").slice(0, 500)
    }, 502);
  }
};

export const config = {
  path: "/api/cj-live-products"
};
