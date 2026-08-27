<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false]); exit; }
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['https://trendpilotchoice.com','https://www.trendpilotchoice.com'];
if ($origin && !in_array($origin, $allowedOrigins, true)) { http_response_code(403); echo json_encode(['ok'=>false]); exit; }
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { http_response_code(400); echo json_encode(['ok'=>false]); exit; }
$email = filter_var(trim((string)($data['email'] ?? '')), FILTER_VALIDATE_EMAIL);
if (!$email || strlen($email) > 254) { http_response_code(422); echo json_encode(['ok'=>false,'error'=>'invalid_email']); exit; }
$sellers = ['Ticombo','Sports Events 365','LiveFootballTickets','Football Ticket Pad'];
$seller = trim((string)($data['seller'] ?? ''));
if (!in_array($seller, $sellers, true)) { http_response_code(422); echo json_encode(['ok'=>false,'error'=>'invalid_seller']); exit; }
$offerUrl = trim((string)($data['offer_url'] ?? ''));
$offerHost = parse_url($offerUrl, PHP_URL_HOST) ?: '';
$allowedHosts = ['zmgig.com','www.ticombo.com','sportsevents365.com','www.sportsevents365.com','livefootballtickets.com','www.livefootballtickets.com','footballticketpad.com','www.footballticketpad.com'];
if (!in_array(strtolower($offerHost), $allowedHosts, true)) { http_response_code(422); echo json_encode(['ok'=>false,'error'=>'invalid_offer']); exit; }
$price = preg_replace('/[^\p{L}\p{N}\p{Sc}.,≈£€$\- ]/u','',trim((string)($data['price'] ?? '')));
$lang = (($data['lang'] ?? '') === 'ar') ? 'ar' : 'en';
$updates = !empty($data['updates']);
$leadId = bin2hex(random_bytes(12));
$tracking = is_array($data['tracking'] ?? null) ? $data['tracking'] : [];
$cleanTracking = [];
foreach (['gclid','utm_source','utm_campaign','utm_term','utm_content'] as $k) { $cleanTracking[$k] = substr(trim((string)($tracking[$k] ?? '')),0,180); }
$record = [
  'lead_id'=>$leadId,'created_at'=>gmdate('c'),'email'=>$email,'updates_opt_in'=>$updates,
  'seller'=>$seller,'price'=>$price,'offer_url'=>$offerUrl,'lang'=>$lang,'tracking'=>$cleanTracking,
  'ip_hash'=>hash('sha256',($_SERVER['REMOTE_ADDR'] ?? '').'|trendpilot-save-v1')
];
$dir = dirname(__DIR__).'/campaign-brain-private';
if (!is_dir($dir)) @mkdir($dir,0700,true);
$file = $dir.'/save-search-leads.jsonl';
$fp = @fopen($file,'ab');
if ($fp) { @flock($fp,LOCK_EX); @fwrite($fp,json_encode($record,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)."\n"); @flock($fp,LOCK_UN); @fclose($fp); }
$returnBase = 'https://trendpilotchoice.com/events/manchester-derby-2026/'.($lang==='ar'?'ar':'en-gb').'/';
$returnUrl = $returnBase.'?return=email&lead='.rawurlencode($leadId).'&seller='.rawurlencode($seller).'#prices';
$from = 'TrendPilot Tickets <tickets@trendpilotchoice.com>';
$headers = "From: $from\r\nReply-To: tickets@trendpilotchoice.com\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
if ($lang === 'ar') {
  $subject = 'تم حفظ مقارنة تذاكر ديربي مانشستر';
  $body = '<html dir="rtl"><body style="font-family:Arial,Tahoma,sans-serif;background:#f5f7fa;padding:24px;color:#142033"><div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:24px"><h2>شكرًا — حفظنا لك المقارنة</h2><p>العرض الذي شاهدته:</p><p><strong>'.htmlspecialchars($seller,ENT_QUOTES,'UTF-8').'</strong> &nbsp; '.htmlspecialchars($price,ENT_QUOTES,'UTF-8').'</p><p>يمكنك الرجوع إلى مقارنة TrendPilot في أي وقت ثم متابعة العرض الحالي لدى البائع.</p><p><a href="'.htmlspecialchars($returnUrl,ENT_QUOTES,'UTF-8').'" style="display:inline-block;background:#111d2e;color:#fff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:bold">العودة إلى مقارنة الديربي</a></p><p style="font-size:12px;color:#748096">الأسعار والتوفر قد تتغير. إذا فعّلت تنبيهات التحديث، فلن نرسل تنبيهًا إلا عند وجود تغيير موثوق في المقارنة.</p></div></body></html>';
} else {
  $subject = 'Your Manchester Derby ticket search is saved';
  $body = '<html><body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#142033"><div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:24px"><h2>Thanks — your comparison is saved</h2><p>The offer you viewed:</p><p><strong>'.htmlspecialchars($seller,ENT_QUOTES,'UTF-8').'</strong> &nbsp; '.htmlspecialchars($price,ENT_QUOTES,'UTF-8').'</p><p>Return to TrendPilot any time to see the comparison again and continue to the current seller offer.</p><p><a href="'.htmlspecialchars($returnUrl,ENT_QUOTES,'UTF-8').'" style="display:inline-block;background:#111d2e;color:#fff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Return to derby comparison</a></p><p style="font-size:12px;color:#748096">Prices and availability can change. If you opted into updates, we will only send a follow-up when there is a meaningful verified change.</p></div></body></html>';
}
$sent = @mail($email, '=?UTF-8?B?'.base64_encode($subject).'?=', $body, $headers);
if (!$sent) { http_response_code(503); echo json_encode(['ok'=>false,'error'=>'mail_failed']); exit; }
echo json_encode(['ok'=>true,'lead_id'=>$leadId]);
