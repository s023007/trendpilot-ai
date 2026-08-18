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
  const wanted = ['pinterest', 'youtube', 'tiktok'];
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

  // TrendPilot currently has four Pinterest boards. Match by stable name prefix so
  // truncated UI labels do not matter and products never fall back to the first board.
  const boardMatchers = {
    tech: /^tech\s*&\s*gadget/i,
    home: /^smart\s+home\s*&/i,
    school: /^back\s+to\s+school/i,
    fashion: /^fashion\s*&\s*everyday/i,
  };

  function choosePinterestBoard(boards) {
    // FOSSiBOT F106 Pro is a phone, so this campaign must go only to Tech & Gadget…
    return boards.find((b) => boardMatchers.tech.test(String(b.name || '').trim())) || null;
  }

  function isCorrectPinterestBoard(name = '') {
    return boardMatchers.tech.test(String(name).trim());
  }

  async function getPinterestBoards(channelId) {
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
    console.log('PINTEREST_BOARDS', JSON.stringify(boards.map((b) => ({ name: b.name, serviceId: b.serviceId }))));
    return boards;
  }

  async function getMatchingDrafts(channel, expectedText) {
    const data = await gql(
      `query ExistingDrafts($org: OrganizationId!, $channel: ChannelId!) {
        posts(first: 50, input: {
          organizationId: $org,
          filter: { status: [draft], channelIds: [$channel] }
        }) {
          edges {
            node {
              id text createdAt channelId channelService
              metadata {
                ... on PinterestPostMetadata {
                  board { name serviceId }
                }
              }
            }
          }
        }
      }`,
      { org: org.id, channel: channel.id },
      `Get ${channel.service} drafts`,
    );
    const drafts = (data?.posts?.edges || []).map((edge) => edge.node);
    const needle = expectedText.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
    return drafts.filter((draft) => (draft.text || '').replace(/\s+/g, ' ').trim().toLowerCase().startsWith(needle));
  }

  async function deleteDraft(id, reason) {
    const data = await gql(
      `mutation DeletePost($input: DeletePostInput!) {
        deletePost(input: $input) {
          __typename
          ... on DeletePostSuccess { id }
          ... on VoidMutationError { message }
        }
      }`,
      { input: { id } },
      'Delete misplaced Buffer draft',
    );
    const payload = data?.deletePost;
    if (!payload || payload.__typename === 'VoidMutationError') {
      throw new Error(`Could not delete misplaced draft ${id}: ${payload?.message || 'unknown error'}`);
    }
    console.log('MISPLACED_DRAFT_DELETED', JSON.stringify({ id, reason }));
  }

  async function createDraft(channel) {
    const spec = post[channel.service];
    let text = spec.caption || spec.description || '';
    const link = spec.link || campaign.product.landing_page;
    if (channel.service !== 'pinterest' && link && !text.includes(link)) text += `\n\n${link}`;

    let pinterestBoard = null;
    if (channel.service === 'pinterest') {
      const matches = await getMatchingDrafts(channel, text);
      for (const draft of matches) {
        const boardName = draft?.metadata?.board?.name || '';
        if (boardName && !isCorrectPinterestBoard(boardName)) {
          await deleteDraft(draft.id, `wrong Pinterest board for phone campaign: ${boardName}`);
        }
      }

      const boards = await getPinterestBoards(channel.id);
      pinterestBoard = choosePinterestBoard(boards);
      if (!pinterestBoard) {
        throw new Error(`Required Tech & Gadget Pinterest board was not found. Existing boards: ${boards.map((b) => b.name).join(' | ')}`);
      }
      console.log('PINTEREST_BOARD_SELECTED', JSON.stringify({ name: pinterestBoard.name, serviceId: pinterestBoard.serviceId }));
    }

    const duplicates = await getMatchingDrafts(channel, text);
    if (duplicates.length) {
      console.log('DRAFT_ALREADY_EXISTS', JSON.stringify({ service: channel.service, postId: duplicates[0].id }));
      return { service: channel.service, status: 'existing', postId: duplicates[0].id };
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
      input.assets = [{ image: { url: imageUrl, metadata: { altText: campaign.product.name } } }];
      input.metadata = {
        pinterest: {
          boardServiceId: pinterestBoard.serviceId,
          title: spec.title || campaign.product.name,
          url: link,
        },
      };
    } else if (channel.service === 'tiktok') {
      input.assets = [{ video: { url: videoUrl, metadata: { thumbnailOffset: 1000 } } }];
      input.metadata = { tiktok: { isAiGenerated: false } };
    } else if (channel.service === 'youtube') {
      input.assets = [{ video: { url: videoUrl } }];
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
          ... on InvalidInputError { message }
          ... on UnauthorizedError { message }
          ... on UnexpectedError { message }
          ... on RestProxyError { message }
          ... on LimitReachedError { message }
        }
      }`,
      { input },
      `Create ${channel.service} draft`,
    );

    const payload = result?.createPost;
    if (!payload || payload.__typename !== 'PostActionSuccess' || !payload.post?.id) {
      throw new Error(`Buffer createPost failed for ${channel.service}: ${payload?.__typename || 'unknown type'}: ${payload?.message || 'unknown error'}`);
    }
    console.log('DRAFT_CREATED', JSON.stringify({
      service: channel.service,
      channel: channel.displayName || channel.name,
      postId: payload.post.id,
      status: payload.post.status,
    }));
    return { service: channel.service, status: 'created', postId: payload.post.id };
  }

  const results = [];
  const failures = [];

  // Each channel is isolated so one network cannot prevent the others from being tested.
  for (const service of wanted) {
    const channel = targets.find((c) => c.service === service);
    try {
      results.push(await createDraft(channel));
    } catch (error) {
      const message = error?.message || String(error);
      failures.push({ service, message });
      console.error('CHANNEL_DRAFT_FAILED', JSON.stringify({ service, message }));
    }
  }

  console.log('BUFFER_CHANNEL_RESULTS', JSON.stringify(results));
  if (failures.length) {
    console.error('BUFFER_CHANNEL_FAILURES', JSON.stringify(failures));
    throw new Error(`Buffer draft test had ${failures.length} channel failure(s): ${failures.map((f) => `${f.service}: ${f.message}`).join(' || ')}`);
  }

  console.log('BUFFER_THREE_CHANNEL_DRAFT_TEST_OK');
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
