import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const ROOT=path.resolve('.');
const source=fs.readFileSync(path.join(ROOT,'js/packed-browse-v21-13-8.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'find/index.html'),'utf8');
const BAD=/(?:cosplay|costume|snow\s*blower|skid\s*(?:plate|shoe)|flooring\s*installation|epoxy\s*shoe|temperature\s*control\s*iron|bunion|toe\s*(?:separator|corrector)|labubu|doll\s*(?:clothes|shoes)|pet\s*(?:shoes|bed|house)|dog\s*(?:boots|shoes|booties)|cleaning\s*cream|shoe\s*(?:cleaner|rack|bag|box|cover|accessor|machine|making|repair|glue|charm|clip|buckle|pendant)|boot\s*cut|bootcut|baggy\s*jeans|straight\s*jeans|phone\s*case|airpods?|cold\s*shoe|hot\s*shoe|bottle\s*opener|wine\s*rack|anti-clog|clog\s*remover|brake\s*shoe|medical\s*boot|walking\s*boot\s*brace|christmas|xmas)/i;
const result={version:'21.13.8',passed:false,checks:{},failures:[],evidence:{}};
const check=(name,ok,detail='')=>{result.checks[name]=!!ok;if(!ok)result.failures.push({name,detail:String(detail)})};

function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}}
function localFetch(url){
  const u=String(url).split('?')[0];
  const file=path.join(ROOT,u.replace(/^\//,''));
  if(!fs.existsSync(file)) return Promise.resolve(new Response('not found',{status:404}));
  return Promise.resolve(new Response(fs.readFileSync(file),{status:200,headers:{'content-type':'application/json'}}));
}
async function waitReady(window,timeout=3000){
  const start=Date.now();
  while(Date.now()-start<timeout){if(window.__TP_PACKED_BROWSE__?.ready===true)return window.__TP_PACKED_BROWSE__;await new Promise(r=>setTimeout(r,10))}
  throw new Error(`packed runtime timeout: ${JSON.stringify(window.__TP_PACKED_BROWSE__)}`);
}
async function run(query){
  const {window}=parseHTML(html);
  const document=window.document;
  const location={search:`?q=${encodeURIComponent(query)}&engine=v2064&universal=1&ui=2138`,assign:()=>{}};
  const ls=storage();
  const context=vm.createContext({
    window,document,location,localStorage:ls,fetch:localFetch,Response,URLSearchParams,encodeURIComponent,
    console,setTimeout,clearTimeout,setInterval,clearInterval,Date,Number,String,Array,Object,Set,Map,Math,JSON,RegExp,
  });
  window.localStorage=ls;window.fetch=localFetch;window.location=location;
  vm.runInContext(source,context,{filename:'packed-browse-v21-13-8.js'});
  const runtime=await waitReady(window);
  return {window,document,runtime};
}
function choose(select,value,window){
  const opts=[...select.querySelectorAll('option')];
  for(const o of opts)o.removeAttribute('selected');
  const target=opts.find(o=>o.getAttribute('value')===value);
  if(!target)throw new Error(`Option not found: ${value}`);
  target.setAttribute('selected','selected');
  select.dispatchEvent(new window.Event('change',{bubbles:true}));
}

try{
  const shoes=await run('shoes');
  const cards=()=>[...shoes.document.querySelectorAll('[data-v209-card]')];
  const options=()=>[...shoes.document.querySelectorAll('[data-filter-merchant] option')].map(x=>x.textContent.trim());
  const titles=()=>[...shoes.document.querySelectorAll('[data-v209-card] h3')].map(x=>x.textContent.trim());
  const before=cards().length;
  result.evidence.shoes={runtime:shoes.runtime,before,options:options(),titles:titles().slice(0,30)};
  check('shoes_runtime_mode',shoes.runtime.mode==='footwear',JSON.stringify(shoes.runtime));
  check('shoes_initial_24',before===24,`before=${before}`);
  check('shoes_seller_options',JSON.stringify(options())===JSON.stringify(['All sellers','AliExpress','TikTok Shop US']),JSON.stringify(options()));
  check('shoes_initial_purity',titles().every(t=>!BAD.test(t)),titles().join(' | '));
  const more=shoes.document.querySelector('[data-v2078-load-more]');
  check('show_more_visible',more && !more.hidden,`hidden=${more?.hidden}`);
  more?.dispatchEvent(new shoes.window.Event('click',{bubbles:true}));
  const after=cards().length;
  result.evidence.shoes.after=after;
  check('show_more_adds_24',after===48,`${before}->${after}`);
  check('show_more_deep_purity',titles().every(t=>!BAD.test(t)),titles().join(' | '));
  const sel=shoes.document.querySelector('[data-filter-merchant]');
  for(const seller of ['AliExpress','TikTok Shop US']){
    choose(sel,seller,shoes.window);
    const names=cards().map(x=>x.getAttribute('data-v209-seller'));
    check(`seller_filter_${seller.replace(/\W+/g,'_')}`,names.length>0&&names.every(x=>x===seller),names.join(', '));
  }

  const popular=await run('popular products');
  const popCards=[...popular.document.querySelectorAll('[data-v209-card]')];
  const popOptions=[...popular.document.querySelectorAll('[data-filter-merchant] option')].map(x=>x.textContent.trim());
  result.evidence.popular={runtime:popular.runtime,cards:popCards.length,options:popOptions};
  check('popular_runtime_mode',popular.runtime.mode==='broad',JSON.stringify(popular.runtime));
  check('popular_initial_24',popCards.length===24,`cards=${popCards.length}`);
  check('popular_many_sellers',popOptions.length>=10,JSON.stringify(popOptions));
  check('popular_key_sellers',['Alibaba','AliExpress','TikTok Shop US','Lenovo','Geekbuying'].every(x=>popOptions.includes(x)),JSON.stringify(popOptions));
  check('popular_no_blocked',!popOptions.some(x=>/^(?:Temu|Joom|FilamentPRO)$/i.test(x)),JSON.stringify(popOptions));
}catch(e){result.failures.push({name:'exception',detail:String(e?.stack||e)})}
result.passed=result.failures.length===0&&Object.values(result.checks).every(Boolean);
const OUT=path.join(ROOT,'artifacts/v21-13-8-dom');fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
process.exit(result.passed?0:1);
