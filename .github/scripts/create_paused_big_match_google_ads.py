#!/usr/bin/env python3
import json, os, re, sys
from pathlib import Path

CFG = Path('marketing/google-ads/big-matches-gcc/campaign.json')
AR = re.compile(r'[\u0600-\u06FF]')


def load_cfg():
    data = json.loads(CFG.read_text(encoding='utf-8'))
    assert data['status'] == 'PAUSED', 'Campaign draft must remain PAUSED'
    assert data['network']['search_partners'] is False
    assert data['network']['display_network'] is False
    assert data['geo']['advanced_location_option'] == 'PRESENCE_ONLY'
    assert data['bidding']['strategy'] == 'MANUAL_CPC'
    assert data['bidding']['broad_match'] is False
    assert data['launch_guards']['never_auto_enable'] is True
    return data


def preview(cfg):
    print('PREVIEW ONLY — no Google Ads mutation')
    print(cfg['name'])
    print('status:', cfg['status'])
    print('daily budget USD:', cfg['budget']['average_daily_usd'])
    print('default max CPC USD:', cfg['bidding']['campaign_default_max_cpc_usd'])
    print('search partners:', cfg['network']['search_partners'])
    print('display:', cfg['network']['display_network'])
    print('geo:', ', '.join(cfg['geo']['included']), '| PRESENCE_ONLY')
    for m in cfg['matches']:
        ar = [k for k in m['keywords_exact'] + m['keywords_phrase'] if AR.search(k)]
        en = [k for k in m['keywords_exact'] + m['keywords_phrase'] if not AR.search(k)]
        print(f"- {m['label']}: max CPC ${m['max_cpc_usd']:.2f}; EN {len(en)} keywords; AR {len(ar)} keywords")


def require_env():
    names = ['GOOGLE_ADS_DEVELOPER_TOKEN','GOOGLE_ADS_CLIENT_ID','GOOGLE_ADS_CLIENT_SECRET','GOOGLE_ADS_REFRESH_TOKEN','GOOGLE_ADS_CUSTOMER_ID']
    missing = [n for n in names if not os.getenv(n)]
    if missing:
        raise SystemExit('Missing required GitHub secrets: ' + ', '.join(missing))
    return {n: os.environ[n] for n in names}


def create_paused(cfg):
    creds = require_env()
    from google.ads.googleads.client import GoogleAdsClient

    client_cfg = {
        'developer_token': creds['GOOGLE_ADS_DEVELOPER_TOKEN'],
        'client_id': creds['GOOGLE_ADS_CLIENT_ID'],
        'client_secret': creds['GOOGLE_ADS_CLIENT_SECRET'],
        'refresh_token': creds['GOOGLE_ADS_REFRESH_TOKEN'],
        'use_proto_plus': True,
    }
    if os.getenv('GOOGLE_ADS_LOGIN_CUSTOMER_ID'):
        client_cfg['login_customer_id'] = os.environ['GOOGLE_ADS_LOGIN_CUSTOMER_ID'].replace('-', '')
    client = GoogleAdsClient.load_from_dict(client_cfg)
    customer_id = creds['GOOGLE_ADS_CUSTOMER_ID'].replace('-', '')

    # Fail closed if an existing campaign with the same name is present.
    ga_service = client.get_service('GoogleAdsService')
    safe_name = cfg['name'].replace("'", "\\'")
    query = f"SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = '{safe_name}' LIMIT 1"
    existing = list(ga_service.search(customer_id=customer_id, query=query))
    if existing:
        row = existing[0]
        print(f"Existing campaign found: {row.campaign.id} | {row.campaign.status.name}. No duplicate created.")
        return

    budget_service = client.get_service('CampaignBudgetService')
    budget_op = client.get_type('CampaignBudgetOperation')
    budget = budget_op.create
    budget.name = cfg['name'] + ' | Budget'
    budget.amount_micros = int(cfg['budget']['average_daily_usd'] * 1_000_000)
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.explicitly_shared = False
    budget_res = budget_service.mutate_campaign_budgets(customer_id=customer_id, operations=[budget_op])
    budget_resource = budget_res.results[0].resource_name

    camp_service = client.get_service('CampaignService')
    camp_op = client.get_type('CampaignOperation')
    camp = camp_op.create
    camp.name = cfg['name']
    camp.status = client.enums.CampaignStatusEnum.PAUSED
    camp.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    camp.campaign_budget = budget_resource
    camp.manual_cpc.enhanced_cpc_enabled = False
    camp.network_settings.target_google_search = True
    camp.network_settings.target_search_network = False
    camp.network_settings.target_content_network = False
    camp.network_settings.target_partner_search_network = False
    camp_res = camp_service.mutate_campaigns(customer_id=customer_id, operations=[camp_op])
    campaign_resource = camp_res.results[0].resource_name
    print('Created PAUSED campaign:', campaign_resource)

    ag_service = client.get_service('AdGroupService')
    kw_service = client.get_service('AdGroupCriterionService')
    ad_service = client.get_service('AdGroupAdService')

    for m in cfg['matches']:
        for lang in ('EN','AR'):
            terms = []
            for text in m['keywords_exact']:
                if bool(AR.search(text)) == (lang == 'AR'):
                    terms.append((text, client.enums.KeywordMatchTypeEnum.EXACT))
            for text in m['keywords_phrase']:
                if bool(AR.search(text)) == (lang == 'AR'):
                    terms.append((text, client.enums.KeywordMatchTypeEnum.PHRASE))
            if not terms:
                continue

            ag_op = client.get_type('AdGroupOperation')
            ag = ag_op.create
            ag.name = f"{m['key']} | {lang}"
            ag.campaign = campaign_resource
            ag.status = client.enums.AdGroupStatusEnum.PAUSED
            ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
            ag.cpc_bid_micros = int(m['max_cpc_usd'] * 1_000_000)
            ag_res = ag_service.mutate_ad_groups(customer_id=customer_id, operations=[ag_op])
            ag_resource = ag_res.results[0].resource_name

            kw_ops = []
            for text, match_type in terms:
                op = client.get_type('AdGroupCriterionOperation')
                crit = op.create
                crit.ad_group = ag_resource
                crit.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
                crit.keyword.text = text
                crit.keyword.match_type = match_type
                crit.cpc_bid_micros = int(m['max_cpc_usd'] * 1_000_000)
                kw_ops.append(op)
            kw_service.mutate_ad_group_criteria(customer_id=customer_id, operations=kw_ops)

            ad_op = client.get_type('AdGroupAdOperation')
            aga = ad_op.create
            aga.ad_group = ag_resource
            aga.status = client.enums.AdGroupAdStatusEnum.PAUSED
            ad = aga.ad
            ad.final_urls.append(m['landing_ar'] if lang == 'AR' else m['landing_en'])
            rsa = ad.responsive_search_ad
            if lang == 'AR':
                heads = [
                    'قارن تذاكر المباراة', 'اختر عرض التذكرة المناسب', 'تحقق من السعر قبل الدفع',
                    'قارن أكثر من مصدر', 'خيارات تذاكر للمباراة', 'TrendPilot لمقارنة التذاكر'
                ]
                descs = [
                    'قارن خيارات التذاكر وتحقق من السعر والمقعد والرسوم قبل الانتقال إلى موقع الحجز.',
                    'TrendPilot موقع مقارنة مستقل ولا يبيع التذاكر. قد تتجاوز أسعار إعادة البيع القيمة الاسمية.'
                ]
            else:
                heads = [
                    'Compare Match Tickets', 'Check Ticket Options', 'Compare Before You Book',
                    'Review Price Before Paying', 'Ticket Options for This Match', 'TrendPilot Ticket Compare'
                ]
                descs = [
                    'Compare ticket options and check the seat, price and fees before visiting the booking site.',
                    'TrendPilot is an independent comparison site. Resale prices may exceed face value.'
                ]
            for h in heads:
                asset = client.get_type('AdTextAsset'); asset.text = h[:30]; rsa.headlines.append(asset)
            for d in descs:
                asset = client.get_type('AdTextAsset'); asset.text = d[:90]; rsa.descriptions.append(asset)
            ad_service.mutate_ad_group_ads(customer_id=customer_id, operations=[ad_op])
            print('Created PAUSED ad group:', ag.name)

    # Campaign-level negatives.
    neg_ops = []
    campaign_criterion_service = client.get_service('CampaignCriterionService')
    for text in cfg['campaign_negatives']:
        op = client.get_type('CampaignCriterionOperation')
        c = op.create
        c.campaign = campaign_resource
        c.negative = True
        c.keyword.text = text
        c.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        neg_ops.append(op)
    if neg_ops:
        campaign_criterion_service.mutate_campaign_criteria(customer_id=customer_id, operations=neg_ops)

    print('DONE. Campaign, ad groups, ads and keywords remain PAUSED. No enable operation exists in this script.')


if __name__ == '__main__':
    cfg = load_cfg()
    mode = (sys.argv[1] if len(sys.argv) > 1 else 'preview').lower()
    if mode == 'preview': preview(cfg)
    elif mode == 'create-paused': create_paused(cfg)
    else: raise SystemExit('Mode must be preview or create-paused')
