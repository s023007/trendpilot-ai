(() => {
  "use strict";

  const ALIBABA_EXACT_RE =
    /https?:\/\/(?:[^/]+\.)?alibaba\.com\/product-detail\/[^?#]+\.html(?:[?#].*)?$/i;

  const processedLinks = new WeakSet();
  const processedCards = new WeakSet();

  const hostOf = (href) => {
    try { return new URL(href, location.href).hostname.toLowerCase(); }
    catch { return ""; }
  };

  const isAlibaba = (href) => /(^|\.)alibaba\.com$/i.test(hostOf(href));
  const isTikTok = (href) => /(^|\.)tiktok\.com$/i.test(hostOf(href));

  const cardFor = (el) =>
    el.closest("article, .offer-card, .product-card, .result-card, [data-product-card], [data-product]");

  const looksLikeCTA = (a) => {
    const text = (a.textContent || "").trim();
    const cls = String(a.className || "");
    return /buy|view|open|shop|deal|price|offer|visit|check|↗/i.test(text) ||
           /button|action|cta|buy|shop|offer/i.test(cls);
  };

  const setTextSafely = (a, label) => {
    if (!looksLikeCTA(a)) return;
    if (a.children.length === 0 && (a.textContent || "").trim() !== label) {
      a.textContent = label;
    }
    if (a.getAttribute("aria-label") !== label) {
      a.setAttribute("aria-label", label);
    }
  };

  const ensureNote = (card, kind, text) => {
    if (!card) return;
    if (card.querySelector(`.tp-safe-note[data-kind="${kind}"]`)) return;

    const note = document.createElement("div");
    note.className = "tp-safe-note";
    note.dataset.kind = kind;
    note.textContent = text;

    const target =
      card.querySelector(".offer-card-body, .product-card-body, .card-body") || card;

    target.appendChild(note);
  };

  const processLink = (a) => {
    if (!(a instanceof HTMLAnchorElement) || processedLinks.has(a)) return;
    processedLinks.add(a);

    const href = a.href || "";
    if (!href) return;

    if (isAlibaba(href)) {
      if (ALIBABA_EXACT_RE.test(href)) {
        setTextSafely(a, "View exact product");
      } else {
        setTextSafely(a, "Search on Alibaba");
        a.title = "Exact Alibaba product page is not proven for this route.";
        ensureNote(
          cardFor(a),
          "alibaba-route",
          "Alibaba route may open a seller/search page instead of this exact product."
        );
      }
    }

    if (isTikTok(href)) {
      setTextSafely(a, "Check availability");
      a.title = "TikTok product availability can change.";
      ensureNote(
        cardFor(a),
        "tiktok-availability",
        "TikTok availability can change; confirm it after opening the offer."
      );
    }
  };

  const recoverTikTokImage = (card) => {
    if (!card || processedCards.has(card)) return;
    processedCards.add(card);

    const text = (card.textContent || "").toLowerCase();
    if (!text.includes("tiktok")) return;

    const media = card.querySelector(
      ".offer-media, .product-media, .card-media, [data-product-media]"
    );
    if (!media || media.querySelector("img[src]")) return;

    const holder =
      card.querySelector(
        "[data-image], [data-image-url], [data-thumbnail], " +
        "[data-thumbnail-url], [data-cover], [data-cover-url]"
      ) || card;

    const d = holder.dataset || {};
    const candidate = [
      d.image, d.imageUrl, d.thumbnail, d.thumbnailUrl, d.cover, d.coverUrl
    ].find(v => /^https?:\/\//i.test(String(v || "")));

    if (!candidate) return;

    const img = document.createElement("img");
    img.src = candidate;
    img.loading = "lazy";
    img.alt =
      (card.querySelector("h3, .product-title, [data-product-title]")?.textContent ||
        "TikTok product").trim();
    img.setAttribute("data-product-image", "");
    media.prepend(img);
  };

  const processRoot = (root) => {
    if (!(root instanceof Element || root instanceof Document)) return;

    if (root instanceof HTMLAnchorElement) processLink(root);
    root.querySelectorAll?.("a[href]").forEach(processLink);

    if (
      root instanceof Element &&
      root.matches?.("article, .offer-card, .product-card, .result-card, [data-product-card], [data-product]")
    ) {
      recoverTikTokImage(root);
    }

    root.querySelectorAll?.(
      "article, .offer-card, .product-card, .result-card, [data-product-card], [data-product]"
    ).forEach(recoverTikTokImage);
  };

  const style = document.createElement("style");
  style.id = "tp-v20-6-9-1-safe-ui-style";
  style.textContent = `
    .offer-card h3,
    .product-card h3,
    .result-card h3,
    .product-card .product-title,
    .offer-card .product-title,
    [data-product-card] h3,
    [data-product-card] [data-product-title] {
      font-size: clamp(.92rem, 2.8vw, 1.06rem) !important;
      line-height: 1.32 !important;
      font-weight: 700 !important;
      display: -webkit-box !important;
      -webkit-box-orient: vertical !important;
      -webkit-line-clamp: 3 !important;
      overflow: hidden !important;
      margin-block: .42rem .52rem !important;
    }

    .tp-safe-note {
      margin-top: .35rem;
      font-size: .74rem;
      line-height: 1.3;
      opacity: .76;
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const start = () => {
    processRoot(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) processRoot(node);
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
