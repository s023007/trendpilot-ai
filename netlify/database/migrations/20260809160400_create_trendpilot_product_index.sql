CREATE TABLE IF NOT EXISTS tp_products_v16 (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  network TEXT NOT NULL DEFAULT '',
  seller TEXT NOT NULL DEFAULT '',
  advertiser_id TEXT NOT NULL DEFAULT '',
  source_product_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  price NUMERIC(18,4),
  currency VARCHAR(12) NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  affiliate_url TEXT NOT NULL DEFAULT '',
  destination_url TEXT NOT NULL DEFAULT '',
  condition_text TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT '',
  quality SMALLINT NOT NULL DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_document TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(category, '') || ' ' || coalesce(subcategory, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(seller, '') || ' ' || coalesce(network, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS tp_products_v16_search_idx
  ON tp_products_v16 USING GIN (search_document);

CREATE INDEX IF NOT EXISTS tp_products_v16_seller_idx
  ON tp_products_v16 (lower(seller));

CREATE INDEX IF NOT EXISTS tp_products_v16_network_idx
  ON tp_products_v16 (lower(network));

CREATE INDEX IF NOT EXISTS tp_products_v16_seen_idx
  ON tp_products_v16 (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS tp_index_jobs_v16 (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS tp_index_jobs_v16_started_idx
  ON tp_index_jobs_v16 (started_at DESC);
