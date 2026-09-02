(function(){
  'use strict';
  var root=document.documentElement;
  var body=document.body;
  if(!body||body.dataset.tpPage!=='sa-aliexpress-product-pilot') return;

  var cfg={
    campaign:'sa_tire_inflator_aliexpress',
    seller:'AliExpress',
    price:'26.56 USD catalog',
    productId:'1005012667041964',
    offerUrl:body.dataset.offerUrl||'',
    endpoint:'https://api.trendpilotchoice.com/save-search.php',
    goEndpoint:'https://api.trendpilotchoice.com/go.php'
  };

  function qs(sel,ctx){return (ctx||document).querySelector(sel);}
  function qsa(sel,ctx){return Array.prototype.slice.call((ctx||document).querySelectorAll(sel));}
  function params(){return new URLSearchParams(location.search||'');}
  function clean(v,n){return String(v||'').trim().slice(0,n||300);}
  function push(name,data){
    var payload=Object.assign({event:name,product_id:cfg.productId,merchant:cfg.seller},data||{});
    window.dataLayer=window.dataLayer||[]; window.dataLayer.push(payload);
    try{ if(typeof window.gtag==='function') window.gtag('event',name,Object.assign({product_id:cfg.productId,merchant:cfg.seller},data||{})); }catch(e){}
  }
  function paidContext(){
    var p=params(), keys=['gclid','gbraid','wbraid','utm_source','utm_medium','utm_campaign','utm_term','utm_content'], out={};
    keys.forEach(function(k){var v=clean(p.get(k),220); if(v) out[k]=v;});
    try{
      var saved=JSON.parse(sessionStorage.getItem('tp_paid_context')||localStorage.getItem('tp_paid_context')||'{}');
      keys.forEach(function(k){if(!out[k]&&saved&&saved[k]) out[k]=clean(saved[k],220);});
    }catch(e){}
    return out;
  }
  function remember(source){
    try{sessionStorage.setItem('tp_last_product_intent',JSON.stringify({at:Date.now(),product_id:cfg.productId,merchant:cfg.seller,source:source||'unknown'}));}catch(e){}
  }
  function trackSeller(source){
    remember(source);
    push('seller_outbound_click',{source:source||'landing',page_path:location.pathname});
  }

  qsa('[data-direct-seller]').forEach(function(a){
    a.addEventListener('click',function(){trackSeller(a.dataset.source||'direct_cta');},{capture:true});
  });

  var modal=qs('#tp-email-intent-modal');
  var form=qs('#tp-email-intent-form');
  var email=qs('#tp-email-intent-email');
  var status=qs('#tp-email-intent-status');
  var submit=qs('#tp-email-intent-submit');
  var success=qs('#tp-email-intent-success');

  function openModal(source){
    if(!modal) return;
    modal.dataset.source=source||'email_cta';
    modal.hidden=false;
    body.classList.add('tp-modal-open');
    root.classList.add('tp-modal-open');
    push('product_email_modal_open',{source:modal.dataset.source});
    setTimeout(function(){if(email) email.focus();},50);
  }
  function closeModal(){
    if(!modal) return;
    modal.hidden=true;
    body.classList.remove('tp-modal-open');
    root.classList.remove('tp-modal-open');
  }
  qsa('[data-open-email-intent]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();openModal(b.dataset.source||'email_cta');});});
  qsa('[data-close-email-intent]').forEach(function(b){b.addEventListener('click',closeModal);});
  if(modal){modal.addEventListener('click',function(e){if(e.target===modal) closeModal();});}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&modal&&!modal.hidden)closeModal();});

  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=190;}
  if(form){
    form.addEventListener('submit',async function(e){
      e.preventDefault();
      var value=clean(email&&email.value,190);
      if(!validEmail(value)){
        if(status){status.textContent='اكتب بريدًا إلكترونيًا صحيحًا.';status.className='tp-email-status is-error';}
        if(email) email.focus(); return;
      }
      if(!cfg.offerUrl){if(status){status.textContent='تعذر تجهيز رابط المنتج. جرّب المتابعة بدون بريد.';status.className='tp-email-status is-error';}return;}
      if(submit){submit.disabled=true;submit.textContent='جاري إرسال الرابط…';}
      if(status){status.textContent='';status.className='tp-email-status';}
      var ctx=paidContext();
      var payload=Object.assign({
        campaign_id:cfg.campaign,
        email:value,
        updates:'exact_product_link',
        lang:'ar',
        seller:cfg.seller,
        price:cfg.price,
        offer_url:cfg.offerUrl,
        page_url:location.origin+location.pathname+location.search,
        alert_opt_in:true,
        source_event:'PRODUCT_EMAIL_INTENT',
        source_label:modal&&modal.dataset.source?modal.dataset.source:'sa_tire_inflator'
      },ctx);
      try{
        var r=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),credentials:'omit',mode:'cors'});
        var data={}; try{data=await r.json();}catch(_e){}
        if(!r.ok||!data||data.ok!==true) throw new Error((data&&data.error)||('HTTP_'+r.status));
        push('PRODUCT_EMAIL_INTENT',{source:payload.source_label,lead_id:clean(data.lead_id,32),has_gclid:!!ctx.gclid});
        if(form) form.hidden=true;
        if(success) success.hidden=false;
        if(status){status.textContent='تم إرسال رابط نفس المنتج إلى بريدك.';status.className='tp-email-status is-success';}
      }catch(err){
        push('product_email_intent_error',{reason:clean(err&&err.message,120)});
        if(status){status.textContent='تعذر إرسال البريد الآن. يمكنك متابعة العرض مباشرة بدون بريد.';status.className='tp-email-status is-error';}
      }finally{
        if(submit){submit.disabled=false;submit.textContent='أرسل رابط المنتج إلى بريدي';}
      }
    });
  }

  qsa('[data-email-success-seller]').forEach(function(a){a.addEventListener('click',function(){trackSeller('email_saved_continue');});});

  (function handleEmailReturn(){
    var p=params();
    if(p.get('return')!=='email-buy') return;
    var lead=clean(p.get('lead'),32), campaign=clean(p.get('campaign'),80), to=clean(p.get('to'),4000);
    push('EMAIL_BUY_INTENT',{source:'saved_email',lead_id:lead,campaign_id:campaign||cfg.campaign,has_destination:!!to});
    if(!lead||!to) return;
    var u=cfg.goEndpoint+'?lead='+encodeURIComponent(lead)+'&campaign='+encodeURIComponent(campaign||cfg.campaign)+'&mode=direct_buy&to='+encodeURIComponent(to);
    setTimeout(function(){location.replace(u);},120);
  })();
})();
