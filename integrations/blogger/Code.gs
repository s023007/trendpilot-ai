const TP_BLOGGER = {
  feedUrl: 'https://trendpilotchoice.com/feed.xml',
  blogUrl: 'https://trendpilotchoice.blogspot.com/',
  maxPerRun: 3,
  stateKey: 'TREND_PILOT_BLOGGER_SEEN_V2',
};

function syncTrendPilotToBlogger() {
  const response = UrlFetchApp.fetch(TP_BLOGGER.feedUrl, {
    muteHttpExceptions: false,
    followRedirects: true,
  });
  const doc = XmlService.parse(response.getContentText());
  const channel = doc.getRootElement().getChild('channel');
  if (!channel) throw new Error('TrendPilot RSS channel not found');

  const items = channel.getChildren('item').map(readRssItem_).filter(Boolean);
  items.sort((a, b) => b.published.getTime() - a.published.getTime());

  const blog = bloggerApi_(
    'https://www.googleapis.com/blogger/v3/blogs/byurl?url=' + encodeURIComponent(TP_BLOGGER.blogUrl),
    { method: 'get' }
  );
  if (!blog || !blog.id) throw new Error('Blogger blog not found: ' + TP_BLOGGER.blogUrl);

  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty(TP_BLOGGER.stateKey);
  const seen = new Set(stored ? JSON.parse(stored) : []);
  const firstRun = !stored;

  const candidates = items.filter(item => !seen.has(item.guid));
  const batch = candidates.slice(0, TP_BLOGGER.maxPerRun);
  const published = [];

  for (const item of batch) {
    const post = {
      kind: 'blogger#post',
      title: item.title,
      content: buildPostHtml_(item),
      labels: [item.category || 'TrendPilot', 'TrendPilot Choice'],
    };
    const created = bloggerApi_(
      `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blog.id)}/posts?isDraft=false`,
      {
        method: 'post',
        contentType: 'application/json; charset=utf-8',
        payload: JSON.stringify(post),
      }
    );
    published.push({ guid: item.guid, bloggerPostId: created.id, title: item.title, url: created.url || null });
    seen.add(item.guid);
  }

  // First authorization/run: publish only the newest batch, then mark the current
  // historical feed as seen so Blogger is not flooded with old material.
  if (firstRun) items.forEach(item => seen.add(item.guid));

  props.setProperty(TP_BLOGGER.stateKey, JSON.stringify(Array.from(seen).slice(-500)));
  console.log(JSON.stringify({
    feedItems: items.length,
    firstRun,
    publishedCount: published.length,
    published,
  }));
}

function installTrendPilotBloggerTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncTrendPilotToBlogger')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncTrendPilotToBlogger')
    .timeBased()
    .everyHours(1)
    .create();

  // Run once now so Google asks for authorization and the connection is verified.
  syncTrendPilotToBlogger();
}

function bloggerApi_(url, options) {
  const token = ScriptApp.getOAuthToken();
  const params = Object.assign({}, options || {}, {
    headers: Object.assign({}, (options && options.headers) || {}, {
      Authorization: 'Bearer ' + token,
    }),
    muteHttpExceptions: true,
  });
  const response = UrlFetchApp.fetch(url, params);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error(`Blogger API HTTP ${code}: ${text.slice(0, 1000)}`);
  }
  return text ? JSON.parse(text) : {};
}

function readRssItem_(item) {
  const title = text_(item, 'title');
  const link = text_(item, 'link');
  const guid = text_(item, 'guid') || link;
  if (!title || !link || !guid) return null;

  const pubRaw = text_(item, 'pubDate');
  const category = text_(item, 'category') || 'TrendPilot';
  const description = text_(item, 'description');
  const mediaNs = XmlService.getNamespace('media', 'http://search.yahoo.com/mrss/');
  const media = item.getChild('content', mediaNs);
  const imageAttr = media ? media.getAttribute('url') : null;
  const image = imageAttr ? imageAttr.getValue() : '';

  const parsedDate = pubRaw ? new Date(pubRaw) : new Date();
  return {
    title,
    link,
    guid,
    category,
    description,
    image,
    published: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
  };
}

function buildPostHtml_(item) {
  const title = escapeHtml_(item.title);
  const url = escapeHtml_(item.link);
  const summary = escapeHtml_(stripTags_(item.description)).slice(0, 900);
  const image = item.image ? `<p><a href="${url}"><img src="${escapeHtml_(item.image)}" alt="${title}" style="max-width:100%;height:auto"></a></p>` : '';

  return [
    image,
    `<p>${summary}</p>`,
    `<p><strong><a href="${url}">Read the complete guide on TrendPilot Choice →</a></strong></p>`,
    '<p><small>Originally published on TrendPilot Choice. Product availability, prices, tickets and travel details can change; verify current details before purchasing or booking.</small></p>',
  ].join('\n');
}

function text_(parent, name) {
  const child = parent.getChild(name);
  return child ? child.getText().trim() : '';
}

function stripTags_(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
