# TrendPilot AI v3.0 — Implementation report

Updated: 3 August 2026

## Public positioning

TrendPilot is now a research-led decision site rather than a bulk feed catalogue. The home page routes visitors to focused comparisons, buying guides, software reviews and business-sourcing guides. The existing automated trend and exact-product validation pipeline remains in place.

## Public active programmes

- AliExpress WW — CPC + CPA available at programme level.
- Joom Many GEOs — CPC + CPA available at programme level.
- Geekbuying WW — CPC + CPA available at programme level.
- Alibaba WW — CPC + CPA available at programme level.
- Wondershare WW — CPA; official fallback links remain until personal Admitad deeplinks are inserted.

A programme-level CPC capability is not treated as proof that every current feed URL is a CPC URL. Link mode must be verified before a page or report labels a route CPC.

## Programmes kept private until approval

Udemy, Airalo, Jetpac and Global YO remain in the private configuration only. They are absent from public navigation, page content, the public programme-status script and the sitemap.

## New public architecture

- `/products/` — carefully selected product guides and live exact-product offers.
- `/compare/` — store, software and product comparisons.
- `/software/` — creator and productivity software.
- `/sourcing/` — Alibaba, suppliers, MOQ, samples and landed-cost decisions.
- `/trends.html` — the existing verified research radar.
- `/stores.html` — the existing verified store catalogue.

## First deep editorial pages

- Wireless CarPlay adapter buying guide.
- Joom vs AliExpress.
- Geekbuying vs AliExpress.
- Filmora review.
- Filmora vs CapCut.
- Best video editor for beginners.
- Alibaba vs AliExpress for small businesses.
- How to find verified suppliers on Alibaba.

Each page distinguishes research-based analysis from hands-on testing and includes decision tables, trade-offs, methodology, update dates, affiliate disclosure and sources.

## Research standard

Every major page has a record in `/research/`. New pages should not be published before documenting search intent, target countries, direct competitors, the content gap, evidence requirements, monetisation mode, internal links and update cadence.

## Trust and legal pages

Added or rebuilt:

- About
- Editorial methodology
- How we test
- Affiliate disclosure
- Corrections policy
- Contact with Netlify Forms
- Privacy policy
- Terms of use
- 404 page

## Technical controls

- Active/pending programme registry.
- Public status file contains active programmes only.
- Exact product-route requirement retained.
- Pending programmes excluded from sitemap.
- Research, data, config and review centre blocked in robots.txt where appropriate.
- Canonicals, descriptions, Open Graph data and article structured data added to new pages.
- Netlify security headers, caching and redirects added.
- Old public navigation aligned with the new architecture.
- Legacy affiliate-programme page redirects to the disclosure.

## Preserved automation

The existing GitHub Actions, trend discovery, source ingestion, product matching, product quality, link guard, review centre and matched-product outputs were not removed.

## Manual actions still required

1. Generate personal Wondershare/Filmora Admitad deeplinks and paste them into `js/affiliate-links.js`.
2. Verify whether each generated AliExpress, Joom, Geekbuying or Alibaba link is CPC or CPA before labelling it in analytics or editorial content.
3. Replace the Netlify subdomain in canonical URLs and the sitemap after a final custom domain is connected.
4. Connect Google Search Console only after the final domain is selected.
5. Add a privacy-compliant analytics setup only when its consent requirements have been addressed.

## Future sections retained in private planning

- eSIM comparison engine after at least two providers become active.
- Learning and courses after Udemy approval.
- Rare used finds after a suitable affiliate source and daily availability checker are active.
- Regional Alibaba stock, low-MOQ sourcing and custom packaging guides.
- Travel gadgets, retro gaming, smart home, professional tools and rare electronics as page clusters only after page-level SEO research.
