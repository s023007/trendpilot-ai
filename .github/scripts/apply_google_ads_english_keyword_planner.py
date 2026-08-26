#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT / "marketing/google-ads/manchester-derby-sa/campaign.json"
ANALYSIS = ROOT / "marketing/google-ads/manchester-derby-sa/keyword-planner-english-sa-2026-08-26.json"

campaign = json.loads(CAMPAIGN.read_text(encoding="utf-8"))
analysis = json.loads(ANALYSIS.read_text(encoding="utf-8"))

for group in campaign.get("ad_groups", []):
    if group.get("name") == "EN_EVENT_HIGH_INTENT":
        group["keywords"]["exact"] = analysis["recommended_first_test_exact"]
        group["keywords"]["phrase"] = analysis["recommended_first_test_phrase"]
        group["draft_max_cpc_usd"] = analysis["bidding_recommendation"]["campaign_default_max_cpc_usd"]
        group["keyword_planner_review"] = {
            "status": "COMPLETE_2026-08-26",
            "market": "Saudi Arabia",
            "language": "English",
            "source_file": "keyword-planner-english-sa-2026-08-26.json"
        }
        break
else:
    raise SystemExit("EN_EVENT_HIGH_INTENT ad group not found")

campaign.setdefault("launch_gates", {})["keyword_planner_english_review_completed"] = True
campaign["launch_gates"]["keyword_planner_arabic_review_completed"] = False
campaign["launch_gates"]["keyword_planner_review_completed"] = False
campaign["draft_version"] = "2026-08-26-v3-english-planner"

CAMPAIGN.write_text(json.dumps(campaign, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Applied Saudi English Keyword Planner shortlist to campaign draft.")
