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
