const fs = require('fs');

(async () => {
  const apiKey = process.env.BUFFER_API_KEY;
  const campaignFile = process.env.PINTEREST_GROWTH_CAMPAIGN || 'data/campaigns/pinterest-growth-f106-v1.json';

  if (!apiKey) throw new Error('BUFFER_API_KEY is missing');

  const campaign = JSON.parse(fs.readFileSync(campaignFile, 'utf8'));
  if (campaign.channel !== 'pinterest') throw new Error('Pinterest growth campaign must target pinterest only');
  if (!Array.isArray(campaign.pins) || campaign.pins.length < 3) throw new Error('Pinterest growth campaign must contain at least 3 creative variants');

  const assetSlug = String(campaign.asset_slug || campaign.campaign_id || '').replace(/^\/+|\/+$/g, '');
  if (!assetSlug) throw new Error('Pinterest growth campaign requires asset_slug or campaign_id');
  const assetBaseUrl = (
    process.env.PIN_ASSET_BASE_URL
    || campaign.asset_base_url
    || `https://trendpilotchoice.com/media/pinterest-growth/${assetSlug}`
  ).replace(/\/$/, '');

  async function gql(query, variables = {}, label = 'Buffer GraphQL') {
    const response = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${label}: non-JSON response HTTP ${response.status}: ${text.slice(0, 800)}`);
    }
    if (!response.ok || body.errors?.length) {
      throw new Error(`${label}: HTTP ${response.status} ${JSON.stringify(body)}`);
    }
    return body.data;
  }

  const accountData = await gql('query { account { organizations { id name } } }', {}, 'Get Buffer account');
  const org = accountData?.account?.organizations?.[0];
  if (!org) throw new Error('No Buffer organization found');

  const channelData = await gql(
    `query GetChannels($org: OrganizationId!) {
      channels(input: { organizationId: $org }) {
        id name displayName service isQueuePaused
      }
    }`,
    { org: org.id },
    'Get Buffer channels',
  );

  const pinterest = (channelData?.channels || []).find((channel) => channel.service === 'pinterest');
  if (!pinterest) throw new Error('Pinterest channel is not connected in Buffer');
  if (pinterest.isQueuePaused) console.warn('PINTEREST_QUEUE_IS_PAUSED');

  const boardMatchers = {
    tech: /^tech\s*&\s*gadget/i,
    home: /^smart\s+home\s*&/i,
    school: /^back\s+to\s+school/i,
    fashion: /^fashion\s*&\s*everyday/i,
    travel: /^travel/i,
    kitchen: /^kitchen/i,
    camping: /^(camping|outdoor)/i,
    beauty: /^beauty/i,
    pets: /^(pet|pets)/i,
  };

  const boardData = await gql(
    `query GetPinterestChannel($id: ChannelId!) {
      channel(input: { id: $id }) {
        metadata {
          ... on PinterestMetadata {
            boards { id name serviceId url }
          }
        }
      }
    }`,
    { id: pinterest.id },
    'Get Pinterest boards',
  );
  const boards = boardData?.channel?.metadata?.boards || [];

  let board;
  if (campaign.board_name) {
    const wanted = String(campaign.board_name).trim().toLowerCase();
    board = boards.find((item) => String(item.name || '').trim().toLowerCase() === wanted);
  } else {
    const matcher = boardMatchers[campaign.board_key];
    if (!matcher) throw new Error(`Unknown Pinterest board_key: ${campaign.board_key}. Set board_name for an exact board match.`);
    board = boards.find((item) => matcher.test(String(item.name || '').trim()));
  }
  if (!board) {
    throw new Error(`Pinterest board was not found. Requested: ${campaign.board_name || campaign.board_key}. Existing boards: ${boards.map((b) => b.name).join(' | ')}`);
  }

  const existingData = await gql(
    `query ExistingPinterestPosts($org: OrganizationId!, $channel: ChannelId!) {
      posts(first: 50, input: {
        organizationId: $org,
        filter: { status: [draft, scheduled, sending, sent], channelIds: [$channel] }
      }) {
        edges {
          node {
            id text status dueAt createdAt channelId channelService
            metadata {
              ... on PinterestPostMetadata {
                board { name serviceId }
              }
            }
          }
        }
      }
    }`,
    { org: org.id, channel: pinterest.id },
    'Get existing Pinterest posts',
  );
  const existing = (existingData?.posts?.edges || []).map((edge) => edge.node);

  function normalized(value = '') {
    return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function alreadyExists(pin) {
    const needle = normalized(pin.description).slice(0, 150);
    return existing.find((post) => normalized(post.text).startsWith(needle));
  }

  const orderedPins = [...campaign.pins].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const nextPin = orderedPins.find((pin) => !alreadyExists(pin));

  console.log('PINTEREST_GROWTH_STATE', JSON.stringify({
    campaign: campaign.campaign_id,
    primaryKeyword: campaign.search?.primary_keyword || null,
    board: board.name,
    assetBaseUrl,
    totalVariants: orderedPins.length,
    alreadyPresent: orderedPins.filter((pin) => alreadyExists(pin)).map((pin) => pin.pin_id),
    next: nextPin?.pin_id || null,
  }));

  if (!nextPin) {
    console.log('PINTEREST_GROWTH_COMPLETE');
    return;
  }

  if (!nextPin.pin_id || !nextPin.title || !nextPin.description || !nextPin.link) {
    throw new Error('Next Pinterest variant requires pin_id, title, description and link');
  }

  const imageUrl = `${assetBaseUrl}/${nextPin.pin_id}.png`;
  const input = {
    text: nextPin.description,
    channelId: pinterest.id,
    schedulingType: 'automatic',
    mode: 'addToQueue',
    saveToDraft: false,
    needsApproval: false,
    aiAssisted: true,
    source: 'trendpilot-github-pinterest-growth',
    assets: [{ image: { url: imageUrl, metadata: { altText: nextPin.image_alt || nextPin.headline || nextPin.title } } }],
    metadata: {
      pinterest: {
        boardServiceId: board.serviceId,
        title: nextPin.title,
        url: nextPin.link,
      },
    },
  };

  const created = await gql(
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { id text dueAt status channelId channelService } }
        ... on MutationError { message }
        ... on InvalidInputError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
        ... on RestProxyError { message }
        ... on LimitReachedError { message }
      }
    }`,
    { input },
    'Queue Pinterest growth Pin',
  );

  const payload = created?.createPost;
  if (!payload || payload.__typename !== 'PostActionSuccess' || !payload.post?.id) {
    throw new Error(`Buffer createPost failed: ${payload?.__typename || 'unknown'}: ${payload?.message || 'unknown error'}`);
  }

  console.log('PINTEREST_GROWTH_PIN_QUEUED', JSON.stringify({
    pinId: nextPin.pin_id,
    creativeId: nextPin.creative_id,
    intent: nextPin.intent || null,
    searchQuery: nextPin.search_query || null,
    angle: nextPin.angle,
    board: board.name,
    bufferPostId: payload.post.id,
    status: payload.post.status,
    dueAt: payload.post.dueAt,
    imageUrl,
    destination: nextPin.link,
  }));
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
