#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,shutil,subprocess,threading,time,urllib.request
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/v21-13-8-local-browser';OUT.mkdir(parents=True,exist_ok=True)
report={'version':'21.13.8','passed':False,'checks':{},'failures':[],'evidence':{}}
def check(name,ok,detail=''):
    report['checks'][name]=bool(ok)
    if not ok:report['failures'].append({'name':name,'detail':str(detail)})

def sha_bytes(b):return hashlib.sha256(b).hexdigest()
def sha_file(p):return sha_bytes(Path(p).read_bytes())
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'TrendPilot-QA/21.13.8'})
    with urllib.request.urlopen(req,timeout=20) as r:return r.read()

def clean(v):return ' '.join(str(v or '').split()).strip()
BLOCK=re.compile(r'\b(?:Temu|Joom|FilamentPRO)\b',re.I)
BAD=re.compile(r'(?:cosplay|costume|snow\s*blower|skid\s*(?:plate|shoe)|flooring\s*installation|epoxy\s*shoe|temperature\s*control\s*iron|bunion|toe\s*(?:separator|corrector)|labubu|doll\s*(?:clothes|shoes)|pet\s*(?:shoes|bed|house)|dog\s*(?:boots|shoes|booties)|cleaning\s*cream|shoe\s*(?:cleaner|rack|bag|box|cover|accessor|machine|making|repair|glue|charm|clip|buckle|pendant)|boot\s*cut|bootcut|baggy\s*jeans|straight\s*jeans|phone\s*case|airpods?|cold\s*shoe|hot\s*shoe|bottle\s*opener|wine\s*rack|anti-clog|clog\s*remover|brake\s*shoe|medical\s*boot|walking\s*boot\s*brace|christmas|xmas)',re.I)

# Static data truth.
foot=json.loads((ROOT/'data/v20-9/footwear-seller-samples.json').read_text(encoding='utf-8'))
browse=json.loads((ROOT/'data/v20-9/seller-browse-samples.json').read_text(encoding='utf-8'))
foot_sellers=sorted((foot.get('sellers') or {}).keys())
browse_sellers=sorted((browse.get('sellers') or {}).keys())
foot_titles=[clean(r.get('t')) for r in (foot.get('records') or {}).values()]
check('footwear_index_version',foot.get('version')=='21.13.7',foot.get('version'))
check('footwear_verified_sellers',foot_sellers==['AliExpress','TikTok Shop US'],foot_sellers)
check('footwear_does_not_invent_alibaba','Alibaba' not in foot_sellers,foot_sellers)
check('footwear_no_blocked_sellers',not any(BLOCK.search(s) for s in foot_sellers),foot_sellers)
check('footwear_deep_purity',len(foot_titles)>=100 and not any(BAD.search(t) for t in foot_titles),[t for t in foot_titles if BAD.search(t)][:20])
check('popular_has_many_sellers',len(browse_sellers)>=10,browse_sellers)
check('popular_key_sellers',all(x in browse_sellers for x in ['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying']),browse_sellers)
check('popular_no_blocked_sellers',not any(BLOCK.search(s) for s in browse_sellers),browse_sellers)
report['evidence']['footwear']={'seller_count':len(foot_sellers),'sellers':foot_sellers,'records':len(foot_titles)}
report['evidence']['popular']={'seller_count':len(browse_sellers),'sellers':browse_sellers,'records':len(browse.get('records') or {})}

# Verify the public deployment is serving the exact deterministic runtime and packed data.
try:
    live_html=fetch('https://trendpilotchoice.com/find/').decode('utf-8','replace')
    check('live_find_uses_v21_13_8','packed-browse-v21-13-8.js?v=21.13.8' in live_html,'marker missing')
    check('live_find_no_old_packed_cache','packed-search-cache-v21-13-' not in live_html,'old packed cache still referenced')
    remote_script=fetch('https://trendpilotchoice.com/js/packed-browse-v21-13-8.js?v=21.13.8')
    check('live_runtime_matches_main',sha_bytes(remote_script)==sha_file(ROOT/'js/packed-browse-v21-13-8.js'),{'remote':sha_bytes(remote_script),'local':sha_file(ROOT/'js/packed-browse-v21-13-8.js')})
    remote_foot=fetch('https://trendpilotchoice.com/data/v20-9/footwear-seller-samples.json?v=21.13.7')
    remote_browse=fetch('https://trendpilotchoice.com/data/v20-9/seller-browse-samples.json?v=21.13.7')
    check('live_footwear_data_matches_main',sha_bytes(remote_foot)==sha_file(ROOT/'data/v20-9/footwear-seller-samples.json'),'footwear data hash differs')
    check('live_browse_data_matches_main',sha_bytes(remote_browse)==sha_file(ROOT/'data/v20-9/seller-browse-samples.json'),'browse data hash differs')
except Exception as e:
    check('live_deployment_fetch',False,repr(e))

# Exact browser behavior against a local copy of current main. No merchant images/network are required.
chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
check('browser_binary_available',bool(chrome),chrome or 'not found')

PROBE=r'''<script>
(()=>{
 const root=document.documentElement,start=Date.now();
 const done=(status)=>{root.dataset.qaReady=status};
 const tick=setInterval(()=>{
   if(window.__TP_PACKED_BROWSE__?.ready===true){
     clearInterval(tick);
     const cards=()=>[...document.querySelectorAll('[data-v209-card]')];
     const sel=document.querySelector('[data-filter-merchant]');
     const options=[...sel.options].map(o=>o.textContent.trim());
     const before=cards().length;
     const more=document.querySelector('[data-v2078-load-more]');
     const moreVisible=!!more && !more.hidden;
     if(moreVisible)more.click();
     const after=cards().length;
     let ali=0,tik=0,filterOk=1;
     if(options.includes('AliExpress')){sel.value='AliExpress';sel.dispatchEvent(new Event('change',{bubbles:true}));ali=cards().length;if(!cards().every(x=>x.dataset.v209Seller==='AliExpress'))filterOk=0;}
     if(options.includes('TikTok Shop US')){sel.value='TikTok Shop US';sel.dispatchEvent(new Event('change',{bubbles:true}));tik=cards().length;if(!cards().every(x=>x.dataset.v209Seller==='TikTok Shop US'))filterOk=0;}
     sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}));
     root.dataset.qaMode=window.__TP_PACKED_BROWSE__.mode||'';
     root.dataset.qaRecords=String(window.__TP_PACKED_BROWSE__.recordCount||0);
     root.dataset.qaSellers=encodeURIComponent(options.join('|'));
     root.dataset.qaBefore=String(before);root.dataset.qaAfter=String(after);
     root.dataset.qaMoreVisible=moreVisible?'1':'0';root.dataset.qaFilterOk=String(filterOk);
     root.dataset.qaAli=String(ali);root.dataset.qaTik=String(tik);
     done('1');
   } else if(Date.now()-start>3500){clearInterval(tick);done('timeout');}
 },50);
})();
</script>'''

def make_probe(name):
    src=(ROOT/'find/index.html').read_text(encoding='utf-8')
    dst=OUT/name
    dst.write_text(src.replace('</body>',PROBE+'\n</body>'),encoding='utf-8')
    return dst

def attrs(html):
    m=re.search(r'<html\b([^>]*)>',html,re.I|re.S)
    text=m.group(1) if m else ''
    return {k:v for k,v in re.findall(r'data-qa-([\w-]+)="([^"]*)"',text,re.I)}

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

if chrome:
    shoes_probe=make_probe('qa-shoes.html');popular_probe=make_probe('qa-popular.html')
    handler=lambda *a,**kw:Quiet(*a,directory=str(ROOT),**kw)
    server=ThreadingHTTPServer(('127.0.0.1',4173),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();time.sleep(.2)
    def dump(path,q):
        url=f'http://127.0.0.1:4173/artifacts/v21-13-8-local-browser/{path}?q={q}&engine=v2064&universal=1&ui=2138'
        cmd=[chrome,'--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--blink-settings=imagesEnabled=false','--virtual-time-budget=5000','--dump-dom',url]
        p=subprocess.run(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=25)
        return p.returncode,p.stdout,p.stderr[-3000:]
    try:
        rc,dom,err=dump('qa-shoes.html','shoes');a=attrs(dom);report['evidence']['browser_shoes']={'rc':rc,'attrs':a,'stderr':err}
        check('browser_shoes_ready',a.get('ready')=='1',a)
        check('browser_shoes_mode',a.get('mode')=='footwear',a)
        check('browser_shoes_sellers',urllib.request.unquote(a.get('sellers',''))=='All%20sellers' if False else urllib.parse.unquote(a.get('sellers',''))=='All sellers|AliExpress|TikTok Shop US',a)
        before=int(a.get('before','0') or 0);after=int(a.get('after','0') or 0)
        check('browser_shoes_initial_fast',before>=20,a)
        check('browser_more_visible',a.get('more-visible')=='1',a)
        check('browser_more_adds_products',after>before,a)
        check('browser_seller_filters_work',a.get('filter-ok')=='1' and int(a.get('ali','0') or 0)>0 and int(a.get('tik','0') or 0)>0,a)
        rc2,dom2,err2=dump('qa-popular.html','popular%20products');b=attrs(dom2);report['evidence']['browser_popular']={'rc':rc2,'attrs':b,'stderr':err2}
        pop_opts=urllib.parse.unquote(b.get('sellers',''))
        check('browser_popular_ready',b.get('ready')=='1' and b.get('mode')=='broad',b)
        check('browser_popular_many_sellers',len(pop_opts.split('|'))>=10,pop_opts)
        check('browser_popular_key_sellers',all(x in pop_opts.split('|') for x in ['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying']),pop_opts)
    except Exception as e:
        check('local_browser_probe',False,repr(e))
    finally:
        server.shutdown();server.server_close()

report['passed']=not report['failures'] and all(report['checks'].values())
(OUT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(report,indent=2,ensure_ascii=False))
raise SystemExit(0 if report['passed'] else 1)
