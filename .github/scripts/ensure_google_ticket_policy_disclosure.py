#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "public/guides/manchester-derby-tickets-saudi-arabia/index.html"

CSS = ".ad-policy-disclosure{margin-top:14px;background:#fff7ed;color:#7c2d12;border:2px solid #f0b36b;border-radius:14px;padding:11px 12px;font-size:14px;font-weight:650;line-height:1.75}.ad-policy-disclosure strong{font-weight:850;color:#7c2d12}"
BOX = '<div class="ad-policy-disclosure"><strong>تنبيه مهم:</strong> TrendPilot يقارن أسعار التذاكر ولا يبيعها ولا يمثل الناديين أو مزود التذاكر الأساسي. بعض الروابط تقود إلى أسواق إعادة بيع وقد تكون الأسعار أعلى من القيمة الاسمية.</div>'


def main():
    doc = PAGE.read_text(encoding="utf-8")

    if ".ad-policy-disclosure{" not in doc:
        marker = "  </style>"
        if marker not in doc:
            raise SystemExit("CSS style closing marker not found")
        doc = doc.replace(marker, f"    {CSS}\n{marker}", 1)

    if 'class="ad-policy-disclosure"' not in doc:
        marker = "</div></div>\n  </section>\n  <div class=\"trustline\">"
        if marker not in doc:
            raise SystemExit("Hero insertion marker not found")
        doc = doc.replace(marker, f"</div>{BOX}</div>\n  </section>\n  <div class=\"trustline\">", 1)

    PAGE.write_text(doc, encoding="utf-8")
    print("Google event-ticket disclosure is present above the fold.")


if __name__ == "__main__":
    main()
