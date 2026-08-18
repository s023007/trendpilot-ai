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

  const boardMatchers = {
    tech: /^tech\s*&\s*gadget/i,
    home: /^smart\s+home\s*&/i,
    school: /^back\s+to\s+school/i,
    fashion: /^fashion\s*&\s*everyday/i,
  };

  function choosePinterestBoard(boards) {
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

  async function getMatchingPosts(channel, expectedText) {
    const data = await gql(
      `query ExistingPosts($org: OrganizationId!, $channel: ChannelId!) {
        posts(first: 50, input: {
          organizationId: $org,
          filter: { status: [draft, scheduled, sending, sent], channelIds: [$channel] }
        }) {
          edges {
            node {
              id text createdAt dueAt status channelId channelService
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
      `Get ${channel.service} posts`,
    );
    const posts = (data?.posts?.edges || []).map((edge) => edge.node);
    const needle = expectedText.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
    return posts.filter((item) => (item.text || '').replace(/\s+/g, ' ').trim().toLowerCase().startsWith(needle));
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

  async function promoteDraftToQueue(item, service) {
    const data = await gql(
      `mutation EditPost($input: EditPostInput!) {
        editPost(input: $input) {
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
      {
        input: {
          id: item.id,
          schedulingType: 'automatic',
          mode: 'addToQueue',
          saveToDraft: false,
        },
      },
      `Promote ${service} draft to queue`,
    );
    const payload = data?.editPost;
    if (!payload || payload.__typename !== 'PostActionSuccess' || !payload.post?.id) {
      throw new Error(`Buffer editPost failed for ${service}: ${payload?.__typename || 'unknown type'}: ${payload?.message || 'unknown error'}`);
    }
    console.log('POST_QUEUED_FROM_DRAFT', JSON.stringify({
      service,
      postId: payload.post.id,
      status: payload.post.status,
      dueAt: payload.post.dueAt,
    }));
    return { service, action: 'promoted', postId: payload.post.id, status: payload.post.status, dueAt: payload.post.dueAt };
  }

  function buildPostInput(channel, spec, text, link, pinterestBoard) {
    const input = {
      text,
      channelId: channel.id,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      saveToDraft: false,
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
    return input;
  }

  async function createQueuedPost(channel, input) {
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
      `Create queued ${channel.service} post`,
    );

    const payload = result?.createPost;
    if (!payload || payload.__typename !== 'PostActionSuccess' || !payload.post?.id) {
      throw new Error(`Buffer createPost failed for ${channel.service}: ${payload?.__typename || 'unknown type'}: ${payload?.message || 'unknown error'}`);
    }
    console.log('POST_QUEUED_NEW', JSON.stringify({
      service: channel.service,
      channel: channel.displayName || channel.name,
      postId: payload.post.id,
      status: payload.post.status,
      dueAt: payload.post.dueAt,
    }));
    return { service: channel.service, action: 'created', postId: payload.post.id, status: payload.post.status, dueAt: payload.post.dueAt };
  }

  async function queueTrackedPost(channel) {
    const spec = post[channel.service];
    let text = spec.caption || spec.description || '';
    const link = spec.link || campaign.product.landing_page;
    if (channel.service !== 'pinterest' && link && !text.includes(link)) text += `\n\n${link}`;

    let pinterestBoard = null;
    let matches = await getMatchingPosts(channel, text);

    if (channel.service === 'pinterest') {
      for (const item of matches.filter((x) => x.status === 'draft')) {
        const boardName = item?.metadata?.board?.name || '';
        if (boardName && !isCorrectPinterestBoard(boardName)) {
          await deleteDraft(item.id, `wrong Pinterest board for phone campaign: ${boardName}`);
        }
      }

      const boards = await getPinterestBoards(channel.id);
      pinterestBoard = choosePinterestBoard(boards);
      if (!pinterestBoard) {
        throw new Error(`Required Tech & Gadget Pinterest board was not found. Existing boards: ${boards.map((b) => b.name).join(' | ')}`);
      }
      console.log('PINTEREST_BOARD_SELECTED', JSON.stringify({ name: pinterestBoard.name, serviceId: pinterestBoard.serviceId }));
      matches = await getMatchingPosts(channel, text);
    }

    const alreadyLiveOrQueued = matches.find((x) => ['scheduled', 'sending', 'sent'].includes(x.status));
    if (alreadyLiveOrQueued) {
      console.log('POST_ALREADY_QUEUED_OR_SENT', JSON.stringify({
        service: channel.service,
        postId: alreadyLiveOrQueued.id,
        status: alreadyLiveOrQueued.status,
        dueAt: alreadyLiveOrQueued.dueAt,
      }));
      return { service: channel.service, action: 'existing', postId: alreadyLiveOrQueued.id, status: alreadyLiveOrQueued.status, dueAt: alreadyLiveOrQueued.dueAt };
    }

    const reusableDraft = matches.find((x) => {
      if (x.status !== 'draft') return false;
      if (channel.service !== 'pinterest') return true;
      return isCorrectPinterestBoard(x?.metadata?.board?.name || '');
    });

    if (reusableDraft) return promoteDraftToQueue(reusableDraft, channel.service);

    const input = buildPostInput(channel, spec, text, link, pinterestBoard);
    return createQueuedPost(channel, input);
  }

  const results = [];
  const failures = [];

  for (const service of wanted) {
    const channel = targets.find((c) => c.service === service);
    try {
      results.push(await queueTrackedPost(channel));
    } catch (error) {
      const message = error?.message || String(error);
      failures.push({ service, message });
      console.error('CHANNEL_QUEUE_FAILED', JSON.stringify({ service, message }));
    }
  }

  console.log('BUFFER_QUEUE_RESULTS', JSON.stringify(results));
  if (failures.length) {
    console.error('BUFFER_QUEUE_FAILURES', JSON.stringify(failures));
    throw new Error(`Buffer queue run had ${failures.length} channel failure(s): ${failures.map((f) => `${f.service}: ${f.message}`).join(' || ')}`);
  }

  console.log('BUFFER_THREE_CHANNEL_QUEUE_OK');
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
