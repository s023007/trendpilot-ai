window.TRENDPILOT_LINKS = {
  "writesonic": {
    "affiliateUrl": "",
    "productUrl": "https://writesonic.com/",
    "applicationUrl": "https://writesonic.com/affiliate"
  },
  "elevenlabs": {
    "affiliateUrl": "https://try.elevenlabs.io/p89acd4lpacm",
    "productUrl": "https://elevenlabs.io/",
    "applicationUrl": "https://elevenlabs.io/affiliates"
  },
  "scalenut": {
    "affiliateUrl": "",
    "productUrl": "https://www.scalenut.com/",
    "applicationUrl": "https://www.scalenut.com/affiliate"
  },
  "synthesia": {
    "affiliateUrl": "",
    "productUrl": "https://www.synthesia.io/",
    "applicationUrl": "https://www.synthesia.io/partners/affiliates"
  },
  "invideo": {
    "affiliateUrl": "",
    "productUrl": "https://invideo.io/",
    "applicationUrl": "https://help.invideo.io/en/articles/9673802-is-there-a-referral-program-or-affiliate-rewards"
  },
  "pictory": {
    "affiliateUrl": "",
    "productUrl": "https://pictory.ai/",
    "applicationUrl": "https://partners.pictory.ai/signup/40690"
  },
  "descript": {
    "affiliateUrl": "",
    "productUrl": "https://www.descript.com/",
    "applicationUrl": "https://www.descript.com/affiliate"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-affiliate-key]").forEach((a) => {
    const row = window.TRENDPILOT_LINKS[a.dataset.affiliateKey];
    if (!row) return;
    a.href = row.affiliateUrl || row.productUrl;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener";
  });
  document.querySelectorAll("[data-apply-key]").forEach((a) => {
    const row = window.TRENDPILOT_LINKS[a.dataset.applyKey];
    if (!row) return;
    a.href = row.applicationUrl;
    a.target = "_blank";
    a.rel = "noopener";
  });
});
