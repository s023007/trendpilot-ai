# TrendPilot V19.0 — Seller 1: Geekbuying Foundation Catalog

> This is the first real seller catalog in the seller-by-seller architecture. It does not change the visitor UI or search API.

## Foundation result

- Seller: **Geekbuying**
- Canonical products: **1,238**
- Source files containing Geekbuying: **73**
- Stable seller ID/SKU: **1,138 (91.9%)**
- Brand available/inferred: **1,210 (97.7%)**
- Model available/inferred: **242 (19.5%)**
- Explicit model: **0 (0%)**
- Cross-seller exact-comparable identity: **0 (0%)**
- Structured specs found: **0 (0%)**
- Price: **1,212 (97.9%)**
- Image: **1,238 (100%)**
- Product link: **1,238 (100%)**
- Products with variants preserved: **0 (0%)**

## Identity safety

- Duplicate product keys: **PASS**
- Blocked seller leak: **PASS**
- Global-ID conflicts: **0**
- Seller-product-ID conflicts: **0**
- SKU conflicts: **0**
- Brand/model collisions: **49**
- Resolver round-trip: **40/40**

## What is persisted

- `data/catalog-v19/schema-v1.json` — contract every later seller must follow.
- `data/catalog-v19/ARCHITECTURE.md` — identity and failure-handling rules.
- `data/catalog-v19/sellers/geekbuying/products.ndjson` — full normalized Geekbuying catalog.
- `identity-index.json` — exact ID/model/name lookup tables.
- `category-index.json` — stored seller categories for broad searches.
- `manifest.json` + `audit.json` — counts, fill rates, conflicts and validation.

## Gate for Seller 2

**PASS**

Seller 2 can now be built against this exact schema. The recommended next seller is **AliExpress**; its adapter must map its source fields into the same identifiers/name/taxonomy/specs/offer contract rather than invent a new structure.
