#!/usr/bin/env python3
import os
import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

REQUIRED = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
]

missing = [name for name in REQUIRED if not os.getenv(name)]
if missing:
    print("Missing required GitHub secrets:", ", ".join(missing))
    sys.exit(2)

customer_id = os.environ["GOOGLE_ADS_CUSTOMER_ID"].replace("-", "").strip()
login_customer_id = os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"].replace("-", "").strip()

config = {
    "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
    "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
    "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
    "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
    "login_customer_id": login_customer_id,
    "use_proto_plus": True,
}

try:
    client = GoogleAdsClient.load_from_dict(config)

    # Read-only test 1: OAuth + developer token work and the identity can see Google Ads accounts.
    customer_service = client.get_service("CustomerService")
    accessible = customer_service.list_accessible_customers()
    accessible_ids = {name.rsplit("/", 1)[-1] for name in accessible.resource_names}
    print(f"OAuth/API authentication: PASS ({len(accessible_ids)} directly accessible account(s))")

    # Read-only test 2: manager login context can query the intended advertising account.
    ga_service = client.get_service("GoogleAdsService")
    query = """
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager,
          customer.test_account
        FROM customer
        LIMIT 1
    """
    rows = list(ga_service.search(customer_id=customer_id, query=query))
    if not rows:
        raise RuntimeError("Target Google Ads customer returned no customer row.")

    customer = rows[0].customer
    if str(customer.id) != customer_id:
        raise RuntimeError(f"Queried customer mismatch: expected {customer_id}, got {customer.id}")

    print("Manager-to-customer access: PASS")
    print(f"Target customer ID: {customer.id}")
    print(f"Account name: {customer.descriptive_name or '(not set)'}")
    print(f"Currency: {customer.currency_code}")
    print(f"Time zone: {customer.time_zone}")
    print(f"Manager account: {customer.manager}")
    print(f"Test account: {customer.test_account}")
    print("Mutation safety: PASS — this script performs READ-ONLY API calls and cannot create ads or spend money.")
    print("GOOGLE ADS API CONNECTION TEST: SUCCESS")

except GoogleAdsException as exc:
    print("GOOGLE ADS API CONNECTION TEST: FAILED")
    print(f"Request ID: {exc.request_id}")
    for error in exc.failure.errors:
        print(f"- {error.error_code}: {error.message}")
    sys.exit(1)
except Exception as exc:
    print("GOOGLE ADS API CONNECTION TEST: FAILED")
    print(f"- {type(exc).__name__}: {exc}")
    sys.exit(1)
