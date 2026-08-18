const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PRODUCT_DIR_PREFIX = path.join(ROOT, 'netlify', 'functions', 'product-preview-');
const REVIEW_JSON = path.join(ROOT, 'data', 'review-evidence-v21.json');
const TARGET = path.join(__dirname, 'product-preview-v20-9-6-mobile-polish.cjs');

function isProductModule(id) {
  return id.startsWith(PRODUCT_DIR_PREFIX) || id === REVIEW_JSON;
}

function purgeProductCache() {
  const purged = [];
  for (const id of Object.keys(require.cache)) {
    if (!isProductModule(id)) continue;
    delete require.cache[id];
    purged.push(path.relative(ROOT, id).replace(/\\/g, '/'));
  }
  return purged;
}

exports.handler = async function () {
  const purged = purgeProductCache();
  let freshLoaded = false;
  let confidenceMarkerLoaded = false;
  let fileVersion = '';
  let error = '';

  try {
    const source = fs.readFileSync(TARGET, 'utf8');
    fileVersion = (source.match(/CONFIDENCE_VERSION\s*=\s*["']([^"']+)["']/) || [])[1] || '';
    const fresh = require(TARGET);
    freshLoaded = !!fresh && typeof fresh.handler === 'function';
    confidenceMarkerLoaded = freshLoaded && String(fresh.handler).includes('x-trendpilot-product-confidence');
  } catch (err) {
    error = String(err && (err.stack || err.message) || err).slice(0, 1200);
  }

  return {
    statusCode: freshLoaded && confidenceMarkerLoaded ? 200 : 500,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-trendpilot-hot-reload': 'namecheap-hot-reload-v1'
    },
    body: JSON.stringify({
      ok: freshLoaded && confidenceMarkerLoaded,
      runtime: 'namecheap-hot-reload-v1',
      pid: process.pid,
      fileVersion,
      freshLoaded,
      confidenceMarkerLoaded,
      purgedCount: purged.length,
      purged: purged.slice(0, 40),
      error
    })
  };
};
