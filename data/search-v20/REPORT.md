# TrendPilot V20.2 — Persistent Shadow Search Projection

**Production visitor UI/search remains unchanged.** This projection is stored separately under `data/search-v20/` and is consumed only by `/api/products-v20-shadow`.

## Foundation
- Public sellers: **13**
- Canonical catalogs loaded: **13**
- Canonical records scanned: **52,032**
- Duplicate product keys: **0**
- Blocked seller leaks: **0**

## Persistent product roles
- main: **10,609**
- accessory: **6,900**
- replacement_part: **1,066**
- related: **823**
- unclassified: **32,634**

## Persistent product types
| Type | Main | Related/accessories/parts | Main sellers |
|---|---:|---:|---:|
| phone | 1,326 | 5,175 | 5 |
| laptop | 643 | 552 | 5 |
| smartwatch | 1,248 | 738 | 2 |
| headphones | 3,653 | 830 | 5 |
| perfume | 211 | 8 | 4 |
| dog_food | 25 | 78 | 2 |
| power_bank | 536 | 395 | 3 |
| air_conditioner | 12 | 3 | 2 |
| 3d_filament | 58 | 0 | 1 |
| cookware | 422 | 14 | 3 |
| lighting | 1,439 | 310 | 9 |
| tools | 1,036 | 686 | 6 |

## Shadow API rule
- Broad queries read the precomputed type projection.
- Specific model/name queries search only within the inferred product type.
- Accessories/replacement parts never enter `main`; they remain in the separate related channel.
- Exact identity uses only trusted identifier keys; inferred model/name text is discovery only.
- Seller-balanced results are returned to support comparison rather than one-seller domination.
