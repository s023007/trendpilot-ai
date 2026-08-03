# TrendPilot AI V4 — Buyer Decision & Revenue Architecture

Installed: 3 August 2026

## Public positioning
- Buyer-first message: compare better, choose faster, buy with confidence.
- Public navigation: Comparisons, Software, Electronics, Marketplaces, For Business, How We Review.
- Internal programme, feed and trend pages are removed from navigation and blocked from indexing through headers/robots.

## SEO
- Unique titles, descriptions, canonicals, Open Graph and Twitter metadata.
- Organization/WebSite, CollectionPage/ItemList, Article, BreadcrumbList and visible FAQ structured data.
- Clean sitemap containing only complete public pages.
- Static editorial content remains indexable without JavaScript.

## Mobile and accessibility
- System-font stack, responsive grids, no horizontal overflow, 48px-class controls, skip link, focus states and reduced-motion support.
- Product media uses a fixed container to reduce layout shift.

## Affiliate and CPC
- Existing secrets, feeds, programme status, affiliate links and generated product data are preserved.
- Product cards are restricted by active programme, exact URL, title relevance, exclusions, duplicates and minimum match score.
- Weak matches are hidden rather than published.
- Outbound sponsored clicks emit `affiliate_outbound_click` with page, advertiser, product, placement, revenue model, link state and destination host.
- Set `ga4Id` in `js/site-config.js` when a GA4 property is ready. No tracking service is loaded while it is blank.
- No forced clicks, hidden links, misleading buttons or automatic redirects are added.

## Future eSIM section
Do not add it to public navigation until at least two or three approved programmes have confirmed links and enough evidence for a real comparison.
