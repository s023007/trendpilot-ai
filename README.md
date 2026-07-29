# TrendPilot AI v0.3 — Trend-to-Affiliate Foundation

This version returns the project to its original direction:

1. Detect a rising trend.
2. Score its commercial opportunity.
3. Match relevant products and affiliate networks.
4. Publish useful content and monetised links.

## New pages

- `index.html` — trend-first homepage and radar
- `trends.html` — complete trend directory
- `trend.html` — dynamic opportunity detail page
- `networks.html` — connector and automation plan

## New data files

- `js/trends-data.js` — central trend dataset
- `js/networks-data.js` — network connector registry

## Your active affiliate link

Your ElevenLabs referral link remains stored in:

- `js/affiliate-links.js`

## Important technical rule

Do not place Awin, CJ, Admitad or Impact API secrets inside public JavaScript. They must later be saved in GitHub Actions Secrets and used by a scheduled backend workflow.

## Uploading v0.3

Upload and replace the files in the update package. Keep your existing `privacy.html`, `terms.html` and images if GitHub asks whether to replace them, although the full package also contains compatible copies.

The current trend snapshot uses Product Hunt July 2026 launch rankings and trending categories. It does not yet claim automatic Google-search or social-volume collection.
