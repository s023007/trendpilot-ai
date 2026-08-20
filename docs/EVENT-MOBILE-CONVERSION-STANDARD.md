# TrendPilot Event Mobile Conversion Standard

This is mandatory for new commercial event pages unless an exception is documented.

## First-screen rule
- The first mobile screen must show the event promise, one short persuasive paragraph and the primary CTA before any large visual.
- The first major visual should appear immediately after that purchase path; do not bury the photography deep in the page.

## Visual rule
- Major sports/event pages should normally contain at least two strong, relevant photographs: one emotional/event image and one venue/experience image.
- Prefer real, properly licensed photography from trustworthy free-use sources such as Wikimedia Commons when it is available and genuinely relevant.
- Local optimized assets are preferred when the production host serves them reliably. If local image serving is unreliable, an approved free-license CDN/source may be used with attribution and a multi-source fallback chain.
- A production image must never fail to a blank rectangle. Use at least one independent fallback source for key images; if every source fails, collapse the visual cleanly.
- Photography must strengthen desire, atmosphere or buying confidence. Decorative filler is not enough.
- Historical photographs must be labelled as historical when needed and must not imply that they show the current lineup or current event.
- AI imagery is optional, not the default. Use it only when it adds value that suitable real/free photography cannot provide, and label it honestly.

## Length rule
- Localized event landing pages should normally use 5–7 meaningful content blocks, not long article-style scrolling.
- Keep only what advances one of these decisions: why attend, buy the correct ticket, travel, stay, or remove a purchase objection.
- Move secondary detail into collapsed FAQ/details instead of expanding the page.

## Arabic quality rule
- Arabic pages must use `lang="ar" dir="rtl"`.
- Mixed Latin names, brands and IDs must be directionally isolated (`dir="ltr"`, `<bdi>`, or a tested `.latin` isolation class) so words do not merge or reorder.
- Arabic copy must be proofread for grammar, punctuation and natural marketing tone before publish.
- Avoid literal translations and bureaucratic wording.

## Conversion rule
- Use one visually dominant CTA label across the page and repeat it only at natural decision points.
- Never use fake scarcity, fake discounts, fake reviews or unsupported urgency.
- Explain resale/marketplace status briefly near the purchase area; do not bury the visitor in disclaimers.
- The page should persuade through experience, relevance, photography and clarity rather than long explanation.

## Cross-sell rule
- Commercial event pages should include a compact “You may also like” section near the end when relevant inventory exists.
- Prefer 2–3 highly relevant next choices: another marquee event guide and team/league ticket searches.
- Cross-sell cards must not compete with the primary event CTA above the purchase decision; they belong after the main ticket/travel path.
- Cross-sell wording should be aspirational and specific, not a generic list of links.

## Design rule
- Mobile-first single-column reading is the default for localized event pages.
- Keep comfortable font sizes, high contrast, clear card hierarchy and enough whitespace without creating large empty areas.
- Event-specific palette may use team/event colors, but CTA contrast must remain obvious.
- Avoid side-aligned narrow columns on mobile and avoid oversized empty image containers.

## Performance rule
- The first CTA and core event facts must not depend on an image request.
- Use responsive image sizes and lazy-load secondary photographs.
- Preconnect/preload only the primary hero source when doing so materially improves mobile speed.
- Avoid unnecessary scripts, font downloads and duplicated content blocks.
