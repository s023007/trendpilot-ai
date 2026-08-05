#!/usr/bin/env python3
"""Install TrendPilot V13.4.1 taxonomy hotfix without changing the calm V13.2 design."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "13.4.1"
SCRIPT_TAG = f'<script defer src="/js/site-v13-4.js?v={VERSION}"></script>'

SCOPE_OPTIONS = """<option value="">All</option>
<optgroup label="Main departments">
<option value="clothing">Clothing, shoes & fashion</option>
<option value="electronics">Electronics</option>
<option value="home">Home, kitchen & DIY</option>
<option value="school">School & office</option>
<option value="sports">Sports & outdoors</option>
<option value="beauty">Beauty & personal care</option>
<option value="kids">Baby, kids & toys</option>
<option value="software">Software & digital tools</option>
<option value="business">Business sourcing</option>
</optgroup>
<optgroup label="More departments">
<option value="pets">Pet supplies</option>
<option value="automotive">Car electronics & accessories</option>
<option value="tools">Tools & workshop</option>
<option value="toys">Toys & games</option>
<option value="bags">Bags & accessories</option>
<option value="jewelry">Jewelry, watches & eyewear</option>
<option value="audio">Audio & headphones</option>
<option value="cameras">Cameras & video gear</option>
<option value="phones">Phones & tablets</option>
<option value="computers">Computers & accessories</option>
<option value="smart-home">Smart home & lighting</option>
<option value="printing">Printing & 3D printing</option>
</optgroup>"""


def patch_html() -> tuple[int, int, int]:
    changed = inserted = scope_patched = 0
    script_pattern = re.compile(
        r'\s*<script[^>]+src=["\']/js/site-v13(?:-2|-3|-4)?\.js[^"\']*["\'][^>]*>\s*</script>\s*',
        re.I,
    )
    scope_pattern = re.compile(
        r'(<select\b[^>]*data-tp-search-scope[^>]*>)(.*?)(</select>)', re.I | re.S
    )
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if any(part.startswith(".") or part in {"node_modules", "automation", "tests"} for part in rel.parts):
            continue
        original = path.read_text(encoding="utf-8", errors="ignore")
        text, count = script_pattern.subn("\n" + SCRIPT_TAG + "\n", original)
        text = re.sub(r'(<input[^>]+type=["\']search["\'][^>]*?)\s+required(?=[\s>])', r'\1', text, flags=re.I)
        text, scope_count = scope_pattern.subn(lambda m: m.group(1) + SCOPE_OPTIONS + m.group(3), text)
        scope_patched += scope_count
        if count == 0 and re.search(r"</body>", text, re.I):
            text = re.sub(r"</body>", SCRIPT_TAG + "\n</body>", text, count=1, flags=re.I)
            inserted += 1
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
    return changed, inserted, scope_patched


def ensure_refresh_hook() -> bool:
    path = ROOT / "automation" / "build_search_catalog.py"
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8", errors="ignore")
    marker = "TREND_PILOT_V13_REFRESH_HOOK"
    if marker in text:
        return False
    hook = '''
# TREND_PILOT_V13_REFRESH_HOOK
if __name__ == "__main__":
    import atexit as _tp_v13_atexit
    import subprocess as _tp_v13_subprocess
    import sys as _tp_v13_sys
    from pathlib import Path as _TpV13Path

    def _tp_v13_rebuild_exact_catalogue() -> None:
        _tp_v13_root = _TpV13Path(__file__).resolve().parents[1]
        _tp_v13_builder = _tp_v13_root / "automation" / "build_decision_catalog.py"
        if not _tp_v13_builder.exists():
            raise RuntimeError("TrendPilot V13 catalogue builder is missing")
        _tp_v13_command = [_tp_v13_sys.executable, str(_tp_v13_builder)]
        if "--allow-fallback" in _tp_v13_sys.argv:
            _tp_v13_command.append("--allow-fallback")
        _tp_v13_subprocess.run(_tp_v13_command, cwd=_tp_v13_root, check=True)

    _tp_v13_atexit.register(_tp_v13_rebuild_exact_catalogue)
# TREND_PILOT_V13_REFRESH_HOOK_END
'''
    guards = list(re.finditer(r'^if __name__\s*==\s*["\']__main__["\']\s*:\s*$', text, flags=re.M))
    if not guards:
        raise RuntimeError("Cannot patch automation/build_search_catalog.py safely: main guard missing")
    pos = guards[-1].start()
    path.write_text(text[:pos] + hook + "\n" + text[pos:], encoding="utf-8")
    return True


def build_catalog() -> dict:
    builder = ROOT / "automation" / "build_decision_catalog.py"
    subprocess.run([sys.executable, str(builder), "--allow-fallback"], cwd=ROOT, check=True)
    manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError("V13.4.1 search manifest was not produced")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != VERSION:
        raise RuntimeError(f"Unexpected catalogue version: {manifest.get('version')}")
    return manifest


def main() -> int:
    changed, inserted, scopes = patch_html()
    hook = ensure_refresh_hook()
    manifest = build_catalog()
    print(
        "TrendPilot V13.4.1 installed: "
        f"pages_updated={changed}, scripts_inserted={inserted}, scope_selects={scopes}, "
        f"refresh_hook_added={int(hook)}, products={manifest.get('productCount', 0):,}, "
        f"segments={len(manifest.get('segments', [])):,}, departments={len(manifest.get('scopeGroups', {}))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
