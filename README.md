# TrendPilot AI v0.5 — Automatic Trend Discovery

This version adds a real daily discovery pipeline before product matching.

## Daily pipeline

1. Read Google Trends RSS for US, UK and UAE.
2. Read Product Hunt's official RSS feed.
3. Read the official Hacker News API.
4. Remove news-only, unsafe, restricted and non-commercial signals.
5. Score the remaining opportunities.
6. Publish source-backed trends to `data/discovered-trends.json`.
7. Build product matching profiles from those trends.
8. Match approved AliExpress affiliate products.
9. Commit only clean public outputs.

No new secret is required. The existing secret remains:
`ADMITAD_ALIEXPRESS_FEED_25_40`

The button on a trend page now says **Why this is trending** only when a genuine external public source exists. Internal JSON reports are no longer opened for visitors.


## v0.5.1
New signals use strict filters, product evidence and manual approval before publication.


## v0.6.0 — Commerce-First Multi-Network Engine

Affiliate feeds and direct programmes are normalised through source adapters.
New CSV/XML/direct sources can be added with a JSON configuration file without
rewriting the discovery or matching engines. Equivalent offers across networks
are deduplicated and the strongest compliant route is selected.

## v0.6.1 — Product Completeness Guard

Adds network-agnostic product validation before commerce discovery and matching.
Approval now requires a best match score of at least 75, at least three strong
matches and three valid affiliate routes. Accessory-only, replacement-part and
weak-title products are held or rejected through configurable rules that work
across Admitad, CJ, Awin, Impact, PartnerStack, direct programmes and future
CSV/XML sources.

## v2.4.0 — Multi-Source Trend Intelligence

Trend discovery now uses independent source families instead of treating multiple
Google regions as multiple websites. The engine adds GitHub Search and Stack
Exchange signals, optional YouTube most-popular data, and a safe curated watchlist
for public trend pages that do not expose a suitable API. Sources are fetched in
parallel, commercial and product evidence remains mandatory, and review.html now
shows source evidence before approval. See TREND-SOURCES-GUIDE.txt.

