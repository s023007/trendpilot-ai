<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

function respond(bool $ok, string $message, int $status = 200, array $extra = []): never {
    http_response_code($status);
    echo json_encode(array_merge(['ok'=>$ok,'message'=>$message],$extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function clean(string $value, int $max = 500): string {
    $value = trim(str_replace(["\r","\0"], '', $value));
    return mb_substr($value, 0, $max, 'UTF-8');
}
function safe_header(string $value): string {
    return str_replace(["\r","\n"], '', $value);
}
function encoded_subject(string $subject): string {
    if (function_exists('mb_encode_mimeheader')) return mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n");
    return '=?UTF-8?B?'.base64_encode($subject).'?=';
}
function rrmdir(string $dir): void {
    if (!is_dir($dir)) return;
    $items = scandir($dir);
    if ($items === false) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir.DIRECTORY_SEPARATOR.$item;
        is_dir($path) ? rrmdir($path) : @unlink($path);
    }
    @rmdir($dir);
}
function normalise_files(array $files): array {
    $out=[];
    if (!isset($files['name'])) return $out;
    if (!is_array($files['name'])) return [$files];
    foreach ($files['name'] as $i=>$name) {
        $out[]=[
            'name'=>$name,
            'type'=>$files['type'][$i] ?? '',
            'tmp_name'=>$files['tmp_name'][$i] ?? '',
            'error'=>$files['error'][$i] ?? UPLOAD_ERR_NO_FILE,
            'size'=>$files['size'][$i] ?? 0,
        ];
    }
    return $out;
}
function send_multipart_mail(string $to, string $subject, string $text, array $attachments, string $from, string $replyTo): bool {
    $boundary='=_tp_'.bin2hex(random_bytes(12));
    $headers=[];
    $headers[]='From: TrendPilot Math <'.safe_header($from).'>';
    $headers[]='Reply-To: '.safe_header($replyTo);
    $headers[]='MIME-Version: 1.0';
    $headers[]='Content-Type: multipart/mixed; boundary="'.$boundary.'"';
    $body='--'.$boundary."\r\n";
    $body.="Content-Type: text/plain; charset=UTF-8\r\n";
    $body.="Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body.=$text."\r\n";
    $finfo=function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
    foreach ($attachments as $a) {
        if (!is_file($a['path'])) continue;
        $mime=$finfo ? (finfo_file($finfo,$a['path']) ?: 'application/octet-stream') : 'application/octet-stream';
        $name=preg_replace('/[^A-Za-z0-9._-]+/u','_',basename($a['name'])) ?: 'attachment';
        $data=chunk_split(base64_encode((string)file_get_contents($a['path'])));
        $body.='--'.$boundary."\r\n";
        $body.='Content-Type: '.$mime.'; name="'.$name."\"\r\n";
        $body.="Content-Transfer-Encoding: base64\r\n";
        $body.='Content-Disposition: attachment; filename="'.$name."\"\r\n\r\n";
        $body.=$data."\r\n";
    }
    if ($finfo) finfo_close($finfo);
    $body.='--'.$boundary."--\r\n";
    return @mail($to, encoded_subject($subject), $body, implode("\r\n",$headers));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(false,'Method not allowed',405);

$lang=(($_POST['page_lang'] ?? 'ar') === 'en') ? 'en' : 'ar';
if (!empty($_POST['website'] ?? '')) respond(true,$lang==='ar'?'تم الاستلام':'Received',200,['request_id'=>'']);

$customerName=clean((string)($_POST['customer_name'] ?? ''),100);
$customerEmail=filter_var(trim((string)($_POST['customer_email'] ?? '')), FILTER_VALIDATE_EMAIL);
if (!$customerEmail) respond(false,$lang==='ar'?'يرجى إدخال بريد إلكتروني صحيح.':'Please enter a valid email address.',422);
$customerEmail=safe_header((string)$customerEmail);

$service=clean((string)($_POST['service'] ?? ''),80);
$level=clean((string)($_POST['level'] ?? ''),80);
$explainLang=clean((string)($_POST['language'] ?? ''),40);
$topic=clean((string)($_POST['topic'] ?? ''),180);
$details=clean((string)($_POST['details'] ?? ''),4000);
if ($service==='' || $details==='') respond(false,$lang==='ar'?'أكمل نوع الخدمة وتفاصيل الطلب.':'Please complete the service type and request details.',422);

// Basic per-IP rate limiting: max 5 submissions per 10 minutes.
$ip=(string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateDir=sys_get_temp_dir().'/trendpilot_math_rate';
@mkdir($rateDir,0700,true);
$rateFile=$rateDir.'/'.hash('sha256',$ip).'.json';
$now=time();$recent=[];
if (is_file($rateFile)) {
    $decoded=json_decode((string)@file_get_contents($rateFile),true);
    if (is_array($decoded)) $recent=array_values(array_filter($decoded,fn($t)=>is_int($t)&&$t>$now-600));
}
if (count($recent)>=5) respond(false,$lang==='ar'?'تم إرسال عدة طلبات خلال فترة قصيرة. حاول بعد قليل.':'Too many requests were sent recently. Please try again shortly.',429);
$recent[]=$now;@file_put_contents($rateFile,json_encode($recent),LOCK_EX);

$files=normalise_files($_FILES['files'] ?? []);
$files=array_values(array_filter($files,fn($f)=>($f['error'] ?? UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE));
if (count($files)>5) respond(false,$lang==='ar'?'يمكن رفع 5 ملفات كحد أقصى.':'You can upload up to 5 files.',413);

$allowed=['pdf','jpg','jpeg','png','webp','heic','heif','doc','docx','xls','xlsx','ppt','pptx'];
$maxEach=6*1024*1024;$maxTotal=12*1024*1024;$total=0;
foreach ($files as $f) {
    if (($f['error'] ?? UPLOAD_ERR_OK)!==UPLOAD_ERR_OK) respond(false,$lang==='ar'?'حدث خطأ أثناء رفع أحد الملفات.':'One of the files could not be uploaded.',422);
    $size=(int)($f['size'] ?? 0);$total+=$size;
    if ($size<=0 || $size>$maxEach) respond(false,$lang==='ar'?'أحد الملفات أكبر من 6 MB أو غير صالح.':'A file is larger than 6 MB or invalid.',413);
    $ext=strtolower(pathinfo((string)$f['name'],PATHINFO_EXTENSION));
    if (!in_array($ext,$allowed,true)) respond(false,$lang==='ar'?'نوع ملف غير مدعوم.':'Unsupported file type.',415);
}
if ($total>$maxTotal) respond(false,$lang==='ar'?'إجمالي الملفات أكبر من 12 MB.':'Total file size exceeds 12 MB.',413);

$requestId='MATH-'.gmdate('Ymd').'-'.strtoupper(bin2hex(random_bytes(3)));
$docRoot=(string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
$home=dirname($docRoot);
$storageRoot=$home.'/math-service-requests';
if (!is_dir($storageRoot) && !@mkdir($storageRoot,0700,true)) $storageRoot=sys_get_temp_dir().'/trendpilot-math-service-requests';
@mkdir($storageRoot,0700,true);

// Remove private archives older than 30 days opportunistically.
if (is_dir($storageRoot) && ($dh=@opendir($storageRoot))) {
    while (($entry=readdir($dh))!==false) {
        if ($entry==='.'||$entry==='..') continue;
        $p=$storageRoot.'/'.$entry;
        if (is_dir($p) && @filemtime($p)!==false && @filemtime($p)<$now-(30*86400)) rrmdir($p);
    }
    closedir($dh);
}

$requestDir=$storageRoot.'/'.$requestId;
if (!@mkdir($requestDir,0700,true) && !is_dir($requestDir)) respond(false,$lang==='ar'?'تعذر حفظ الطلب. حاول مرة أخرى.':'Could not save the request. Please try again.',500);

$attachments=[];$fileMeta=[];
foreach ($files as $index=>$f) {
    $original=clean((string)$f['name'],180);
    $ext=strtolower(pathinfo($original,PATHINFO_EXTENSION));
    $stored=sprintf('%02d_%s.%s',$index+1,bin2hex(random_bytes(6)),$ext);
    $dest=$requestDir.'/'.$stored;
    if (!is_uploaded_file((string)$f['tmp_name']) || !move_uploaded_file((string)$f['tmp_name'],$dest)) {
        rrmdir($requestDir);
        respond(false,$lang==='ar'?'تعذر حفظ أحد الملفات. حاول مرة أخرى.':'Could not save one of the uploaded files.',500);
    }
    @chmod($dest,0600);
    $attachments[]=['name'=>$original,'path'=>$dest];
    $fileMeta[]=['original_name'=>$original,'stored_name'=>$stored,'size'=>(int)$f['size']];
}

$meta=[
    'request_id'=>$requestId,'created_at'=>gmdate('c'),'customer_name'=>$customerName,'customer_email'=>$customerEmail,
    'service'=>$service,'level'=>$level,'explanation_language'=>$explainLang,'topic'=>$topic,'details'=>$details,
    'files'=>$fileMeta,'ip_hash'=>hash('sha256',$ip),'mail'=>['admin'=>false,'confirmation'=>false]
];
@file_put_contents($requestDir.'/request.json',json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT),LOCK_EX);
@chmod($requestDir.'/request.json',0600);

$adminEmail='hello@trendpilotchoice.com';
$fromEmail='hello@trendpilotchoice.com';
$fileLines=$fileMeta ? implode("\n",array_map(fn($f)=>'- '.$f['original_name'].' ('.number_format($f['size']/1048576,2).' MB)',$fileMeta)) : '- No files';
$adminBody="New math service request\n\nRequest ID: {$requestId}\nName: ".($customerName?:'Not provided')."\nEmail: {$customerEmail}\nService: {$service}\nLevel: {$level}\nExplanation language: {$explainLang}\nTopic: ".($topic?:'Not specified')."\n\nDetails:\n{$details}\n\nFiles:\n{$fileLines}\n\nA private backup is stored outside the public website under math-service-requests/{$requestId}.";
$adminSent=send_multipart_mail($adminEmail,"Math request {$requestId} - {$service}",$adminBody,$attachments,$fromEmail,$customerEmail);

if ($lang==='ar') {
    $confirmSubject="تم استلام طلبك | {$requestId}";
    $confirmBody="مرحبًا".($customerName!==''?' '.$customerName:'').",\n\nتم استلام طلبك وملفاتك بنجاح.\nرقم الطلب: {$requestId}\n\nسنراجع التفاصيل ثم نرسل لك السعر النهائي وطريقة الدفع المناسبة قبل بدء التنفيذ.\n\nيرجى عدم إرسال بيانات بطاقة أو معلومات مالية حساسة عبر البريد.\n\nTrendPilot Math\nhello@trendpilotchoice.com";
} else {
    $confirmSubject="We received your math request | {$requestId}";
    $confirmBody="Hello".($customerName!==''?' '.$customerName:'').",\n\nYour request and files have been received successfully.\nRequest ID: {$requestId}\n\nWe will review the details and then send you the confirmed price and appropriate payment instructions before work begins.\n\nPlease do not send card details or sensitive financial information by email.\n\nTrendPilot Math\nhello@trendpilotchoice.com";
}
$confirmHeaders='From: TrendPilot Math <'.$fromEmail.">\r\n".'Reply-To: '.$adminEmail."\r\n".'Content-Type: text/plain; charset=UTF-8';
$confirmationSent=@mail($customerEmail,encoded_subject($confirmSubject),$confirmBody,$confirmHeaders);

$meta['mail']=['admin'=>$adminSent,'confirmation'=>$confirmationSent];
@file_put_contents($requestDir.'/request.json',json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT),LOCK_EX);

respond(true,$lang==='ar'?'تم استلام طلبك بنجاح.':'Your request was received successfully.',200,['request_id'=>$requestId]);
