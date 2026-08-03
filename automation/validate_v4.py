from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import sys
root=Path('.')
errors=[]; titles={}
htmls=[p for p in root.rglob('*.html') if '.git' not in p.parts]
for p in htmls:
    # Legacy/internal pages are outside the v4 validation scope unless they load v4 CSS.
    text=p.read_text(encoding='utf-8',errors='ignore')
    if 'style-v4.css' not in text: continue
    soup=BeautifulSoup(text,'html.parser')
    title=soup.title.get_text(strip=True) if soup.title else ''
    if not title: errors.append(f'{p}: missing title')
    if title in titles: errors.append(f'{p}: duplicate title with {titles[title]}')
    titles[title]=p
    if len(soup.find_all('h1'))!=1: errors.append(f'{p}: expected one h1')
    if not soup.find('meta',attrs={'name':'description'}): errors.append(f'{p}: missing description')
    if p.name!='404.html' and not soup.find('link',rel='canonical'): errors.append(f'{p}: missing canonical')
    for a in soup.find_all('a',href=True):
        href=a['href']
        if href.startswith(('http:','https:','mailto:','#','javascript:')): continue
        path=urlparse(href).path
        if not path: continue
        target=root/path.lstrip('/')
        if path.endswith('/'): target=target/'index.html'
        elif target.suffix=='': target=target/'index.html'
        if not target.exists(): errors.append(f'{p}: broken internal link {href}')
if errors:
    print('\n'.join(errors));sys.exit(1)
print(f'Validated {len(titles)} TrendPilot V4 pages with no structural or internal-link errors.')
