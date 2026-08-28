#!/usr/bin/env python3
import json
import os
from pathlib import Path
from google.ads.googleads.client import GoogleAdsClient

CAMPAIGN_ID = 24190034111
OUT = Path('keyword_research.json')
GEO_IDS = ['2682','2784','2512','2634','2414','2048']  # SA, UAE, OM, QA, KW, BH
LANG_IDS = {'EN':'1000','AR':'1019'}

SEEDS = {
 'manchester_derby': {
   'EN': ['manchester derby tickets','manchester united vs manchester city tickets','man utd man city tickets','buy manchester derby tickets','old trafford tickets man city'],
   'AR': ['تذاكر ديربي مانشستر','تذاكر مانشستر يونايتد مانشستر سيتي','تذاكر مانشستر يونايتد ضد مانشستر سيتي','شراء تذاكر ديربي مانشستر','حجز تذاكر مانشستر يونايتد مانشستر سيتي']},
 'liverpool_manunited': {
   'EN': ['liverpool vs manchester united tickets','liverpool man united tickets','liverpool vs man utd tickets','buy liverpool man united tickets','anfield man united tickets'],
   'AR': ['تذاكر ليفربول مانشستر يونايتد','تذاكر ليفربول ضد مانشستر يونايتد','شراء تذاكر ليفربول مانشستر يونايتد','حجز تذاكر ليفربول مانشستر يونايتد','تذاكر مباراة ليفربول مانشستر يونايتد']},
 'el_clasico': {
   'EN': ['el clasico tickets','barcelona vs real madrid tickets','barcelona real madrid tickets','buy el clasico tickets','camp nou real madrid tickets'],
   'AR': ['تذاكر الكلاسيكو','تذاكر برشلونة ريال مدريد','تذاكر برشلونة ضد ريال مدريد','شراء تذاكر الكلاسيكو','حجز تذاكر برشلونة ريال مدريد']},
 'madrid_derby': {
   'EN': ['madrid derby tickets','atletico madrid vs real madrid tickets','atletico real madrid tickets','buy madrid derby tickets','metropolitano real madrid tickets'],
   'AR': ['تذاكر ديربي مدريد','تذاكر اتلتيكو ريال مدريد','تذاكر أتلتيكو مدريد ريال مدريد','شراء تذاكر ديربي مدريد','حجز تذاكر اتلتيكو ريال مدريد']},
 'north_london_derby': {
   'EN': ['north london derby tickets','tottenham vs arsenal tickets','tottenham arsenal tickets','buy tottenham arsenal tickets','tottenham stadium arsenal tickets'],
   'AR': ['تذاكر ديربي شمال لندن','تذاكر توتنهام أرسنال','تذاكر توتنهام ضد ارسنال','شراء تذاكر توتنهام أرسنال','حجز تذاكر توتنهام أرسنال']},
 'arsenal_mancity': {
   'EN': ['arsenal vs manchester city tickets','arsenal man city tickets','arsenal vs man city tickets','buy arsenal man city tickets','emirates man city tickets'],
   'AR': ['تذاكر أرسنال مانشستر سيتي','تذاكر ارسنال ضد مانشستر سيتي','شراء تذاكر أرسنال مانشستر سيتي','حجز تذاكر أرسنال مانشستر سيتي','تذاكر مباراة أرسنال مانشستر سيتي']},
}

def client():
    return GoogleAdsClient.load_from_dict({
      'developer_token': os.environ['GOOGLE_ADS_DEVELOPER_TOKEN'],
      'client_id': os.environ['GOOGLE_ADS_CLIENT_ID'],
      'client_secret': os.environ['GOOGLE_ADS_CLIENT_SECRET'],
      'refresh_token': os.environ['GOOGLE_ADS_REFRESH_TOKEN'],
      'login_customer_id': os.environ['GOOGLE_ADS_LOGIN_CUSTOMER_ID'].replace('-','').strip(),
      'use_proto_plus': True,
    })

def relevance(key, lang, text):
    t = text.lower()
    if lang == 'EN':
        if 'ticket' not in t and 'seat' not in t: return False
        checks = {
          'manchester_derby': (('manchester' in t and ('city' in t or 'derby' in t)) or 'man utd man city' in t),
          'liverpool_manunited': ('liverpool' in t and ('manchester' in t or 'man utd' in t or 'man united' in t)),
          'el_clasico': ('clasico' in t or ('barcelona' in t and ('real' in t or 'madrid' in t))),
          'madrid_derby': (('atletico' in t or 'atlético' in t) and ('real' in t or 'madrid' in t)) or 'madrid derby' in t,
          'north_london_derby': ('tottenham' in t and 'arsenal' in t) or 'north london derby' in t,
          'arsenal_mancity': ('arsenal' in t and ('city' in t or 'man city' in t or 'manchester' in t)),
        }
        return checks[key]
    if 'تذاكر' not in t and 'تذكرة' not in t and 'حجز' not in t: return False
    checks = {
      'manchester_derby': ('مانشستر' in t and ('سيتي' in t or 'ديربي' in t)),
      'liverpool_manunited': ('ليفربول' in t and ('يونايتد' in t or 'مانشستر' in t)),
      'el_clasico': ('كلاسيكو' in t or ('برشلونة' in t and ('ريال' in t or 'مدريد' in t))),
      'madrid_derby': (('اتلتيكو' in t or 'أتلتيكو' in t) and ('ريال' in t or 'مدريد' in t)) or 'ديربي مدريد' in t,
      'north_london_derby': ('توتنهام' in t and ('أرسنال' in t or 'ارسنال' in t)) or 'ديربي شمال لندن' in t,
      'arsenal_mancity': (('أرسنال' in t or 'ارسنال' in t) and ('سيتي' in t or 'مانشستر' in t)),
    }
    return checks[key]

def research(c, cid, key, lang, seeds):
    svc = c.get_service('KeywordPlanIdeaService')
    req = c.get_type('GenerateKeywordIdeasRequest')
    req.customer_id = cid
    req.language = f'languageConstants/{LANG_IDS[lang]}'
    req.geo_target_constants.extend([f'geoTargetConstants/{x}' for x in GEO_IDS])
    req.keyword_plan_network = c.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    req.keyword_seed.keywords.extend(seeds)
    resp = svc.generate_keyword_ideas(request=req)
    rows = []
    for r in resp:
        if not relevance(key, lang, r.text):
            continue
        m = r.keyword_idea_metrics
        rows.append({
          'keyword': r.text,
          'avg_monthly_searches': int(m.avg_monthly_searches or 0),
          'competition': m.competition.name,
          'competition_index': int(m.competition_index or 0),
          'low_top_bid_usd': round(int(m.low_top_of_page_bid_micros or 0)/1_000_000,2),
          'high_top_bid_usd': round(int(m.high_top_of_page_bid_micros or 0)/1_000_000,2),
        })
    rows.sort(key=lambda x: (-x['avg_monthly_searches'], x['competition_index'], x['low_top_bid_usd']))
    return rows[:20]

def policy_audit(c, cid):
    ga = c.get_service('GoogleAdsService')
    q = f'''SELECT ad_group.name, ad_group.status, ad_group_ad.status,
                  ad_group_ad.primary_status, ad_group_ad.primary_status_reasons,
                  ad_group_ad.ad.final_urls
           FROM ad_group_ad
           WHERE campaign.id = {CAMPAIGN_ID}
             AND ad_group_ad.status != 'REMOVED'
           ORDER BY ad_group.name'''
    out=[]
    for r in ga.search(customer_id=cid, query=q):
        out.append({
          'ad_group': r.ad_group.name,
          'ad_group_status': r.ad_group.status.name,
          'ad_status': r.ad_group_ad.status.name,
          'primary_status': r.ad_group_ad.primary_status.name,
          'reasons': [x.name for x in r.ad_group_ad.primary_status_reasons],
          'final_urls': list(r.ad_group_ad.ad.final_urls),
        })
    return out

def main():
    c=client(); cid=os.environ['GOOGLE_ADS_CUSTOMER_ID'].replace('-','').strip()
    result={'campaign_id':CAMPAIGN_ID,'geo':'GCC aggregate','research':{},'ads':policy_audit(c,cid)}
    for key, langs in SEEDS.items():
        result['research'][key]={}
        for lang,seeds in langs.items():
            ideas=research(c,cid,key,lang,seeds)
            result['research'][key][lang]=ideas
            print(f'\n=== {key} | {lang} | TOP RELEVANT IDEAS ===')
            if not ideas: print('NO RELEVANT IDEAS RETURNED')
            for i,x in enumerate(ideas[:12],1):
                print(f"{i:02d}. {x['keyword']} | avg={x['avg_monthly_searches']} | comp={x['competition']}({x['competition_index']}) | bid=${x['low_top_bid_usd']}-${x['high_top_bid_usd']}")
    print('\n=== AD REVIEW STATUS ===')
    for a in result['ads']:
        print(a['ad_group'],'|',a['primary_status'],'|',','.join(a['reasons']))
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('\nREAD-ONLY KEYWORD PLANNER RESEARCH COMPLETE')
    print('No campaign/ad group/ad/keyword mutation performed.')

if __name__=='__main__': main()
