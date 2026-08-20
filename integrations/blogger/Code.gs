const TP_BLOGGER = {
  feedUrl: 'https://trendpilotchoice.com/feed.xml',
  postingEmailProperty: 'BLOGGER_POST_EMAIL',
  firstRunBatch: 3,
  routineBatch: 1,
  stateKey: 'TREND_PILOT_BLOGGER_SEEN_V3',
};

function syncTrendPilotToBlogger() {
  const props = PropertiesService.getScriptProperties();
  const postingEmail = String(props.getProperty(TP_BLOGGER.postingEmailProperty) || '').trim();
  if (!postingEmail || !/@blogger\.com$/i.test(postingEmail)) {
    throw new Error('Missing BLOGGER_POST_EMAIL script property. Add the full secret Blogger posting email in Project settings > Script properties.');
  }

  const response = UrlFetchApp.fetch(TP_BLOGGER.feedUrl, {
    muteHttpExceptions: false,
    followRedirects: true,
  });
  const doc = XmlService.parse(response.getContentText());
  const channel = doc.getRootElement().getChild('channel');
  if (!channel) throw new Error('TrendPilot RSS channel not found');

  const items = channel.getChildren('item').map(readRssItem_).filter(Boolean);
  items.sort((a, b) => b.published.getTime() - a.published.getTime());

  const stored = props.getProperty(TP_BLOGGER.stateKey);
  const seen = new Set(stored ? JSON.parse(stored) : []);
  const firstRun = !stored;
  const maxPerRun = firstRun ? TP_BLOGGER.firstRunBatch : TP_BLOGGER.routineBatch;
  const candidates = items.filter(item => !seen.has(item.guid));
  const batch = candidates.slice(0, maxPerRun);
  const published = [];

  for (const item of batch) {
    const html = buildPostHtml_(item);
    MailApp.sendEmail({
      to: postingEmail,
      subject: item.title,
      htmlBody: html,
      body: stripTags_(html),
      name: 'TrendPilot Choice',
    });
    seen.add(item.guid);
    published.push({ guid: item.guid, title: item.title, source: item.link });
    Utilities.sleep(1200);
  }

  // First run: publish the newest few items only, then mark older current feed items
  // as seen so the new Blogger account is not flooded with historical posts.
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

  // Three checks per day. If there is no new RSS item, nothing is posted.
  ScriptApp.newTrigger('syncTrendPilotToBlogger')
    .timeBased()
    .everyHours(8)
    .create();

  // Run once now: publishes up to three newest current RSS items and verifies the connection.
  syncTrendPilotToBlogger();
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
  const category = escapeHtml_(item.category || 'TrendPilot');
  const summary = escapeHtml_(stripTags_(item.description)).slice(0, 900);
  const image = item.image
    ? `<p><a href="${url}"><img src="${escapeHtml_(item.image)}" alt="${title}" style="max-width:100%;height:auto"></a></p>`
    : '';

  return [
    image,
    `<p><small>${category}</small></p>`,
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
