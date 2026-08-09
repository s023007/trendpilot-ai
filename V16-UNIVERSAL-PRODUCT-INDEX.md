# TrendPilot V16 Universal Product Index

V16 introduces a server-side universal product index backed by Netlify Database.

## V16.0 foundation

- Creates a Postgres product table with full-text search.
- Adds `/api/products-v16` for generic product search.
- Adds `/api/products-v16/health` for index statistics.
- Adds `/api/products-v16/rebuild` as an idempotent background importer.
- Seeds from trusted existing TrendPilot catalog files.
- Does not replace the public search UI yet. V15 remains the live fallback until V16 data quality is verified.
- Keeps global catalog behavior; no GEO/serviceable-area import filtering is introduced.

## Rollout

1. Deploy V16.0 and let Netlify provision/apply the database migration.
2. Verify `/api/products-v16/health`.
3. Trigger `/api/products-v16/rebuild` once.
4. Re-check `/api/products-v16/health`.
5. In V16.1, connect the public finder to database-first search with live-source fallback and write-through caching.
