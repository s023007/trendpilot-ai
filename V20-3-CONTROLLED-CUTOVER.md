# TrendPilot V20.3.2 — Controlled Visitor Cutover

## Search order

1. `/find/` calls the verified persistent V20.2 projection first.
2. If V20 recognizes the product type and returns at least one `main` row,
   V20 owns the visitor result set.
3. V20 `main` rows go to **Exact matches**.
4. Same-type alternatives plus related/accessory/part rows remain in the
   separate **Related alternatives** channel.
5. V16/V17 catalogue/live search runs only when V20 does not support the
   query, is unavailable, or has no main result for the requested seller.
6. After V20 succeeds, legacy “Show more catalogue pages” cannot mix old
   rows into the verified V20 result set.

## Seller policy

Public product comparison contains exactly 13 approved sellers.

Permanently blocked from public product search in this stage:
- Temu
- Joom
- FilamentPRO EU CPS

## Safety

- V20.2 persistent projection remains unchanged.
- `/api/products-v20-shadow` remains the V20 data endpoint.
- The previous V16/V17 path is retained as an automatic fallback.
- Seller selection reruns the same controlled search using the selected
  seller, preventing the old “seller resets to All sellers” behavior.
- No GEO/serviceable-area filter is introduced.
