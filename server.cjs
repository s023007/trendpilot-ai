const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html':'text/html; charset=utf-8', '.htm':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.cjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.map':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options':'SAMEORIGIN'
};

function send(res, status, headers, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function redirect(res, location, status = 301) {
  send(res, status, { Location: location, 'Cache-Control':'no-store' }, '');
}

function safeStaticPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const clean = decoded.replace(/\\/g, '/');
  const blocked = [
    '/.git','/.github','/netlify/','/node_modules/','/.env','/package.json','/package-lock.json','/netlify.toml','/server.cjs'
  ];
  if (blocked.some(x => clean === x || clean.startsWith(x))) return null;
  const relative = clean.replace(/^\/+/, '');
  const full = path.resolve(ROOT, relative || 'index.html');
  if (!full.startsWith(path.resolve(ROOT) + path.sep) && full !== path.resolve(ROOT, 'index.html')) return null;
  return full;
}

function queryObject(searchParams) {
  const out = {};
  for (const [k,v] of searchParams.entries()) out[k] = v;
  return out;
}

async function bodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function loadFunction(name) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('Invalid function name');
  const base = path.join(ROOT, 'netlify', 'functions', name);
  for (const ext of ['.cjs','.js','.mjs']) {
    const file = base + ext;
    if (!fs.existsSync(file)) continue;
    if (ext === '.mjs') return await import(pathToFileURL(file).href);
    return require(file);
  }
  const indexCandidates = [path.join(base,'index.cjs'),path.join(base,'index.js'),path.join(base,'index.mjs')];
  for (const file of indexCandidates) {
    if (!fs.existsSync(file)) continue;
    if (file.endsWith('.mjs')) return await import(pathToFileURL(file).href);
    return require(file);
  }
  return null;
}

async function invokeNetlifyFunction(name, req, res, url, extraQuery = {}) {
  const mod = await loadFunction(name);
  const handler = mod && (mod.handler || (mod.default && mod.default.handler) || mod.default);
  if (typeof handler !== 'function') {
    send(res, 404, {'Content-Type':'text/plain; charset=utf-8'}, 'Function not found');
    return;
  }

  const raw = await bodyBuffer(req);
  const headers = {};
  for (const [k,v] of Object.entries(req.headers || {})) headers[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  const queryStringParameters = { ...queryObject(url.searchParams), ...extraQuery };
  const event = {
    path: url.pathname,
    rawUrl: `https://${headers.host || 'trendpilotchoice.com'}${url.pathname}${url.search}`,
    httpMethod: req.method || 'GET',
    headers,
    queryStringParameters,
    multiValueQueryStringParameters: Object.fromEntries([...url.searchParams.keys()].map(k => [k, url.searchParams.getAll(k)])),
    body: raw.length ? raw.toString('utf8') : null,
    isBase64Encoded: false
  };

  const result = await handler(event, {});
  const statusCode = Number(result && result.statusCode) || 200;
  const outHeaders = { ...(result && result.headers || {}) };
  if (result && result.multiValueHeaders) {
    for (const [k,v] of Object.entries(result.multiValueHeaders)) outHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  let out = result && result.body != null ? result.body : '';
  if (result && result.isBase64Encoded) out = Buffer.from(out, 'base64');
  send(res, statusCode, outHeaders, out);
}

function cacheHeader(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'no-cache';
  if (ext === '.json' && file.includes(`${path.sep}data${path.sep}`)) return 'public, max-age=300, stale-while-revalidate=3600';
  if (['.css','.js','.mjs','.svg','.png','.jpg','.jpeg','.webp','.woff','.woff2'].includes(ext)) return 'public, max-age=3600';
  return 'public, max-age=300';
}

async function serveStatic(req, res, pathname) {
  let file = safeStaticPath(pathname);
  if (!file) return false;
  try {
    let stat = await fs.promises.stat(file);
    if (stat.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = await fs.promises.stat(file);
    }
    if (!stat.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Cache-Control': cacheHeader(file)
    };
    res.writeHead(200, { ...SECURITY_HEADERS, ...headers });
    fs.createReadStream(file).pipe(res);
    return true;
  } catch { return false; }
}

async function route(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  if (p === '/comparisons') return redirect(res, '/compare/');
  if (p === '/electronics') return redirect(res, '/products/');
  if (p === '/business') return redirect(res, '/sourcing/');
  if (p === '/how-we-review') return redirect(res, '/editorial-methodology.html');
  if (p.startsWith('/marketplaces/')) return redirect(res, '/find/');
  if (p.startsWith('/compare/joom-vs-aliexpress/')) return redirect(res, '/find/?q=electronics');
  if (p.startsWith('/compare/geekbuying-vs-aliexpress/')) return redirect(res, '/find/?q=electronics');

  if (p === '/product') return redirect(res, '/find/?engine=v2064');
  if (p.startsWith('/product/')) {
    const slug = p.slice('/product/'.length);
    return invokeNetlifyFunction('product-preview-v20-9-6-mobile-polish', req, res, url, { slug });
  }

  if (p.startsWith('/.netlify/functions/')) {
    const name = p.slice('/.netlify/functions/'.length).split('/')[0];
    return invokeNetlifyFunction(name, req, res, url);
  }

  if (await serveStatic(req, res, p)) return;

  const fallback = safeStaticPath('/404.html');
  if (fallback && fs.existsSync(fallback)) {
    const body = await fs.promises.readFile(fallback);
    return send(res, 404, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}, body);
  }
  send(res, 404, {'Content-Type':'text/plain; charset=utf-8'}, 'Not found');
}

const server = http.createServer((req, res) => {
  Promise.resolve(route(req, res)).catch(err => {
    console.error('[TrendPilot Namecheap runtime]', err);
    if (!res.headersSent) send(res, 500, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}, 'Internal Server Error');
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`TrendPilot Namecheap runtime listening on ${HOST}:${PORT}`);
});
