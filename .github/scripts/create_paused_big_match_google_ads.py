#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

CFG = Path('marketing/google-ads/big-matches-gcc/campaign.json')
AR = re.compile(r'[\u0600-\u06FF]')

GEO_TARGETS = {
    'Saudi Arabia': ('SA', '2682'),
    'United Arab Emirates': ('AE', '2784'),
    'Oman': ('OM', '2512'),
    'Qatar': ('QA', '2634'),
    'Kuwait': ('KW', '2414'),
    'Bahrain': ('BH', '2048'),
}
LANGUAGE_TARGETS = {'English': '1000', 'Arabic': '1019'}

AD_COPY = {
    'manchester_derby': {
        'EN': [
            'Manchester Derby Tickets', 'Man Utd v Man City Tickets',
            'Compare Derby Ticket Offers', 'Old Trafford Ticket Options',
            'Check Seats Before Booking', 'Compare Ticket Sellers',
        ],
        'AR': [
            'تذاكر ديربي مانشستر', 'يونايتد ضد مانشستر سيتي',
            'قارن عروض تذاكر الديربي', 'خيارات تذاكر أولد ترافورد',
            'تحقق من المقعد قبل الحجز', 'قارن بين مواقع التذاكر',
        ],
    },
    'liverpool_manunited': {
        'EN': [
            'Liverpool v Man Utd Tickets', 'Liverpool Man Utd Tickets',
            'Compare Match Ticket Offers', 'Anfield Ticket Options',
            'Check Seats Before Booking', 'Compare Ticket Sellers',
        ],
        'AR': [
            'تذاكر ليفربول ويونايتد', 'ليفربول ضد مانشستر يونايتد',
            'قارن عروض تذاكر المباراة', 'خيارات تذاكر أنفيلد',
            'تحقق من المقعد قبل الحجز', 'قارن بين مواقع التذاكر',
        ],
    },
    'el_clasico': {
        'EN': [
            'El Clasico Tickets', 'Barcelona v Real Tickets',
            'Compare Clasico Ticket Offers', 'Camp Nou Ticket Options',
            'Check Seats Before Booking', 'Compare Ticket Sellers',
        ],
        'AR': [
            'تذاكر الكلاسيكو', 'برشلونة ضد ريال مدريد',
            'قارن عروض تذاكر الكلاسيكو', 'خيارات تذاكر كامب نو',
            'تحقق من المقعد قبل الحجز', 'قارن بين مواقع التذاكر',
        ],
    },
    'madrid_derby': {
        'EN': [
            'Madrid Derby Tickets', 'Atletico v Real Tickets',
            'Compare Derby Ticket Offers', 'Madrid Derby Ticket Options',
            'Check Seats Before Booking', 'Compare Ticket Sellers',
        ],
        'AR': [
            'تذاكر ديربي مدريد', 'أتلتيكو ضد ريال مدريد',
            'قارن عروض تذاكر الديربي', 'خيارات تذاكر ديربي مدريد',
            'تحقق من المقعد قبل الحجز', 'قارن بين مواقع التذاكر',
        ],
    },
    'north_london_derby': {
        'EN': [
            'North London Derby Tickets', 'Tottenham v Arsenal Tickets',
            'Compare Derby Ticket Offers', 'Tottenham Ticket Options',
            'Check Seats Before Booking', 'Compare Ticket Sellers',
        ],
        'AR': [
            'تذاكر ديربي شمال لندن', 'توتنهام ضد أرسنال',
            'قارن عروض تذاكر الديربي', 'خيارات تذاكر توتنهام',
            'تحقق من المقعد قبل الحجز', 'قارن بين مواقع التذاكر',
        ],
    },
    'arsenal_mancity': {
        'EN': [
            'Arsenal v Man City Tickets', 'Arsenal Man City Tickets',
            'Compare Match Ticket Offers', 'Emirates Ticket Options',
            'Check Seats Before Booking', 'Compare Ticket Sellers',
        ],
        'AR': [
            'تذاكر أرسنال ومانشستر سيتي', 'أرسنال ضد مانشستر سيتي',
            'قارن عروض تذاكر المباراة', 'خيارات تذاكر الإمارات',
            'تحقق من المقعد قبل الحجز', 'قارن بين مواقع التذاكر',
        ],
    },
}

DESCRIPTIONS = {
    'EN': [
        'Compare ticket options, seats, prices and fees before visiting the booking site.',
        'TrendPilot is independent. Resale ticket prices may exceed the original face value.',
    ],
    'AR': [
        'قارن خيارات التذاكر والمقاعد والأسعار والرسوم قبل الانتقال إلى موقع الحجز.',
        'TrendPilot موقع مستقل للمقارنة وقد تتجاوز أسعار إعادة البيع القيمة الاسمية.',
    ],
}


def sql_escape(value):
    return str(value).replace('\\', '\\\\').replace("'", "\\'")


def load_cfg():
    data = json.loads(CFG.read_text(encoding='utf-8'))
    assert data['status'] == 'PAUSED', 'Campaign draft must remain PAUSED'
    assert data['network']['search_partners'] is False
    assert data['network']['display_network'] is False
    assert data['geo']['advanced_location_option'] == 'PRESENCE_ONLY'
    assert data['bidding']['strategy'] == 'MANUAL_CPC'
    assert data['bidding']['broad_match'] is False
    assert data['launch_guards']['never_auto_enable'] is True
    assert data.get('account_currency') == 'USD', 'Account currency must be verified before mutation'
    assert set(data['geo']['included']) == set(GEO_TARGETS), 'GCC geo target list changed unexpectedly'
    assert set(data['languages']) == set(LANGUAGE_TARGETS), 'Language target list changed unexpectedly'
    assert len(data['matches']) == 6, 'Expected exactly six match test groups'
    for match in data['matches']:
        assert match['key'] in AD_COPY, f"Missing match-specific RSA copy for {match['key']}"
        assert match['landing_ar'].startswith('https://trendpilotchoice.com/')
        assert match['landing_en'].startswith('https://trendpilotchoice.com/')
    return data


def preview(cfg):
    print('PREVIEW ONLY — no Google Ads mutation')
    print(cfg['name'])
    print('status:', cfg['status'])
    print('account currency:', cfg['account_currency'])
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
    names = [
        'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN',
        'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
    ]
    missing = [n for n in names if not os.getenv(n)]
    if missing:
        raise SystemExit('Missing required GitHub secrets: ' + ', '.join(missing))
    return {n: os.environ[n] for n in names}


def build_client(creds):
    from google.ads.googleads.client import GoogleAdsClient
    return GoogleAdsClient.load_from_dict({
        'developer_token': creds['GOOGLE_ADS_DEVELOPER_TOKEN'],
        'client_id': creds['GOOGLE_ADS_CLIENT_ID'],
        'client_secret': creds['GOOGLE_ADS_CLIENT_SECRET'],
        'refresh_token': creds['GOOGLE_ADS_REFRESH_TOKEN'],
        'login_customer_id': creds['GOOGLE_ADS_LOGIN_CUSTOMER_ID'].replace('-', '').strip(),
        'use_proto_plus': True,
    })


def get_one(service, customer_id, query):
    rows = list(service.search(customer_id=customer_id, query=query))
    return rows[0] if rows else None


def verify_account_and_constants(client, customer_id, cfg):
    ga = client.get_service('GoogleAdsService')
    row = get_one(
        ga, customer_id,
        'SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1'
    )
    if not row:
        raise RuntimeError('Could not read target customer account.')
    if row.customer.currency_code != cfg['account_currency']:
        raise RuntimeError(
            f"Currency mismatch: config={cfg['account_currency']} account={row.customer.currency_code}"
        )
    print('Account guard PASS:', row.customer.currency_code, '|', row.customer.time_zone)

    expected_geo = {code: cid for _, (code, cid) in GEO_TARGETS.items()}
    ids = ', '.join(GEO_TARGETS[name][1] for name in cfg['geo']['included'])
    geo_query = f"""
        SELECT geo_target_constant.id, geo_target_constant.name,
               geo_target_constant.country_code, geo_target_constant.target_type,
               geo_target_constant.status, geo_target_constant.resource_name
        FROM geo_target_constant
        WHERE geo_target_constant.id IN ({ids})
    """
    got_geo = {}
    for r in ga.search(customer_id=customer_id, query=geo_query):
        g = r.geo_target_constant
        got_geo[g.country_code] = str(g.id)
        if str(g.status.name) != 'ENABLED' or str(g.target_type).lower() != 'country':
            raise RuntimeError(f'Geo target not safely targetable: {g.name} / {g.status.name} / {g.target_type}')
    if got_geo != expected_geo:
        raise RuntimeError(f'Geo constant verification failed: {got_geo}')
    print('GCC geo constants PASS:', ', '.join(sorted(got_geo)))

    ids = ', '.join(LANGUAGE_TARGETS[name] for name in cfg['languages'])
    lang_query = f"""
        SELECT language_constant.id, language_constant.name,
               language_constant.code, language_constant.targetable,
               language_constant.resource_name
        FROM language_constant
        WHERE language_constant.id IN ({ids})
    """
    got_lang = {}
    for r in ga.search(customer_id=customer_id, query=lang_query):
        lang = r.language_constant
        if not lang.targetable:
            raise RuntimeError(f'Language is not targetable: {lang.name}')
        got_lang[str(lang.id)] = lang.code
    if set(got_lang) != set(LANGUAGE_TARGETS.values()):
        raise RuntimeError(f'Language constant verification failed: {got_lang}')
    print('Language constants PASS:', got_lang)


def get_or_create_budget(client, customer_id, cfg):
    ga = client.get_service('GoogleAdsService')
    name = cfg['name'] + ' | Budget'
    q = f"""
        SELECT campaign_budget.resource_name, campaign_budget.name,
               campaign_budget.amount_micros, campaign_budget.status
        FROM campaign_budget
        WHERE campaign_budget.name = '{sql_escape(name)}'
          AND campaign_budget.status != 'REMOVED'
        LIMIT 1
    """
    row = get_one(ga, customer_id, q)
    wanted = int(cfg['budget']['average_daily_usd'] * 1_000_000)
    if row:
        budget = row.campaign_budget
        if int(budget.amount_micros) != wanted:
            raise RuntimeError(
                f'Existing budget amount mismatch. Found {budget.amount_micros}, expected {wanted}. '
                'Failing closed instead of changing money settings.'
            )
        print('Reusing existing safe budget:', budget.resource_name)
        return budget.resource_name

    svc = client.get_service('CampaignBudgetService')
    op = client.get_type('CampaignBudgetOperation')
    budget = op.create
    budget.name = name
    budget.amount_micros = wanted
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.explicitly_shared = False
    res = svc.mutate_campaign_budgets(customer_id=customer_id, operations=[op])
    print('Created campaign budget resource (campaign still PAUSED/not yet created).')
    return res.results[0].resource_name


def get_or_create_campaign(client, customer_id, cfg, budget_resource):
    ga = client.get_service('GoogleAdsService')
    q = f"""
        SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status,
               campaign.advertising_channel_type,
               campaign.geo_target_type_setting.positive_geo_target_type,
               campaign.network_settings.target_google_search,
               campaign.network_settings.target_search_network,
               campaign.network_settings.target_content_network,
               campaign.network_settings.target_partner_search_network
        FROM campaign
        WHERE campaign.name = '{sql_escape(cfg['name'])}'
          AND campaign.status != 'REMOVED'
        LIMIT 1
    """
    row = get_one(ga, customer_id, q)
    if row:
        camp = row.campaign
        if camp.status.name != 'PAUSED':
            raise RuntimeError(f'Existing campaign is not PAUSED: {camp.status.name}')
        if camp.advertising_channel_type.name != 'SEARCH':
            raise RuntimeError('Existing campaign is not Search.')
        print('Reusing existing PAUSED campaign:', camp.id)
        return camp.resource_name

    svc = client.get_service('CampaignService')
    op = client.get_type('CampaignOperation')
    camp = op.create
    camp.name = cfg['name']
    camp.status = client.enums.CampaignStatusEnum.PAUSED
    camp.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    camp.campaign_budget = budget_resource
    camp.manual_cpc.enhanced_cpc_enabled = False
    camp.network_settings.target_google_search = True
    camp.network_settings.target_search_network = False
    camp.network_settings.target_content_network = False
    camp.network_settings.target_partner_search_network = False
    camp.contains_eu_political_advertising = (
        client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    )
    camp.geo_target_type_setting.positive_geo_target_type = client.enums.PositiveGeoTargetTypeEnum.PRESENCE
    camp.geo_target_type_setting.negative_geo_target_type = client.enums.NegativeGeoTargetTypeEnum.PRESENCE
    camp.final_url_suffix = cfg['tracking']['final_url_suffix']
    res = svc.mutate_campaigns(customer_id=customer_id, operations=[op])
    print('Created PAUSED Search campaign:', res.results[0].resource_name)
    return res.results[0].resource_name


def ensure_campaign_targeting(client, customer_id, campaign_resource, cfg):
    ga = client.get_service('GoogleAdsService')
    campaign_id = campaign_resource.rsplit('/', 1)[-1]
    existing_locations = set()
    q = f"""
        SELECT campaign_criterion.location.geo_target_constant
        FROM campaign_criterion
        WHERE campaign.id = {campaign_id}
          AND campaign_criterion.type = 'LOCATION'
          AND campaign_criterion.negative = FALSE
    """
    for r in ga.search(customer_id=customer_id, query=q):
        existing_locations.add(r.campaign_criterion.location.geo_target_constant)

    existing_languages = set()
    q = f"""
        SELECT campaign_criterion.language.language_constant
        FROM campaign_criterion
        WHERE campaign.id = {campaign_id}
          AND campaign_criterion.type = 'LANGUAGE'
          AND campaign_criterion.negative = FALSE
    """
    for r in ga.search(customer_id=customer_id, query=q):
        existing_languages.add(r.campaign_criterion.language.language_constant)

    ops = []
    for name in cfg['geo']['included']:
        resource = f"geoTargetConstants/{GEO_TARGETS[name][1]}"
        if resource not in existing_locations:
            op = client.get_type('CampaignCriterionOperation')
            c = op.create
            c.campaign = campaign_resource
            c.location.geo_target_constant = resource
            c.negative = False
            ops.append(op)

    for name in cfg['languages']:
        resource = f"languageConstants/{LANGUAGE_TARGETS[name]}"
        if resource not in existing_languages:
            op = client.get_type('CampaignCriterionOperation')
            c = op.create
            c.campaign = campaign_resource
            c.language.language_constant = resource
            c.negative = False
            ops.append(op)

    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops
        )
    print('Targeting ensured: 6 GCC countries + Arabic/English.')


def ensure_ad_group(client, customer_id, campaign_resource, match, lang):
    ga = client.get_service('GoogleAdsService')
    campaign_id = campaign_resource.rsplit('/', 1)[-1]
    name = f"{match['key']} | {lang}"
    q = f"""
        SELECT ad_group.resource_name, ad_group.id, ad_group.name, ad_group.status,
               ad_group.cpc_bid_micros
        FROM ad_group
        WHERE campaign.id = {campaign_id}
          AND ad_group.name = '{sql_escape(name)}'
          AND ad_group.status != 'REMOVED'
        LIMIT 1
    """
    row = get_one(ga, customer_id, q)
    wanted = int(match['max_cpc_usd'] * 1_000_000)
    if row:
        ag = row.ad_group
        if ag.status.name != 'PAUSED':
            raise RuntimeError(f'Ad group {name} is not PAUSED.')
        if int(ag.cpc_bid_micros) != wanted:
            raise RuntimeError(f'Ad group bid mismatch for {name}; failing closed.')
        return ag.resource_name

    svc = client.get_service('AdGroupService')
    op = client.get_type('AdGroupOperation')
    ag = op.create
    ag.name = name
    ag.campaign = campaign_resource
    ag.status = client.enums.AdGroupStatusEnum.PAUSED
    ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ag.cpc_bid_micros = wanted
    res = svc.mutate_ad_groups(customer_id=customer_id, operations=[op])
    print('Created PAUSED ad group:', name)
    return res.results[0].resource_name


def ensure_keywords(client, customer_id, ad_group_resource, match, lang):
    ga = client.get_service('GoogleAdsService')
    ad_group_id = ad_group_resource.rsplit('/', 1)[-1]
    existing = set()
    q = f"""
        SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               ad_group_criterion.status
        FROM keyword_view
        WHERE ad_group.id = {ad_group_id}
          AND ad_group_criterion.negative = FALSE
          AND ad_group_criterion.status != 'REMOVED'
    """
    for r in ga.search(customer_id=customer_id, query=q):
        existing.add((r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name))

    terms = []
    for text in match['keywords_exact']:
        if bool(AR.search(text)) == (lang == 'AR'):
            terms.append((text, client.enums.KeywordMatchTypeEnum.EXACT, 'EXACT'))
    for text in match['keywords_phrase']:
        if bool(AR.search(text)) == (lang == 'AR'):
            terms.append((text, client.enums.KeywordMatchTypeEnum.PHRASE, 'PHRASE'))

    ops = []
    for text, enum_value, enum_name in terms:
        if (text.lower(), enum_name) in existing:
            continue
        op = client.get_type('AdGroupCriterionOperation')
        crit = op.create
        crit.ad_group = ad_group_resource
        crit.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
        crit.keyword.text = text
        crit.keyword.match_type = enum_value
        crit.cpc_bid_micros = int(match['max_cpc_usd'] * 1_000_000)
        ops.append(op)
    if ops:
        client.get_service('AdGroupCriterionService').mutate_ad_group_criteria(
            customer_id=customer_id, operations=ops
        )


def ensure_rsa(client, customer_id, ad_group_resource, match, lang):
    ga = client.get_service('GoogleAdsService')
    ad_group_id = ad_group_resource.rsplit('/', 1)[-1]
    q = f"""
        SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.type
        FROM ad_group_ad
        WHERE ad_group.id = {ad_group_id}
          AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
          AND ad_group_ad.status != 'REMOVED'
        LIMIT 1
    """
    row = get_one(ga, customer_id, q)
    if row:
        if row.ad_group_ad.status.name != 'PAUSED':
            raise RuntimeError(f'Existing RSA in {match["key"]} {lang} is not PAUSED.')
        return

    op = client.get_type('AdGroupAdOperation')
    aga = op.create
    aga.ad_group = ad_group_resource
    aga.status = client.enums.AdGroupAdStatusEnum.PAUSED
    ad = aga.ad
    ad.final_urls.append(match['landing_ar'] if lang == 'AR' else match['landing_en'])
    rsa = ad.responsive_search_ad
    for text in AD_COPY[match['key']][lang]:
        if len(text) > 30:
            raise RuntimeError(f'RSA headline too long ({len(text)}): {text}')
        asset = client.get_type('AdTextAsset')
        asset.text = text
        rsa.headlines.append(asset)
    for text in DESCRIPTIONS[lang]:
        if len(text) > 90:
            raise RuntimeError(f'RSA description too long ({len(text)}): {text}')
        asset = client.get_type('AdTextAsset')
        asset.text = text
        rsa.descriptions.append(asset)
    client.get_service('AdGroupAdService').mutate_ad_group_ads(
        customer_id=customer_id, operations=[op]
    )
    print('Created PAUSED RSA:', match['key'], lang)


def ensure_negatives(client, customer_id, campaign_resource, cfg):
    ga = client.get_service('GoogleAdsService')
    campaign_id = campaign_resource.rsplit('/', 1)[-1]
    existing = set()
    q = f"""
        SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
        FROM campaign_criterion
        WHERE campaign.id = {campaign_id}
          AND campaign_criterion.type = 'KEYWORD'
          AND campaign_criterion.negative = TRUE
    """
    for r in ga.search(customer_id=customer_id, query=q):
        existing.add(r.campaign_criterion.keyword.text.lower())
    ops = []
    for text in cfg['campaign_negatives']:
        if text.lower() in existing:
            continue
        op = client.get_type('CampaignCriterionOperation')
        c = op.create
        c.campaign = campaign_resource
        c.negative = True
        c.keyword.text = text
        c.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops
        )
    print('Campaign negative keyword guard ensured:', len(cfg['campaign_negatives']))


def final_audit(client, customer_id, cfg):
    ga = client.get_service('GoogleAdsService')
    q = f"""
        SELECT campaign.id, campaign.status, campaign.advertising_channel_type,
               campaign.geo_target_type_setting.positive_geo_target_type,
               campaign.network_settings.target_google_search,
               campaign.network_settings.target_search_network,
               campaign.network_settings.target_content_network,
               campaign.network_settings.target_partner_search_network
        FROM campaign
        WHERE campaign.name = '{sql_escape(cfg['name'])}'
          AND campaign.status != 'REMOVED'
        LIMIT 1
    """
    row = get_one(ga, customer_id, q)
    if not row:
        raise RuntimeError('Final audit: campaign not found.')
    c = row.campaign
    checks = [
        c.status.name == 'PAUSED',
        c.advertising_channel_type.name == 'SEARCH',
        c.geo_target_type_setting.positive_geo_target_type.name == 'PRESENCE',
        c.network_settings.target_google_search is True,
        c.network_settings.target_search_network is False,
        c.network_settings.target_content_network is False,
        c.network_settings.target_partner_search_network is False,
    ]
    if not all(checks):
        raise RuntimeError('Final audit: campaign-level safety setting mismatch.')
    cid = c.id

    geo_rows = list(ga.search(customer_id=customer_id, query=f"""
        SELECT campaign_criterion.location.geo_target_constant
        FROM campaign_criterion
        WHERE campaign.id = {cid}
          AND campaign_criterion.type = 'LOCATION'
          AND campaign_criterion.negative = FALSE
    """))
    lang_rows = list(ga.search(customer_id=customer_id, query=f"""
        SELECT campaign_criterion.language.language_constant
        FROM campaign_criterion
        WHERE campaign.id = {cid}
          AND campaign_criterion.type = 'LANGUAGE'
          AND campaign_criterion.negative = FALSE
    """))
    ag_rows = list(ga.search(customer_id=customer_id, query=f"""
        SELECT ad_group.id, ad_group.status
        FROM ad_group
        WHERE campaign.id = {cid} AND ad_group.status != 'REMOVED'
    """))
    ad_rows = list(ga.search(customer_id=customer_id, query=f"""
        SELECT ad_group_ad.status
        FROM ad_group_ad
        WHERE campaign.id = {cid} AND ad_group_ad.status != 'REMOVED'
    """))
    kw_rows = list(ga.search(customer_id=customer_id, query=f"""
        SELECT ad_group_criterion.status, ad_group_criterion.keyword.match_type
        FROM keyword_view
        WHERE campaign.id = {cid} AND ad_group_criterion.status != 'REMOVED'
    """))
    if len(geo_rows) != 6 or len(lang_rows) != 2:
        raise RuntimeError(f'Final audit: expected 6 geo + 2 language, got {len(geo_rows)} + {len(lang_rows)}')
    if len(ag_rows) != 12 or any(r.ad_group.status.name != 'PAUSED' for r in ag_rows):
        raise RuntimeError(f'Final audit: expected 12 PAUSED ad groups, got {len(ag_rows)}')
    if len(ad_rows) != 12 or any(r.ad_group_ad.status.name != 'PAUSED' for r in ad_rows):
        raise RuntimeError(f'Final audit: expected 12 PAUSED ads, got {len(ad_rows)}')
    if not kw_rows or any(r.ad_group_criterion.status.name != 'PAUSED' for r in kw_rows):
        raise RuntimeError('Final audit: a keyword is missing or not PAUSED.')
    bad_match = [r for r in kw_rows if r.ad_group_criterion.keyword.match_type.name not in ('EXACT', 'PHRASE')]
    if bad_match:
        raise RuntimeError('Final audit: non-Exact/Phrase keyword detected.')
    print('FINAL SAFETY AUDIT PASS')
    print('Campaign: PAUSED | Search only | Presence only | Search Partners OFF | Display OFF')
    print(f'Targets: {len(geo_rows)} GCC countries | Languages: {len(lang_rows)}')
    print(f'Ad groups: {len(ag_rows)} PAUSED | RSAs: {len(ad_rows)} PAUSED | Keywords: {len(kw_rows)} PAUSED')
    print('NO ENABLE OPERATION EXISTS IN THIS SCRIPT.')


def create_paused(cfg):
    creds = require_env()
    client = build_client(creds)
    customer_id = creds['GOOGLE_ADS_CUSTOMER_ID'].replace('-', '').strip()
    verify_account_and_constants(client, customer_id, cfg)
    budget_resource = get_or_create_budget(client, customer_id, cfg)
    campaign_resource = get_or_create_campaign(client, customer_id, cfg, budget_resource)
    ensure_campaign_targeting(client, customer_id, campaign_resource, cfg)
    for match in cfg['matches']:
        for lang in ('EN', 'AR'):
            ad_group_resource = ensure_ad_group(client, customer_id, campaign_resource, match, lang)
            ensure_keywords(client, customer_id, ad_group_resource, match, lang)
            ensure_rsa(client, customer_id, ad_group_resource, match, lang)
    ensure_negatives(client, customer_id, campaign_resource, cfg)
    final_audit(client, customer_id, cfg)


if __name__ == '__main__':
    cfg = load_cfg()
    mode = (sys.argv[1] if len(sys.argv) > 1 else 'preview').lower()
    if mode == 'preview':
        preview(cfg)
    elif mode == 'create-paused':
        create_paused(cfg)
    else:
        raise SystemExit('Mode must be preview or create-paused')
