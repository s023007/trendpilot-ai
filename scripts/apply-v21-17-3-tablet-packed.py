from pathlib import Path
import re

p=Path('js/packed-browse-v21-13-8.js')
s=p.read_text(encoding='utf-8')
old=s
s=s.replace('const VERSION = "21.17.0";','const VERSION = "21.17.3";')
s=s.replace('const BROAD = /^(?:popular products?|popular|products?|best sellers?|bestsellers?|trending products?|trending)$/i;\n  const mode = FOOT.test(ql) ? "footwear" : BROAD.test(ql) ? "broad" : "";',
'''const BROAD = /^(?:popular products?|popular|products?|best sellers?|bestsellers?|trending products?|trending)$/i;
  const TABLET = /^(?:tablet|tablets|ipad|ipads)$/i;
  const mode = FOOT.test(ql) ? "footwear" : TABLET.test(ql) ? "tablet" : BROAD.test(ql) ? "broad" : "";''')
s=s.replace('''  const dataUrl = mode === "footwear"
    ? `/data/v20-9/footwear-seller-samples.json?v=21.13.7`
    : `/data/v20-9/seller-browse-samples.json?v=21.13.7`;''',
'''  const dataUrl = mode === "footwear"
    ? `/data/v20-9/footwear-seller-samples.json?v=21.13.7`
    : mode === "tablet"
      ? `/data/v20-9/tablet-seller-samples.json?v=21.17.3`
      : `/data/v20-9/seller-browse-samples.json?v=21.13.7`;''')
s=s.replace('const label=mode==="footwear"?"Footwear":E(r.b||r.tyl||r.ty||"Product");',
'''const label=mode==="footwear"?"Footwear":mode==="tablet"?"Tablet":E(r.b||r.tyl||r.ty||"Product");''')
s=s.replace('''      if(sub) sub.textContent=mode==="footwear"?"Showing verified wearable footwear only. Sellers appear only when the catalogue contains matching footwear available for your region.":"Popular products are balanced across sellers represented in the current catalogue sample and available for your region.";''',
'''      if(sub) sub.textContent=mode==="footwear"
        ? "Showing verified wearable footwear only. Sellers appear only when the catalogue contains matching footwear available for your region."
        : mode==="tablet"
          ? "Showing consumer tablets only. Drawing tablets, stylus products, accessories and replacement parts are excluded."
          : "Popular products are balanced across sellers represented in the current catalogue sample and available for your region.";''')
if s==old:
    if 'const VERSION = "21.17.3";' in s and 'mode === "tablet"' in s:
        print('packed tablet route already current')
    else:
        raise SystemExit('Packed tablet patch made no changes; inspect source contract')
else:
    p.write_text(s,encoding='utf-8')
    print('updated js/packed-browse-v21-13-8.js')

# Cache-bust the packed runtime and normalizer on the finder.
p=Path('find/index.html');s=p.read_text(encoding='utf-8');old=s
s=re.sub(r'/js/packed-browse-v21-13-8\.js\?v=[^"\']+', '/js/packed-browse-v21-13-8.js?v=21.17.3', s)
s=re.sub(r'/js/query-normalizer-v21-3\.js\?v=[^"\']+', '/js/query-normalizer-v21-3.js?v=21.17.2', s)
if s!=old:
    p.write_text(s,encoding='utf-8');print('updated find/index.html cache versions')
