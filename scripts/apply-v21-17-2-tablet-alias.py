from pathlib import Path

p=Path('js/query-normalizer-v21-3.js')
s=p.read_text(encoding='utf-8')
old=s
needle='''  const fixes = [
    [/\\b(?:makbook|mackbook|macbok|mackbok|mac\\s+book)\\b/ig, "macbook"],'''
replacement='''  const fixes = [
    [/\\btablets\\b/ig, "tablet"],
    [/\\bipads\\b/ig, "ipad"],
    [/\\b(?:makbook|mackbook|macbok|mackbok|mac\\s+book)\\b/ig, "macbook"],'''
if replacement not in s:
    if needle not in s:
        raise SystemExit('query normalizer fixes array not found')
    s=s.replace(needle,replacement,1)
if s!=old:
    p.write_text(s,encoding='utf-8')
    print('updated js/query-normalizer-v21-3.js')
else:
    print('tablet aliases already current')
