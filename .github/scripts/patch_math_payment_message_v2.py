from pathlib import Path
p=Path('math/index-v3.html')
s=p.read_text()
repls={
'الدفع بسيط، ويتم بعد تأكيد الطلب والسعر.':'طريقة الدفع تُرسل لك بعد مراجعة طلبك.',
'لا نطلب بيانات البطاقة داخل المحادثة. يتم أولًا مراجعة طلبك وتأكيد السعر وطريقة التنفيذ، ثم نرسل لك طريقة الدفع المناسبة.':'بعد أن نستلم رسالتك ونراجع تفاصيل الطلب، نؤكد لك السعر النهائي ثم نرسل لك طريقة الدفع المناسبة. لا ترسل أي بيانات بطاقة أو معلومات مالية حساسة داخل الرسالة.',
'بعد تأكيد الطلب والسعر، يمكن الدفع بتحويل محلي عبر رقم الهاتف. تُرسل بيانات التحويل بعد الاتفاق على الخدمة.':'بعد مراجعة الطلب وتأكيد السعر، سنرسل لك بيانات التحويل المناسبة. داخل عُمان يمكن الدفع بسهولة عبر التحويل برقم الهاتف.',
'تحويل محلي عبر رقم الهاتف':'التحويل عبر رقم الهاتف متاح داخل عُمان',
'سيتم توفير الدفع الدولي عبر بوابة دفع آمنة تدعم Google Pay والبطاقات بعد تفعيل حساب التاجر. لا يتم إدخال بيانات البطاقة في الموقع حاليًا.':'بعد مراجعة طلبك وتأكيد السعر، سنرسل لك وسيلة الدفع المناسبة المتاحة للعملاء خارج عُمان.',
'Google Pay / Visa / Mastercard — بعد التفعيل':'طريقة الدفع تُرسل بعد تأكيد الطلب',
"payTitle:'Payment is simple and happens only after your request and price are confirmed.'":"payTitle:'Payment instructions are sent after your request is reviewed.'",
"payLead:'We never ask for card details in chat. Your request, price and delivery method are confirmed first, then the appropriate payment option is provided.'":"payLead:'Once we receive and review your request, we confirm the final price and then send you the appropriate payment instructions. Please do not send card details or sensitive financial information in your message.'",
"omanText:'After the request and price are confirmed, local payment can be made by phone-number transfer. Transfer details are shared after the service is agreed.'":"omanText:'After your request and price are confirmed, we will send you the payment details. In Oman, phone-number transfer is available for convenient local payment.'",
"omanBadge:'Local phone-number transfer'":"omanBadge:'Phone-number transfer available in Oman'",
"intlText:'International checkout through a secure gateway supporting Google Pay and cards will be available after merchant activation. Card details are not collected on this site yet.'":"intlText:'After your request is reviewed and the price is confirmed, we will send you the appropriate payment method available for customers outside Oman.'",
"intlBadge:'Google Pay / Visa / Mastercard — after activation'":"intlBadge:'Payment method sent after confirmation'"
}
missing=[]
for a,b in repls.items():
    if a not in s:
        missing.append(a)
    else:
        s=s.replace(a,b,1)
if missing:
    raise SystemExit('Missing expected strings: '+repr(missing))
p.write_text(s)
# trigger workflow after creation
