# TrendPilot Event Mobile Conversion Standard

This is mandatory for new commercial event pages unless an exception is documented.

## First-screen rule
- The first mobile screen must show the event promise, one short persuasive paragraph and the primary CTA before any large visual.
- Never make the visitor wait for a remote image before seeing useful content or the buy path.

## Visual rule
- Do not hotlink `<img>` assets from third-party hosts on production event pages.
- Use local, optimized assets stored with the event page. Prefer WebP/JPEG/AVIF for realistic AI imagery and keep SVG for lightweight graphic fallback.
- A visual must strengthen the experience or decision; decorative filler is not enough.
- Historical or illustrative visuals must be labelled honestly and must not imply a current lineup.
- Every major visual must have a graceful failure state: if an asset cannot render, the layout must collapse cleanly or show a lightweight fallback instead of a large blank area.
- AI-generated sports visuals should sell the atmosphere without falsely representing a real current player, official kit, exact current lineup, or documentary photograph.

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
- The page should persuade through experience, relevance and clarity rather than long explanation.

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
- No third-party image request may block first content paint.
- Keep the hero visual lightweight and local.
- Avoid unnecessary scripts, font downloads and duplicated content blocks.
