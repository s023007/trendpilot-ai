# TP-META-SA-MANCHESTER-DERBY-01

Saudi Arabia test campaign for Manchester United vs Manchester City on 13 September 2026.

## Verified commercial routes

- Ticombo: exact Manchester Derby Admitad deeplink verified to event ID `3001252536`.
- Sports Events 365: CJ tracked Premier League route verified, but deep linking is not allowed; use only as a clearly labeled competition-level fallback.
- Trip.com: Manchester hotel CJ deeplink verified.
- TicketNetwork: public event inventory exists, but an exact tracked CJ affiliate event route is not yet verified; keep its CTA disabled.

## Launch gates

Do not spend on Meta until all of the following are true:

1. At least one exact-event affiliate route is live and verified (currently Ticombo).
2. Any non-exact fallback is explicitly labeled as a competition/category route.
3. Current event availability is checked on the same day the ad goes live.
4. Trip.com Manchester hotel cross-sell deeplink remains verified.
5. `AffiliateOutboundClick` is observed in production analytics with seller/network/placement dimensions.
6. Mobile rendering is reviewed on the production domain.
7. Meta billing safety limit is confirmed.

## First test

- Market: Saudi Arabia
- Objective: Traffic / Landing Page Views
- Initial spend cap: USD 6
- Creatives: 2
- Primary decision metric: ticket outbound-click rate from the TrendPilot page
- Stop: weak or near-zero outbound intent after meaningful landing-page traffic
- Scale: only after qualified outbound intent is demonstrated
