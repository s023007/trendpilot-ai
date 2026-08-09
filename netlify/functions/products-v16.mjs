import { getDatabase } from "@netlify/database";

const clean = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      "x-content-type-options": "nosniff"
    }
  });

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q") || "").slice(0, 160);
    const seller = clean(url.searchParams.get("seller") || "").slice(0, 120);
    const network = clean(url.searchParams.get("network") || "").slice(0, 80);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 48) || 48));
    const offset = Math.max(0, Math.min(5000, Number(url.searchParams.get("offset") || 0) || 0));

    const where = ["active = TRUE"];
    const params = [];
    let p = 1;

    if (q) {
      params.push(q);
      const qp = p++;
      where.push(`(
        search_document @@ websearch_to_tsquery('simple', $${qp})
        OR lower(title) LIKE '%' || lower($${qp}) || '%'
        OR lower(brand) LIKE '%' || lower($${qp}) || '%'
        OR lower(category) LIKE '%' || lower($${qp}) || '%'
        OR lower(description) LIKE '%' || lower($${qp}) || '%'
      )`);
    }

    if (seller) {
      params.push(seller);
      where.push(`lower(seller) = lower($${p++})`);
    }

    if (network) {
      params.push(network);
      where.push(`lower(network) = lower($${p++})`);
    }

    params.push(limit);
    const limitParam = p++;
    params.push(offset);
    const offsetParam = p++;

    const rankSql = q
      ? `ts_rank_cd(search_document, websearch_to_tsquery('simple', $1)) DESC,
         CASE
           WHEN lower(title) = lower($1) THEN 5
           WHEN lower(title) LIKE lower($1) || '%' THEN 4
           WHEN lower(title) LIKE '%' || lower($1) || '%' THEN 3
           WHEN lower(brand) = lower($1) THEN 2
           ELSE 0
         END DESC,`
      : "";

    const sql = `
      SELECT
        source_key, source, network, seller, advertiser_id, source_product_id,
        title, description, brand, category, subcategory,
        price, currency, image_url, affiliate_url, destination_url,
        condition_text, availability, quality, last_seen_at
      FROM tp_products_v16
      WHERE ${where.join(" AND ")}
      ORDER BY
        ${rankSql}
        quality DESC,
        last_seen_at DESC,
        id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const db = getDatabase();
    const rows = await db.sql.unsafe(sql, params);

    return json({
      ok: true,
      version: "16.0.0",
      query: q,
      seller: seller || null,
      network: network || null,
      totalReturned: rows.length,
      products: rows.map(row => ({
        id: row.source_key,
        sourceKey: row.source_key,
        source: row.source,
        network: row.network,
        advertiser: row.seller,
        advertiserId: row.advertiser_id,
        sourceProductId: row.source_product_id,
        name: row.title,
        title: row.title,
        description: row.description,
        brand: row.brand,
        category: row.category,
        subcategory: row.subcategory,
        price: row.price === null ? 0 : Number(row.price),
        currency: row.currency,
        image: row.image_url,
        imageUrl: row.image_url,
        url: row.affiliate_url || row.destination_url,
        affiliateUrl: row.affiliate_url,
        destinationUrl: row.destination_url,
        condition: row.condition_text,
        availability: row.availability,
        quality: row.quality,
        indexedAt: row.last_seen_at
      }))
    });
  } catch (error) {
    console.error("TrendPilot V16 product search failed", error);
    return json({
      ok: false,
      version: "16.0.0",
      error: "Product index is not ready yet.",
      detail: String(error?.message || error).slice(0, 500)
    }, 503);
  }
}

export const config = {
  path: "/api/products-v16",
  method: "GET"
};
