#!/usr/bin/env python3
"""Regression tests for TrendPilot V13.4.1 taxonomy across every department."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("tp_catalog", ROOT / "automation" / "build_decision_catalog.py")
assert SPEC and SPEC.loader
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


def offer(name: str, category: str = "", description: str = "", **extra) -> dict:
    return {
        "name": name,
        "category": category,
        "description": description,
        "affiliateUrl": "https://example.com/item",
        "advertiser": "Test seller",
        "offerType": "product",
        **extra,
    }


def check(name: str, category: str, group: str, family: str, audience: str = "all") -> None:
    row = offer(name, category)
    actual_group = catalog.group_for(row)
    assert actual_group == group, (name, actual_group, group)
    actual_family = catalog.family_for(row, actual_group)
    assert actual_family == family, (name, actual_family, family)
    assert catalog.audience_for(row) == audience, (name, catalog.audience_for(row), audience)


def main() -> int:
    cases = [
        ("Men Graphic Cotton T-Shirt", "Men clothing", "apparel", "t-shirts", "men"),
        ("Women Formal Business Dress Shirt", "Women clothing", "apparel", "dress-shirts", "women"),
        ("Trail Running Shoes Breathable", "Footwear", "footwear", "running-shoes", "all"),
        ("Waterproof School Backpack for Students", "School supplies", "office-school", "school-bags", "all"),
        ("Leather Shoulder Handbag Women", "Bags", "bags-accessories", "handbags", "women"),
        ("Fitness Smartwatch Heart Rate", "Watches", "jewelry-watches", "smartwatches", "all"),
        ("Matte Liquid Lipstick", "Makeup", "beauty-care", "lip-makeup", "all"),
        ("Vitamin C Face Serum", "Skin care", "beauty-care", "skin-care", "all"),
        ("Foldable Baby Stroller", "Baby", "baby-kids", "strollers", "kids"),
        ("Automatic Smart Pet Feeder", "Pet supplies", "pet-supplies", "pet-feeder", "all"),
        ("Android Smartphone 5G", "Phones", "phones-tablets", "smartphones", "all"),
        ("Tempered Glass Screen Protector for iPhone", "Phone accessory", "phones-tablets", "screen-protectors", "all"),
        ("Gaming Laptop 16GB RAM", "Computers", "computers", "laptops", "all"),
        ("USB C Docking Station 12 in 1", "Computer accessory", "computers", "docks-hubs", "all"),
        ("Wireless Bluetooth Earbuds TWS", "Audio", "audio", "earbuds", "all"),
        ("Action Camera 4K Waterproof", "Camera", "cameras", "action-cameras", "all"),
        ("Waterproof Camera Backpack", "Camera accessory", "cameras", "camera-bags", "all"),
        ("Mini Portable Projector 1080p", "Projector", "projectors-tv", "portable-projector", "all"),
        ("Smart WiFi Fingerprint Door Lock", "Smart home", "smart-home", "smart-locks", "all"),
        ("Wireless CarPlay Adapter Dongle", "Car electronics", "automotive", "wireless-carplay-adapter", "all"),
        ("Air Fryer 5L Digital", "Kitchen appliance", "home-kitchen", "kitchen-appliances", "all"),
        ("Cordless Impact Drill 20V", "Power tools", "tools", "drills", "all"),
        ("Digital Multimeter Auto Range", "Test equipment", "tools", "multimeters", "all"),
        ("Scientific Calculator for Students", "School supplies", "office-school", "calculators", "all"),
        ("Kids Educational Building Blocks", "Toys", "toys-games", "building-toys", "kids"),
        ("Non Slip Yoga Mat", "Sports", "sports-outdoors", "yoga-pilates", "all"),
        ("PLA Filament for 3D Printer", "3D printing", "printing-3d", "3d-filament", "all"),
        ("Thermal Label Printer Bluetooth", "Printing", "printing-3d", "thermal-printer", "all"),
        ("Professional Video Editing Software Annual License", "Software", "software", "video-editor", "all"),
        ("Antivirus Internet Security License", "Software", "software", "antivirus-security", "all"),
        ("Custom Logo Private Label Bottles MOQ 100", "Wholesale", "business-sourcing", "private-label", "all"),
        ("International Freight Logistics Service", "Supplier services", "business-sourcing", "shipping-logistics", "all"),
    ]
    for name, category, group, family, audience in cases:
        check(name, category, group, family, audience)

    # Cross-department contamination guards.
    check("Women Lips Makeup Print T-Shirt", "Women's Tops", "apparel", "t-shirts", "women")
    check("Portable Cosmetic Makeup Bag Organizer", "Fashion bags", "bags-accessories", "makeup-bags", "all")
    check("Pet Carrier Backpack for Cats", "Pet", "pet-supplies", "pet-carriers", "all")
    check("Baby Diaper Bag with Changing Mat", "Baby", "baby-kids", "diapers-changing", "kids")

    # Regression for the V13.4 installation failure: a genuinely unknown
    # feed item is allowed in the top-level Other department, but the emitted
    # family must still have a stable public label.
    unknown = offer("Mystery commodity ABC 123", "Miscellaneous")
    unknown_group = catalog.group_for(unknown)
    assert unknown_group == "other", unknown_group
    unknown_family = catalog.family_for(unknown, unknown_group)
    assert unknown_family == "other", unknown_family
    assert catalog.CANONICAL_FAMILY_LABELS.get("other") == "Other products"

    # Every supported department must expose finite canonical rules and labels.
    supported = set(catalog.GROUP_FAMILY_RULES)
    required = set(catalog.GROUPS) - {"other"}
    assert required.issubset(supported), sorted(required - supported)
    for group, rules in catalog.GROUP_FAMILY_RULES.items():
        assert rules, group
        for family, aliases in rules:
            assert family and aliases, (group, family)
            assert family in catalog.CANONICAL_FAMILY_LABELS, family
            assert ":" not in family, family

    print(f"TrendPilot V13.4.1 taxonomy tests passed: {len(cases) + 4} representative products, {len(supported)} departments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
