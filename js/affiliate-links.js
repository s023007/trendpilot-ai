window.TRENDPILOT_LINKS = {
  "filmora": {
    "affiliateUrl": "",
    "productUrl": "https://filmora.wondershare.com/",
    "pricingUrl": "https://filmora.wondershare.com/shop/buy/buy-video-editor.html",
    "applicationUrl": "https://www.admitad.com/"
  },
  "pdfelement": {
    "affiliateUrl": "",
    "productUrl": "https://pdf.wondershare.com/",
    "applicationUrl": "https://www.admitad.com/"
  },
  "recoverit": {
    "affiliateUrl": "",
    "productUrl": "https://recoverit.wondershare.com/",
    "applicationUrl": "https://www.admitad.com/"
  },
  "drfone": {
    "affiliateUrl": "",
    "productUrl": "https://drfone.wondershare.com/",
    "applicationUrl": "https://www.admitad.com/"
  },
  "uniconverter": {
    "affiliateUrl": "",
    "productUrl": "https://videoconverter.wondershare.com/",
    "applicationUrl": "https://www.admitad.com/"
  },
  "edrawmax": {
    "affiliateUrl": "",
    "productUrl": "https://www.edrawsoft.com/edraw-max/",
    "applicationUrl": "https://www.admitad.com/"
  },
  "writesonic": {"affiliateUrl":"","productUrl":"https://writesonic.com/","applicationUrl":"https://writesonic.com/affiliate"},
  "elevenlabs": {"affiliateUrl":"https://try.elevenlabs.io/p89acd4lpacm","productUrl":"https://elevenlabs.io/","applicationUrl":"https://elevenlabs.io/affiliates"},
  "scalenut": {"affiliateUrl":"","productUrl":"https://www.scalenut.com/","applicationUrl":"https://www.scalenut.com/affiliate"},
  "synthesia": {"affiliateUrl":"","productUrl":"https://www.synthesia.io/","applicationUrl":"https://www.synthesia.io/partners/affiliates"},
  "invideo": {"affiliateUrl":"","productUrl":"https://invideo.io/","applicationUrl":"https://help.invideo.io/en/articles/9673802-is-there-a-referral-program-or-affiliate-rewards"},
  "pictory": {"affiliateUrl":"","productUrl":"https://pictory.ai/","applicationUrl":"https://partners.pictory.ai/signup/40690"},
  "descript": {"affiliateUrl":"","productUrl":"https://www.descript.com/","applicationUrl":"https://www.descript.com/affiliate"}
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-affiliate-key]").forEach((a) => {
    const row = window.TRENDPILOT_LINKS[a.dataset.affiliateKey];
    if (!row) return;
    a.href = row.affiliateUrl || row.productUrl;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener";
    if (!row.affiliateUrl) a.dataset.linkState = "official-fallback";
  });
  document.querySelectorAll("[data-pricing-key]").forEach((a) => {
    const row = window.TRENDPILOT_LINKS[a.dataset.pricingKey];
    if (!row) return;
    a.href = row.affiliateUrl || row.pricingUrl || row.productUrl;
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
