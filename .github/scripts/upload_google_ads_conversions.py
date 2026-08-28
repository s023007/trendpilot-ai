#!/usr/bin/env python3
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient

SAVE_LOG = Path(os.getenv('TP_SAVE_LOG', '/tmp/tp-save-search.jsonl'))
CLICK_LOG = Path(os.getenv('TP_CLICK_LOG', '/tmp/tp-email-clicks.jsonl'))
STATE_FILE = Path(os.getenv('TP_CONVERSION_STATE', '/tmp/tp-google-ads-conversion-state.json'))

SELLER_NAME = 'TrendPilot | Seller Outbound Click'
LEAD_NAME = 'TrendPilot | Email Lead'
ALLOWED_CAMPAIGNS = {
    'manchester_derby_2026',
    'el_clasico_2026',
    'liverpool_manunited_2026',
    'madrid_derby_2026',
    'north_london_derby_2026',
    'arsenal_mancity_2026',
}
LEAD_RE = re.compile(r'^[a-f0-9]{16}$')


def read_jsonl(path: Path):
    if not path.exists():
        return []
    out = []
    for raw in path.read_text(encoding='utf-8', errors='replace').splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            out.append(item)
    return out


def load_state():
    base = {'lead': [], 'seller': []}
    if not STATE_FILE.exists():
        return {k: set(v) for k, v in base.items()}
    try:
        data = json.loads(STATE_FILE.read_text(encoding='utf-8'))
    except Exception:
        data = base
    return {
        'lead': set(str(x) for x in data.get('lead', [])),
        'seller': set(str(x) for x in data.get('seller', [])),
    }


def save_state(state):
    payload = {
        'lead': sorted(state['lead']),
        'seller': sorted(state['seller']),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    STATE_FILE.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def clean_id(value):
    return str(value or '').replace('-', '').strip()


def valid_row(row):
    lead = str(row.get('lead_id') or '').lower().strip()
    gclid = str(row.get('gclid') or '').strip()
    campaign = str(row.get('campaign_id') or '').strip()
    created = str(row.get('created_at') or '').strip()
    return bool(LEAD_RE.fullmatch(lead) and len(gclid) >= 10 and campaign in ALLOWED_CAMPAIGNS and created)


def conversion_time(value):
    s = str(value).strip()
    if s.endswith('Z'):
        s = s[:-1] + '+00:00'
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.strftime('%Y-%m-%d %H:%M:%S+00:00')


def client_from_env():
    return GoogleAdsClient.load_from_dict({
        'developer_token': os.environ['GOOGLE_ADS_DEVELOPER_TOKEN'],
        'client_id': os.environ['GOOGLE_ADS_CLIENT_ID'],
        'client_secret': os.environ['GOOGLE_ADS_CLIENT_SECRET'],
        'refresh_token': os.environ['GOOGLE_ADS_REFRESH_TOKEN'],
        'login_customer_id': clean_id(os.environ['GOOGLE_ADS_LOGIN_CUSTOMER_ID']),
        'use_proto_plus': True,
    })


def get_conversion_customer(client, target_cid):
    ga = client.get_service('GoogleAdsService')
    rows = list(ga.search(customer_id=target_cid, query='''
      SELECT customer.conversion_tracking_setting.google_ads_conversion_customer,
             customer.auto_tagging_enabled
      FROM customer LIMIT 1
    '''))
    if len(rows) != 1:
        raise RuntimeError('Could not resolve conversion customer.')
    cust = rows[0].customer
    if not cust.auto_tagging_enabled:
        raise RuntimeError('Auto-tagging is OFF; refusing conversion upload.')
    owner = str(cust.conversion_tracking_setting.google_ads_conversion_customer or '')
    return owner.rsplit('/', 1)[-1] if owner else target_cid


def get_action(client, conversion_cid, name):
    ga = client.get_service('GoogleAdsService')
    safe = name.replace("'", "\\'")
    rows = list(ga.search(customer_id=conversion_cid, query=f'''
      SELECT conversion_action.resource_name, conversion_action.name,
             conversion_action.status, conversion_action.type
      FROM conversion_action
      WHERE conversion_action.name = '{safe}'
        AND conversion_action.status = 'ENABLED'
      LIMIT 1
    '''))
    if not rows:
        raise RuntimeError(f'Missing enabled conversion action: {name}')
    action = rows[0].conversion_action
    if action.type_.name != 'UPLOAD_CLICKS':
        raise RuntimeError(f'Wrong conversion type for {name}: {action.type_.name}')
    return action.resource_name


def upload_one(client, conversion_cid, action_resource, row, order_id):
    conversion = client.get_type('ClickConversion')
    conversion.conversion_action = action_resource
    conversion.gclid = str(row['gclid']).strip()
    conversion.conversion_date_time = conversion_time(row['created_at'])
    conversion.conversion_value = 1.0
    conversion.currency_code = 'USD'
    conversion.order_id = order_id

    svc = client.get_service('ConversionUploadService')
    response = svc.upload_click_conversions(
        customer_id=conversion_cid,
        conversions=[conversion],
        partial_failure=True,
    )
    if response.partial_failure_error:
        return False, response.partial_failure_error.message
    return True, 'ok'


def main():
    client = client_from_env()
    target_cid = clean_id(os.environ['GOOGLE_ADS_CUSTOMER_ID'])
    conversion_cid = get_conversion_customer(client, target_cid)
    seller_action = get_action(client, conversion_cid, SELLER_NAME)
    lead_action = get_action(client, conversion_cid, LEAD_NAME)

    state = load_state()
    saves = read_jsonl(SAVE_LOG)
    clicks = read_jsonl(CLICK_LOG)

    lead_candidates = {}
    for row in saves:
        if not valid_row(row):
            continue
        lead = str(row['lead_id']).lower().strip()
        if lead not in state['lead']:
            lead_candidates[lead] = row

    seller_candidates = {}
    for row in clicks:
        if not valid_row(row):
            continue
        lead = str(row['lead_id']).lower().strip()
        if lead not in state['seller']:
            seller_candidates[lead] = row

    # Conservative quota guard for the initial campaign.
    max_each = 100
    uploaded_leads = 0
    uploaded_sellers = 0
    failed = 0

    for lead, row in list(lead_candidates.items())[:max_each]:
        ok, msg = upload_one(client, conversion_cid, lead_action, row, f'tp-lead-{lead}')
        if ok:
            state['lead'].add(lead)
            uploaded_leads += 1
        else:
            failed += 1
            print(f'Lead upload skipped/failed for {lead[:6]}…: {msg}')

    for lead, row in list(seller_candidates.items())[:max_each]:
        ok, msg = upload_one(client, conversion_cid, seller_action, row, f'tp-seller-{lead}')
        if ok:
            state['seller'].add(lead)
            uploaded_sellers += 1
        else:
            failed += 1
            print(f'Seller upload skipped/failed for {lead[:6]}…: {msg}')

    save_state(state)
    print('GOOGLE ADS CONVERSION IMPORT PASS')
    print('Valid pending lead candidates:', len(lead_candidates))
    print('Valid pending seller-click candidates:', len(seller_candidates))
    print('Uploaded email leads:', uploaded_leads)
    print('Uploaded seller outbound clicks:', uploaded_sellers)
    print('Upload failures:', failed)
    print('Rows without valid Google click IDs are intentionally ignored.')


if __name__ == '__main__':
    main()
