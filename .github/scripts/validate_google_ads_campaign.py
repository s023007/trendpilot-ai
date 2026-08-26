#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "marketing/google-ads/manchester-derby-sa/campaign.json"
PAGE = ROOT / "public/guides/manchester-derby-tickets-saudi-arabia/index.html"

errors = []
config = json.loads(CONFIG.read_text(encoding="utf-8"))
page = PAGE.read_text(encoding="utf-8") if PAGE.exists() else ""
page_ids = set(re.findall(r'\bid=["\']([^"\']+)["\']', page))

if config.get("status") != "DRAFT_DO_NOT_PUBLISH":
    errors.append("Campaign must remain DRAFT_DO_NOT_PUBLISH until launch gates are explicitly cleared.")

network = config.get("network", {})
if network.get("type") != "SEARCH" or network.get("search_partners") or network.get("display_network"):
    errors.append("Initial campaign must be Google Search only, with Search Partners and Display disabled.")

geo = config.get("geo", {})
if geo.get("included") != ["Saudi Arabia"] or geo.get("advanced_location_option") != "PRESENCE_ONLY":
    errors.append("Initial campaign must target Saudi Arabia with PRESENCE_ONLY.")

if config.get("bidding", {}).get("guardrails", {}).get("no_broad_match_initially") is not True:
    errors.append("Broad-match launch guard must remain enabled.")

if config.get("first_test_decision_rules", {}).get("never_auto_scale") is not True:
    errors.append("First-test auto-scaling must remain disabled.")

launch_gates = config.get("launch_gates", {})
if launch_gates.get("google_event_ticket_eligibility_confirmed_for_domain") is not False:
    errors.append("Eligibility must remain false until Google explicitly approves the domain/account.")
if launch_gates.get("landing_page_ticket_aggregator_disclosure_above_fold") is not True:
    errors.append("Ticket-aggregator disclosure must remain confirmed above the fold.")
if launch_gates.get("final_manual_review_required") is not True:
    errors.append("Final manual review gate must remain enabled.")

forbidden = [x.lower() for x in config.get("policy", {}).get("never_use_terms", [])]
seen_rsa_names = set()


def check_url_anchor(label: str, url: str):
    if not url:
        errors.append(f"{label}: missing final URL.")
        return
    parsed = urlparse(url)
    if parsed.netloc and parsed.netloc != "trendpilotchoice.com":
        errors.append(f"{label}: final URL must stay on trendpilotchoice.com.")
    if parsed.fragment and parsed.fragment not in page_ids:
        errors.append(f"{label}: landing-page anchor '#{parsed.fragment}' does not exist.")

for group in config.get("ad_groups", []):
    keywords = group.get("keywords", {})
    if keywords.get("broad"):
        errors.append(f"{group['name']}: broad positive keywords are not allowed in the first controlled test.")
    if not keywords.get("exact"):
        errors.append(f"{group['name']}: at least one exact-match keyword is required.")
    if group.get("rsa_variants") and len(group.get("rsa_variants", [])) < 2:
        errors.append(f"{group['name']}: prepare at least two RSA variants for the controlled test.")
    for rsa in group.get("rsa_variants", []):
        name = rsa.get("name", "unnamed")
        if name in seen_rsa_names:
            errors.append(f"Duplicate RSA name: {name}")
        seen_rsa_names.add(name)
        check_url_anchor(name, rsa.get("final_url", ""))
        heads = rsa.get("headlines", [])
        descs = rsa.get("descriptions", [])
        if not (3 <= len(heads) <= 15):
            errors.append(f"{name}: RSA must contain 3-15 headlines.")
        if not (2 <= len(descs) <= 4):
            errors.append(f"{name}: RSA must contain 2-4 descriptions.")
        if len(set(heads)) != len(heads):
            errors.append(f"{name}: duplicate headlines detected.")
        if len(set(descs)) != len(descs):
            errors.append(f"{name}: duplicate descriptions detected.")
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

for sitelink in config.get("assets", {}).get("sitelink_plan", []):
    target = sitelink.get("target", "")
    if target.startswith("#") and target[1:] not in page_ids:
        errors.append(f"Sitelink '{sitelink.get('text')}' points to missing anchor {target}.")

if config.get("policy", {}).get("display_url_paths"):
    errors.append("Ticket aggregator display URL paths must remain blank.")

negatives = config.get("campaign_negatives", {}).get("broad", [])
if len(negatives) < 30:
    errors.append("Negative-keyword guardrail is unexpectedly small.")

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
print(f"Landing anchors checked: {len(page_ids)}")
print(f"Negative keywords: {len(negatives)}")
