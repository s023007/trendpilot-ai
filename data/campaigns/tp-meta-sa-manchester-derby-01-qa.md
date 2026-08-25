# QA — TP-META-SA-MANCHESTER-DERBY-01

## Verified now

- [x] Ticombo exact-event affiliate link lands on Manchester United vs Manchester City event ID `3001252536`.
- [x] Ticombo affiliate tracking survives redirect.
- [x] Sports Events 365 CJ route is tracked and explicitly labeled as a Premier League fallback, not an exact event deeplink.
- [x] Trip.com Manchester hotel targeted deeplink is verified.
- [x] Price language on TrendPilot is dynamic; no stale fixed ticket price is hard-coded.
- [x] Affiliate disclosure is visible on the page.
- [x] Hotel cross-sell appears after ticket comparison.

## Still required before paid spend

- [ ] Re-check live ticket availability on launch day.
- [ ] Confirm `AffiliateOutboundClick` is received in production analytics with seller, network, route kind, market and placement.
- [ ] Review the production page on mobile for layout/overflow and test each active CTA.
- [ ] Confirm Meta billing/payment safety limit.
- [ ] TicketNetwork exact affiliate route: enable only if the dedicated audit proves it; otherwise leave it disabled.

No ad is launched until the production checks above pass.
