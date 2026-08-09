const ENDPOINT = "https://link-search.api.cj.com/v2/link-search";

const SELLERS = {
  "Temu": "6293473",
  "PandaHall": "4295086",
  "FragranceShop.com": "7287203",
  "Karaca EU": "5893489"
};

const PID =
  process.env.CJ_WEBSITE_PID ||
  process.env.CJ_PID ||
  process.env.CJ_WEBSITE_ID ||
  "100655394";

function token() {
  return (
    process.env.CJ_API_TOKEN ||
    process.env.CJ_TOKEN ||
    process.env.CJ_PAT ||
    process.env.CJ_PERSONAL_ACCESS_TOKEN ||
    ""
  ).trim();
}

function clean(v) {
  return String(v ?? "").trim();
}

function canonicalSeller(v) {
  const x = clean(v).toLowerCase();
  if (["temu","temu.com"].includes(x)) return "Temu";
  if (["pandahall","panda hall"].includes(x)) return "PandaHall";
  if (["fragranceshop.com","fragranceshop","fragrance shop"].includes(x)) return "FragranceShop.com";
  if (["karaca eu","karaca"].includes(x)) return "Karaca EU";
  return "Temu";
}

function json(body, status=200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function decodeXml(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function field(block, names) {
  for (const name of names) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
    const m = String(block || "").match(re);
    if (m) return clean(decodeXml(m[1]));
  }
  return "";
}

function maskPid(value) {
  const s = String(value || "");
  if (s.length <= 4) return "****";
  return "*".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

export default async (request) => {
  if (request.method !== "GET") {
    return json({ok:false,error:"GET only"},405);
  }

  const auth = token();
  if (!auth) {
    return json({
      ok:false,
      error:"CJ_API_TOKEN is not available to this Netlify Function"
    },503);
  }

  const u = new URL(request.url);
  const seller = canonicalSeller(u.searchParams.get("seller") || "Temu");
  const advertiserId = SELLERS[seller];

  const params = new URLSearchParams({
    "website-id": PID,
    "advertiser-ids": advertiserId,
    "records-per-page": "20",
    "page-number": "1"
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const r = await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        "authorization": `Bearer ${auth}`,
        "accept": "application/xml, text/xml;q=0.9, application/json;q=0.8, */*;q=0.5",
        "user-agent": "TrendPilot-CJ-LinkSearch-Diagnostic/15.7.4"
      },
      signal: controller.signal
    });

    const raw = await r.text();
    const contentType = r.headers.get("content-type") || "";

    const linkBlocks = raw.match(/<link\b[\s\S]*?<\/link>/gi) || [];
    const totalResults = Number(
      field(raw, ["total-results","totalResults"]) || 0
    );

    const firstFive = linkBlocks.slice(0,5).map((block,index) => ({
      index:index+1,
      advertiserId:field(block,["advertiser-id","advertiserId"]),
      advertiserName:field(block,["advertiser-name","advertiserName"]),
      relationshipStatus:field(block,["relationship-status","relationshipStatus"]),
      linkName:field(block,["link-name","linkName"]),
      linkType:field(block,["link-type","linkType"]),
      promotionType:field(block,["promotion-type","promotionType"]),
      allowDeepLinking:field(block,["allow-deep-linking","allowDeepLinking"]),
      clickUrl:field(block,["clickUrl","click-url","clickurl"]),
      destination:field(block,["destination"]),
      description:field(block,["description","ad-content"])
    }));

    const tagCounts = {
      linkBlocks: linkBlocks.length,
      clickUrlCamel: (raw.match(/<clickUrl\b/gi) || []).length,
      clickUrlKebab: (raw.match(/<click-url\b/gi) || []).length,
      destination: (raw.match(/<destination\b/gi) || []).length,
      allowDeepLinkingCamel: (raw.match(/<allowDeepLinking\b/gi) || []).length,
      allowDeepLinkingKebab: (raw.match(/<allow-deep-linking\b/gi) || []).length,
      relationshipStatusCamel: (raw.match(/<relationshipStatus\b/gi) || []).length,
      relationshipStatusKebab: (raw.match(/<relationship-status\b/gi) || []).length
    };

    let parsedJson = null;
    if (/json/i.test(contentType) || /^[\s]*[\[{]/.test(raw)) {
      try {
        parsedJson = JSON.parse(raw);
      } catch {}
    }

    return json({
      ok:r.ok,
      version:"15.7.4",
      diagnosticOnly:true,
      seller,
      advertiserId,
      pidUsed:maskPid(PID),
      request:{
        endpoint:ENDPOINT,
        params:{
          "website-id":maskPid(PID),
          "advertiser-ids":advertiserId,
          "records-per-page":20,
          "page-number":1
        }
      },
      response:{
        httpStatus:r.status,
        contentType,
        contentLength:raw.length,
        totalResults,
        tagCounts,
        firstFive,
        jsonDetected:Boolean(parsedJson),
        jsonPreview:parsedJson ? parsedJson : null,
        rawPreview:raw.slice(0,7000)
      },
      interpretation:{
        noLinks:
          r.ok && linkBlocks.length === 0 && totalResults === 0,
        parserMismatch:
          r.ok && linkBlocks.length === 0 && raw.length > 0 && totalResults > 0,
        hasClickUrls:
          tagCounts.clickUrlCamel + tagCounts.clickUrlKebab > 0,
        nextStep:
          !r.ok
            ? "Inspect CJ HTTP/API error."
            : (tagCounts.clickUrlCamel + tagCounts.clickUrlKebab > 0)
              ? "Link Search works; update V15.7.3 parser/selection using exact returned field names."
              : linkBlocks.length > 0
                ? "Links exist but click URL field uses an unexpected shape; inspect rawPreview."
                : "No active links returned for this advertiser/PID; test allow-deep-linking or use another CJ-approved tracking method."
      }
    }, r.ok ? 200 : 502);

  } catch (e) {
    return json({
      ok:false,
      version:"15.7.4",
      stage:"request",
      error:String(e?.message || e)
    },502);
  } finally {
    clearTimeout(timer);
  }
};

export const config = {
  path: "/api/cj-link-search-debug-v15-7-4"
};
