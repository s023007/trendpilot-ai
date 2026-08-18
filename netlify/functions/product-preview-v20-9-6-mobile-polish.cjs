const previous = require("./product-preview-v20-9-6.cjs");

function polish(body){
  if(!body || !/<html/i.test(body)) return body;
  if(!/trendpilot-calm-dark-v21\.css/i.test(body)) body=body.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/trendpilot-calm-dark-v21.css?v=21.0.0"></head>');
  if(!/trendpilot-graphite-navy-v21-1\.css/i.test(body)) body=body.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/trendpilot-graphite-navy-v21-1.css?v=21.1.0"></head>');
  if(!/visitor-context-v21-17\.js/i.test(body)) body=body.replace(/<\/head>/i,'<script src="/js/visitor-context-v21-17.js?v=21.17.0"></script><script defer src="/js/tiktok-us-geo-v21-17.js?v=21.17.0"></script></head>');
  body=body.replace(/<meta name="theme-color" content="[^"]*">/i,'<meta name="theme-color" content="#121721">');

  const css = `
/* V20.9.6 mobile polish: presentation only; product/search/seller truth is unchanged. */
#seller-offers{padding:16px 14px!important;margin-top:14px!important}
#seller-offers>.eyebrow{font-size:12px!important;margin-bottom:3px!important}
#seller-offers>h2{font-size:24px!important;line-height:1.08!important;margin:3px 0 12px!important}
#seller-offers .seller-card{padding:11px 12px!important;border-radius:16px!important}
#seller-offers .seller-card h3{font-size:18px!important;line-height:1.15!important;margin-bottom:2px!important}
#seller-offers .seller-card .seller-top p{font-size:13px!important;line-height:1.3!important}
#seller-offers .seller-card .cta{margin-top:8px!important;padding:9px 12px!important}
#seller-offers .route-note{font-size:11px!important;line-height:1.35!important;margin-top:6px!important}
#seller-offers .catalogue-records{margin-top:8px!important;padding-top:7px!important}
.technical-disclosure{margin-top:10px!important}
.technical-disclosure .identity-inside{margin:8px 2px 0!important;padding-top:8px!important;border-top:1px solid #e8edeb!important}
.bottom{transition:transform .18s ease,opacity .18s ease!important;will-change:transform}
.bottom.tp-nav-hidden{transform:translateY(calc(100% + 14px))!important;opacity:0!important;pointer-events:none!important}
@media(max-width:650px){
  main{padding-bottom:72px!important}
  .hero h1{font-size:clamp(21px,5.35vw,24px)!important;line-height:1.06!important}
  #seller-offers{padding:14px 12px!important}
  #seller-offers>h2{font-size:22px!important;margin-bottom:9px!important}
  #seller-offers .seller-card{padding:10px 11px!important}
  .bottom{left:22px!important;right:22px!important;bottom:4px!important;padding:2px 4px!important;border-radius:16px!important}
  .bottom a{min-height:34px!important;font-size:9.5px!important;padding:0 4px!important}
}
`;

  const styleEnd = body.lastIndexOf("</style>");
  if(styleEnd >= 0) body = body.slice(0,styleEnd) + css + body.slice(styleEnd);

  const script = `<script>(()=>{const run=()=>{
    const clean=v=>String(v??'').replace(/\\s+/g,' ').trim();
    const seller=document.querySelector('#seller-offers');
    if(seller){
      const h=seller.querySelector('h2');
      if(h&&/^Seller option$/i.test(clean(h.textContent))) h.textContent='Where to buy';
    }
    const tech=document.querySelector('.technical-disclosure');
    const content=tech?.querySelector('.technical-disclosure-content');
    if(content){
      const identity=[...document.querySelectorAll('details')].find(d=>/Technical identity details/i.test(clean(d.querySelector('summary')?.textContent)));
      if(identity&&!identity.closest('.technical-disclosure')){
        identity.classList.add('identity-inside');
        content.appendChild(identity);
      }
    }
    const nav=document.querySelector('.bottom');
    if(nav){
      let last=window.scrollY;
      let ticking=false;
      const update=()=>{
        const y=window.scrollY;
        const nearBottom=(window.innerHeight+y)>=(document.documentElement.scrollHeight-90);
        if(y<90||nearBottom||y<last-8) nav.classList.remove('tp-nav-hidden');
        else if(y>last+8) nav.classList.add('tp-nav-hidden');
        last=y;
        ticking=false;
      };
      window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
    }
  };if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();})();</script>`;

  let out = body.replace(/<\/body>/i,`${script}</body>`);
  if(!/seller-handoff-v21-15\.js/i.test(out)) out=out.replace(/<\/body>/i,'<script defer src="/js/seller-handoff-v21-15.js?v=21.15.0"></script></body>');
  if(!/post-intelligence-v21\.js/i.test(out)) out=out.replace(/<\/body>/i,'<script defer src="/js/post-intelligence-v21.js?v=21.1.1"></script></body>');
  if(!/product-confidence-v21-2\.js/i.test(out)) out=out.replace(/<\/body>/i,'<script defer src="/js/product-confidence-v21-2.js?v=21.2.0"></script></body>');
  return out;
}

exports.handler=async function(event,context){
  const res=await previous.handler(event,context);
  const type=String(res?.headers?.["content-type"]||res?.headers?.["Content-Type"]||"");
  if(res?.statusCode===200 && /text\/html/i.test(type)){
    res.body=polish(res.body);
    res.headers={...(res.headers||{}),"cache-control":"no-cache","x-trendpilot-mobile-polish":"20.9.6","x-trendpilot-internal-first":"21.15.0","x-trendpilot-tiktok-geo":"21.17.0","x-trendpilot-browser-compat":"21.17.0","x-trendpilot-post-intelligence":"21.1.1","x-trendpilot-product-confidence":"21.2.0"};
  }
  return res;
};
