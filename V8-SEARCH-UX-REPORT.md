# TrendPilot V8 — Search, Comparison and Mobile UX

## What this patch changes

- Moves the mobile navigation drawer to the browser viewport so it opens fully in Firefox and Chrome.
- Builds a category-sharded buyer search catalogue from every enabled, approved product feed.
- Removes the old baseline score that could surface unrelated products.
- Adds strict name/category matching, common synonyms and light typo tolerance.
- Keeps the private feed cache private; only compact public product fields are published.
- Suggests additional compatible products after the first comparison selection.
- Uses product-family matching instead of requiring an identical raw feed category.
- Removes the artificial empty height on the finder page.
- Adds image fallbacks and a page audit report for missing media, metadata and internal wording.

## Catalogue lifecycle

The installer creates a small starter catalogue from already-published matched products. The existing `Update trends and affiliate products` workflow is patched to rebuild the wider search catalogue immediately after source ingestion. Run that workflow once after V8 installation and thereafter its existing schedule will keep the catalogue current.

## Public output

Only product name, image, current price, currency, seller, category, compact description and approved outbound URL are published. Feed locations, credentials, commission data and internal source rules are not included in the search shards.
