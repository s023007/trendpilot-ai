(() => {
  'use strict';

  const d = document;
  const TIKTOK_TEXT = /\bTikTok\s*Shop(?:\s*US)?\b/i;
  const TIKTOK_HOST = /(?:^|\.)(?:tiktok\.com|tiktokshop\.com)$/i;
  const CARD_SELECTOR = [
    '.tp78-card','.tp90-product','.tp214-deal','.tp214-coupon','.tp80-rare-card',
    '.tp-ticket-v141-card','.product-card','.offer-card','.deal-card','.result-card',
    '[data-v209-card]','[data-product-card]','[data-product]','[data-offer-id]','[data-seller]'
  ].join(',');
  const DETAIL_PATH = /^\/(?:item|product|deal|coupon|rare-used\/view|rare-used\/finds)(?:\/|$)/i;

  const clean = value => String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  const country = () => String(window.__TP_VISITOR_COUNTRY__ || 'ZZ').toUpperCase();
  const allowed = () => window.__TP_ALLOW_TIKTOK_US__ === true;
  const hostOf = href => { try { return new URL(href, location.href).hostname.toLowerCase(); } catch (_) { return ''; } };
  const isTikTokHref = href => TIKTOK_HOST.test(hostOf(href));

  function dataSeller(el) {
    if (!el) return '';
    return clean(
      (el.dataset && (el.dataset.v209Seller || el.dataset.seller || el.dataset.merchant)) ||
      (el.getAttribute && (el.getAttribute('data-seller-name') || el.getAttribute('data-merchant-name'))) || ''
    );
  }

  function isTikTokNode(el) {
    if (!(el instanceof Element)) return false;
    if (TIKTOK_TEXT.test(dataSeller(el))) return true;
    if (el.matches('option') && TIKTOK_TEXT.test(clean(el.textContent))) return true;
    const anchors = el.querySelectorAll ? el.querySelectorAll('a[href]') : [];
    for (const a of anchors) if (isTikTokHref(a.getAttribute('href') || a.href || '')) return true;
    const named = el.querySelector && el.querySelector('[data-seller-name],.seller,.merchant,.tp78-top span,.tp214-meta strong,.tp214-coupon-top strong');
    return TIKTOK_TEXT.test(clean(named && named.textContent));
  }

  function markUS(el) {
    if (!(el instanceof Element) || el.dataset.tpTikTokUsMarked === '1') return;
    el.dataset.tpTikTokUsMarked = '1';
    if (el.querySelector && el.querySelector('[data-tp-us-only]')) return;
    const badge = d.createElement('span');
    badge.setAttribute('data-tp-us-only','1');
    badge.className = 'tp-us-only-badge';
    badge.textContent = 'US only';
    const target = (el.querySelector && el.querySelector('.tp78-top,.tp214-meta,.tp214-coupon-top,.tp90-type')) || el;
    target.appendChild(badge);
  }

  function removeOption(opt) {
    if (!(opt instanceof HTMLOptionElement) || !TIKTOK_TEXT.test(clean(opt.textContent))) return;
    const select = opt.parentElement;
    const selected = opt.selected;
    opt.remove();
    if (selected && select instanceof HTMLSelectElement) {
      select.value = '';
      setTimeout(() => select.dispatchEvent(new Event('change',{bubbles:true})), 0);
    }
  }

  function processNode(root) {
    if (!(root instanceof Element || root instanceof Document)) return;

    const options = [];
    if (root instanceof HTMLOptionElement) options.push(root);
    if (root.querySelectorAll) root.querySelectorAll('option').forEach(x => options.push(x));
    if (!allowed()) options.forEach(removeOption);

    const cards = [];
    if (root instanceof Element && root.matches(CARD_SELECTOR)) cards.push(root);
    if (root.querySelectorAll) root.querySelectorAll(CARD_SELECTOR).forEach(x => cards.push(x));
    for (const card of cards) {
      if (!isTikTokNode(card)) continue;
      if (allowed()) markUS(card);
      else card.remove();
    }
  }

  function replaceRestrictedDetail() {
    if (allowed() || !DETAIL_PATH.test(location.pathname)) return;
    const main = d.querySelector('main');
    if (!main || main.dataset.tpTikTokRegionBlocked === '1') return;
    const anchors = main.querySelectorAll('a[href]');
    let hasTikTokLink = false;
    for (const a of anchors) {
      if (isTikTokHref(a.getAttribute('href') || a.href || '')) { hasTikTokLink = true; break; }
    }
    const named = main.querySelector('[data-seller-name],.seller,.merchant,#seller-offers,.tp214-detail');
    const explicitSeller = TIKTOK_TEXT.test(clean(named && named.textContent));
    if (!hasTikTokLink && !explicitSeller) return;
    main.dataset.tpTikTokRegionBlocked = '1';
    main.innerHTML = `<section class="tp-section"><div class="tp-shell"><article class="tp-geo-region-card"><span class="tp-kicker">Regional availability</span><h1>TikTok Shop US is shown only to visitors in the United States.</h1><p>This listing comes from TikTok Shop US. Your current region (${country() === 'ZZ' ? 'not detected' : country()}) is not eligible for TikTok Shop US results on TrendPilot.</p><div class="tp-geo-region-actions"><a class="tp-btn tp-btn-primary" href="/find/">Find products available to you</a><a class="tp-btn tp-btn-light" href="javascript:history.back()">Go back</a></div></article></div></section>`;
  }

  function protectHandoff() {
    if (allowed() || !location.pathname.startsWith('/handoff/')) return;
    const button = d.querySelector('[data-continue]');
    if (!button || !isTikTokHref(button.getAttribute('href') || button.href || '')) return;
    button.removeAttribute('href');
    button.setAttribute('aria-disabled','true');
    button.textContent = 'TikTok Shop US unavailable in your region';
    button.style.opacity = '.55';
    button.style.pointerEvents = 'none';
    const seller = d.querySelector('[data-seller]');
    const host = d.querySelector('[data-host]');
    if (seller) seller.textContent = 'TikTok Shop US — US only';
    if (host) host.textContent = `Not shown for ${country() === 'ZZ' ? 'undetected regions' : country()}`;
  }

  function refreshVisibleCounts() {
    if (allowed()) return;
    const finderGrid = d.querySelector('[data-v2078-product-grid]');
    if (!finderGrid || !window.__TP_PACKED_BROWSE_ACTIVE__) return;
    const visible = finderGrid.querySelectorAll('.tp78-card').length;
    const count = d.querySelector('[data-v2078-results-count]');
    if (count && visible === 0) count.textContent = '0 matching';
  }

  const style = d.createElement('style');
  style.id = 'tp-tiktok-us-geo-v21-17-style';
  style.textContent = `
    .tp-us-only-badge{display:inline-flex;align-items:center;justify-content:center;margin-inline-start:8px;padding:3px 8px;border-radius:999px;background:#eef3ff;color:#2744a7;font-size:11px;font-weight:800;line-height:1.2;white-space:nowrap}
    .tp-geo-region-card{max-width:760px;margin:24px auto;background:#fff;color:#0f172a;border-radius:28px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.18)}
    .tp-geo-region-card h1{color:#0b1220;font-size:clamp(30px,6vw,50px);line-height:1.08;margin:10px 0 14px}.tp-geo-region-card p{color:#475569;line-height:1.7}.tp-geo-region-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
  `;
  if (!d.getElementById(style.id)) d.head.appendChild(style);

  function start() {
    processNode(d);
    replaceRestrictedDetail();
    protectHandoff();
    refreshVisibleCounts();

    const pending = new Set();
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      pending.forEach(processNode);
      pending.clear();
      replaceRestrictedDetail();
      protectHandoff();
      refreshVisibleCounts();
    };
    const schedule = node => {
      if (node && node.nodeType === 1) pending.add(node);
      if (scheduled) return;
      scheduled = true;
      if (window.requestAnimationFrame) requestAnimationFrame(flush); else setTimeout(flush,16);
    };
    const observer = new MutationObserver(records => {
      for (const rec of records) rec.addedNodes.forEach(schedule);
    });
    observer.observe(d.documentElement,{subtree:true,childList:true});
  }

  const ready = window.__TP_GEO_READY__;
  if (ready && typeof ready.then === 'function') ready.then(start, start);
  else if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
