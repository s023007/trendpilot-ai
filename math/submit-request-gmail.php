<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const OWNER_EMAIL = 'trendpilotchoice@gmail.com';
const FROM_EMAIL  = 'hello@trendpilotchoice.com';
const MAX_FILES   = 5;
const MAX_EACH    = 6291456;
const MAX_TOTAL   = 12582912;

function out(bool $ok,string $msg,int $code=200,array $extra=[]):never{http_response_code($code);echo json_encode(array_merge(['ok'=>$ok,'message'=>$msg],$extra),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function txt(string $v,int $max=4000):string{$v=trim(str_replace(["\r","\0"],'',$v));return function_exists('mb_substr')?mb_substr($v,0,$max,'UTF-8'):substr($v,0,$max);}
function h(string $v):string{return str_replace(["\r","\n"],'',$v);}
function subj(string $v):string{return function_exists('mb_encode_mimeheader')?mb_encode_mimeheader($v,'UTF-8','B',"\r\n"):'=?UTF-8?B?'.base64_encode($v).'?=';}
function files_flat(array $f):array{if(!isset($f['name']))return[];if(!is_array($f['name']))return[$f];$o=[];foreach($f['name'] as $i=>$n)$o[]=['name'=>$n,'tmp_name'=>$f['tmp_name'][$i]??'','error'=>$f['error'][$i]??UPLOAD_ERR_NO_FILE,'size'=>$f['size'][$i]??0];return$o;}
function send_with_files(string $to,string $subject,string $body,array $files,string $reply):bool{
  $b='=_tp_'.bin2hex(random_bytes(10));
  $headers='From: TrendPilot Math <'.FROM_EMAIL.">\r\nReply-To: ".h($reply)."\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$b\"";
  $msg="--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$body\r\n";
  foreach($files as $f){if(!is_file($f['path']))continue;$name=preg_replace('/[^A-Za-z0-9._-]+/u','_',basename($f['name']))?:'attachment';$data=chunk_split(base64_encode((string)file_get_contents($f['path'])));$msg.="--$b\r\nContent-Type: application/octet-stream; name=\"$name\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n$data\r\n";}
  $msg.="--$b--\r\n";return @mail($to,subj($subject),$msg,$headers);
}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')out(false,'Method not allowed',405);
$lang=(($_POST['page_lang']??'ar')==='en')?'en':'ar';
if(!empty($_POST['website']??''))out(true,'OK',200,['request_id'=>'']);
$name=txt((string)($_POST['customer_name']??''),100);
$email=filter_var(trim((string)($_POST['customer_email']??'')),FILTER_VALIDATE_EMAIL);if(!$email)out(false,$lang==='ar'?'يرجى إدخال بريد إلكتروني صحيح.':'Please enter a valid email address.',422);$email=h((string)$email);
$service=txt((string)($_POST['service']??''),80);$level=txt((string)($_POST['level']??''),80);$explain=txt((string)($_POST['language']??''),40);$topic=txt((string)($_POST['topic']??''),180);$details=txt((string)($_POST['details']??''),4000);if($service===''||$details==='')out(false,$lang==='ar'?'أكمل نوع الخدمة وتفاصيل الطلب.':'Please complete the service type and details.',422);
$raw=array_values(array_filter(files_flat($_FILES['files']??[]),fn($f)=>($f['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE));if(count($raw)>MAX_FILES)out(false,$lang==='ar'?'يمكن رفع 5 ملفات كحد أقصى.':'You can upload up to 5 files.',413);
$allowed=['pdf','jpg','jpeg','png','webp','heic','heif','doc','docx','xls','xlsx','ppt','pptx'];$total=0;foreach($raw as $f){$ext=strtolower(pathinfo((string)$f['name'],PATHINFO_EXTENSION));$size=(int)$f['size'];$total+=$size;if(($f['error']??1)!==UPLOAD_ERR_OK||$size<=0||$size>MAX_EACH||!in_array($ext,$allowed,true))out(false,$lang==='ar'?'أحد الملفات غير صالح أو غير مدعوم أو أكبر من 6 MB.':'A file is invalid, unsupported, or larger than 6 MB.',413);}if($total>MAX_TOTAL)out(false,$lang==='ar'?'إجمالي الملفات أكبر من 12 MB.':'Total files exceed 12 MB.',413);
$id='MATH-'.gmdate('Ymd').'-'.strtoupper(bin2hex(random_bytes(3)));$root=dirname((string)($_SERVER['DOCUMENT_ROOT']??__DIR__)).'/math-service-requests';if(!is_dir($root))@mkdir($root,0700,true);$dir=$root.'/'.$id;if(!@mkdir($dir,0700,true)&&!is_dir($dir))out(false,$lang==='ar'?'تعذر حفظ الطلب.':'Could not save request.',500);
$attachments=[];$metaFiles=[];foreach($raw as $i=>$f){$ext=strtolower(pathinfo((string)$f['name'],PATHINFO_EXTENSION));$dest=$dir.'/'.sprintf('%02d_%s.%s',$i+1,bin2hex(random_bytes(5)),$ext);if(!is_uploaded_file((string)$f['tmp_name'])||!move_uploaded_file((string)$f['tmp_name'],$dest))out(false,$lang==='ar'?'تعذر حفظ أحد الملفات.':'Could not save an uploaded file.',500);@chmod($dest,0600);$attachments[]=['name'=>txt((string)$f['name'],180),'path'=>$dest];$metaFiles[]=['name'=>txt((string)$f['name'],180),'size'=>(int)$f['size']];}
$fileList=$metaFiles?implode("\n",array_map(fn($f)=>'- '.$f['name'].' ('.number_format($f['size']/1048576,2).' MB)',$metaFiles)):'- No files';$ownerBody="New math service request\n\nRequest ID: $id\nName: ".($name?:'Not provided')."\nEmail: $email\nService: $service\nLevel: $level\nExplanation language: $explain\nTopic: ".($topic?:'Not specified')."\n\nDetails:\n$details\n\nFiles:\n$fileList";$ownerSent=send_with_files(OWNER_EMAIL,"Math request $id - $service",$ownerBody,$attachments,$email);
if($lang==='ar'){$cs="تم استلام طلبك | $id";$cb="مرحبًا".($name!==''?' '.$name:'').",\n\nتم استلام طلبك وملفاتك بنجاح.\nرقم الطلب: $id\n\nسنراجع التفاصيل ثم نرسل لك السعر النهائي وطريقة الدفع المناسبة قبل بدء التنفيذ.\n\nإذا احتجت إضافة أي معلومات، يمكنك الرد مباشرة على هذه الرسالة.\n\nTrendPilot Math\n".OWNER_EMAIL;}else{$cs="We received your math request | $id";$cb="Hello".($name!==''?' '.$name:'').",\n\nYour request and files have been received successfully.\nRequest ID: $id\n\nWe will review the details and then send you the confirmed price and appropriate payment instructions before work begins.\n\nYou can reply directly to this email if you need to add anything.\n\nTrendPilot Math\n".OWNER_EMAIL;}
$ch='From: TrendPilot Math <'.FROM_EMAIL.">\r\nReply-To: ".OWNER_EMAIL."\r\nContent-Type: text/plain; charset=UTF-8";$confirmSent=@mail($email,subj($cs),$cb,$ch);@file_put_contents($dir.'/request.json',json_encode(['request_id'=>$id,'created_at'=>gmdate('c'),'customer_name'=>$name,'customer_email'=>$email,'service'=>$service,'level'=>$level,'explanation_language'=>$explain,'topic'=>$topic,'details'=>$details,'files'=>$metaFiles,'mail'=>['owner'=>$ownerSent,'confirmation'=>$confirmSent]],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT),LOCK_EX);@chmod($dir.'/request.json',0600);
out(true,$lang==='ar'?'تم استلام طلبك بنجاح.':'Your request was received successfully.',200,['request_id'=>$id]);
