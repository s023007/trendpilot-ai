<?php
declare(strict_types=1);

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow', true);
header('Referrer-Policy: no-referrer-when-downgrade');

$lead = strtolower(trim((string)($_GET['lead'] ?? '')));
if (!preg_match('/^[a-f0-9]{16}$/', $lead)) {
    http_response_code(400);
    exit('Invalid link');
}

$store = '/home/kehwgbpo/trendpilot-private/save-search.jsonl';
if (!is_file($store)) {
    http_response_code(404);
    exit('Offer not found');
}

$fp = fopen($store, 'rb');
if (!$fp) {
    http_response_code(500);
    exit('Unable to open saved offer');
}

$match = null;
while (($line = fgets($fp)) !== false) {
    $row = json_decode($line, true);
    if (!is_array($row)) continue;
    if (($row['lead_id'] ?? '') === $lead) $match = $row;
}
fclose($fp);

if (!$match) {
    http_response_code(404);
    exit('Offer not found');
}

$target = trim((string)($match['offer_url'] ?? ''));
$scheme = strtolower((string)parse_url($target, PHP_URL_SCHEME));
$host = strtolower((string)parse_url($target, PHP_URL_HOST));
if (!in_array($scheme, ['http','https'], true) || !$host) {
    http_response_code(400);
    exit('Invalid seller link');
}

$campaign = (string)($match['campaign_id'] ?? '');
$allowedTicketHosts = [
    'zmgig.com','www.zmgig.com','ticombo.com','www.ticombo.com',
    'sportsevents365.com','www.sportsevents365.com',
    'livefootballtickets.com','www.livefootballtickets.com',
    'footballticketpad.com','www.footballticketpad.com'
];
$allowedElClasicoHosts = [
    'sportsevents365.com','www.sportsevents365.com',
    'livefootballtickets.com','www.livefootballtickets.com',
    'seatpick.com','www.seatpick.com','fanpass.es','www.fanpass.es'
];
$allowedBigMatchHosts = [
    'sportsevents365.com','www.sportsevents365.com',
    'livefootballtickets.com','www.livefootballtickets.com'
];
$allowedAliExpressHosts = [
    'rzekl.com','www.rzekl.com',
    's.click.aliexpress.com','www.aliexpress.com','aliexpress.com'
];
$allowedWauHosts = ['axavl.com','www.axavl.com'];
if ($campaign === 'manchester_derby_2026' && !in_array($host, $allowedTicketHosts, true)) {
    http_response_code(400);
    exit('Seller link not allowed');
}
if ($campaign === 'el_clasico_2026' && !in_array($host, $allowedElClasicoHosts, true)) {
    http_response_code(400);
    exit('Seller link not allowed');
}
if (in_array($campaign, ['liverpool_manunited_2026','madrid_derby_2026','north_london_derby_2026','arsenal_mancity_2026'], true) && !in_array($host, $allowedBigMatchHosts, true)) {
    http_response_code(400);
    exit('Seller link not allowed');
}
if ($campaign === 'sa_tire_inflator_aliexpress' && !in_array($host, $allowedAliExpressHosts, true)) {
    http_response_code(400);
    exit('Seller link not allowed');
}
if ($campaign === 'wau_led_mask_bg' && !in_array($host, $allowedWauHosts, true)) {
    http_response_code(400);
    exit('Seller link not allowed');
}

$click = [
    'created_at' => gmdate('c'),
    'event' => in_array($campaign, ['sa_tire_inflator_aliexpress','wau_led_mask_bg'], true) ? 'EMAIL_BUY_INTENT' : 'email_affiliate_handoff',
    'lead_id' => $lead,
    'campaign_id' => $campaign,
    'seller' => (string)($match['seller'] ?? ''),
    'price' => (string)($match['price'] ?? ''),
    'offer_host' => $host,
    'utm_source' => (string)($match['utm_source'] ?? ''),
    'utm_campaign' => (string)($match['utm_campaign'] ?? ''),
    'utm_term' => (string)($match['utm_term'] ?? ''),
    'gclid' => (string)($match['gclid'] ?? ''),
    'ip_hash' => hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '')),
    'ua' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300)
];
@file_put_contents('/home/kehwgbpo/trendpilot-private/email-clicks.jsonl', json_encode($click, JSON_UNESCAPED_UNICODE)."\n", FILE_APPEND|LOCK_EX);

header('Location: '.$target, true, 302);
exit;
