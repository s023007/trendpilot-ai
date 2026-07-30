# TrendPilot AI v0.4 — Product Matcher

This version tests the full product-matching workflow before more networks and feeds are added.

## Current sources

1. ElevenLabs direct affiliate link already stored in `js/affiliate-links.js`.
2. Static Admitad Hot Products snapshot in `data/source/admitad-hot-products.csv`.
3. Private AliExpress 25–40 USD Product Feed URL read only from the GitHub Actions secret:

`ADMITAD_ALIEXPRESS_FEED_25_40`

## What the automation does

- Reads products without publishing the private feed URL.
- Blocks restricted and unsafe product terms.
- Matches products to configured commerce-trend profiles.
- Deduplicates and scores candidates.
- Publishes no more than eight products per trend.
- Writes only:
  - `data/matched-products.json`
  - `data/product-matcher-report.json`
  - `js/matched-products.js`
- Commits the clean outputs back to the repository.

## Run the first test

1. Make sure the GitHub repository secret exists:
   `ADMITAD_ALIEXPRESS_FEED_25_40`
2. Upload this update.
3. Open the repository's **Actions** tab.
4. Open **Update matched affiliate products**.
5. Choose **Run workflow**.
6. Wait for a green check.
7. Open `data/product-matcher-report.json` to see counts and source status.
8. Open the website and view:
   `trend.html?trend=wireless-carplay-retrofit`

## Safety rules

- Never place the private Product Feed URL in JavaScript, HTML, README or screenshots.
- The workflow never logs or commits that URL.
- A product match is not proof that a topic is trending.
- Prices, stock and commissions can change.
- Review product relevance before promoting a new automated category.
- Organic content traffic is the current approved method for AliExpress WW.
