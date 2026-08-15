(() => {
  "use strict";

  const p = new URLSearchParams(location.search);
  const raw = String(p.get("q") || "").trim();
  if (!raw) return;

  const fixes = [
    [/\b(?:makbook|mackbook|macbok|mackbok|mac\s+book)\b/ig, "macbook"]
  ];

  let corrected = raw;
  for (const [pattern, replacement] of fixes) corrected = corrected.replace(pattern, replacement);
  corrected = corrected.replace(/\s+/g, " ").trim();

  if (corrected.toLowerCase() !== raw.toLowerCase()) {
    p.set("q", corrected);
    p.set("corrected_from", raw);
    p.set("engine", "v2064");
    p.set("universal", "1");
    history.replaceState(null, "", `${location.pathname}?${p.toString()}${location.hash}`);
  }

  const q = corrected.toLowerCase();
  const clean = value => String(value || "").toLowerCase().replace(/[^a-z0-9+.#/-]+/g, " ").replace(/\s+/g, " ").trim();
  const explicitAccessory = /\b(?:accessor(?:y|ies)|case|cover|protector|holder|stand|mount|strap|lanyard|sleeve|charger|charging cable|usb cable|dock|replacement|spare|repair|parts?)\b/i.test(q);

  function targetFamily(value) {
    if (/\b(?:phone|smartphone|smart phone|mobile phone|cell phone|iphone|galaxy|pixel|redmi|oneplus|poco|nothing phone)\b/i.test(value)) return "phone";
    if (/\b(?:laptop|chromebook|notebook computer|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop)\b/i.test(value)) return "laptop";
    if (/\b(?:headphones?|headsets?|earbuds?|earphones?|airpods|tws)\b/i.test(value)) return "headphones";
    if (/\b(?:smartwatch|smart watch|apple watch)\b/i.test(value)) return "smartwatch";
    if (/\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i.test(value)) return "perfume";
    if (/\b(?:power\s*bank|powerbank|portable charger)\b/i.test(value)) return "power-bank";
    return "";
  }

  const family = targetFamily(q);
  const MAIN = {
    phone: /\b(?:smartphone|smart phone|mobile phone|cell phone|feature phone|rugged phone|satellite phone|foldable phone|android phone|iphone(?:\s*(?:\d{1,2}|x|xs|xr|se|pro|max|plus|mini))?|galaxy\s+(?:s|a|m|f|z|note)\s*[a-z0-9+.-]*|pixel\s+\d[a-z0-9+.-]*|redmi\s+[a-z0-9+.-]+|oneplus\s+[a-z0-9+.-]+|poco\s+[a-z0-9+.-]+|nothing\s+phone|honor\s+[a-z0-9+.-]+|huawei\s+[a-z0-9+.-]+|oppo\s+[a-z0-9+.-]+|vivo\s+[a-z0-9+.-]+|realme\s+[a-z0-9+.-]+|motorola\s+[a-z0-9+.-]+|moto\s+[a-z0-9+.-]+|nokia\s+[a-z0-9+.-]+|zte\s+[a-z0-9+.-]+|nubia\s+[a-z0-9+.-]+|doogee\s+[a-z0-9+.-]+|oukitel\s+[a-z0-9+.-]+|ulefone\s+[a-z0-9+.-]+|blackview\s+[a-z0-9+.-]+|fossibot\s+[a-z0-9+.-]+|cubot\s+[a-z0-9+.-]+|umidigi\s+[a-z0-9+.-]+)\b/i,
    laptop: /\b(?:laptop|chromebook|notebook computer|macbook|thinkpad|ideapad|thinkbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop)\b/i,
    headphones: /\b(?:headphones?|headsets?|earbuds?|earphones?|airpods|tws)\b/i,
    smartwatch: /\b(?:smartwatch|smart watch|apple watch(?:\s+(?:series|ultra|se))?)\b/i,
    perfume: /\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i,
    "power-bank": /\b(?:power\s*bank|powerbank|portable charger)\b/i
  };

  const BAD = {
    phone: /\b(?:case|cover|protector|lensprotector|tempered glass|holder|mount|stand|tripod|selfie light|phone light|ring light|charger|charging cable|usb cable|adapter|power\s*bank|replacement|repair|screwdriver|tool\s*kit|ammeter|voltmeter|multimeter|tester|enclosure|ssd|nvme|hard\s*drive|dock|hub|strap|lanyard|wallet|gimbal|keyboard|gamepad|controller)\b/i,
    laptop: /\b(?:accessor(?:y|ies)|bag|backpack|toploader|briefcase|sleeve|case|cover|skin|stand|dock|docking|charger|charging|adapter|cable|battery|replacement|keyboard|screen|display|lcd|hinge|palmrest|heatsink|cooling fan|dc jack|motherboard|mainboard|graphics card|graphic card|external graphics|gpu|ssd|nvme|hard drive|enclosure|storage drive|mouse|webcam|camera module|speaker|touchpad|trackpad|tool|toolkit|screwdriver|repair|programmer|programming socket|socket clip|inverter|converter|power supply|power module|step-down|step down|tray|breakfast|serving|tv table|laptop desk|bed table|table stand)\b/i,
    headphones: /\b(?:case|cover|ear pads?|ear cushions?|replacement|cable|stand|hanger|holder|adapter|charger|protective)\b/i,
    smartwatch: /\b(?:band|strap|case|cover|protector|tempered glass|charger|charging cable|stand|holder|replacement)\b/i,
    perfume: /\b(?:empty bottle|refillable|atomizer|sprayer|vending machine|dispensing machine|filling machine|packaging machine|bottle cap|display stand)\b/i,
    "power-bank": /\b(?:case|housing|shell|pcb|circuit board|power module|battery holder|adapter converter|converter charger)\b/i
  };

  const GENERIC = {
    phone: new Set(["phone","phones","smartphone","smartphones","smart","mobile"]),
    laptop: new Set(["laptop","laptops","notebook","notebooks","computer","computers"]),
    headphones: new Set(["headphone","headphones","headset","headsets","earbud","earbuds","earphone","earphones"]),
    smartwatch: new Set(["smartwatch","smartwatches","smart","watch","watches"]),
    perfume: new Set(["perfume","perfumes","fragrance","fragrances","cologne","colognes"]),
    "power-bank": new Set(["power","bank","banks","powerbank","powerbanks","portable","charger","chargers"])
  };
  const QUERY_STOP = new Set(["the","and","for","with","from","this","that","new","best","cheap","budget","good","original","official","latest","buy","sale"]);

  function anchorOK(title, fam) {
    const generic = GENERIC[fam] || new Set();
    const anchors = clean(q).split(" ").filter(x => x && x.length > 1 && !generic.has(x) && !QUERY_STOP.has(x));
    if (!anchors.length) return true;
    let hits = 0;
    for (const token of anchors) if (title.includes(token)) hits++;
    const need = anchors.length <= 2 ? anchors.length : Math.ceil(anchors.length * 0.66);
    return hits >= need;
  }

  function keepRow(row) {
    if (!family || explicitAccessory) return true;
    const title = clean(row && row.t);
    if (!title) return false;
    if (BAD[family] && BAD[family].test(title)) return false;
    if (MAIN[family] && !MAIN[family].test(title)) return false;
    if (!anchorOK(title, family)) return false;
    return true;
  }

  if (family && !explicitAccessory && typeof window.fetch === "function") {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init);
      try {
        const rawUrl = typeof input === "string" ? input : input && input.url;
        const url = new URL(rawUrl || "", location.href);
        if (!/\/data\/v20-9\/products\/[a-z0-9_]{2}\.json$/i.test(url.pathname) || !response.ok) return response;
        const data = await response.clone().json();
        if (!data || Array.isArray(data) || typeof data !== "object") return response;
        const filtered = {};
        for (const [id, row] of Object.entries(data)) {
          if (!keepRow(row)) continue;
          const safe = {...row};
          if (family === "laptop" && String(safe.se || "").toLowerCase() === "lenovo" && Number(safe.p) > 0 && Number(safe.p) <= 5) {
            safe.p = 0;
            safe.x = false;
          }
          filtered[id] = safe;
        }
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        headers.delete("etag");
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(JSON.stringify(filtered), {status: response.status, statusText: response.statusText, headers});
      } catch {
        return response;
      }
    };
  }

  const hideInternalMeta = () => document.querySelectorAll('.tp80-universal-meta').forEach(el => { el.hidden = true; el.style.display = 'none'; });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hideInternalMeta, {once:true});
  else hideInternalMeta();
  new MutationObserver(hideInternalMeta).observe(document.documentElement, {subtree:true, childList:true});

  window.__TP_QUERY_NORMALIZER__ = {version: "21.6.1", original: raw, corrected, family, strictPurity: Boolean(family && !explicitAccessory)};
})();
