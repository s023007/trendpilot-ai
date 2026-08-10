# TrendPilot V19 Seller Catalog Architecture

## Non-negotiable rule

Search does not decide what a product is after the visitor types a query.
Each seller is normalized **before** search into the same canonical product contract.

## Seller build order

1. Geekbuying — reference/foundation catalog.
2. AliExpress — map to exactly the same contract.
3. Alibaba — map to exactly the same contract.
4. Remaining approved sellers, one by one.

A new seller cannot join the global resolver until its adapter passes the same validation.

## Identity hierarchy

Strongest to weakest:

1. GTIN / EAN / UPC / ISBN.
2. Brand + explicit MPN.
3. Brand + explicit model number.
4. Seller product ID / SKU — exact inside that seller only.
5. Exact normalized product name — searchable, never sufficient for automatic cross-seller merging.
6. Inferred model/name — discovery only, never silent merge.

A serial number is intentionally not invented. Serial numbers identify individual physical units; marketplace catalogs usually expose product IDs, SKUs, model/MPN, or global trade identifiers instead.

## What happens on difficult events

- **Same title, different products:** both remain separate.
- **Same product ID repeated in multiple source shards:** richest record wins; one stable productKey remains.
- **Price changes:** productKey stays stable because identity is not based on price.
- **Missing price/image:** product remains searchable if identity/name is valid; offer quality flags expose the missing field.
- **Variant SKUs:** preserved under variants and are not flattened into unrelated products.
- **Model inferred from title:** searchable, but cannot auto-merge across sellers.
- **Conflicting GTIN/model:** kept as a conflict for review; never silently merged.
- **Seller removed from approved policy:** its catalog can remain archived but must not enter the public resolver.
- **Temu/Joom:** blocked by the current public product-seller policy.
- **Second seller and later sellers:** must emit the same schema, field meanings, normalization rules, and identity keys.

## Resolver behavior

Specific query:
- seller product ID / SKU / global ID / explicit model -> exact lookup first.
- exact normalized name -> return matching records without merging them.
- partial name -> discovery results.

Broad query:
- uses the catalog's stored taxonomy/category indexes.
- does not invent product categories at request time.

## Cross-seller comparison

Cross-seller comparison will be added only after at least two seller catalogs exist.
Automatic grouping is allowed only when identity confidence is strong enough under the hierarchy above.
