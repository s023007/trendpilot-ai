// TrendPilot V20.3 - explicit public product seller policy.
// Temu and Joom are not approved for public product comparison.
// FilamentPRO EU CPS is intentionally excluded by owner policy.
export const PRODUCT_SELLER_POLICY_VERSION = "20.3.2";
export const PUBLIC_PRODUCT_SELLER_NAMES = Object.freeze(["AliExpress", "Alibaba", "Geekbuying", "Govee Many GEOs", "Harfington Many GEOs", "Sunsky-online WW", "Lenovo", "Diecast", "FragranceShop.com", "Karaca EU", "MFI Medical", "PandaHall", "TikTok Shop US"]);
const aliasGroups = {"AliExpress": ["aliexpress", "ali express", "aliexpress.com", "aliexpress ww", "aliexpressww"], "Alibaba": ["alibaba", "alibaba.com", "alibaba ww", "alibabaww"], "Geekbuying": ["geekbuying", "geek buying", "geekbuying ww", "geekbuyingww"], "Govee Many GEOs": ["govee", "govee many geos"], "Harfington Many GEOs": ["harfington", "harfington many geos", "harrington", "harrington many geos"], "Sunsky-online WW": ["sunsky", "sunsky online", "sunsky-online", "sunsky-online ww"], "Lenovo": ["lenovo", "lenovo many geos"], "Diecast": ["diecast", "diecast.com", "diecast models wholesale", "diecastmodelswholesale"], "FragranceShop.com": ["fragranceshop.com", "fragranceshop", "fragrance shop", "the fragrance shop"], "Karaca EU": ["karaca", "karaca eu", "karaca europe"], "MFI Medical": ["mfi", "mfi medical", "mfimedical"], "PandaHall": ["pandahall", "panda hall", "pandahall.com"], "TikTok Shop US": ["tiktok", "tiktok shop", "tiktok shop us", "tiktokshop", "tiktokshopus"]};
const normalizeKey = value => String(value ?? "").toLocaleLowerCase("en-US").normalize("NFKC").replace(/[^a-z0-9]+/g, "");
const canonicalByKey = new Map();
for (const canonical of PUBLIC_PRODUCT_SELLER_NAMES) {
  canonicalByKey.set(normalizeKey(canonical), canonical);
  for (const alias of aliasGroups[canonical] || []) canonicalByKey.set(normalizeKey(alias), canonical);
}
export function canonicalProductSeller(value) { const key=normalizeKey(value); return key ? (canonicalByKey.get(key)||"") : ""; }
export function isApprovedProductSeller(value) { return Boolean(canonicalProductSeller(value)); }
export function canonicalizePublicProduct(product) {
  if (!product || typeof product !== "object") return null;
  const rawSeller=product.seller||product.advertiser||product.merchant||product.advertiserName||product.merchantName||"";
  const seller=canonicalProductSeller(rawSeller); if (!seller) return null;
  return {...product,seller,advertiser:product.advertiser?seller:product.advertiser};
}
export function publicProductSellerAllowed(product) { return Boolean(canonicalizePublicProduct(product)); }
