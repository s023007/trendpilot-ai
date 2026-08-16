(() => {
  "use strict";

  const p = new URLSearchParams(location.search);
  const raw = String(p.get("q") || "").trim();
  if (!raw) return;

  const fixes = [
    [/\btablets\b/ig, "tablet"],
    [/\bipads\b/ig, "ipad"],
    [/\b(?:makbook|mackbook|macbok|mackbok|mac\s+book)\b/ig, "macbook"],
    [/\b(?:shose|shooes)\b/ig, "shoes"],
    [/\b(?:headpone|headpones)\b/ig, "headphones"],
    [/\b(?:smartwach|smartwacth)\b/ig, "smartwatch"]
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
    if (/\b(?:tablets?|ipads?|galaxy tabs?|surface pro)\b/i.test(value)) return "tablet";
    if (/\b(?:laptop|chromebook|notebook computer|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop)\b/i.test(value)) return "laptop";
    if (/\b(?:headphones?|headsets?|earbuds?|earphones?|airpods|tws)\b/i.test(value)) return "headphones";
    if (/\b(?:speaker|soundbar|subwoofer)\b/i.test(value)) return "speaker";
    if (/\b(?:smartwatch|smart watch|apple watch)\b/i.test(value)) return "smartwatch";
    if (/\b(?:camera|webcam|camera lens|dash cam|action cam)\b/i.test(value)) return "camera";
    if (/\b(?:printer|label printer|thermal printer|laser printer|inkjet)\b/i.test(value)) return "printer";
    if (/\bprojector\b/i.test(value)) return "projector";
    if (/\b(?:television|smart tv|oled tv|qled tv|led tv|tv)\b/i.test(value)) return "television";
    if (/\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i.test(value)) return "perfume";
    if (/\b(?:power\s*bank|powerbank|portable charger)\b/i.test(value)) return "power-bank";
    if (/\b(?:3d printer|3d printing|3d filament|filament|pla\b|petg\b|tpu\b|resin printer)\b/i.test(value)) return "3d-printing";
    if (/\b(?:tools?|drill|saw|grinder|screwdriver|wrench|pliers|multimeter|soldering)\b/i.test(value)) return "tools";
    if (/\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i.test(value)) return "air-conditioning";
    if (/\b(?:air fryer|vacuum|coffee maker|espresso machine|blender|kettle|toaster|rice cooker|humidifier|air purifier)\b/i.test(value)) return "home-appliances";
    if (/\b(?:cookware|pan\b|saucepan|wok|skillet|kitchen knife|cutting board|kitchen utensil)\b/i.test(value)) return "kitchen";
    if (/\b(?:lighting|lights?|lamps?|ceiling light|wall light|desk lamp|floor lamp|solar light)\b/i.test(value)) return "lighting";
    if (/\b(?:furniture|desk\b|chair\b|sofa|couch|table\b|cabinet|bookshelf|wardrobe|bed frame)\b/i.test(value)) return "furniture";
    if (/\b(?:car accessories|automotive|vehicle|car charger|car mount|carplay|head unit|brake|spark plug|ignition coil|fuel pump)\b/i.test(value)) return "automotive";
    if (/\b(?:pet supplies|dog food|cat food|pet food|dog\b|cat\b|puppy|kitten|leash|collar|litter)\b/i.test(value)) return "pets";
    if (/\b(?:beauty|skincare|skin care|makeup|serum|lipstick|mascara|hair dryer|hair straightener|nail care|grooming)\b/i.test(value)) return "beauty";
    if (/\b(?:shoes?|sneakers?|boots?|sandals?|slippers?|loafers?|heels?|dress|shirt|t-shirt|hoodie|sweater|jacket|coat|jeans|trousers|pants|skirt|shorts|clothing|apparel)\b/i.test(value)) return "apparel";
    if (/\b(?:bag\b|handbag|backpack|wallet|cardholder)\b/i.test(value)) return "bags";
    if (/\b(?:fitness equipment|fitness|gym\b|exercise|treadmill|exercise bike|rowing machine|resistance band|camping|cycling)\b/i.test(value)) return "sports";
    if (/\b(?:baby products|baby|stroller|infant|diaper|nappy)\b/i.test(value)) return "baby";
    if (/\b(?:toys?|doll|action figure|building blocks|plush)\b/i.test(value)) return "toys";
    if (/\b(?:office supplies|stationery|notebook|pen\b|pencil)\b/i.test(value)) return "office";
    if (/\b(?:medical|surgical|diagnostic|blood pressure|oximeter|dental|patient monitor)\b/i.test(value)) return "medical";
    return "";
  }

  const family = targetFamily(q);
  const MAIN = {
    phone: /\b(?:smartphone|smart phone|mobile phone|cell phone|feature phone|rugged phone|satellite phone|foldable phone|android phone|iphone(?:\s*(?:\d{1,2}|x|xs|xr|se|pro|max|plus|mini))?|galaxy\s+(?:s|a|m|f|z|note)\s*[a-z0-9+.-]*|pixel\s+\d[a-z0-9+.-]*|redmi\s+[a-z0-9+.-]+|oneplus\s+[a-z0-9+.-]+|poco\s+[a-z0-9+.-]+|nothing\s+phone|honor\s+[a-z0-9+.-]+|huawei\s+[a-z0-9+.-]+|oppo\s+[a-z0-9+.-]+|vivo\s+[a-z0-9+.-]+|realme\s+[a-z0-9+.-]+|motorola\s+[a-z0-9+.-]+|moto\s+[a-z0-9+.-]+|nokia\s+[a-z0-9+.-]+|zte\s+[a-z0-9+.-]+|nubia\s+[a-z0-9+.-]+|doogee\s+[a-z0-9+.-]+|oukitel\s+[a-z0-9+.-]+|ulefone\s+[a-z0-9+.-]+|blackview\s+[a-z0-9+.-]+|fossibot\s+[a-z0-9+.-]+|cubot\s+[a-z0-9+.-]+|umidigi\s+[a-z0-9+.-]+)\b/i,
    tablet: /\b(?:tablets?|ipads?|galaxy tabs?|surface pro)\b/i,
    laptop: /\b(?:laptop|chromebook|notebook computer|macbook|thinkpad|ideapad|thinkbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop)\b/i,
    headphones: /\b(?:headphones?|headsets?|earbuds?|earphones?|airpods|tws)\b/i,
    speaker: /\b(?:speaker|soundbar|subwoofer)\b/i,
    smartwatch: /\b(?:smartwatch|smart watch|apple watch(?:\s+(?:series|ultra|se))?)\b/i,
    camera: /\b(?:camera|webcam|dash cam|action cam|digital camera|camera lens)\b/i,
    printer: /\b(?:printer|label printer|thermal printer|laser printer|inkjet)\b/i,
    projector: /\bprojector\b/i,
    television: /\b(?:television|smart tv|oled tv|qled tv|led tv|tv)\b/i,
    perfume: /\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i,
    "power-bank": /\b(?:power\s*bank|powerbank|portable charger)\b/i,
    "3d-printing": /\b(?:3d printer|3d printing|filament|pla\b|petg\b|tpu\b|resin printer)\b/i,
    tools: /\b(?:tool|drill|saw|grinder|screwdriver|wrench|pliers|multimeter|soldering)\b/i,
    "air-conditioning": /\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i,
    "home-appliances": /\b(?:air fryer|vacuum|coffee maker|espresso machine|blender|kettle|toaster|rice cooker|humidifier|air purifier)\b/i,
    kitchen: /\b(?:cookware|pan\b|saucepan|wok|skillet|kitchen knife|cutting board|kitchen utensil)\b/i,
    lighting: /\b(?:lighting|lights?|lamps?|ceiling light|wall light|desk lamp|floor lamp|solar light)\b/i,
    furniture: /\b(?:furniture|desk\b|chair\b|sofa|couch|table\b|cabinet|bookshelf|wardrobe|bed frame)\b/i,
    automotive: /\b(?:automotive|vehicle|car\b|brake|spark plug|ignition coil|fuel pump|car charger|car mount|carplay|head unit)\b/i,
    pets: /\b(?:pet\b|dog\b|cat\b|puppy|kitten|pet food|dog food|cat food|leash|collar|litter)\b/i,
    beauty: /\b(?:beauty|skincare|skin care|makeup|serum|lipstick|mascara|hair dryer|hair straightener|nail care|grooming)\b/i,
    apparel: /\b(?:shoes?|sneakers?|boots?|sandals?|slippers?|loafers?|heels?|dress|shirt|t-shirt|hoodie|sweater|jacket|coat|jeans|trousers|pants|skirt|shorts|clothing|apparel)\b/i,
    bags: /\b(?:bag\b|handbag|backpack|wallet|cardholder)\b/i,
    sports: /\b(?:fitness|gym\b|exercise|treadmill|exercise bike|rowing machine|resistance band|camping|cycling)\b/i,
    baby: /\b(?:baby|stroller|infant|diaper|nappy)\b/i,
    toys: /\b(?:toy|doll|action figure|building blocks|plush)\b/i,
    office: /\b(?:stationery|notebook|pen\b|pencil|office supplies)\b/i,
    medical: /\b(?:medical|surgical|diagnostic|blood pressure|oximeter|dental|patient monitor)\b/i
  };

  const BAD = {
    phone: /\b(?:case|cover|protector|lens protector|tempered glass|holder|mount|stand|tripod|selfie light|phone light|ring light|charger|charging cable|usb cable|adapter|power\s*bank|replacement|repair|screwdriver|tool\s*kit|ammeter|voltmeter|multimeter|tester|enclosure|ssd|nvme|hard\s*drive|dock|hub|strap|lanyard|wallet|gimbal|keyboard|gamepad|controller)\b/i,
    tablet: /\b(?:case|cover|protector|tempered glass|holder|stand|mount|keyboard case|stylus|charger|cable|replacement|screen|digitizer|battery)\b/i,
    laptop: /\b(?:accessor(?:y|ies)|bag|backpack|toploader|briefcase|sleeve|case|cover|skin|stand|dock|docking|charger|charging|adapter|cable|battery|replacement|keyboard|screen|display|lcd|hinge|palmrest|heatsink|cooling fan|dc jack|motherboard|mainboard|graphics card|graphic card|external graphics|gpu|ssd|nvme|hard drive|enclosure|storage drive|mouse|webcam|camera module|speaker|touchpad|trackpad|tool|toolkit|screwdriver|repair|programmer|programming socket|socket clip|inverter|converter|power supply|power module|step-down|step down|tray|breakfast|serving|tv table|laptop desk|bed table|table stand)\b/i,
    headphones: /\b(?:case|cover|ear pads?|ear cushions?|replacement|cable|stand|hanger|holder|adapter|charger|protective)\b/i,
    speaker: /\b(?:replacement|repair|driver unit|speaker cone|case|cover|mount|stand|cable|adapter)\b/i,
    smartwatch: /\b(?:band|strap|case|cover|protector|tempered glass|charger|charging cable|stand|holder|replacement)\b/i,
    camera: /\b(?:case|bag|strap|mount|tripod|battery|charger|replacement|protector|filter adapter)\b/i,
    printer: /\b(?:ink cartridge|toner|replacement|roller|printhead|print head|cable|adapter|paper tray|maintenance kit)\b/i,
    projector: /\b(?:lamp replacement|bulb|remote control|screen|mount|stand|cable|adapter|case)\b/i,
    television: /\b(?:remote control|wall mount|stand|bracket|backlight|led strip|replacement|power board|main board|cable|adapter)\b/i,
    perfume: /\b(?:empty bottle|refillable|atomizer|sprayer|vending machine|dispensing machine|filling machine|packaging machine|bottle cap|display stand)\b/i,
    "power-bank": /\b(?:case|housing|shell|pcb|circuit board|power module|battery holder|adapter converter|converter charger)\b/i,
    "3d-printing": /\b(?:replacement fan|nozzle|hotend|extruder gear|belt|sensor|motherboard|control board|spare part)\b/i,
    tools: /\b(?:replacement carbon brush|armature|stator|rotor|switch assembly|spare part|replacement part|tool bag|tool case|holder)\b/i,
    "air-conditioning": /\b(?:remote control|replacement board|capacitor|compressor part|fan motor|filter replacement|hose|bracket)\b/i,
    "home-appliances": /\b(?:replacement part|spare part|filter replacement|basket replacement|heating element|control board|motor part)\b/i,
    kitchen: /\b(?:replacement handle|replacement lid|spare part|rack insert)\b/i,
    lighting: /\b(?:replacement driver|power supply|connector|mounting bracket|spare part)\b/i,
    furniture: /\b(?:replacement leg|furniture handle|knob|hinge|caster wheel|cover only)\b/i,
    automotive: /\b(?:phone case|toy car|model car|keychain|sticker|cover only)\b/i,
    pets: /\b(?:machine|manufacturing|packaging machine|production line|mold|industrial equipment)\b/i,
    beauty: /\b(?:vending machine|filling machine|packaging machine|display stand|empty bottle|container only)\b/i,
    apparel: /\b(?:shoe rack|shoe cabinet|shoe bag|shoe box|shoe cover|shoelace|shoe lace|insole|replacement sole|display stand|clothes rack|hanger|sewing machine|fabric roll)\b/i,
    bags: /\b(?:bag strap|replacement strap|bag handle|hardware|zipper pull|organizer insert|display rack)\b/i,
    sports: /\b(?:replacement part|spare part|repair kit|motor controller|display replacement|machine component)\b/i,
    baby: /\b(?:replacement wheel|spare part|stroller accessory|cover only|adapter)\b/i,
    toys: /\b(?:replacement part|display stand|storage box|toy accessory only)\b/i,
    office: /\b(?:replacement part|printer toner|machine component|industrial)\b/i,
    medical: /\b(?:replacement part|spare part|machine component|repair kit)\b/i
  };

  const GENERIC = {
    phone: new Set(["phone","phones","smartphone","smartphones","smart","mobile"]),
    tablet: new Set(["tablet","tablets","ipad"]),
    laptop: new Set(["laptop","laptops","notebook","notebooks","computer","computers"]),
    headphones: new Set(["headphone","headphones","headset","headsets","earbud","earbuds","earphone","earphones"]),
    speaker: new Set(["speaker","speakers","audio"]),
    smartwatch: new Set(["smartwatch","smartwatches","smart","watch","watches"]),
    camera: new Set(["camera","cameras"]),
    printer: new Set(["printer","printers"]),
    projector: new Set(["projector","projectors"]),
    television: new Set(["tv","television","televisions","smart"]),
    perfume: new Set(["perfume","perfumes","fragrance","fragrances","cologne","colognes"]),
    "power-bank": new Set(["power","bank","banks","powerbank","powerbanks","portable","charger","chargers"]),
    "3d-printing": new Set(["3d","printer","printers","printing","filament","filaments"]),
    tools: new Set(["tool","tools"]),
    "air-conditioning": new Set(["air","conditioner","conditioners","ac"]),
    "home-appliances": new Set(["appliance","appliances","home"]),
    kitchen: new Set(["kitchen","cookware"]),
    lighting: new Set(["lighting","light","lights","lamp","lamps"]),
    furniture: new Set(["furniture"]),
    automotive: new Set(["car","cars","automotive","vehicle","vehicles","accessories"]),
    pets: new Set(["pet","pets","dog","dogs","cat","cats","food","supplies"]),
    beauty: new Set(["beauty","makeup","skincare","skin","care"]),
    apparel: new Set(["shoe","shoes","sneaker","sneakers","boot","boots","sandal","sandals","clothing","apparel","fashion"]),
    bags: new Set(["bag","bags","handbag","handbags","backpack","backpacks"]),
    sports: new Set(["sport","sports","fitness","equipment","gym","exercise"]),
    baby: new Set(["baby","babies","products"]),
    toys: new Set(["toy","toys"]),
    office: new Set(["office","supplies","stationery"]),
    medical: new Set(["medical"])
  };
  const QUERY_STOP = new Set(["the","and","for","with","from","this","that","new","best","cheap","budget","good","original","official","latest","buy","sale"]);

  const SUB = {
    apparel: /\b(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels)\b/i.test(q) ? /\b(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels)\b/i : null,
    pets: /\b(?:dog food|cat food|pet food)\b/i.test(q) ? /\b(?:dog food|cat food|pet food|dog kibble|cat kibble)\b/i : null,
    beauty: /\bmakeup\b/i.test(q) ? /\b(?:makeup|foundation|lipstick|mascara|eyeshadow|concealer|blush)\b/i : /\b(?:skincare|skin care)\b/i.test(q) ? /\b(?:skincare|skin care|serum|cleanser|moisturizer|cream|toner)\b/i : null,
    tools: /\bdrill\b/i.test(q) ? /\bdrill\b/i : /\bsaw\b/i.test(q) ? /\bsaw\b/i : /\bgrinder\b/i.test(q) ? /\bgrinder\b/i : null,
    "home-appliances": /\bair fryer\b/i.test(q) ? /\bair fryer\b/i : null,
    "3d-printing": /\bfilament\b/i.test(q) ? /\b(?:filament|pla\b|petg\b|tpu\b)\b/i : /\b3d printer\b/i.test(q) ? /\b3d printer\b/i : null,
    sports: /\b(?:fitness equipment|gym equipment)\b/i.test(q) ? /\b(?:treadmill|exercise bike|rowing machine|weight bench|dumbbell|fitness equipment|gym equipment)\b/i : null
  };

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
    const required = SUB[family] || MAIN[family];
    if (required && !required.test(title)) return false;
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

  window.__TP_QUERY_NORMALIZER__ = {version: "21.12.0", original: raw, corrected, family, strictPurity: Boolean(family && !explicitAccessory)};
})();
