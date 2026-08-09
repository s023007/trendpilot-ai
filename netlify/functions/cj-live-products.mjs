const CJ_ENDPOINT = "https://ads.api.cj.com/query";

const SELLERS = {
  "Temu": { advertiserId: "6293473", adIds: ["15501511"] },
  "PandaHall": { advertiserId: "4295086", adIds: ["15609716"] },
  "FragranceShop.com": { advertiserId: "7287203", adIds: ["16941446"] },
  "Karaca EU": { advertiserId: "5893489", adIds: ["15171094"] }
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

const memoryCache = new Map();
const rateWindows = new Map();

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
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function words(value) {
  const stop = new Set(["the","and","for","with","from","this","that","best","new","sale","buy","shop","product","products"]);
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
    rateWindows.set(ip, {started: now, count: 1});
    return true;
  }
  current.count += 1;
  return current.count <= 35;
}

function relevance(product, query) {
  const q = clean(query).toLowerCase();
  const tokens = words(q);
  const text = clean([product?.title, product?.description, product?.brand].join(" ")).toLowerCase();
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
        catalogId
        id
        title
        description
        imageLink
        brand
        availability
        condition
        price { amount currency }
        linkCode(pid: ${JSON.stringify(PID)}) { clickUrl }
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

  const graphql = `query TrendPilotLiveSearch {\n${selections}\n}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);

  try {
    const response = await fetch(CJ_ENDPOINT, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${token}`,
        "content-type": "application/json",
        "accept": "application/json",
        "user-agent": "TrendPilot-CJ-Live-Search/15.7.1"
      },
      body: JSON.stringify({query: graphql}),
      signal: controller.signal
    });

    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch { throw new Error(`CJ returned non-JSON HTTP ${response.status}`); }

    if (!response.ok) throw new Error(`CJ HTTP ${response.status}`);
    if (payload.errors?.length) {
      const message = payload.errors.map(e => e.message).filter(Boolean).join(" | ");
      throw new Error(`CJ GraphQL: ${message.slice(0, 700)}`);
    }
    return {data: payload.data || {}, aliases};
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRows(result, seller, query) {
  const rows = Array.isArray(result?.resultList) ? result.resultList : [];
  const advertiserId = SELLERS[seller].advertiserId;

  return rows.map(row => {
    const price = Number(row?.price?.amount || 0) || 0;
    const currency = clean(row?.price?.currency || "USD");
    const title = clean(row?.title);
    const description = clean(row?.description);
    const image = clean(row?.imageLink);
    const url = clean(row?.linkCode?.clickUrl);
    const brand = clean(row?.brand);
    const liveScore = relevance(row, query);

    return {
      id: `cj-live-${advertiserId}-${clean(row?.catalogId)}-${clean(row?.id)}`,
      clusterKey: `cj-live-${advertiserId}-${clean(row?.id)}`,
      name: title,
      title,
      description,
      image,
      imageUrl: image,
      images: image ? [image] : [],
      url,
      affiliateUrl: url,
      advertiser: seller,
      advertiserId,
      network: "CJ",
      source: "CJ Live Product Feed API",
      catalogId: clean(row?.catalogId),
      cjProductId: clean(row?.id),
      brand,
      category: "",
      group: "other",
      family: "other",
      audience: "all",
      quality: 92,
      price,
      currency,
      condition: clean(row?.condition),
      delivery: clean(row?.availability),
      offerCount: 1,
      storeCount: 1,
      liveCj: true,
      liveScore
    };
  })
  .filter(row => row.name && /^https?:\/\//i.test(row.url) && /^https?:\/\//i.test(row.image))
  .filter(row => row.liveScore >= 12)
  .sort((a,b) => b.liveScore - a.liveScore)
  .slice(0, 28);
}

export default async (request) => {
  if (request.method !== "GET") {
    return jsonResponse({ok:false,error:"Method not allowed"},405,{allow:"GET"});
  }

  if (!rateAllowed(request)) {
    return jsonResponse({ok:false,error:"Too many searches. Try again shortly."},429);
  }

  const token = affiliateToken();
  if (!token) {
    return jsonResponse({
      ok:false,
      configured:false,
      error:"CJ live search is not configured in Netlify environment variables."
    },503);
  }

  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q") || "");
  const requestedSeller = canonicalSeller(url.searchParams.get("seller") || "");

  if (query.length < 2 || query.length > 120 || query.toLowerCase() === "popular products") {
    return jsonResponse({ok:true,products:[],total:0,sellers:[]});
  }

  const sellers = requestedSeller ? [requestedSeller] : Object.keys(SELLERS);
  const cacheKey = `${query.toLowerCase()}|${requestedSeller || "all"}`;
  const cached = memoryCache.get(cacheKey);

  if (cached && Date.now() - cached.savedAt < 180_000) {
    return jsonResponse({...cached.body,cache:"memory"});
  }

  try {
    const {data, aliases} = await queryCj(query, sellers, token);
    const products = [];
    const coverage = [];

    for (const [alias, seller] of aliases) {
      const result = data?.[alias] || {};
      const rows = normalizeRows(result, seller, query);
      products.push(...rows);
      coverage.push({
        seller,
        totalCount: Number(result?.totalCount || 0),
        returned: rows.length
      });
    }

    const seen = new Set();
    const unique = products.filter(row => {
      const key = row.clusterKey || row.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const body = {
      ok:true,
      version:"15.7.1",
      query,
      requestedSeller: requestedSeller || null,
      products:unique,
      total:unique.length,
      coverage
    };

    memoryCache.set(cacheKey,{savedAt:Date.now(),body});
    if (memoryCache.size > 250) {
      const oldest = [...memoryCache.entries()]
        .sort((a,b) => a[1].savedAt - b[1].savedAt)
        .slice(0,60);
      oldest.forEach(([key]) => memoryCache.delete(key));
    }

    return jsonResponse(body);
  } catch (error) {
    console.error("TrendPilot CJ live search failed", {
      message:error?.message,
      query,
      seller:requestedSeller || "all"
    });

    return jsonResponse({
      ok:false,
      error:"CJ live search is temporarily unavailable.",
      detail:String(error?.message || "").slice(0,500)
    },502);
  }
};

export const config = {
  path: "/api/cj-live-products"
};
