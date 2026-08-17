const fs=require('fs');
const path=require('path');

const days=Math.max(1,Math.min(90,Number(process.argv[2]||7)));
const dir=process.env.TP_ANALYTICS_DIR||path.join(process.env.HOME||process.cwd(),'trendpilot-analytics');
const cutoff=Date.now()-days*86400000;
const rows=[];
try{
  for(const name of fs.readdirSync(dir)){
    if(!/^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))continue;
    const full=path.join(dir,name);
    const text=fs.readFileSync(full,'utf8');
    for(const line of text.split(/\r?\n/)){
      if(!line.trim())continue;
      try{
        const e=JSON.parse(line);
        const ts=Date.parse(e.server_ts||'');
        if(Number.isFinite(ts)&&ts>=cutoff)rows.push(e);
      }catch{}
    }
  }
}catch(err){
  console.error('No analytics data found at',dir);
  process.exitCode=1;
  return;
}

const map=new Map();
for(const e of rows){
  const post=e.post_id||'(unattributed)';
  const angle=e.angle_id||'(none)';
  const key=post+'\t'+angle;
  if(!map.has(key))map.set(key,{post,angle,page_view:0,product_detail_click:0,product_view:0,seller_click:0,compare_click:0,sessions:new Set(),sellers:new Set()});
  const x=map.get(key);
  if(Object.prototype.hasOwnProperty.call(x,e.event))x[e.event]++;
  if(e.session_id)x.sessions.add(e.session_id);
  if(e.seller)x.sellers.add(e.seller);
}
const pct=(n,d)=>d?`${(100*n/d).toFixed(1)}%`:'0.0%';
const out=[...map.values()].map(x=>({
  post:x.post,
  angle:x.angle,
  sessions:x.sessions.size,
  page_views:x.page_view,
  product_views:x.product_view,
  seller_clicks:x.seller_click,
  seller_click_rate:pct(x.seller_click,x.product_view||x.page_view),
  detail_clicks:x.product_detail_click,
  detail_click_rate:pct(x.product_detail_click,x.page_view),
  compare_clicks:x.compare_click,
  sellers:[...x.sellers].join('|')
})).sort((a,b)=>b.seller_clicks-a.seller_clicks||b.product_views-a.product_views||b.sessions-a.sessions);

console.log(`TrendPilot post-intelligence summary — last ${days} day(s)`);
console.log(`Events: ${rows.length} | attributed groups: ${out.length}`);
console.table(out.slice(0,40));
