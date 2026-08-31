<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$allowedOrigins = ['https://trendpilotchoice.com', 'https://www.trendpilotchoice.com'];
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'origin_not_allowed']);
    exit;
}
if ($origin !== '') {
    header('Access-Control-Allow-Origin: '.$origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

function fail_json(int $status, string $error): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

function clean_text(mixed $value, int $max = 160): string {
    $value = trim((string)$value);
    $value = preg_replace('/[\x00-\x1F\x7F]/u', '', $value) ?? '';
    return mb_substr($value, 0, $max, 'UTF-8');
}

function campaign_from_path(string $path): string {
    if (str_contains($path, '/events/manchester-derby-2026/')) return 'manchester_derby_2026';
    if (str_contains($path, '/events/liverpool-v-manchester-united-2026/')) return 'liverpool_manunited_2026';
    if (str_contains($path, '/events/el-clasico-2026/')) return 'el_clasico_2026';
    if (str_contains($path, '/events/madrid-derby-2026/')) return 'madrid_derby_2026';
    if (str_contains($path, '/events/north-london-derby-2026/')) return 'north_london_derby_2026';
    if (str_contains($path, '/events/arsenal-v-manchester-city-2026/')) return 'arsenal_mancity_2026';
    return '';
}

$raw = file_get_contents('php://input');
$data = json_decode((string)$raw, true);
if (!is_array($data)) fail_json(400, 'invalid_json');

$eventId = strtolower(clean_text($data['event_id'] ?? '', 32));
if (!preg_match('/^[a-f0-9]{16}$/', $eventId)) fail_json(400, 'invalid_event_id');

$pageUrl = clean_text($data['page_url'] ?? '', 1200);
$page = parse_url($pageUrl);
$pageHost = strtolower((string)($page['host'] ?? ''));
if (!in_array($pageHost, ['trendpilotchoice.com', 'www.trendpilotchoice.com'], true)) {
    fail_json(400, 'invalid_page');
}
$pagePath = (string)($page['path'] ?? '');
$campaignId = campaign_from_path($pagePath);
if ($campaignId === '') fail_json(400, 'unsupported_campaign');

$offerUrl = clean_text($data['offer_url'] ?? '', 1600);
$offer = parse_url($offerUrl);
if (strtolower((string)($offer['scheme'] ?? '')) !== 'https') fail_json(400, 'invalid_offer');
$offerHost = strtolower((string)($offer['host'] ?? ''));
$allowedSellerHosts = [
    'livefootballtickets.com', 'www.livefootballtickets.com',
    'sportsevents365.com', 'www.sportsevents365.com',
    'seatpick.com', 'www.seatpick.com',
    'fanpass.es', 'www.fanpass.es',
    'ticombo.com', 'www.ticombo.com',
    'footballticketpad.com', 'www.footballticketpad.com',
    'zmgig.com', 'www.zmgig.com'
];
if (!in_array($offerHost, $allowedSellerHosts, true)) fail_json(400, 'seller_not_allowed');

$tracking = is_array($data['tracking'] ?? null) ? $data['tracking'] : [];
$record = [
    'lead_id' => $eventId,
    'campaign_id' => $campaignId,
    'source' => 'direct_seller_outbound',
    'seller' => clean_text($data['seller'] ?? $offerHost, 100),
    'price' => clean_text($data['price'] ?? '', 60),
    'offer_url' => $offerUrl,
    'page_path' => $pagePath,
    'gclid' => clean_text($tracking['gclid'] ?? '', 220),
    'utm_source' => clean_text($tracking['utm_source'] ?? '', 120),
    'utm_campaign' => clean_text($tracking['utm_campaign'] ?? '', 180),
    'utm_term' => clean_text($tracking['utm_term'] ?? '', 220),
    'utm_content' => clean_text($tracking['utm_content'] ?? '', 180),
    'clicked_at' => gmdate('c'),
];

$privateDir = '/home/kehwgbpo/trendpilot-private';
if (!is_dir($privateDir) && !@mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    fail_json(500, 'log_unavailable');
}
$log = $privateDir.'/seller-outbound.jsonl';
$line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($line === false || file_put_contents($log, $line."\n", FILE_APPEND | LOCK_EX) === false) {
    fail_json(500, 'log_failed');
}
@chmod($log, 0600);

echo json_encode(['ok' => true, 'event_id' => $eventId], JSON_UNESCAPED_UNICODE);
