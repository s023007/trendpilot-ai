(function(){
  'use strict';
  function track(name, params){
    if(typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  document.querySelectorAll('[data-video-embed]').forEach(function(shell){
    var button = shell.querySelector('[data-video-load]');
    if(!button) return;
    button.addEventListener('click', function(){
      var src = shell.getAttribute('data-video-src');
      var title = shell.getAttribute('data-video-title') || 'Video';
      if(!src) return;
      var iframe = document.createElement('iframe');
      iframe.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1';
      iframe.title = title;
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      shell.replaceChildren(iframe);
      track('video_start', {video_title:title, page_location:location.href});
    }, {once:true});
  });
  document.querySelectorAll('[data-share-page]').forEach(function(button){
    button.addEventListener('click', async function(){
      var title = button.getAttribute('data-share-title') || document.title;
      var text = button.getAttribute('data-share-text') || '';
      var url = button.getAttribute('data-share-url') || location.href;
      var status = button.parentElement.querySelector('[data-share-status]');
      try{
        if(navigator.share){
          await navigator.share({title:title,text:text,url:url});
          if(status) status.textContent = 'Shared';
        }else if(navigator.clipboard){
          await navigator.clipboard.writeText(url);
          if(status) status.textContent = 'Link copied';
        }else{
          window.prompt('Copy this link:', url);
        }
        track('share', {method:navigator.share?'native':'copy', content_type:'guide', item_id:location.pathname});
      }catch(error){
        if(error && error.name !== 'AbortError' && status) status.textContent = 'Copy the page link';
      }
    });
  });
})();
