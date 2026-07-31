from __future__ import annotations

import gzip
import io
import json
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterator

from .common import build_offer_from_row, resolve_location, text


def value_at_path(value: Any, path: str) -> Any:
    current = value
    for segment in [part for part in path.split(".") if part]:
        if isinstance(current, dict):
            current = current.get(segment)
        elif isinstance(current, list) and segment.isdigit():
            index = int(segment)
            current = current[index] if index < len(current) else None
        else:
            return None
    return current


def find_item_list(payload: Any, configured_path: str) -> list:
    if configured_path:
        selected = value_at_path(payload, configured_path)
        return selected if isinstance(selected, list) else []

    if isinstance(payload, list):
        return payload

    if not isinstance(payload, dict):
        return []

    preferred_keys = (
        "products", "items", "offers", "results", "listings",
        "data", "records",
    )
    for key in preferred_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = find_item_list(value, "")
            if nested:
                return nested

    best: list = []
    for value in payload.values():
        if isinstance(value, list) and len(value) > len(best):
            best = value
        elif isinstance(value, dict):
            nested = find_item_list(value, "")
            if len(nested) > len(best):
                best = nested
    return best


def flatten_row(value: dict, prefix: str = "") -> dict[str, object]:
    output: dict[str, object] = {}
    for key, item in value.items():
        full_key = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(item, dict):
            nested = flatten_row(item, full_key)
            output.update(nested)
            # Also expose unique leaf names for easy field maps.
            for nested_key, nested_value in nested.items():
                leaf = nested_key.rsplit(".", 1)[-1]
                output.setdefault(leaf, nested_value)
        elif isinstance(item, list):
            output[full_key] = ",".join(text(entry) for entry in item)
            output.setdefault(str(key), output[full_key])
        else:
            output[full_key] = item
            output.setdefault(str(key), item)
    return output


def request_headers(source: dict) -> dict[str, str]:
    headers = {
        "User-Agent": "TrendPilotAI-MultiNetwork/2.1",
        "Accept": "application/json,text/json,*/*",
        "Accept-Encoding": "gzip",
    }
    for key, value in (source.get("requestHeaders") or {}).items():
        if text(key) and text(value):
            headers[text(key)] = text(value)

    import os
    for header, environment_variable in (
        source.get("requestHeadersFromEnvironment") or {}
    ).items():
        secret_value = os.environ.get(text(environment_variable), "").strip()
        if text(header) and secret_value:
            headers[text(header)] = secret_value
    return headers


def open_remote(url: str, source: dict) -> tuple[io.BufferedIOBase, object]:
    request = urllib.request.Request(
        url,
        headers=request_headers(source),
    )
    response = urllib.request.urlopen(request, timeout=180)
    raw = response
    content_encoding = (response.headers.get("Content-Encoding") or "").lower()
    if (
        "gzip" in content_encoding
        or urllib.parse.urlparse(url).path.endswith(".gz")
    ):
        raw = gzip.GzipFile(fileobj=response)
    return raw, response


def iter_offers(
    source: dict,
    root: Path,
    allowed_schemes: set[str],
) -> Iterator[dict]:
    kind, locator = resolve_location(source, root)
    if not locator:
        return

    row_limit = int(source.get("rowLimit") or 25000)
    encoding = text(source.get("encoding") or "utf-8")
    items_path = text(source.get("itemsPath"))

    handle = None
    response = None
    try:
        if kind == "local_file":
            path = Path(locator)
            if not path.exists():
                return
            handle = path.open("rb")
        else:
            handle, response = open_remote(locator, source)

        payload = json.loads(handle.read().decode(encoding, errors="replace"))
        items = find_item_list(payload, items_path)

        for index, item in enumerate(items, start=1):
            if index > row_limit:
                break
            if not isinstance(item, dict):
                continue
            offer = build_offer_from_row(
                flatten_row(item),
                source,
                allowed_schemes,
            )
            if offer:
                yield offer
    finally:
        try:
            if handle:
                handle.close()
        finally:
            if response:
                response.close()
