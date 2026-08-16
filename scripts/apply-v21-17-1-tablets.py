from pathlib import Path


def patch(path, replacements):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    old=s
    for before,after,label in replacements:
        if after in s:
            continue
        if before not in s:
            raise SystemExit(f'{path}: {label}: expected source not found')
        s=s.replace(before,after,1)
    if s!=old:
        p.write_text(s,encoding='utf-8')
        print('updated',path)
    else:
        print('already current',path)

patch('js/universal-discovery-v20-9-1.js',[
    ('["tablet",/\\b(?:tablet|ipad|galaxy tab|surface pro)\\b/i]',
     '["tablet",/\\b(?:tablets?|ipads?|galaxy tabs?|surface pro)\\b/i]',
     'tablet family plural'),
    ('    phone:/^(?:phones?|smartphones?|mobile phones?)$/i,\n    laptop:',
     '    phone:/^(?:phones?|smartphones?|mobile phones?)$/i,\n    tablet:/^(?:tablets?|ipads?)$/i,\n    laptop:',
     'tablet generic route')
])

patch('js/query-normalizer-v21-3.js',[
    ('if (/\\b(?:tablet|ipad|galaxy tab|surface pro)\\b/i.test(value)) return "tablet";',
     'if (/\\b(?:tablets?|ipads?|galaxy tabs?|surface pro)\\b/i.test(value)) return "tablet";',
     'normalizer tablet plural'),
    ('tablet: /\\b(?:tablet|ipad|galaxy tab|surface pro)\\b/i,',
     'tablet: /\\b(?:tablets?|ipads?|galaxy tabs?|surface pro)\\b/i,',
     'normalizer tablet main plural')
])

print('V21.17.1 tablet plural patch complete')
