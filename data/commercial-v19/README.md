# TrendPilot V19 Commercial Layer

Product identity and commercial monetization are intentionally separate.

## CPC
CPC/click-payment programs are stored as seller/campaign metadata.
They may change the outbound tracking route, but they must not change
product identity or organic comparison ranking. If a future paid
placement affects ranking, it must be explicitly labeled Sponsored.

## Coupons
Coupons are stored separately and attached only after a product or
seller has already been resolved. A coupon must never become a product.
Product-specific coupons should use seller product ID/SKU/global ID
where available; otherwise they remain seller/category-wide.

Required coupon fields:
seller, code, scope, discount type/value, currency, minimum spend,
region, validFrom, validUntil, product/category constraints, status,
affiliate/tracking URL, source.

Required CPC fields:
seller, network, campaign/program ID, regions, payout model, click
tracking URL/template, validFrom, validUntil, status, source.

Expired, region-incompatible, or unverified commercial records are not
applied to visitor-facing prices.
