const fs = require('fs');
const path = require('path');

(async () => {
  const apiKey = process.env.BUFFER_API_KEY;
  const campaignPath = process.env.CAMPAIGN_FILE || 'data/campaigns/fossibot-f106-pro-launch-v1.json';
  const productId = process.env.PRODUCT_ID || 'bcba2c15f61566';
  const videoUrl = process.env.MEDIA_VIDEO_URL;

  if (!apiKey) throw new Error('BUFFER_API_KEY is missing');
  if (!videoUrl) throw new Error('MEDIA_VIDEO_URL is missing');

  const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
  const post = campaign.posts.find((p) => p.sequence === 1);
  if (!post) throw new Error('Campaign post sequence 1 not found');

  function findProduct(id) {
    const bucket = path.join(process.cwd(), 'data/v20-9/products', `${id.slice(0, 2)}.json`);
    const obj = JSON.parse(fs.readFileSync(bucket, 'utf8'));
    return obj[id] || null;
  }

  const product = findProduct(productId);
  if (!product || !product.im) throw new Error(`Product image not found for ${productId}`);
  const imageUrl = product.im;

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
  const orgs = accountData?.account?.organizations || [];
  if (!orgs.length) throw new Error('No Buffer organizations found');
  const org = orgs[0];

  const channelData = await gql(
    `query GetChannels($org: OrganizationId!) {
      channels(input: { organizationId: $org }) {
        id name displayName service isQueuePaused
      }
    }`,
    { org: org.id },
    'Get Buffer channels',
  );

  const channels = channelData?.channels || [];
  const wanted = ['pinterest', 'tiktok', 'youtube'];
  const targets = wanted.map((service) => channels.find((c) => c.service === service)).filter(Boolean);

  console.log('BUFFER_ORGANIZATION', JSON.stringify({ id: org.id, name: org.name }));
  console.log('BUFFER_CHANNELS', JSON.stringify(channels.map((c) => ({
    id: c.id,
    service: c.service,
    name: c.displayName || c.name,
    paused: c.isQueuePaused,
  }))));

  const foundServices = new Set(targets.map((c) => c.service));
  const missing = wanted.filter((service) => !foundServices.has(service));
  if (missing.length) throw new Error(`Missing required Buffer channels: ${missing.join(', ')}`);

  for (const service of wanted) {
    if (!post[service]) throw new Error(`Campaign post 1 has no ${service} content`);
  }

  async function getPinterestBoard(channelId) {
    const data = await gql(
      `query GetPinterestChannel($id: ChannelId!) {
        channel(input: { id: $id }) {
          metadata {
            ... on PinterestMetadata {
              boards { id name serviceId url }
            }
          }
        }
      }`,
      { id: channelId },
      'Get Pinterest boards',
    );
    const boards = data?.channel?.metadata?.boards || [];
    if (!boards.length) throw new Error('Pinterest channel has no boards');
    console.log('PINTEREST_BOARDS', JSON.stringify(boards.map((b) => ({ name: b.name, serviceId: b.serviceId }))));
    const preferred = boards.find((b) => /trend\s*pilot|tech|gadget|phone|electronics|shopping/i.test(b.name));
    if (preferred) return preferred;
    console.log('PINTEREST_BOARD_FALLBACK', boards[0].name);
    return boards[0];
  }

  async function existingDraft(channel, expectedText) {
    const data = await gql(
      `query ExistingDrafts($org: OrganizationId!, $channel: ChannelId!) {
        posts(first: 50, input: {
          organizationId: $org,
          filter: { status: [draft], channelIds: [$channel] }
        }) {
          edges { node { id text createdAt channelId } }
        }
      }`,
      { org: org.id, channel: channel.id },
      `Get ${channel.service} drafts`,
    );
    const drafts = (data?.posts?.edges || []).map((edge) => edge.node);
    const needle = expectedText.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
    return drafts.find((draft) => (draft.text || '').replace(/\s+/g, ' ').trim().toLowerCase().startsWith(needle)) || null;
  }

  async function createDraft(channel) {
    const spec = post[channel.service];
    let text = spec.caption || spec.description || '';
    const link = spec.link || campaign.product.landing_page;
    if (channel.service !== 'pinterest' && link && !text.includes(link)) text += `\n\n${link}`;

    const duplicate = await existingDraft(channel, text);
    if (duplicate) {
      console.log('DRAFT_ALREADY_EXISTS', JSON.stringify({ service: channel.service, postId: duplicate.id }));
      return;
    }

    const input = {
      text,
      channelId: channel.id,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      saveToDraft: true,
      needsApproval: false,
      aiAssisted: true,
      source: 'trendpilot-github',
      assets: [],
    };

    if (channel.service === 'pinterest') {
      const board = await getPinterestBoard(channel.id);
      input.assets = [{ image: { url: imageUrl, metadata: { altText: campaign.product.name } } }];
      input.metadata = {
        pinterest: {
          boardServiceId: board.serviceId,
          title: spec.title || campaign.product.name,
          url: link,
        },
      };
    } else if (channel.service === 'tiktok') {
      input.assets = [{ video: { url: videoUrl, metadata: { thumbnailOffset: 1000 } } }];
      input.metadata = { tiktok: { isAiGenerated: false } };
    } else if (channel.service === 'youtube') {
      input.assets = [{ video: { url: videoUrl, metadata: { thumbnailOffset: 1000 } } }];
      input.metadata = {
        youtube: {
          title: spec.title || campaign.product.name,
          categoryId: '28',
          madeForKids: false,
          privacy: 'public',
          notifySubscribers: true,
          embeddable: true,
          isAiGenerated: false,
        },
      };
    }

    const result = await gql(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess { post { id text dueAt status channelId channelService } }
          ... on MutationError { message }
        }
      }`,
      { input },
      `Create ${channel.service} draft`,
    );

    const payload = result?.createPost;
    if (!payload || payload.__typename === 'MutationError' || payload.message || !payload.post?.id) {
      throw new Error(`Buffer createPost failed for ${channel.service}: ${payload?.message || 'unknown error'}`);
    }
    console.log('DRAFT_CREATED', JSON.stringify({
      service: channel.service,
      channel: channel.displayName || channel.name,
      postId: payload.post.id,
      status: payload.post.status,
    }));
  }

  for (const service of wanted) {
    const channel = targets.find((c) => c.service === service);
    await createDraft(channel);
  }

  console.log('BUFFER_THREE_CHANNEL_DRAFT_TEST_OK');
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
