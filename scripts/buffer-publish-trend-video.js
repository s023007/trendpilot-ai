const fs = require('fs');

(async () => {
  const apiKey = process.env.BUFFER_API_KEY;
  const campaignPath = process.env.CAMPAIGN_FILE;
  const videoUrl = process.env.MEDIA_VIDEO_URL;

  if (!apiKey) throw new Error('BUFFER_API_KEY is missing');
  if (!campaignPath) throw new Error('CAMPAIGN_FILE is missing');
  if (!videoUrl) throw new Error('MEDIA_VIDEO_URL is missing');

  const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
  const post = campaign.posts?.find((p) => p.sequence === 1);
  if (!post) throw new Error('Campaign post sequence 1 not found');

  const wanted = ['pinterest', 'youtube', 'tiktok'];
  const declared = [campaign.primary_channel, ...(campaign.secondary_channels || [])];
  if (JSON.stringify(declared) !== JSON.stringify(['pinterest', 'tiktok', 'youtube'])) {
    throw new Error(`Campaign channels must be exactly pinterest,tiktok,youtube; got ${declared.join(',')}`);
  }

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
  const channels = channelData?.channels || [];
  const targets = wanted.map((service) => channels.find((c) => c.service === service)).filter(Boolean);
  const found = new Set(targets.map((c) => c.service));
  const missing = wanted.filter((s) => !found.has(s));
  if (missing.length) throw new Error(`Missing Buffer channels: ${missing.join(', ')}`);

  console.log('BUFFER_TARGETS', JSON.stringify(targets.map((c) => ({
    service: c.service,
    id: c.id,
    name: c.displayName || c.name,
  }))));

  const boardMatchers = {
    tech: /^tech\s*&\s*gadget/i,
    home: /^smart\s+home\s*&/i,
    school: /^back\s+to\s+school/i,
    fashion: /^fashion\s*&\s*everyday/i,
  };

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
    const matcher = boardMatchers[campaign.pinterest_board || 'tech'] || boardMatchers.tech;
    const board = boards.find((b) => matcher.test(String(b.name || '').trim()));
    if (!board) throw new Error(`Required Pinterest board not found. Available: ${boards.map((b) => b.name).join(' | ')}`);
    console.log('PINTEREST_BOARD_SELECTED', JSON.stringify({ name: board.name, serviceId: board.serviceId }));
    return board;
  }

  function normalize(s = '') {
    return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
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
              id text createdAt dueAt sentAt status channelId channelService externalLink
            }
          }
        }
      }`,
      { org: org.id, channel: channel.id },
      `Get ${channel.service} posts`,
    );
    const posts = (data?.posts?.edges || []).map((e) => e.node);
    const needle = normalize(expectedText).slice(0, 210);
    return posts.filter((item) => normalize(item.text).startsWith(needle));
  }

  async function deleteDraft(id) {
    const data = await gql(
      `mutation DeletePost($input: DeletePostInput!) {
        deletePost(input: $input) {
          __typename
          ... on DeletePostSuccess { id }
          ... on VoidMutationError { message }
        }
      }`,
      { input: { id } },
      'Delete old Buffer draft',
    );
    const payload = data?.deletePost;
    if (!payload || payload.__typename === 'VoidMutationError') {
      throw new Error(`Could not delete draft ${id}: ${payload?.message || 'unknown error'}`);
    }
  }

  function buildInput(channel, spec, text, link, pinterestBoard) {
    const input = {
      text,
      channelId: channel.id,
      schedulingType: 'automatic',
      mode: 'shareNow',
      saveToDraft: false,
      needsApproval: false,
      aiAssisted: true,
      source: 'trendpilot-trend-radar',
      assets: [{ video: { url: videoUrl, metadata: { thumbnailOffset: 1800 } } }],
    };

    if (channel.service === 'pinterest') {
      input.metadata = {
        pinterest: {
          boardServiceId: pinterestBoard.serviceId,
          title: spec.title || campaign.product.name,
          url: link,
        },
      };
    } else if (channel.service === 'tiktok') {
      input.metadata = { tiktok: { isAiGenerated: false } };
    } else if (channel.service === 'youtube') {
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

  async function createPost(channel, input) {
    const data = await gql(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess {
            post { id text status dueAt sentAt externalLink channelId channelService sharedNow shareMode }
          }
          ... on MutationError { message }
          ... on InvalidInputError { message }
          ... on UnauthorizedError { message }
          ... on UnexpectedError { message }
          ... on RestProxyError { message }
          ... on LimitReachedError { message }
        }
      }`,
      { input },
      `Publish ${channel.service}`,
    );
    const payload = data?.createPost;
    if (!payload || payload.__typename !== 'PostActionSuccess' || !payload.post?.id) {
      throw new Error(`Buffer createPost failed for ${channel.service}: ${payload?.__typename || 'unknown'}: ${payload?.message || 'unknown error'}`);
    }
    console.log('POST_PUBLISH_REQUESTED', JSON.stringify({
      service: channel.service,
      postId: payload.post.id,
      status: payload.post.status,
      sharedNow: payload.post.sharedNow,
      shareMode: payload.post.shareMode,
      externalLink: payload.post.externalLink,
    }));
    return payload.post;
  }

  async function publishChannel(channel) {
    const spec = post[channel.service];
    if (!spec) throw new Error(`Missing ${channel.service} campaign content`);
    const link = spec.link || campaign.product.landing_page;
    let text = spec.caption || spec.description || '';
    if (channel.service !== 'pinterest' && link && !text.includes(link)) text += `\n\n${link}`;

    const matches = await getMatchingPosts(channel, text);
    const live = matches.find((x) => ['scheduled', 'sending', 'sent'].includes(x.status));
    if (live) {
      console.log('POST_ALREADY_EXISTS', JSON.stringify({ service: channel.service, id: live.id, status: live.status, externalLink: live.externalLink }));
      return { service: channel.service, action: 'existing', post: live };
    }
    for (const draft of matches.filter((x) => x.status === 'draft')) await deleteDraft(draft.id);

    const board = channel.service === 'pinterest' ? await getPinterestBoard(channel.id) : null;
    const input = buildInput(channel, spec, text, link, board);
    const created = await createPost(channel, input);
    return { service: channel.service, action: 'shareNow', post: created };
  }

  const results = [];
  const failures = [];
  for (const service of wanted) {
    const channel = targets.find((c) => c.service === service);
    try {
      results.push(await publishChannel(channel));
    } catch (error) {
      const message = error?.message || String(error);
      failures.push({ service, message });
      console.error('CHANNEL_PUBLISH_FAILED', JSON.stringify({ service, message }));
    }
  }

  console.log('TREND_VIDEO_RESULTS', JSON.stringify(results));
  if (failures.length) {
    console.error('TREND_VIDEO_FAILURES', JSON.stringify(failures));
    throw new Error(`Trend video had ${failures.length} channel failure(s): ${failures.map((f) => `${f.service}: ${f.message}`).join(' || ')}`);
  }
  console.log('TREND_VIDEO_THREE_CHANNEL_PUBLISH_OK');
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
