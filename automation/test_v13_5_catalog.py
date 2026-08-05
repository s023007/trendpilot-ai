#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("build_decision_catalog.py")
spec = importlib.util.spec_from_file_location("tp_builder", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)

sample = {
    "name": "Wireless CarPlay Adapter Model CP86",
    "description": "Works with compatible wired CarPlay vehicles. Two year warranty.",
    "category": "Car electronics",
    "affiliateUrl": "https://seller.example/product/1",
    "imageUrl": "https://images.example/main.jpg",
    "additionalImages": ["https://images.example/side.jpg"],
    "videoUrl": "https://youtu.be/abcdefghijk",
    "specifications": {"Compatibility": "Vehicles with wired CarPlay", "Model": "CP86"},
    "price": 33.12,
    "currency": "USD",
    "advertiser": "Example Store",
    "available": True,
    "qualityScore": 90,
}
record = module.public_record(sample, "automotive")
assert record["family"] == "wireless-carplay-adapter"
assert len(record["images"]) == 2
assert record["videoUrl"].startswith("https://youtu.be/")
assert record["specs"]["Compatibility"] == "Vehicles with wired CarPlay"
assert record["specs"]["Model"] == "CP86"
print("TrendPilot V13.5 catalogue enrichment tests passed")
