from __future__ import annotations

import csv
import gzip
import io
import itertools
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterator

from .common import build_offer_from_row, resolve_location, text


def detect_delimiter(sample: str, configured: str) -> str:
    if configured and configured != "auto":
        return "\\t" if configured == "tab" else configured
    counts = {delimiter: sample.count(delimiter) for delimiter in (";", ",", "\t", "|")}
    return max(counts, key=counts.get) if max(counts.values(), default=0) else ","


def normalise_remote_url(url: str) -> str:
    """Convert browser-friendly IRIs to an ASCII-safe URI for urllib.

    Admitad feed URLs can occasionally contain non-ASCII characters or
    invisible Unicode characters when copied from a browser. Browsers handle
    these automatically, while urllib.request may raise UnicodeEncodeError.
    """
    cleaned = str(url or "").strip()
    for invisible in ("\u200b", "\u200c", "\u200d", "\ufeff"):
        cleaned = cleaned.replace(invisible, "")

    parts = urllib.parse.urlsplit(cleaned)
    if not parts.scheme or not parts.netloc:
        return cleaned

    # IDNA-encode the hostname while preserving optional credentials/port.
    hostname = parts.hostname or ""
    try:
        ascii_host = hostname.encode("idna").decode("ascii")
    except UnicodeError:
        ascii_host = hostname

    netloc = ascii_host
    if parts.port:
        netloc += f":{parts.port}"
    if parts.username:
        user = urllib.parse.quote(parts.username, safe="%")
        if parts.password:
            password = urllib.parse.quote(parts.password, safe="%")
            netloc = f"{user}:{password}@{netloc}"
        else:
            netloc = f"{user}@{netloc}"

    path = urllib.parse.quote(
        parts.path,
        safe="/%:@!$&'()*+,;=-._~",
    )
    query = urllib.parse.quote(
        parts.query,
        safe="=&%/:?+,$;@-._~!()*'[]",
    )
    fragment = urllib.parse.quote(
        parts.fragment,
        safe="=&%/:?+,$;@-._~!()*'[]",
    )
    return urllib.parse.urlunsplit(
        (parts.scheme, netloc, path, query, fragment)
    )


def open_remote(url: str, encoding: str) -> tuple[io.TextIOBase, object]:
    url = normalise_remote_url(url)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "TrendPilotAI-MultiNetwork/0.6.2",
            "Accept-Encoding": "gzip",
            "Accept": "text/csv,text/plain,*/*",
        },
    )
    response = urllib.request.urlopen(request, timeout=180)
    raw = response
    content_encoding = (response.headers.get("Content-Encoding") or "").lower()
    if "gzip" in content_encoding or urllib.parse.urlparse(url).path.endswith(".gz"):
        raw = gzip.GzipFile(fileobj=response)
    stream = io.TextIOWrapper(raw, encoding=encoding, errors="replace", newline="")
    return stream, response


def iter_offers(source: dict, root: Path, allowed_schemes: set[str]) -> Iterator[dict]:
    kind, locator = resolve_location(source, root)
    if not locator:
        return

    row_limit = int(source.get("rowLimit") or 25000)
    encoding = text(source.get("encoding") or "utf-8-sig")
    delimiter_config = text(source.get("delimiter") or "auto")
    stream = None
    response = None

    try:
        if kind == "local_file":
            path = Path(locator)
            if not path.exists():
                return
            stream = path.open("r", encoding=encoding, errors="replace", newline="")
        else:
            stream, response = open_remote(locator, encoding)

        sampled_lines = []
        for _ in range(20):
            line = stream.readline()
            if not line:
                break
            sampled_lines.append(line)

        sample = "".join(sampled_lines)
        if not sample.strip():
            return

        reader = csv.DictReader(
            itertools.chain(sampled_lines, stream),
            delimiter=detect_delimiter(sample, delimiter_config),
        )
        for index, row in enumerate(reader, start=1):
            if index > row_limit:
                break
            offer = build_offer_from_row(row, source, allowed_schemes)
            if offer:
                yield offer
    finally:
        try:
            if stream:
                stream.close()
        finally:
            if response:
                response.close()
