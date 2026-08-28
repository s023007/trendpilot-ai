from pathlib import Path

PAGES = [
    Path('events/manchester-derby-2026/ar/index.html'),
    Path('events/manchester-derby-2026/en-gb/index.html'),
]

CSS = '<link rel="stylesheet" href="../save-search.css?v=1.0.0">'
JS = '<script src="../save-search.js?v=1.0.0" defer></script>'
BUY_JS = '<script src="../email-buy-redirect.js?v=1.0.0"></script>'

for path in PAGES:
    text = path.read_text(encoding='utf-8')
    changed = False
    if CSS not in text:
        needle = '<link rel="stylesheet" href="../derby-premium-v4.css?v=4.3.0">'
        if needle not in text:
            raise SystemExit(f'Missing stylesheet marker in {path}')
        text = text.replace(needle, needle + '\n' + CSS, 1)
        changed = True
    if BUY_JS not in text:
        needle = '</body></html>'
        if needle not in text:
            raise SystemExit(f'Missing body marker in {path}')
        text = text.replace(needle, BUY_JS + '\n' + needle, 1)
        changed = True
    if JS not in text:
        needle = '</body></html>'
        if needle not in text:
            raise SystemExit(f'Missing body marker in {path}')
        text = text.replace(needle, JS + '\n' + needle, 1)
        changed = True
    if changed:
        path.write_text(text, encoding='utf-8')
        print(f'updated {path}')
    else:
        print(f'no change {path}')
