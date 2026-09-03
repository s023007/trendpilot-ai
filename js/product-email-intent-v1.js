(function(){
  'use strict';
  var body=document.body;
  if(!body||body.dataset.tpPage!=='sa-aliexpress-product-pilot') return;

  var cfg={
    campaign:'sa_tire_inflator_aliexpress',
    seller:'AliExpress',
    productId:'',title:'',price:'',offerUrl:'',
    endpoint:'https://api.trendpilotchoice.com/save-search.php'
  };

  function qs(sel,ctx){return (ctx||document).querySelector(sel);}
  function qsa(sel,ctx){return Array.prototype.slice.call((ctx||document).querySelectorAll(sel));}
  function clean(v,n){return String(v||'').trim().slice(0,n||300);}
  function params(){return new URLSearchParams(location.search||'');}
  function push(name,data){
    var payload=Object.assign({event:name,product_id:cfg.productId,merchant:cfg.seller,product_title:cfg.title},data||{});
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push(payload);
    try{if(typeof window.gtag==='function')window.gtag('event',name,payload);}catch(e){}
  }
  function paidContext(){
    var p=params(),keys=['gclid','gbraid','wbraid','utm_source','utm_medium','utm_campaign','utm_term','utm_content'],out={};
    keys.forEach(function(k){var v=clean(p.get(k),220);if(v)out[k]=v;});
    try{
      var saved=JSON.parse(sessionStorage.getItem('tp_paid_context')||localStorage.getItem('tp_paid_context')||'{}');
      keys.forEach(function(k){if(!out[k]&&saved&&saved[k])out[k]=clean(saved[k],220);});
    }catch(e){}
    return out;
  }

  var modal=qs('#tp-email-intent-modal');
  var form=qs('#tp-email-intent-form');
  var email=qs('#tp-email-intent-email');
  var status=qs('#tp-email-intent-status');
  var submit=qs('#tp-email-intent-submit');
  var direct=qs('#tp-email-direct');
  var productName=qs('#tp-email-product-name');

  function selectProduct(a){
    cfg.productId=clean(a&&a.dataset.productId,120);
    cfg.title=clean(a&&a.dataset.productTitle,220)||'منفاخ إطارات';
    cfg.price=clean(a&&a.dataset.price,80);
    cfg.seller=clean(a&&a.dataset.seller,80)||'AliExpress';
    cfg.offerUrl=(a&&a.dataset.offerUrl)||(a&&a.href)||'';
    if(productName)productName.textContent=cfg.title;
    if(direct&&cfg.offerUrl)direct.href=cfg.offerUrl;
  }

  function openModal(a){
    if(!modal)return;
    selectProduct(a);
    modal.dataset.source=(a&&a.dataset.source)||'product_card';
    if(status){status.textContent='';status.className='tp-email-status';}
    if(submit){submit.disabled=false;submit.textContent='احفظ وافتح العرض';}
    modal.hidden=false;
    push('purchase_email_modal_open',{source:modal.dataset.source});
    setTimeout(function(){if(email)email.focus();},80);
  }
  function closeModal(){if(modal)modal.hidden=true;}

  qsa('[data-email-gate]').forEach(function(a){
    a.addEventListener('click',function(e){
      if(!modal)return;
      e.preventDefault();
      openModal(a);
    });
  });
  qsa('[data-close-email-intent]').forEach(function(el){el.addEventListener('click',closeModal);});
  if(modal)modal.addEventListener('click',function(e){if(e.target===modal)closeModal();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&modal&&!modal.hidden)closeModal();});

  if(direct){
    direct.addEventListener('click',function(){
      push('seller_outbound_click',{source:'continue_without_email',page_path:location.pathname});
    });
  }

  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=190;}
  if(form){
    form.addEventListener('submit',async function(e){
      e.preventDefault();
      var value=clean(email&&email.value,190);
      if(!validEmail(value)){
        if(status){status.textContent='اكتب بريدًا إلكترونيًا صحيحًا.';status.className='tp-email-status is-error';}
        if(email)email.focus();
        return;
      }
      if(!cfg.offerUrl){
        if(status){status.textContent='تعذر تجهيز رابط العرض.';status.className='tp-email-status is-error';}
        return;
      }
      if(submit){submit.disabled=true;submit.textContent='لحظة…';}
      var ctx=paidContext();
      var payload=Object.assign({
        campaign_id:cfg.campaign,
        email:value,
        updates:'exact_product_link',
        lang:'ar',seller:cfg.seller,price:cfg.price,
        product_id:cfg.productId,product_title:cfg.title,offer_url:cfg.offerUrl,
        page_url:location.origin+location.pathname+location.search,
        alert_opt_in:false,
        source_event:'PURCHASE_EMAIL_INTENT',
        source_label:modal&&modal.dataset.source?modal.dataset.source:'sa_tire_inflator_purchase'
      },ctx);
      try{
        var r=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),credentials:'omit',mode:'cors'});
        var data={};try{data=await r.json();}catch(_e){}
        if(!r.ok||!data||data.ok!==true)throw new Error((data&&data.error)||('HTTP_'+r.status));
        push('PURCHASE_EMAIL_INTENT',{source:payload.source_label,lead_id:clean(data.lead_id,32),has_gclid:!!ctx.gclid});
        if(status){status.textContent='✓ تم الحفظ — نفتح العرض الآن.';status.className='tp-email-status is-success';}
        setTimeout(function(){location.assign(cfg.offerUrl);},260);
      }catch(err){
        push('purchase_email_intent_error',{reason:clean(err&&err.message,120)});
        if(status){status.textContent='تعذر حفظ البريد الآن. يمكنك المتابعة للعرض مباشرة.';status.className='tp-email-status is-error';}
        if(submit){submit.disabled=false;submit.textContent='حاول مرة أخرى';}
      }
    });
  }
})();
