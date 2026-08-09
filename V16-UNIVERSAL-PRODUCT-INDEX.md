# TrendPilot V16 Universal Product Index

## V16.0.1 — Netlify Blobs architecture

The project's current Netlify account returned:
`403 database feature not available for this account`
when V16.0 attempted to provision Netlify Database.

V16.0.1 therefore uses Netlify Blobs, which requires no database provisioning.

### Architecture

- Site-wide Blob store: `trendpilot-products-v16`
- Generic search endpoint: `/api/products-v16?q=...`
- Health endpoint: `/api/products-v16/health`
- Background rebuild endpoint: `/api/products-v16/rebuild`
- Products are normalized from existing TrendPilot catalog JSON.
- Product documents are split into 16 stable shards.
- Search tokens are stored in hash-partitioned inverted-index blobs.
- Search can filter by seller or network.
- The current public V15 finder is not replaced yet.
- GEO/serviceable-area filtering is not introduced.

### Rollout

1. Deploy V16.0.1.
2. Verify `/api/products-v16/health`.
3. Trigger `/api/products-v16/rebuild` once.
4. Re-check `/api/products-v16/health`.
5. Test generic queries such as `phone`, `watch`, `dog food`, `dress`, `laptop`.
6. After data-quality verification, V16.1 will connect the public finder to this index with live-source fallback/write-through caching.


## V16.0.3 — relevance and catalog balance

- Wider candidate rescoring before the final result list.
- Strong boosts for direct title/category product matches.
- Generic down-ranking of repair tools, cases, stands, feeders,
  containers, replacement parts and other accessory-intent results
  when the visitor searched for the core product itself.
- Accessory searches remain supported: a query such as `phone case`
  is not penalized for containing `case`.
- Catalog shard selection is balanced across top-level product groups
  instead of taking only the first paths found in the manifest.
- Catalog shard file paths no longer appear as affiliate network names.


## V16.0.4 — core product intent ranking

- Search-only update; no catalog rebuild required.
- Strong generic boost for clean core-product titles.
- Stronger down-ranking for accessories, repair tools and containers
  when the visitor asks for the core product.
- Symmetric accessory detection catches both `phone battery` and
  `case for phone` style titles.
- Explicit accessory queries such as `phone battery`, `watch case`
  and `dog food bowl` remain valid and are not penalized.
- Candidate rescoring now scans the full 1,800-entry token posting
  window before returning the top results.
