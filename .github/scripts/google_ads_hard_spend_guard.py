#!/usr/bin/env python3
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from google.ads.googleads.client import GoogleAdsClient

CAMPAIGN_ID = 24190034111
CAMPAIGN_NAME = "TrendPilot | GCC Big Matches | Search | 2026"
START_DATE = "2026-08-28"
FINAL_END_DATE_TIME = "2026-12-05 23:59:59"  # customer timezone: Asia/Muscat
DAILY_BUDGET_MAX_MICROS = 5_000_000
# Search campaigns do not provide a true lifetime hard-cap. Pause early to leave
# a buffer for Google Ads reporting/serving latency around the user's $20 target.
STOP_TRIGGER_USD = 18.00
TARGET_TOTAL_USD = 20.00
MUSCAT = ZoneInfo("Asia/Muscat")

# Retire each match's AR/EN ad groups once the match day is over. Manchester has
# a confirmed 19:30 Muscat kick-off, so its cutoff is tighter; the other fixture
# kick-off times were not all officially confirmed when the campaign was built.
MATCH_CUTOFFS = {
    "manchester_derby": datetime(2026, 9, 13, 22, 30, tzinfo=MUSCAT),
    "madrid_derby": datetime(2026, 9, 20, 23, 55, tzinfo=MUSCAT),
    "el_clasico": datetime(2026, 10, 25, 23, 55, tzinfo=MUSCAT),
    "liverpool_manunited": datetime(2026, 11, 21, 23, 55, tzinfo=MUSCAT),
    "arsenal_mancity": datetime(2026, 11, 28, 23, 55, tzinfo=MUSCAT),
    "north_london_derby": datetime(2026, 12, 5, 23, 55, tzinfo=MUSCAT),
}


def client_from_env():
    return GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
        "login_customer_id": os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"].replace("-", "").strip(),
        "use_proto_plus": True,
    })


def pause_campaign(client, cid, reason):
    service = client.get_service("CampaignService")
    op = client.get_type("CampaignOperation")
    op.update.resource_name = service.campaign_path(cid, CAMPAIGN_ID)
    op.update.status = client.enums.CampaignStatusEnum.PAUSED
    op.update_mask.paths.append("status")
    service.mutate_campaigns(customer_id=cid, operations=[op])
    print(f"SAFETY PAUSE: campaign paused. reason={reason}")


def set_end_date(client, cid):
    service = client.get_service("CampaignService")
    op = client.get_type("CampaignOperation")
    op.update.resource_name = service.campaign_path(cid, CAMPAIGN_ID)
    op.update.end_date_time = FINAL_END_DATE_TIME
    op.update_mask.paths.append("end_date_time")
    service.mutate_campaigns(customer_id=cid, operations=[op])
    print("Campaign final end date/time set:", FINAL_END_DATE_TIME, "Asia/Muscat")


def pause_ad_group(client, cid, resource_name, name):
    service = client.get_service("AdGroupService")
    op = client.get_type("AdGroupOperation")
    op.update.resource_name = resource_name
    op.update.status = client.enums.AdGroupStatusEnum.PAUSED
    op.update_mask.paths.append("status")
    service.mutate_ad_groups(customer_id=cid, operations=[op])
    print("Expired match ad group paused:", name)


def main():
    client = client_from_env()
    cid = os.environ["GOOGLE_ADS_CUSTOMER_ID"].replace("-", "").strip()
    ga = client.get_service("GoogleAdsService")

    rows = list(ga.search(customer_id=cid, query=f"""
      SELECT campaign.id, campaign.name, campaign.status,
             campaign.end_date_time, campaign.bidding_strategy_type,
             campaign.network_settings.target_google_search,
             campaign.network_settings.target_search_network,
             campaign.network_settings.target_content_network,
             campaign.network_settings.target_partner_search_network,
             campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.id = {CAMPAIGN_ID}
      LIMIT 1
    """))
    assert len(rows) == 1, "Target campaign not found"
    row = rows[0]
    c = row.campaign
    budget_micros = int(row.campaign_budget.amount_micros)
    assert c.name == CAMPAIGN_NAME, f"Unexpected campaign name: {c.name}"

    # Install an actual campaign end date even while PAUSED.
    if str(c.end_date_time or "") != FINAL_END_DATE_TIME:
        set_end_date(client, cid)

    # Sum campaign cost from creation through today. A date-segmented query is
    # used so the range is explicit and no UI/default reporting window can hide spend.
    today = datetime.now(MUSCAT).date().isoformat()
    cost_rows = list(ga.search(customer_id=cid, query=f"""
      SELECT segments.date, metrics.cost_micros
      FROM campaign
      WHERE campaign.id = {CAMPAIGN_ID}
        AND segments.date BETWEEN '{START_DATE}' AND '{today}'
    """))
    total_cost_micros = sum(int(r.metrics.cost_micros or 0) for r in cost_rows)
    total_cost_usd = total_cost_micros / 1_000_000.0

    # Any configuration drift that could waste money causes a fail-closed pause.
    unsafe_reasons = []
    if budget_micros > DAILY_BUDGET_MAX_MICROS:
        unsafe_reasons.append(f"daily_budget_above_5_usd:{budget_micros/1_000_000:.2f}")
    if c.bidding_strategy_type.name != "MANUAL_CPC":
        unsafe_reasons.append(f"bidding_changed:{c.bidding_strategy_type.name}")
    if c.network_settings.target_google_search is not True:
        unsafe_reasons.append("google_search_off")
    if c.network_settings.target_search_network is True:
        unsafe_reasons.append("search_network_on")
    if c.network_settings.target_content_network is True:
        unsafe_reasons.append("display_on")
    if c.network_settings.target_partner_search_network is True:
        unsafe_reasons.append("search_partners_on")

    if total_cost_usd >= STOP_TRIGGER_USD:
        unsafe_reasons.append(f"spend_guard:{total_cost_usd:.2f}_usd")

    now = datetime.now(MUSCAT)
    if now >= datetime(2026, 12, 5, 23, 59, 59, tzinfo=MUSCAT):
        unsafe_reasons.append("campaign_expired")

    if unsafe_reasons and c.status.name == "ENABLED":
        pause_campaign(client, cid, ",".join(unsafe_reasons))
        campaign_status_after = "PAUSED"
    else:
        campaign_status_after = c.status.name

    # Match-by-match expiry guard. It can only PAUSE; it never enables anything.
    ag_rows = list(ga.search(customer_id=cid, query=f"""
      SELECT ad_group.resource_name, ad_group.name, ad_group.status
      FROM ad_group
      WHERE campaign.id = {CAMPAIGN_ID}
        AND ad_group.status != 'REMOVED'
    """))
    for r in ag_rows:
        name = r.ad_group.name
        key = name.split(" | ", 1)[0]
        cutoff = MATCH_CUTOFFS.get(key)
        if cutoff and now >= cutoff and r.ad_group.status.name == "ENABLED":
            pause_ad_group(client, cid, r.ad_group.resource_name, name)

    print("HARD SPEND GUARD PASS")
    print("Campaign status:", campaign_status_after)
    print("Observed campaign cost: $%.2f" % total_cost_usd)
    print("Early stop trigger: $%.2f (buffer toward $%.2f target)" % (STOP_TRIGGER_USD, TARGET_TOTAL_USD))
    print("Daily budget ceiling invariant: $5.00")
    print("Final campaign end:", FINAL_END_DATE_TIME, "Asia/Muscat")
    print("Guard can PAUSE only. It contains no enable, bid increase, or budget increase operation.")


if __name__ == "__main__":
    main()
