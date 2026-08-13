(() => {
  "use strict";

  const EXACT_ALIBABA_RE = /https?:\/\/(?:[^/]+\.)?alibaba\.com\/product-detail\/[^?#]+\.html(?:[?#].*)?$/i;
  const hostOf = (u) => { try { return new URL(u, location.href).hostname; } catch { return ""; } };
  const isAlibaba = (u) => /(^|\.)alibaba\.com$/i.test(hostOf(u));
  const isTikTok = (u) => /(^|\.)tiktok\.com$/i.test(hostOf(u));

  const style = document.createElement("style");
  style.id = "tp-v20-6-9-compact-title-style";
  style.textContent = `
    .offer-card h3,
    .product-card h3,
    .product-card .product-title,
    .product-card [data-product-title],
    [data-product-card] h3,
    [data-product-card] [data-product-title],
    .tp-product-title {
      font-size: clamp(0.92rem, 2.8vw, 1.08rem) !important;
      line-height: 1.32 !important;
      font-weight: 700 !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 3 !important;
      -webkit-box-orient: vertical !important;
      overflow: hidden !important;
      margin-block: 0.45rem 0.55rem !important;
    }

    .tp-destination-note {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      font-size: .76rem;
      line-height: 1.25;
      opacity: .76;
      margin-top: .35rem;
    }

    .tp-destination-note[data-kind="warning"] {
      opacity: .88;
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  function cardFor(el) {
    return el.closest("article, .offer-card, .product-card, [data-product-card], [data-product], .result-card");
  }

  function buttonLike(anchor) {
    const txt = (anchor.textContent || "").trim();
    const cls = String(anchor.className || "");
    return /buy|view|open|shop|deal|price|offer|visit|↗/i.test(txt) ||
           /button|action|cta|buy|shop|offer/i.test(cls);
  }

  function setLabel(anchor, label) {
    if (!buttonLike(anchor)) return;
    if (anchor.children.length === 0) {
      anchor.textContent = label;
      return;
    }
    anchor.setAttribute("aria-label", label);
  }

  function ensureNote(card, text, kind = "info") {
    if (!card) return;
    if ([...card.querySelectorAll(".tp-destination-note")].some(n => n.textContent === text)) return;
    const note = document.createElement("div");
    note.className = "tp-destination-note";
    note.dataset.kind = kind;
    note.textContent = text;
    const body = card.querySelector(".offer-card-body, .product-card-body, .card-body") || card;
    body.appendChild(note);
  }

  function processAlibaba(anchor) {
    const href = anchor.href || "";
    if (!isAlibaba(href)) return;
    const card = cardFor(anchor);
    const exact = EXACT_ALIBABA_RE.test(href);

    if (!exact) {
      setLabel(anchor, "Search on Alibaba");
      anchor.setAttribute("aria-label", "Search on Alibaba — exact product page not proven");
      anchor.title = "This route is not proven to land on the exact product page.";
      ensureNote(card, "Alibaba: exact product link not proven", "warning");

      if (card) {
        card.querySelectorAll(".verified-corner, .direct-product, [data-direct-product]").forEach((badge) => {
          if (/direct product/i.test(badge.textContent || "")) badge.textContent = "Seller route";
        });
      }
    } else {
      setLabel(anchor, "View exact product");
      anchor.setAttribute("aria-label", "View exact Alibaba product");
    }
  }

  function processTikTok(anchor) {
    const href = anchor.href || "";
    if (!isTikTok(href)) return;
    const card = cardFor(anchor);
    setLabel(anchor, "Check availability");
    anchor.setAttribute("aria-label", "Check current availability on TikTok");
    ensureNote(card, "TikTok availability can change", "info");
  }

  function compactTitles(root = document) {
    root.querySelectorAll(
      ".offer-card h3, .product-card h3, .product-card .product-title, " +
      ".product-card [data-product-title], [data-product-card] h3, " +
      "[data-product-card] [data-product-title]"
    ).forEach(el => el.classList.add("tp-product-title"));
  }

  function process(root = document) {
    compactTitles(root);

    root.querySelectorAll('a[href^="http"]').forEach((a) => {
      processAlibaba(a);
      processTikTok(a);
    });

    root.querySelectorAll("article, .offer-card, .product-card, [data-product-card]").forEach((card) => {
      const text = (card.textContent || "").toLowerCase();
      if (!text.includes("tiktok")) return;
      const media = card.querySelector(".offer-media, .product-media, .card-media, [data-product-media]");
      if (!media || media.querySelector("img[src]")) return;

      const holder = card.querySelector(
        "[data-image], [data-image-url], [data-thumbnail], [data-thumbnail-url], [data-cover], [data-cover-url]"
      ) || card;

      const possible = [
        holder.dataset?.image,
        holder.dataset?.imageUrl,
        holder.dataset?.thumbnail,
        holder.dataset?.thumbnailUrl,
        holder.dataset?.cover,
        holder.dataset?.coverUrl,
      ].find(v => /^https?:\/\//i.test(String(v || "")));

      if (possible) {
        const img = document.createElement("img");
        img.src = possible;
        img.alt = (card.querySelector("h3, .product-title")?.textContent || "TikTok product").trim();
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.setAttribute("data-product-image", "");
        media.prepend(img);
        media.classList.add("image-ready");
      }
    });
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      process(document);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
