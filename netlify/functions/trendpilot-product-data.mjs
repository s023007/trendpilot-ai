import fs from 'node:fs';
import path from 'node:path';

let CACHE = null;
const REQUIRED = ['products.json','offers.json','variants.json'];

function goodDir(dir) {
  try { return Boolean(dir) && REQUIRED.every(name => fs.existsSync(path.join(dir,name))); }
  catch { return false; }
}

function directCandidates() {
  const roots = [];
  const add = value => { if (value && typeof value === 'string' && !roots.includes(value)) roots.push(value); };
  add(process.env.TRENDPILOT_PRODUCT_DATA_ROOT);
  add(process.env.LAMBDA_TASK_ROOT);
  add(process.env.PWD);
  add(process.cwd());
  try { if (process.argv?.[1]) add(path.dirname(path.resolve(process.argv[1]))); } catch {}
  add('/var/task');
  add('/var/task/netlify/functions');
  add('/var/task/functions');

  const out = [];
  for (const root of roots) {
    out.push(root);
    out.push(path.join(root,'_product-data'));
    out.push(path.join(root,'netlify','functions','_product-data'));
    out.push(path.join(root,'functions','_product-data'));
    out.push(path.join(root,'.netlify','functions-serve','_product-data'));
  }
  return [...new Set(out)];
}

function boundedFind(start, maxDepth = 5) {
  if (!start || !fs.existsSync(start)) return '';
  const queue = [{dir:start,depth:0}];
  const seen = new Set();
  while (queue.length) {
    const {dir,depth} = queue.shift();
    let real = dir;
    try { real = fs.realpathSync(dir); } catch {}
    if (seen.has(real)) continue;
    seen.add(real);
    if (goodDir(dir)) return dir;
    if (depth >= maxDepth) continue;
    let entries = [];
    try { entries = fs.readdirSync(dir,{withFileTypes:true}); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (/^(?:node_modules|proc|sys|dev|tmp|cache|\.git)$/i.test(entry.name)) continue;
      queue.push({dir:path.join(dir,entry.name),depth:depth+1});
    }
  }
  return '';
}

export function locateProductData() {
  for (const dir of directCandidates()) if (goodDir(dir)) return dir;
  const starts = [...new Set([
    process.env.LAMBDA_TASK_ROOT,
    process.cwd(),
    '/var/task'
  ].filter(Boolean))];
  for (const start of starts) {
    const hit = boundedFind(start,5);
    if (hit) return hit;
  }
  throw new Error('TrendPilot product data bundle was not found in the function runtime.');
}

function readJson(file) {
  const value = JSON.parse(fs.readFileSync(file,'utf8'));
  if (!Array.isArray(value)) throw new Error(`Invalid product data: ${path.basename(file)} is not an array.`);
  return value;
}

export function loadProductData() {
  if (CACHE) return CACHE;
  const dir = locateProductData();
  const products = readJson(path.join(dir,'products.json'));
  const offers = readJson(path.join(dir,'offers.json'));
  const variants = readJson(path.join(dir,'variants.json'));
  if (products.length < 1000 || offers.length < 1000 || variants.length < 1000) {
    throw new Error(`Product data bundle is unexpectedly small (${products.length}/${offers.length}/${variants.length}).`);
  }
  CACHE = {dir,products,offers,variants};
  return CACHE;
}

export function resetProductDataCacheForQA() { CACHE = null; }
