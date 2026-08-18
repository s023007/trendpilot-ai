<?php
declare(strict_types=1);
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['probe'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'runtime' => 'analytics-v1'], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
if ($origin !== '') {
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($originHost === '' || $originHost !== preg_replace('/:\d+$/', '', $host)) {
        http_response_code(403);
        exit;
    }
}

$raw = file_get_contents('php://input');
if (!is_string($raw) || $raw === '' || strlen($raw) > 8192) {
    http_response_code(400);
    exit;
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    exit;
}

$allowedEvents = [
    'item_view', 'quick_verdict_view', 'confidence_view', 'review_sources_open',
    'compare_click', 'similar_click', 'seller_outbound_click'
];
$event = trim((string)($data['event'] ?? ''));
if (!in_array($event, $allowedEvents, true)) {
    http_response_code(422);
    exit;
}

function tp_s($v, int $max = 220): string {
    $s = preg_replace('/\s+/u', ' ', trim((string)$v));
    if (!is_string($s)) $s = '';
    return mb_substr($s, 0, $max, 'UTF-8');
}
function tp_detail($v): array {
    if (!is_array($v)) return [];
    $out = [];
    foreach ($v as $k => $x) {
        if (count($out) >= 12) break;
        $key = preg_replace('/[^a-z0-9_\-]/i', '', (string)$k);
        if ($key === '') continue;
        if (is_scalar($x) || $x === null) $out[$key] = tp_s($x, 160);
    }
    return $out;
}

$record = [
    'received_at' => gmdate('c'),
    'event' => $event,
    'session' => tp_s($data['session'] ?? '', 80),
    'product_id' => tp_s($data['product_id'] ?? '', 80),
    'path' => tp_s($data['path'] ?? '', 500),
    'referrer_host' => tp_s($data['referrer_host'] ?? '', 120),
    'post_id' => tp_s($data['post_id'] ?? '', 100),
    'creative_id' => tp_s($data['creative_id'] ?? '', 100),
    'utm_source' => tp_s($data['utm_source'] ?? '', 100),
    'utm_medium' => tp_s($data['utm_medium'] ?? '', 100),
    'utm_campaign' => tp_s($data['utm_campaign'] ?? '', 140),
    'utm_content' => tp_s($data['utm_content'] ?? '', 140),
    'vw' => max(0, min(10000, (int)($data['vw'] ?? 0))),
    'detail' => tp_detail($data['detail'] ?? [])
];

$base = dirname(__DIR__, 2) . '/trendpilot-analytics';
if (!is_dir($base) && !mkdir($base, 0700, true) && !is_dir($base)) {
    http_response_code(500);
    exit;
}
$file = $base . '/events-' . gmdate('Y-m-d') . '.jsonl';
$line = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
if (file_put_contents($file, $line, FILE_APPEND | LOCK_EX) === false) {
    http_response_code(500);
    exit;
}
http_response_code(204);
