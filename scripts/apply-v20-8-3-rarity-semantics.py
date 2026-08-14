#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
B=ROOT/'scripts/build-v20-8-universal-discovery.py'
U=ROOT/'js/universal-discovery-v20-8.js'
R=ROOT/'js/rare-finds-v20-8.js'
F=ROOT/'find/index.html'
H=ROOT/'rare-used/index.html'

b=B.read_text(encoding='utf-8')
b=b.replace("V='20.8.2'","V='20.8.3'")
old="    if re.search(r'\\b(?:carbon brush|armature|stator|rotor)\\b',text) and re.search(r'\\b(?:power tool|drill|saw|sander|grinder|router|motor)\\b',text): return 'power-tool-parts'"
new="    if 'carbon brush' in text: return 'power-tool-parts'\n    if re.search(r'\\b(?:armature|stator|rotor)\\b',text) and re.search(r'\\b(?:power tool|drill|saw|sander|grinder|router|motor)\\b',text): return 'power-tool-parts'"
if old in b:b=b.replace(old,new)
elif "if 'carbon brush' in text" not in b:raise SystemExit('Carbon brush type rule not found')

old_loop="""        for term,val in RARE.items():
            if term in t:
                weight={'rare':15,'hard to find':18,'hard-to-find':18,'discontinued':28,'obsolete':24,'vintage':8,'limited edition':20,'collector':18,'collectible':18,'new old stock':24,'surplus':12,'legacy':12,'classic':8,'out of production':28,'replacement':6,'spare':5,'oem':4}.get(term,val)
                add=max(add,weight)
                if term in {'discontinued','obsolete','out of production','legacy'}:
                    if 'discontinued' not in sig:sig.append('discontinued')
                    strong_rarity=True
                if term in {'limited edition','collector','collectible','new old stock'}:
                    if 'collector' not in sig:sig.append('collector')
                    strong_rarity=True
                if term in {'rare','hard to find','hard-to-find'}:strong_rarity=True
"""
new_loop="""        for term,val in RARE.items():
            if term not in t:continue
            # 'collector' can mean dust/data/solar collector; only count collector language when it clearly describes collectibility.
            if term=='collector' and not re.search(r"\\b(?:collector(?:'s)?\\s+(?:item|edition|series|model|piece|set)|for\\s+collectors?)\\b",t):continue
            weight={'rare':15,'hard to find':18,'hard-to-find':18,'discontinued':28,'obsolete':24,'vintage':8,'limited edition':20,'collector':18,'collectible':18,'new old stock':24,'surplus':12,'legacy':12,'classic':8,'out of production':28,'replacement':6,'spare':5,'oem':4}.get(term,val)
            add=max(add,weight)
            if term in {'discontinued','obsolete','out of production','legacy'}:
                if 'discontinued' not in sig:sig.append('discontinued')
                strong_rarity=True
            if term in {'limited edition','collector','collectible','new old stock'}:
                if 'collector' not in sig:sig.append('collector')
                strong_rarity=True
            if term in {'rare','hard to find','hard-to-find'}:strong_rarity=True
"""
if old_loop in b:b=b.replace(old_loop,new_loop)
elif "dust/data/solar collector" not in b:raise SystemExit('Rare collector loop not found')
B.write_text(b,encoding='utf-8')

for p in (U,R):
    p.write_text(p.read_text(encoding='utf-8').replace('20.8.2','20.8.3'),encoding='utf-8')
for p in (F,H):
    p.write_text(p.read_text(encoding='utf-8').replace('v=20.8.2','v=20.8.3'),encoding='utf-8')
print('V20.8.3 rarity semantics applied')
