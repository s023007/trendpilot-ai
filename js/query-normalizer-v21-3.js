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

  if (corrected.toLowerCase() === raw.toLowerCase()) return;
  p.set("q", corrected);
  p.set("corrected_from", raw);
  p.set("engine", "v2064");
  p.set("universal", "1");
  history.replaceState(null, "", `${location.pathname}?${p.toString()}${location.hash}`);

  window.__TP_QUERY_NORMALIZER__ = {version: "21.3.0", original: raw, corrected};
})();
