import fs from 'node:fs';

const API = 'https://api.buffer.com';
const DATA_PATH = 'data/v20-9/seller-browse-samples.json';
const BLOCKED_SELLERS = [/^joom$/i, /^temu$/i, /filamentpro/i];

const apiKey = process.env.BUFFER_API_KEY;
const productId = process.env.PRODUCT_ID || '6aaec79cc643e9';
const boardName = process.env.BOARD_NAME || 'Back to School Finds';
const publish = String(process.env.PUBLISH || 'false').toLowerCase() === 'true';
const campaign = process.env.CAMPAIGN || 'pinterest_product_launch_2026';

if (!apiKey) throw new Error('BUFFER_API_KEY is missing.');

function gqlString(value) {
  return JSON.stringify(String(value));
}

async function gql(query) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error(`Buffer returned non-JSON HTTP ${response.status}`); }
  if (!response.ok) throw new Error(`Buffer HTTP ${response.status}`);
  if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));
  return payload.data;
}

function loadProduct() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const rec = raw?.records?.[productId];
  if (!rec) throw new Error(`Product ${productId} was not found in ${DATA_PATH}.`);
  if (BLOCKED_SELLERS.some(rx => rx.test(String(rec.se || '')))) {
    throw new Error(`Blocked seller guard rejected ${rec.se}.`);
  }
  if (String(rec.se || '').toLowerCase().includes('tiktok') && process.env.TARGET_COUNTRY !== 'US') {
    throw new Error('TikTok Shop US products are US-only and are blocked from global Pinterest publishing.');
  }
  if (/lenovo/i.test(String(rec.se || '')) && Number(rec.p) <= 5) {
    throw new Error('Lenovo placeholder-price guard rejected this product.');
  }
  if (!rec.im || !/^https:\/\//i.test(rec.im)) throw new Error('Product has no usable HTTPS image.');
  return rec;
}

function cleanTitle(title) {
  return String(title || 'Product find').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function buildDescription(rec) {
  const family = String(rec.tyl || rec.fa || rec.ty || 'product').replace(/_/g, ' ');
  const seller = String(rec.se || 'seller');
  const text = `Discover this ${family} pick from ${seller}. Review the product details, current seller information and available options on TrendPilot before you buy.`;
  return text.slice(0, 480);
}

async function discoverPinterest() {
  const account = await gql(`query { account { organizations { id name } } }`);
  const orgs = account?.account?.organizations || [];
  const found = [];
  for (const org of orgs) {
    const channels = await gql(`query { channels(input: { organizationId: ${gqlString(org.id)} }) { id name service } }`);
    for (const c of channels?.channels || []) {
      if (String(c.service).toLowerCase() !== 'pinterest') continue;
      const detail = await gql(`query { channel(input: { id: ${gqlString(c.id)} }) { id name metadata { ... on PinterestMetadata { boards { name serviceId url } } } } }`);
      found.push(detail.channel);
    }
  }
  if (!found.length) throw new Error('No Pinterest channel is connected in Buffer.');
  return found;
}

const rec = loadProduct();
const channels = await discoverPinterest();
const channel = channels[0];
const boards = channel?.metadata?.boards || [];
const board = boards.find(b => String(b.name).trim().toLowerCase() === boardName.trim().toLowerCase());

const destination = `https://trendpilotchoice.com/product/?id=${encodeURIComponent(productId)}&utm_source=pinterest&utm_medium=organic&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${encodeURIComponent(productId)}`;
const title = cleanTitle(rec.t);
const description = buildDescription(rec);

console.log(`Pinterest channel: ${channel?.name || '(unknown)'}`);
console.log(`Boards visible to Buffer: ${boards.length}`);
console.log(`Target board: ${boardName}`);
console.log(`Product: ${title}`);
console.log(`Seller: ${rec.se}`);
console.log(`Image: ${rec.im}`);
console.log(`Destination: ${destination}`);
console.log(`Mode: ${publish ? 'PUBLISH TO BUFFER QUEUE' : 'DRY RUN ONLY'}`);

if (!board) {
  console.log('BLOCKED: Target board is not visible through Buffer yet. Refresh/re-authorize the Pinterest channel in Buffer and rerun.');
  process.exit(0);
}

if (!publish) {
  console.log(`READY: Board matched: ${board.name}. No post was created.`);
  process.exit(0);
}

const mutation = `mutation {
  createPost(input: {
    text: ${gqlString(description)}
    channelId: ${gqlString(channel.id)}
    schedulingType: automatic
    mode: addToQueue
    aiAssisted: true
    source: "trendpilot-github"
    assets: [{ image: { url: ${gqlString(rec.im)} } }]
    metadata: { pinterest: {
      boardServiceId: ${gqlString(board.serviceId)}
      title: ${gqlString(title)}
      url: ${gqlString(destination)}
    } }
  }) {
    ... on PostActionSuccess { post { id text dueAt status } }
    ... on MutationError { message }
  }
}`;

const result = await gql(mutation);
const payload = result?.createPost;
if (payload?.message) throw new Error(`Buffer createPost failed: ${payload.message}`);
if (!payload?.post?.id) throw new Error('Buffer createPost did not return a post ID.');
console.log(`CREATED: Buffer post ${payload.post.id} queued successfully.`);
