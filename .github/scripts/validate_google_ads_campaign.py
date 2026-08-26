#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "marketing/google-ads/manchester-derby-sa/campaign.json"

errors = []
config = json.loads(CONFIG.read_text(encoding="utf-8"))

if config.get("status") != "DRAFT_DO_NOT_PUBLISH":
    errors.append("Campaign must remain DRAFT_DO_NOT_PUBLISH until launch gates are explicitly cleared.")

network = config.get("network", {})
if network.get("type") != "SEARCH" or network.get("search_partners") or network.get("display_network"):
    errors.append("Initial campaign must be Google Search only, with Search Partners and Display disabled.")

geo = config.get("geo", {})
if geo.get("included") != ["Saudi Arabia"] or geo.get("advanced_location_option") != "PRESENCE_ONLY":
    errors.append("Initial campaign must target Saudi Arabia with PRESENCE_ONLY.")

forbidden = [x.lower() for x in config.get("policy", {}).get("never_use_terms", [])]
seen_rsa_names = set()

for group in config.get("ad_groups", []):
    keywords = group.get("keywords", {})
    if keywords.get("broad"):
        errors.append(f"{group['name']}: broad positive keywords are not allowed in the first controlled test.")
    for rsa in group.get("rsa_variants", []):
        name = rsa.get("name", "unnamed")
        if name in seen_rsa_names:
            errors.append(f"Duplicate RSA name: {name}")
        seen_rsa_names.add(name)
        heads = rsa.get("headlines", [])
        descs = rsa.get("descriptions", [])
        if not (3 <= len(heads) <= 15):
            errors.append(f"{name}: RSA must contain 3-15 headlines.")
        if not (2 <= len(descs) <= 4):
            errors.append(f"{name}: RSA must contain 2-4 descriptions.")
        for h in heads:
            if len(h) > 30:
                errors.append(f"{name}: headline over 30 chars ({len(h)}): {h}")
            low = h.lower()
            for word in forbidden:
                if word and word in low:
                    errors.append(f"{name}: forbidden policy term '{word}' in headline: {h}")
        for d in descs:
            if len(d) > 90:
                errors.append(f"{name}: description over 90 chars ({len(d)}): {d}")
            low = d.lower()
            for word in forbidden:
                if word and word in low:
                    errors.append(f"{name}: forbidden policy term '{word}' in description: {d}")

if config.get("policy", {}).get("display_url_paths"):
    errors.append("Ticket aggregator display URL paths must remain blank.")

if errors:
    print("Google Ads campaign validation FAILED:\n")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("Google Ads campaign validation PASSED")
print(f"Campaign: {config['campaign_id']}")
print(f"Status: {config['status']}")
print(f"Ad groups: {len(config.get('ad_groups', []))}")
print(f"RSA variants: {len(seen_rsa_names)}")
