from __future__ import annotations

import io
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterator

from .common import build_offer_from_row, resolve_location, text


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def element_to_row(element: ET.Element) -> dict:
    row: dict[str, str] = {}
    for child in element.iter():
        key = local_name(child.tag)
        value = text(child.text)
        if key and value and key not in row:
            row[key] = value
        for attribute, attribute_value in child.attrib.items():
            row.setdefault(local_name(attribute), text(attribute_value))
    return row


def iter_offers(source: dict, root: Path, allowed_schemes: set[str]) -> Iterator[dict]:
    kind, locator = resolve_location(source, root)
    if not locator:
        return

    row_limit = int(source.get("rowLimit") or 25000)
    item_tags = {
        text(item).lower()
        for item in source.get("itemTags", ["item", "product", "offer"])
        if text(item)
    }

    handle = None
    try:
        if kind == "local_file":
            path = Path(locator)
            if not path.exists():
                return
            handle = path.open("rb")
        else:
            request = urllib.request.Request(
                locator,
                headers={
                    "User-Agent": "TrendPilotAI-MultiNetwork/0.6",
                    "Accept": "application/xml,text/xml,*/*",
                },
            )
            handle = urllib.request.urlopen(request, timeout=180)

        count = 0
        for _, element in ET.iterparse(handle, events=("end",)):
            if local_name(element.tag) not in item_tags:
                continue
            offer = build_offer_from_row(element_to_row(element), source, allowed_schemes)
            element.clear()
            if offer:
                yield offer
                count += 1
                if count >= row_limit:
                    break
    finally:
        if handle:
            handle.close()
