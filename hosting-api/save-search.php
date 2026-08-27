<?php
// TrendPilot Save Search endpoint for api.trendpilotchoice.com

declare(strict_types=1);

$allowedOrigin = 'https://trendpilotchoice.com';
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$email = filter_var(trim((string)($data['email'] ?? '')), FILTER_VALIDATE_EMAIL);
$updates = !empty($data['updates']);
$seller = trim((string)($data['seller'] ?? ''));
$price = trim((string)($data['price'] ?? ''));
$offerUrl = trim((string)($data['offer_url'] ?? ''));
$pageUrl = trim((string)($data['page_url'] ?? ''));
$lang = (($data['lang'] ?? 'en') === 'ar') ? 'ar' : 'en';
$tracking = is_array($data['tracking'] ?? null) ? $data['tracking'] : [];

if (!$email || !$updates || !$seller || !$price || !$offerUrl) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'missing_required_fields']);
    exit;
}

$allowedHosts = [
    'www.ticombo.com','ticombo.com','zmgig.com','www.zmgig.com',
    'sportsevents365.com','www.sportsevents365.com',
    'livefootballtickets.com','www.livefootballtickets.com',
    'footballticketpad.com','www.footballticketpad.com'
];
$host = strtolower((string)parse_url($offerUrl, PHP_URL_HOST));
if (!$host || !in_array($host, $allowedHosts, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_offer_host']);
    exit;
}

$leadId = bin2hex(random_bytes(8));
$base = 'https://trendpilotchoice.com/events/manchester-derby-2026/' . ($lang === 'ar' ? 'ar/' : 'en-gb/');
$returnUrl = $base . '?return=email&lead=' . rawurlencode($leadId) . '&seller=' . rawurlencode($seller) . '#prices';

$subject = $lang === 'ar'
    ? 'تم حفظ عرض ديربي مانشستر — ' . $price
    : 'Your Manchester Derby offer is saved — ' . $price;

if ($lang === 'ar') {
    $html = '<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Arial,sans-serif;background:#07111d;color:#f7f9fc;padding:24px">'
      . '<div style="max-width:620px;margin:auto;background:#0e1d31;border-radius:20px;padding:24px">'
      . '<h2 style="margin-top:0">شكرًا لك — حفظنا عرضك</h2>'
      . '<p>العرض الذي شاهدته:</p><p style="font-size:22px"><strong>' . htmlspecialchars($seller) . '</strong> — <strong>' . htmlspecialchars($price) . '</strong></p>'
      . '<p>سننبهك إذا تغير السعر في المقارنة المحفوظة.</p>'
      . '<p><a href="' . htmlspecialchars($returnUrl) . '" style="display:inline-block;background:#ffd66b;color:#171006;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">العودة إلى عرضي</a></p>'
      . '<p style="font-size:12px;color:#9aa8ba">الأسعار والتوفر قد تتغير. تحقق من السعر النهائي وشروط البائع قبل الدفع.</p>'
      . '</div></body></html>';
} else {
    $html = '<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;background:#07111d;color:#f7f9fc;padding:24px">'
      . '<div style="max-width:620px;margin:auto;background:#0e1d31;border-radius:20px;padding:24px">'
      . '<h2 style="margin-top:0">Thanks — your ticket offer is saved</h2>'
      . '<p>The offer you viewed:</p><p style="font-size:22px"><strong>' . htmlspecialchars($seller) . '</strong> — <strong>' . htmlspecialchars($price) . '</strong></p>'
      . '<p>We’ll alert you if the saved comparison price changes.</p>'
      . '<p><a href="' . htmlspecialchars($returnUrl) . '" style="display:inline-block;background:#ffd66b;color:#171006;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Return to my offer</a></p>'
      . '<p style="font-size:12px;color:#9aa8ba">Prices and availability can change. Confirm the final seller price and terms before payment.</p>'
      . '</div></body></html>';
}

$from = 'tickets@trendpilotchoice.com';
$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: TrendPilot Tickets <' . $from . '>',
    'Reply-To: ' . $from,
    'X-Mailer: PHP/' . PHP_VERSION
];

$sent = @mail((string)$email, $subject, $html, implode("\r\n", $headers));
if (!$sent) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'mail_send_failed']);
    exit;
}

$docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
$accountRoot = $docRoot ? dirname($docRoot) : dirname(dirname(__DIR__));
$storageDir = $accountRoot . '/trendpilot-private';
if (!is_dir($storageDir)) { @mkdir($storageDir, 0700, true); }
$record = [
    'created_at' => gmdate('c'),
    'lead_id' => $leadId,
    'email' => (string)$email,
    'updates' => true,
    'seller' => $seller,
    'price' => $price,
    'page_url' => $pageUrl,
    'gclid' => substr((string)($tracking['gclid'] ?? ''), 0, 256),
    'utm_source' => substr((string)($tracking['utm_source'] ?? ''), 0, 128),
    'utm_campaign' => substr((string)($tracking['utm_campaign'] ?? ''), 0, 128),
    'utm_term' => substr((string)($tracking['utm_term'] ?? ''), 0, 256),
    'utm_content' => substr((string)($tracking['utm_content'] ?? ''), 0, 256)
];
@file_put_contents($storageDir . '/save-search.jsonl', json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

echo json_encode(['ok' => true, 'lead_id' => $leadId, 'return_url' => $returnUrl]);
