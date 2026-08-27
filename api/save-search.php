<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$origin=(string)($_SERVER['HTTP_ORIGIN']??'');
$allowedOrigins=['https://trendpilotchoice.com','https://www.trendpilotchoice.com'];
if($origin && in_array($origin,$allowedOrigins,true)){header('Access-Control-Allow-Origin: '.$origin);header('Vary: Origin');}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);echo json_encode(['ok'=>false,'error'=>'method_not_allowed']);exit;}

function fail_json(int $code,string $error):never{http_response_code($code);echo json_encode(['ok'=>false,'error'=>$error],JSON_UNESCAPED_UNICODE);exit;}
function h(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function smtp_read($fp):string{$out='';while(!feof($fp)){ $line=fgets($fp,8192); if($line===false)break; $out.=$line; if(preg_match('/^\d{3} /',$line))break;}return $out;}
function smtp_expect($fp,array $codes):string{$r=smtp_read($fp);$c=(int)substr($r,0,3);if(!in_array($c,$codes,true))throw new RuntimeException('SMTP_'.$c.':'.trim($r));return $r;}
function smtp_cmd($fp,string $cmd,array $codes):string{fwrite($fp,$cmd."\r\n");return smtp_expect($fp,$codes);}
function smtp_send_html(array $cfg,string $to,string $subject,string $html):void{
  $host=(string)$cfg['host'];$port=(int)$cfg['port'];$user=(string)$cfg['username'];$pass=(string)$cfg['password'];$from=(string)$cfg['from_email'];$fromName=(string)$cfg['from_name'];
  $ctx=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'peer_name'=>$host,'SNI_enabled'=>true]]);
  $fp=@stream_socket_client("ssl://{$host}:{$port}",$eno,$estr,20,STREAM_CLIENT_CONNECT,$ctx);if(!$fp)throw new RuntimeException("SMTP_CONNECT:$eno:$estr");stream_set_timeout($fp,20);
  try{smtp_expect($fp,[220]);smtp_cmd($fp,'EHLO trendpilotchoice.com',[250]);smtp_cmd($fp,'AUTH LOGIN',[334]);smtp_cmd($fp,base64_encode($user),[334]);smtp_cmd($fp,base64_encode($pass),[235]);smtp_cmd($fp,'MAIL FROM:<'.$from.'>',[250]);smtp_cmd($fp,'RCPT TO:<'.$to.'>',[250,251]);smtp_cmd($fp,'DATA',[354]);
    $headers=['Date: '.date(DATE_RFC2822),'Message-ID: <'.bin2hex(random_bytes(12)).'@trendpilotchoice.com>','From: =?UTF-8?B?'.base64_encode($fromName).'?= <'.$from.'>','Reply-To: '.$from,'To: <'.$to.'>','Subject: =?UTF-8?B?'.base64_encode($subject).'?=','MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: 8bit'];
    $body=implode("\r\n",$headers)."\r\n\r\n".$html;$body=preg_replace('/(?m)^\./','..',$body);fwrite($fp,$body."\r\n.\r\n");smtp_expect($fp,[250]);smtp_cmd($fp,'QUIT',[221]);
  }finally{fclose($fp);}
}
function campaign_from(array $data,string $pageUrl):string{
  $id=preg_replace('/[^a-z0-9_-]/','',strtolower((string)($data['campaign_id']??'')));
  if($id)return $id;
  if(str_contains($pageUrl,'/events/manchester-derby-2026/'))return 'manchester_derby_2026';
  return 'generic_offer';
}
function campaign_spec(string $id,string $lang):array{
  $ar=$lang==='ar';
  $specs=[
    'manchester_derby_2026'=>[
      'type'=>'ticket','return_base'=>$ar?'https://trendpilotchoice.com/events/manchester-derby-2026/ar/':'https://trendpilotchoice.com/events/manchester-derby-2026/en-gb/',
      'badge'=>$ar?'تنبيه تذاكر • ديربي مانشستر':'TICKET ALERT • MANCHESTER DERBY',
      'subject'=>$ar?'حفظنا عرض ديربي مانشستر لك':'Your Manchester Derby offer is saved',
      'headline'=>$ar?'عرض الديربي الذي اخترته أصبح محفوظًا':'Your derby offer is saved',
      'intro'=>$ar?'ارجع إلى نفس المقارنة في أي وقت، وسننبهك إذا تغيّر السعر بشكل موثوق.':'Return to the same comparison anytime. We’ll alert you if the price changes materially.',
      'cta'=>$ar?'العودة إلى عرضي ←':'Return to my offer →',
      'point1'=>$ar?'المباراة: مانشستر يونايتد × مانشستر سيتي':'Fixture: Manchester United vs Manchester City',
      'point2'=>$ar?'المكان: Old Trafford • 13 سبتمبر 2026':'Venue: Old Trafford • 13 Sep 2026',
      'point3'=>$ar?'السعر النهائي وشروط المقعد لدى البائع هي المرجع':'Seller checkout price and seat terms remain authoritative',
      'allowed_hosts'=>['zmgig.com','www.ticombo.com','ticombo.com','www.sportsevents365.com','sportsevents365.com','www.livefootballtickets.com','livefootballtickets.com','www.footballticketpad.com','footballticketpad.com']
    ],
    'generic_offer'=>[
      'type'=>'product','return_base'=>'https://trendpilotchoice.com/','badge'=>$ar?'عرض محفوظ • TrendPilot':'SAVED OFFER • TRENDPILOT','subject'=>$ar?'حفظنا العرض الذي اخترته':'Your TrendPilot offer is saved','headline'=>$ar?'عرضك محفوظ وجاهز للرجوع':'Your offer is saved and ready','intro'=>$ar?'يمكنك الرجوع إلى TrendPilot في أي وقت لمراجعة العرض ومقارنته من جديد.':'Return to TrendPilot anytime to review the offer and compare again.','cta'=>$ar?'العودة إلى TrendPilot ←':'Return to TrendPilot →','point1'=>$ar?'العرض الذي اخترته محفوظ':'The offer you selected is saved','point2'=>$ar?'يمكن تخصيص الرسالة حسب المنتج والحملة':'Email adapts to the product and campaign','point3'=>$ar?'تحقق دائمًا من السعر النهائي لدى البائع':'Always confirm the final seller price','allowed_hosts'=>[]
    ]
  ];
  return $specs[$id]??$specs['generic_offer'];
}
function render_email(array $s,string $lang,string $seller,string $price,string $returnUrl):string{
  $rtl=$lang==='ar';$dir=$rtl?'rtl':'ltr';$align=$rtl?'right':'left';$seller=h($seller);$price=h($price);$return=h($returnUrl);
  $brand='Trend<span style="color:#66e1b7">Pilot</span> <span style="color:#b7c4d8;font-size:18px">AI</span>';
  return '<!doctype html><html lang="'.($rtl?'ar':'en').'" dir="'.$dir.'"><body style="margin:0;background:#eef3f8;font-family:Arial,Tahoma,sans-serif;color:#0e1b31"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 8px 30px rgba(14,27,49,.08)"><tr><td style="background:#0a1426;padding:28px 34px;text-align:'.$align.'"><div style="font-size:27px;font-weight:800;color:#fff">'.$brand.'</div><div style="margin-top:16px;display:inline-block;padding:8px 12px;border-radius:999px;background:#13233e;color:#67e1b7;font-size:12px;font-weight:800;letter-spacing:.4px">'.h($s['badge']).'</div></td></tr><tr><td style="padding:34px;text-align:'.$align.'"><h1 style="margin:0 0 14px;font-size:30px;line-height:1.25;color:#0b1830">'.h($s['headline']).'</h1><p style="margin:0 0 24px;font-size:17px;line-height:1.8;color:#4d5d74">'.h($s['intro']).'</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dfe7f1;border-radius:18px;background:#f7faff"><tr><td style="padding:22px;text-align:'.$align.'"><div style="font-size:13px;color:#718096;margin-bottom:6px">'.($rtl?'العرض المختار':'SELECTED OFFER').'</div><div style="font-size:22px;font-weight:800;color:#0e1b31">'.$seller.'</div><div style="font-size:34px;font-weight:900;color:#0b1830;margin-top:6px">'.$price.'</div></td></tr></table><div style="height:22px"></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 0 12px;font-size:16px;line-height:1.6;color:#25364e">✓ '.h($s['point1']).'</td></tr><tr><td style="padding:0 0 12px;font-size:16px;line-height:1.6;color:#25364e">✓ '.h($s['point2']).'</td></tr><tr><td style="padding:0 0 22px;font-size:16px;line-height:1.6;color:#25364e">✓ '.h($s['point3']).'</td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="background:#ffcf4a;border-radius:14px"><a href="'.$return.'" style="display:block;padding:17px 24px;color:#16120a;text-decoration:none;font-size:18px;font-weight:900">'.h($s['cta']).'</a></td></tr></table><p style="margin:22px 0 0;font-size:12px;line-height:1.65;color:#7a8799">'.($rtl?'TrendPilot منصة مقارنة مستقلة وقد تحصل على عمولة من بعض الشركاء. الأسعار والتوفر تتغير؛ تحقق من السعر النهائي وشروط البائع قبل الدفع.':'TrendPilot is an independent comparison platform and may earn a commission from eligible partners. Prices and availability change; confirm final seller terms before payment.').'</p></td></tr><tr><td style="background:#f3f6fa;padding:18px 34px;text-align:center;font-size:12px;color:#8390a3">TrendPilotChoice.com • tickets@trendpilotchoice.com</td></tr></table></td></tr></table></body></html>';
}

$data=json_decode(file_get_contents('php://input')?:'',true);if(!is_array($data))fail_json(400,'invalid_json');
$email=filter_var(trim((string)($data['email']??'')),FILTER_VALIDATE_EMAIL);$updates=!empty($data['updates']);$seller=trim((string)($data['seller']??''));$price=preg_replace('/[^\p{L}\p{N}\p{Sc}.,≈£€$\- ]/u','',trim((string)($data['price']??'')));$offerUrl=trim((string)($data['offer_url']??''));$pageUrl=trim((string)($data['page_url']??''));$lang=(($data['lang']??'en')==='ar')?'ar':'en';
if(!$email||!$updates||!$seller||!$price||!$offerUrl)fail_json(422,'missing_required_fields');
$campaignId=campaign_from($data,$pageUrl);$spec=campaign_spec($campaignId,$lang);$offerHost=strtolower((string)parse_url($offerUrl,PHP_URL_HOST));if($spec['allowed_hosts'] && !in_array($offerHost,$spec['allowed_hosts'],true))fail_json(400,'invalid_offer_host');
$leadId=bin2hex(random_bytes(8));$returnUrl=$spec['return_base'].'?return=email&lead='.rawurlencode($leadId).'&seller='.rawurlencode($seller).'#prices';
$configFile='/home/kehwgbpo/trendpilot-private/mail-config.php';if(!is_file($configFile))fail_json(503,'smtp_config_missing');$cfg=require $configFile;if(!is_array($cfg)||empty($cfg['password']))fail_json(503,'smtp_config_incomplete');
$html=render_email($spec,$lang,$seller,$price,$returnUrl);
try{smtp_send_html($cfg,(string)$email,(string)$spec['subject'],$html);}catch(Throwable $e){@file_put_contents('/home/kehwgbpo/trendpilot-private/smtp-errors.log',gmdate('c').' '.$e->getMessage()."\n",FILE_APPEND|LOCK_EX);fail_json(503,'smtp_send_failed');}
$tracking=is_array($data['tracking']??null)?$data['tracking']:[];$record=['created_at'=>gmdate('c'),'lead_id'=>$leadId,'email'=>(string)$email,'updates'=>true,'campaign_id'=>$campaignId,'seller'=>$seller,'price'=>$price,'page_url'=>$pageUrl,'offer_host'=>$offerHost,'gclid'=>substr((string)($tracking['gclid']??''),0,256),'utm_source'=>substr((string)($tracking['utm_source']??''),0,128),'utm_campaign'=>substr((string)($tracking['utm_campaign']??''),0,128),'utm_term'=>substr((string)($tracking['utm_term']??''),0,256),'utm_content'=>substr((string)($tracking['utm_content']??''),0,256)];@file_put_contents('/home/kehwgbpo/trendpilot-private/save-search.jsonl',json_encode($record,JSON_UNESCAPED_UNICODE)."\n",FILE_APPEND|LOCK_EX);
echo json_encode(['ok'=>true,'lead_id'=>$leadId,'campaign_id'=>$campaignId,'return_url'=>$returnUrl],JSON_UNESCAPED_UNICODE);
