import { getDatabase } from "@netlify/database";

const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

export default async function handler(request) {
  if (request.method !== "GET") {
    return response({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const db = getDatabase();

    const totals = await db.sql`
      SELECT
        COUNT(*)::int AS products,
        COUNT(DISTINCT NULLIF(seller, ''))::int AS sellers,
        COUNT(DISTINCT NULLIF(network, ''))::int AS networks,
        MAX(last_seen_at) AS last_indexed_at
      FROM tp_products_v16
      WHERE active = TRUE
    `;

    const sellers = await db.sql`
      SELECT seller, network, COUNT(*)::int AS products
      FROM tp_products_v16
      WHERE active = TRUE
      GROUP BY seller, network
      ORDER BY COUNT(*) DESC, seller ASC
      LIMIT 40
    `;

    const jobs = await db.sql`
      SELECT id, job_type, status, started_at, completed_at, rows_seen, rows_written, detail
      FROM tp_index_jobs_v16
      ORDER BY id DESC
      LIMIT 5
    `;

    return response({
      ok: true,
      version: "16.0.0",
      database: "ready",
      totals: totals[0] || { products: 0, sellers: 0, networks: 0, last_indexed_at: null },
      sellers,
      recentJobs: jobs
    });
  } catch (error) {
    console.error("TrendPilot V16 health failed", error);
    return response({
      ok: false,
      version: "16.0.0",
      database: "not-ready",
      detail: String(error?.message || error).slice(0, 500)
    }, 503);
  }
}

export const config = {
  path: "/api/products-v16/health",
  method: "GET"
};
