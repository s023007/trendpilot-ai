#!/usr/bin/env python3
"""Reusable product-completeness checks for TrendPilot AI v0.6.1.

The rules are network-agnostic. They work with Admitad, CJ, Awin, Impact,
PartnerStack, direct programmes and future CSV/XML feeds after normalisation.
"""
from __future__ import annotations

from typing import Iterable

from adapters.common import has_term, normalise, text


def _terms(values: Iterable[object]) -> list[str]:
    return [text(value) for value in values or [] if text(value)]


def _category_contains(category: object, term: object) -> bool:
    haystack = normalise(category)
    needle = normalise(term)
    return bool(haystack and needle and (needle in haystack or haystack in needle))


def validate_offer(
    offer: dict,
    profile: dict,
    global_rules: dict | None = None,
) -> tuple[bool, list[str]]:
    """Return whether an offer looks like a complete product for a profile.

    Existing include/exclude term matching and price rules remain outside this
    helper. This layer prevents accessory-only, replacement-part and weak-title
    products from qualifying merely because their description mentions the
    target product.
    """
    rules = global_rules or {}
    title = text(offer.get("name"))
    category = text(offer.get("category"))
    reasons: list[str] = []

    if bool(rules.get("requireAffiliateUrl", True)) and offer.get("offerType") != "direct":
        if not text(offer.get("affiliateUrl")):
            reasons.append("missing-affiliate-url")

    minimum_title_length = int(rules.get("minimumTitleLength") or 4)
    if len(normalise(title)) < minimum_title_length:
        reasons.append("product-title-too-short")

    required_title_terms = _terms(profile.get("requiredTitleTerms", []))
    minimum_required = int(profile.get("minimumRequiredTitleTerms") or (1 if required_title_terms else 0))
    title_matches = [term for term in required_title_terms if has_term(title, term)]
    if minimum_required and len(title_matches) < minimum_required:
        reasons.append("missing-required-title-term")

    excluded_title_terms = _terms(profile.get("excludeTitleTerms", []))
    excluded_category_terms = _terms(profile.get("excludeCategoryTerms", []))

    if not bool(profile.get("allowAccessoryProducts", False)):
        excluded_title_terms.extend(_terms(rules.get("blockedAccessoryTitleTerms", [])))
        excluded_category_terms.extend(_terms(rules.get("blockedAccessoryCategoryTerms", [])))

    if any(has_term(title, term) for term in excluded_title_terms):
        reasons.append("accessory-or-excluded-title")

    if any(_category_contains(category, term) for term in excluded_category_terms):
        reasons.append("accessory-or-excluded-category")

    return not reasons, list(dict.fromkeys(reasons))
