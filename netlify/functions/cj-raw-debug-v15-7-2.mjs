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

function clean(v) {
  return String(v ?? "").trim();
}

function token() {
  return (
    process.env.CJ_API_TOKEN ||
    process.env.CJ_TOKEN ||
    process.env.CJ_PAT ||
    process.env.CJ_PERSONAL_ACCESS_TOKEN ||
    ""
  ).trim();
}

function canonicalSeller(value) {
  const raw = clean(value).toLowerCase();
  if (["temu","temu.com"].includes(raw)) return "Temu";
  if (["pandahall","panda hall"].includes(raw)) return "PandaHall";
  if (["fragranceshop.com","fragranceshop","fragrance shop"].includes(raw)) return "FragranceShop.com";
  if (["karaca eu","karaca"].includes(raw)) return "Karaca EU";
  return "";
}

function response(body, status=200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export default async (request) => {
  if (request.method !== "GET") {
    return response({ok:false,error:"GET only"},405);
  }

  const auth = token();
  if (!auth) {
    return response({ok:false,error:"CJ_API_TOKEN is not available to Netlify Functions"},503);
  }

  const url = new URL(request.url);
  const q = clean(url.searchParams.get("q") || "power bank");
  const seller = canonicalSeller(url.searchParams.get("seller") || "Temu") || "Temu";
  const cfg = SELLERS[seller];

  if (q.length < 2 || q.length > 120) {
    return response({ok:false,error:"Query must be 2-120 characters"},400);
  }

  const gql = `
    query TrendPilotRawProductDiagnostic {
      shoppingProducts(
        companyId: ${COMPANY_ID}
        adIds: [${cfg.adIds.join(", ")}]
        keywords: [${JSON.stringify(q)}]
        limit: 20
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
          price {
            amount
            currency
          }
          linkCode(pid: ${JSON.stringify(PID)}) {
            clickUrl
          }
        }
      }
    }
  `;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const r = await fetch(CJ_ENDPOINT, {
      method:"POST",
      headers:{
        "authorization":`Bearer ${auth}`,
        "content-type":"application/json",
        "accept":"application/json",
        "user-agent":"TrendPilot-CJ-Raw-Diagnostic/15.7.2"
      },
      body:JSON.stringify({query:gql}),
      signal:controller.signal
    });

    const raw = await r.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return response({
        ok:false,
        stage:"parse-cj-response",
        cjHttpStatus:r.status,
        responsePreview:raw.slice(0,1000)
      },502);
    }

    if (!r.ok || payload.errors?.length) {
      return response({
        ok:false,
        stage:"cj-graphql",
        cjHttpStatus:r.status,
        errors:payload.errors || [],
        data:payload.data || null
      },502);
    }

    const block = payload?.data?.shoppingProducts || {};
    const rows = Array.isArray(block.resultList) ? block.resultList : [];

    const fieldStats = {
      rawRows: rows.length,
      titlePresent: 0,
      imageLinkPresent: 0,
      imageLinkHttp: 0,
      clickUrlPresent: 0,
      clickUrlHttp: 0,
      pricePresent: 0,
      brandPresent: 0,
      advertiserIdMatchesExpected: 0
    };

    for (const p of rows) {
      const title = clean(p?.title);
      const image = clean(p?.imageLink);
      const click = clean(p?.linkCode?.clickUrl);
      const brand = clean(p?.brand);
      const amount = Number(p?.price?.amount || 0);

      if (title) fieldStats.titlePresent++;
      if (image) fieldStats.imageLinkPresent++;
      if (/^https?:\/\//i.test(image)) fieldStats.imageLinkHttp++;
      if (click) fieldStats.clickUrlPresent++;
      if (/^https?:\/\//i.test(click)) fieldStats.clickUrlHttp++;
      if (Number.isFinite(amount) && amount > 0) fieldStats.pricePresent++;
      if (brand) fieldStats.brandPresent++;
      if (clean(p?.advertiserId) === cfg.advertiserId) fieldStats.advertiserIdMatchesExpected++;
    }

    const firstFive = rows.slice(0,5).map((p,index) => ({
      index:index+1,
      advertiserId:p?.advertiserId ?? null,
      catalogId:p?.catalogId ?? null,
      id:p?.id ?? null,
      title:p?.title ?? null,
      imageLink:p?.imageLink ?? null,
      brand:p?.brand ?? null,
      availability:p?.availability ?? null,
      condition:p?.condition ?? null,
      price:p?.price ?? null,
      linkCode:p?.linkCode ?? null,
      diagnostics:{
        titlePresent:Boolean(clean(p?.title)),
        imagePresent:Boolean(clean(p?.imageLink)),
        imageIsHttp:/^https?:\/\//i.test(clean(p?.imageLink)),
        clickUrlPresent:Boolean(clean(p?.linkCode?.clickUrl)),
        clickUrlIsHttp:/^https?:\/\//i.test(clean(p?.linkCode?.clickUrl)),
        pricePositive:Number(p?.price?.amount || 0) > 0
      }
    }));

    let likelyCause = "No obvious missing field detected";
    if (rows.length === 0) {
      likelyCause = "CJ reports matches but returned no resultList rows";
    } else if (fieldStats.clickUrlHttp === 0) {
      likelyCause = "V15.7.1 filters every row because linkCode.clickUrl is missing or not an http(s) URL";
    } else if (fieldStats.imageLinkHttp === 0) {
      likelyCause = "V15.7.1 filters every row because imageLink is missing or not an http(s) URL";
    } else if (fieldStats.titlePresent === 0) {
      likelyCause = "Product title is missing";
    }

    return response({
      ok:true,
      version:"15.7.2",
      diagnosticOnly:true,
      seller,
      advertiserId:cfg.advertiserId,
      adIds:cfg.adIds,
      query:q,
      companyIdUsed:String(COMPANY_ID).replace(/\d(?=\d{3})/g,"*"),
      pidUsed:String(PID).replace(/\d(?=\d{3})/g,"*"),
      cj:{
        totalCount:Number(block.totalCount || 0),
        count:Number(block.count || 0)
      },
      fieldStats,
      likelyCause,
      firstFive
    });
  } catch (e) {
    return response({
      ok:false,
      stage:"request",
      error:String(e?.message || e)
    },502);
  } finally {
    clearTimeout(timer);
  }
};

export const config = {
  path: "/api/cj-raw-debug-v15-7-2"
};
