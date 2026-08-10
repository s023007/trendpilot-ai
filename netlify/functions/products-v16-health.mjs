import { getStore } from "@netlify/blobs";
import { STORE_NAME } from "./products-v16-lib.mjs";

const json = (body, status = 200) =>
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
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const meta = await store.get("meta", { type: "json" });

    if (!meta) {
      return json({
        ok: true,
        version: "17.3.1",
        storage: "netlify-blobs",
        ready: false,
        products: 0,
        message: "Storage is available. The first rebuild has not completed yet."
      });
    }

    return json({
      ok: true,
      version: "17.3.1",
      storage: "netlify-blobs",
      ...meta
    });
  } catch (error) {
    console.error("TrendPilot V16 Blobs health failed", error);
    return json({
      ok: false,
      version: "17.3.1",
      storage: "netlify-blobs",
      ready: false,
      detail: String(error?.message || error).slice(0, 500)
    }, 503);
  }
}

export const config = {
  path: "/api/products-v16/health",
  method: "GET"
};
