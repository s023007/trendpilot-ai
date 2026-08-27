# TrendPilot Campaign Brain V1

Reusable decision layer for paid-search campaigns. Manchester Derby 2026 is the first laboratory.

## Goal
Turn advertising data into repeatable decisions while protecting budget. V1 is recommendation-only: it scores and recommends; a human approves changes until enough evidence exists for safe automation.

## Funnel
Impression -> Ad click -> Landing page -> Price section -> Seller click -> Conversion/revenue (when available).

## Required dimensions
campaign, ad_group, keyword, match_type, search_term, country, device, date, impressions, clicks, cost, ctr, avg_cpc, price_section_views, seller_clicks, seller, conversions, conversion_value.

## Core derived metrics
- Seller Click Rate = seller_clicks / ad clicks
- Cost per Seller Click = cost / seller_clicks
- Revenue per Ad Click = conversion_value / ad clicks
- ROAS = conversion_value / cost
- Expected Value per Ad Click = Seller Click Rate x expected value per seller click

## Decision states
LEARNING: insufficient sample.
WINNER: meaningful downstream buyer intent.
SCALE: winner with positive economics; increase gradually, max 20% per adjustment.
KEEP: acceptable performance without enough evidence to scale.
LANDING_MISMATCH: ad/query gets clicks but visitors do not continue toward sellers.
NEGATIVE_CANDIDATE: irrelevant search term; review for negative keyword.
STOP_LOSS: sufficient spend/click evidence with no buyer intent.
PAUSE: human-approved stop.

## Safety rules
1. Never judge a keyword from CTR alone.
2. Never stop a keyword on a tiny sample.
3. Never scale more than 20% in one adjustment.
4. Search terms and keywords are evaluated separately.
5. Preserve historical results; do not delete losing rows.
6. Every rule decision must record the reason and input metrics.
7. Revenue/commission evidence overrides proxy metrics when reliable.
8. V1 never changes Google Ads automatically. Automation is enabled only after API connection, conversion validation, and explicit approval.

## Reuse
Each future client/campaign gets its own campaign ID and configuration while using the same engine. Thresholds can later be calibrated by vertical, country, device and traffic economics.
