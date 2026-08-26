#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT / "marketing/google-ads/manchester-derby-sa/campaign.json"
PLANNER = ROOT / "marketing/google-ads/manchester-derby-sa/keyword-planner-arabic-sa-2026-08-26.json"

cfg = json.loads(CAMPAIGN.read_text(encoding="utf-8"))
planner = json.loads(PLANNER.read_text(encoding="utf-8"))

# Keep the campaign safely in draft while incorporating Planner evidence.
cfg["status"] = "DRAFT_DO_NOT_PUBLISH"
cfg["draft_version"] = "2026-08-26-v4"

cfg["language_strategy"] = {
    "primary_launch_language": "English",
    "english_group_status": "READY_AFTER_EVENT_TICKET_ELIGIBILITY",
    "arabic_group_status": "PAUSED_INITIAL_TEST_LOW_EVENT_SPECIFIC_VOLUME",
    "note": (
        "Saudi Keyword Planner measured several derby-specific English ticket queries, "
        "including low-competition variants. The Arabic run measured generic Manchester United "
        "ticket demand but no Arabic query explicitly naming Manchester City/the derby. "
        "Protect the small first-test budget by launching English first and keeping Arabic prepared but paused."
    )
}

cfg.setdefault("launch_gates", {})["keyword_planner_review_completed"] = True
cfg["launch_gates"]["keyword_planner_english_completed"] = True
cfg["launch_gates"]["keyword_planner_arabic_completed"] = True

cfg["keyword_planner_evidence"] = {
    "english_file": "marketing/google-ads/manchester-derby-sa/keyword-planner-english-sa-2026-08-26.json",
    "arabic_file": "marketing/google-ads/manchester-derby-sa/keyword-planner-arabic-sa-2026-08-26.json",
    "launch_decision": "ENGLISH_FIRST_ARABIC_PAUSED",
    "reason": planner["launch_recommendation"]["reason"]
}

for group in cfg.get("ad_groups", []):
    if group.get("name") == "EN_EVENT_HIGH_INTENT":
        group["launch_priority"] = 1
        group["initial_status"] = "READY_AFTER_EVENT_TICKET_ELIGIBILITY"
    elif group.get("name") == "AR_EVENT_HIGH_INTENT":
        group["launch_priority"] = 3
        group["initial_status"] = "PAUSED"
        group["draft_max_cpc_usd"] = planner["launch_recommendation"]["arabic_draft_max_cpc_usd_if_later_tested"]
        group["keyword_planner_review"] = {
            "status": "COMPLETE",
            "result": "NO_MEASURABLE_ARABIC_DERBY_SPECIFIC_QUERY_IN_EXPORT",
            "generic_measurable_examples": [
                "تذاكر مباراة مانشستر يونايتد",
                "حجز تذاكر مباراة مانشستر يونايتد",
                "سعر تذكرة مباراة مانشستر يونايتد"
            ],
            "decision": "KEEP_PREPARED_BUT_PAUSED_FOR_FIRST_TEST"
        }

# Add opponent names as campaign negatives so phrase matching cannot drift toward other fixtures.
neg = cfg.setdefault("campaign_negatives", {}).setdefault("broad", [])
for term in planner.get("negative_keyword_additions", []):
    if term not in neg:
        neg.append(term)

# Keep the existing conservative English CPC cap. Do not increase from Planner data alone.
cfg.setdefault("bidding", {})["campaign_default_max_cpc_usd"] = min(
    float(cfg.get("bidding", {}).get("campaign_default_max_cpc_usd", 0.45)), 0.45
)
cfg["bidding"]["planner_decision"] = (
    "Keep first-test cap at or below $0.45. Do not chase the English high-range top-of-page estimate."
)

CAMPAIGN.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Applied Arabic Keyword Planner review to campaign draft.")
print("Launch language: English first; Arabic paused.")
print("Campaign remains DRAFT_DO_NOT_PUBLISH.")
