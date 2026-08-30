#!/usr/bin/env python3
import os
import sys
import urllib.request

CAMPAIGN_NAME = 'TrendPilot | RO Bosch GBH2 Parts | Search | Pilot'
BUDGET_USD = 2.00
MAX_CPC_USD = 0.15
MAX_ALLOWED_CPC_USD = 0.25
LANDING_URL = 'https://trendpilotchoice.com/rare-products/bosch-gbh2-chuck/ro/'
ROMANIA_GEO_ID = '2642'
ROMANIAN_LANGUAGE_ID = '1032'

EXACT_KEYWORDS = [
    'bosch gbh 2-20 chuck',
    'bosch gbh 2-24 chuck',
    'bosch gbh 2-26 chuck',
    'gbh 2-26 chuck replacement',
    'mandrina bosch gbh 2-20',
    'mandrina bosch gbh 2-24',
    'mandrina bosch gbh 2-26',
    'mandrina sds gbh 2-26',
]
PHRASE_KEYWORDS = [
    'bosch gbh 2-26 chuck replacement',
    'gbh 2-24 chuck replacement',
    'mandrina bosch gbh 2-26',
    'mandrina sds gbh 2-24',
]
NEGATIVES = ['free', 'manual', 'pdf', 'diagram', 'schematic', 'service manual']

HEADLINES = [
    'Mandrina SDS pentru GBH2',
    'Verifica modelul exact',
    'GBH2-20 24 26 compatibil',
    'Vezi oferta actuala',
    'Verifica livrarea in RO',
    'Piesa pentru modele GBH2',
]
DESCRIPTIONS = [
    'Verifica piesa listata pentru GBH2-20, GBH2-24 si GBH2-26 inainte de comanda.',
    'Vezi oferta exacta si confirma pretul, stocul si livrarea in Romania la vanzator.',
]


def require_env():
    required = [
        'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN',
        'GOOGLE_ADS_CUSTOMER_ID',
    ]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise SystemExit('Missing required Google Ads secrets: ' + ', '.join(missing))
    return {name: os.environ[name] for name in required}


def verify_live_landing():
    req = urllib.request.Request(
        LANDING_URL,
        headers={
            'User-Agent': 'Mozilla/5.0 TrendPilot-GoogleAds-Preflight/1.0',
            'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.7',
            'Cache-Control': 'no-cache',
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read(700000).decode('utf-8', 'replace')
        checks = {
            'http_200': r.status == 200,
            'romanian_title': 'Mandrină SDS compatibilă' in raw,
            'models': all(x in raw for x in ('GBH2', '20', '24', '26')),
            'exact_item': '1005011859163692' in raw,
            'outbound_tracking': 'data-tp-outbound' in raw,
            'affiliate_disclosure': 'comision' in raw.lower(),
        }
        print('LANDING_FINAL_URL', r.geturl())
        for key, value in checks.items():
            print('LANDING_CHECK', key, value)
        if not all(checks.values()):
            raise SystemExit('Safety stop: live Romania landing failed preflight')


def build_client(creds):
    from google.ads.googleads.client import GoogleAdsClient
    cfg = {
        'developer_token': creds['GOOGLE_ADS_DEVELOPER_TOKEN'],
        'client_id': creds['GOOGLE_ADS_CLIENT_ID'],
        'client_secret': creds['GOOGLE_ADS_CLIENT_SECRET'],
        'refresh_token': creds['GOOGLE_ADS_REFRESH_TOKEN'],
        'use_proto_plus': True,
    }
    login_id = os.getenv('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '').replace('-', '').strip()
    if login_id:
        cfg['login_customer_id'] = login_id
    return GoogleAdsClient.load_from_dict(cfg)


def get_one(ga, customer_id, query):
    rows = list(ga.search(customer_id=customer_id, query=query))
    return rows[0] if rows else None


def verify_constants(client, customer_id):
    ga = client.get_service('GoogleAdsService')
    acct = get_one(ga, customer_id, 'SELECT customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1')
    if not acct:
        raise SystemExit('Safety stop: target Google Ads customer could not be read')
    print('ACCOUNT', acct.customer.descriptive_name, acct.customer.currency_code, acct.customer.time_zone)
    if acct.customer.currency_code != 'USD':
        raise SystemExit('Safety stop: expected USD Google Ads account')

    geo = get_one(ga, customer_id, f"SELECT geo_target_constant.id, geo_target_constant.name, geo_target_constant.country_code, geo_target_constant.target_type, geo_target_constant.status FROM geo_target_constant WHERE geo_target_constant.id = {ROMANIA_GEO_ID} LIMIT 1")
    if not geo or geo.geo_target_constant.country_code != 'RO' or geo.geo_target_constant.status.name != 'ENABLED':
        raise SystemExit('Safety stop: Romania geo constant verification failed')
    print('GEO_OK', geo.geo_target_constant.id, geo.geo_target_constant.name, geo.geo_target_constant.country_code)

    lang = get_one(ga, customer_id, f"SELECT language_constant.id, language_constant.name, language_constant.code, language_constant.targetable FROM language_constant WHERE language_constant.id = {ROMANIAN_LANGUAGE_ID} LIMIT 1")
    if not lang or not lang.language_constant.targetable or lang.language_constant.code != 'ro':
        raise SystemExit('Safety stop: Romanian language constant verification failed')
    print('LANGUAGE_OK', lang.language_constant.id, lang.language_constant.name, lang.language_constant.code)


def create_paused(client, customer_id):
    ga = client.get_service('GoogleAdsService')
    safe_name = CAMPAIGN_NAME.replace("'", "\\'")
    existing = get_one(ga, customer_id, f"SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = '{safe_name}' AND campaign.status != 'REMOVED' LIMIT 1")
    if existing:
        print('EXISTING_CAMPAIGN', existing.campaign.id, existing.campaign.status.name)
        if existing.campaign.status.name != 'PAUSED':
            raise SystemExit('Safety stop: existing campaign with this name is not PAUSED')
        return str(existing.campaign.id)

    budget_service = client.get_service('CampaignBudgetService')
    budget_op = client.get_type('CampaignBudgetOperation')
    budget = budget_op.create
    budget.name = CAMPAIGN_NAME + ' | Budget'
    budget.amount_micros = int(BUDGET_USD * 1_000_000)
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.explicitly_shared = False
    budget_result = budget_service.mutate_campaign_budgets(customer_id=customer_id, operations=[budget_op])
    budget_resource = budget_result.results[0].resource_name

    campaign_service = client.get_service('CampaignService')
    campaign_op = client.get_type('CampaignOperation')
    campaign = campaign_op.create
    campaign.name = CAMPAIGN_NAME
    campaign.status = client.enums.CampaignStatusEnum.PAUSED
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    campaign.campaign_budget = budget_resource
    campaign.manual_cpc.enhanced_cpc_enabled = False
    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = False
    campaign.network_settings.target_content_network = False
    campaign.network_settings.target_partner_search_network = False
    campaign.contains_eu_political_advertising = client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    campaign.geo_target_type_setting.positive_geo_target_type = client.enums.PositiveGeoTargetTypeEnum.PRESENCE
    campaign.geo_target_type_setting.negative_geo_target_type = client.enums.NegativeGeoTargetTypeEnum.PRESENCE
    campaign.final_url_suffix = 'utm_source=google&utm_medium=cpc&utm_campaign=tp_ro_bosch_gbh2_rare&utm_term={keyword}&utm_content={adgroupid}-{creative}&device={device}&matchtype={matchtype}'
    campaign_result = campaign_service.mutate_campaigns(customer_id=customer_id, operations=[campaign_op])
    campaign_resource = campaign_result.results[0].resource_name
    campaign_id = campaign_resource.rsplit('/', 1)[-1]
    print('CREATED_PAUSED_CAMPAIGN', campaign_id)

    criterion_service = client.get_service('CampaignCriterionService')
    target_ops = []
    geo_op = client.get_type('CampaignCriterionOperation')
    geo = geo_op.create
    geo.campaign = campaign_resource
    geo.location.geo_target_constant = client.get_service('GeoTargetConstantService').geo_target_constant_path(ROMANIA_GEO_ID)
    target_ops.append(geo_op)
    lang_op = client.get_type('CampaignCriterionOperation')
    lang = lang_op.create
    lang.campaign = campaign_resource
    lang.language.language_constant = client.get_service('LanguageConstantService').language_constant_path(ROMANIAN_LANGUAGE_ID)
    target_ops.append(lang_op)
    criterion_service.mutate_campaign_criteria(customer_id=customer_id, operations=target_ops)

    ad_group_service = client.get_service('AdGroupService')
    ag_op = client.get_type('AdGroupOperation')
    ag = ag_op.create
    ag.name = 'GBH2 Chuck Replacement | RO'
    ag.campaign = campaign_resource
    ag.status = client.enums.AdGroupStatusEnum.PAUSED
    ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ag.cpc_bid_micros = int(MAX_CPC_USD * 1_000_000)
    ag_result = ad_group_service.mutate_ad_groups(customer_id=customer_id, operations=[ag_op])
    ad_group_resource = ag_result.results[0].resource_name

    keyword_service = client.get_service('AdGroupCriterionService')
    kw_ops = []
    for text, match_type in [(x, client.enums.KeywordMatchTypeEnum.EXACT) for x in EXACT_KEYWORDS] + [(x, client.enums.KeywordMatchTypeEnum.PHRASE) for x in PHRASE_KEYWORDS]:
        op = client.get_type('AdGroupCriterionOperation')
        kw = op.create
        kw.ad_group = ad_group_resource
        kw.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
        kw.keyword.text = text
        kw.keyword.match_type = match_type
        kw.cpc_bid_micros = int(MAX_CPC_USD * 1_000_000)
        kw_ops.append(op)
    keyword_service.mutate_ad_group_criteria(customer_id=customer_id, operations=kw_ops)

    ad_service = client.get_service('AdGroupAdService')
    ad_op = client.get_type('AdGroupAdOperation')
    aga = ad_op.create
    aga.ad_group = ad_group_resource
    aga.status = client.enums.AdGroupAdStatusEnum.PAUSED
    aga.ad.final_urls.append(LANDING_URL)
    rsa = aga.ad.responsive_search_ad
    for text in HEADLINES:
        asset = client.get_type('AdTextAsset')
        asset.text = text[:30]
        rsa.headlines.append(asset)
    for text in DESCRIPTIONS:
        asset = client.get_type('AdTextAsset')
        asset.text = text[:90]
        rsa.descriptions.append(asset)
    ad_service.mutate_ad_group_ads(customer_id=customer_id, operations=[ad_op])

    neg_ops = []
    for text in NEGATIVES:
        op = client.get_type('CampaignCriterionOperation')
        neg = op.create
        neg.campaign = campaign_resource
        neg.negative = True
        neg.keyword.text = text
        neg.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        neg_ops.append(op)
    criterion_service.mutate_campaign_criteria(customer_id=customer_id, operations=neg_ops)
    return campaign_id


def verify_created(client, customer_id, campaign_id):
    ga = client.get_service('GoogleAdsService')
    q = f"""
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
             campaign.network_settings.target_google_search,
             campaign.network_settings.target_search_network,
             campaign.network_settings.target_content_network,
             campaign.network_settings.target_partner_search_network,
             campaign.geo_target_type_setting.positive_geo_target_type,
             campaign_budget.amount_micros,
             campaign.bidding_strategy_type
      FROM campaign
      WHERE campaign.id = {campaign_id}
    """
    row = get_one(ga, customer_id, q)
    if not row:
        raise SystemExit('Safety stop: created campaign cannot be read back')
    c = row.campaign
    b = row.campaign_budget
    print('VERIFY_CAMPAIGN', c.id, c.status.name, c.advertising_channel_type.name, c.bidding_strategy_type.name, b.amount_micros)
    guards = [
        c.status.name == 'PAUSED',
        c.advertising_channel_type.name == 'SEARCH',
        c.network_settings.target_google_search is True,
        c.network_settings.target_search_network is False,
        c.network_settings.target_content_network is False,
        c.network_settings.target_partner_search_network is False,
        int(b.amount_micros) == int(BUDGET_USD * 1_000_000),
    ]
    if not all(guards):
        raise SystemExit('Safety stop: campaign safety verification failed')

    kw_rows = list(ga.search(customer_id=customer_id, query=f"SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.cpc_bid_micros FROM keyword_view WHERE campaign.id = {campaign_id}"))
    ad_rows = list(ga.search(customer_id=customer_id, query=f"SELECT ad_group_ad.status FROM ad_group_ad WHERE campaign.id = {campaign_id} AND ad_group_ad.status != 'REMOVED'"))
    ag_rows = list(ga.search(customer_id=customer_id, query=f"SELECT ad_group.status, ad_group.cpc_bid_micros FROM ad_group WHERE campaign.id = {campaign_id} AND ad_group.status != 'REMOVED'"))
    print('VERIFY_COUNTS', 'keywords', len(kw_rows), 'ads', len(ad_rows), 'adgroups', len(ag_rows))
    if len(kw_rows) != len(EXACT_KEYWORDS) + len(PHRASE_KEYWORDS) or len(ad_rows) != 1 or len(ag_rows) != 1:
        raise SystemExit('Safety stop: unexpected campaign child counts')
    if any(r.ad_group_criterion.status.name != 'PAUSED' or int(r.ad_group_criterion.cpc_bid_micros) > int(MAX_ALLOWED_CPC_USD * 1_000_000) for r in kw_rows):
        raise SystemExit('Safety stop: keyword status/bid guard failed')
    if any(r.ad_group_ad.status.name != 'PAUSED' for r in ad_rows):
        raise SystemExit('Safety stop: ad is not PAUSED')
    if any(r.ad_group.status.name != 'PAUSED' or int(r.ad_group.cpc_bid_micros) > int(MAX_ALLOWED_CPC_USD * 1_000_000) for r in ag_rows):
        raise SystemExit('Safety stop: ad group status/bid guard failed')
    print('PAUSED_PILOT_READY', campaign_id)
    print('NO_ENABLE_OPERATION_EXISTS_IN_THIS_SCRIPT')


def main():
    verify_live_landing()
    creds = require_env()
    client = build_client(creds)
    customer_id = creds['GOOGLE_ADS_CUSTOMER_ID'].replace('-', '').strip()
    verify_constants(client, customer_id)
    campaign_id = create_paused(client, customer_id)
    verify_created(client, customer_id, campaign_id)


if __name__ == '__main__':
    main()
