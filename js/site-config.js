window.TRENDPILOT_SITE_CONFIG = {
  version: "20.7.7",
  baseUrl: "https://trendpilotchoice.com",
  ga4Id: "",
  clickEndpoint: ""
};

if (location.pathname.startsWith('/find') && !document.querySelector('script[data-tp-product-route-2077]')) {
  const s = document.createElement('script');
  s.src = '/js/v20-7-7-product-route.js?v=20.7.7';
  s.defer = true;
  s.dataset.tpProductRoute2077 = '1';
  document.head.appendChild(s);
}
