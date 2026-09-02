from pathlib import Path

p = Path('api/save-search.php')
s = p.read_text(encoding='utf-8')
key = "'sa_tire_inflator_aliexpress'=>["

if "str_contains($p,'/products/car-tire-inflator/sa/')" not in s:
    needle = "return 'generic_offer';}"
    repl = "if(str_contains($p,'/products/car-tire-inflator/sa/'))return 'sa_tire_inflator_aliexpress';return 'generic_offer';}"
    if needle not in s:
        raise SystemExit('campaign_from fallback marker not found')
    s = s.replace(needle, repl, 1)

if key not in s:
    marker = "'generic_offer'=>["
    if marker not in s:
        raise SystemExit('generic_offer marker not found')
    spec = (
        "'sa_tire_inflator_aliexpress'=>["
        "'return_base'=>'https://trendpilotchoice.com/products/car-tire-inflator/sa/',"
        "'badge'=>$ar?'منتج محفوظ • منفاخ إطارات':'SAVED PRODUCT • TIRE INFLATOR',"
        "'subject'=>$ar?'حفظنا رابط منفاخ الإطارات الذي اخترته':'Your tire inflator product link is saved',"
        "'headline'=>$ar?'رابط نفس المنتج محفوظ لك':'The exact product link is saved for you',"
        "'intro'=>$ar?'احتفظنا برابط نفس منفاخ الإطارات لتعود إليه عندما تكون مستعدًا.':'We saved the exact tire inflator link so you can return when ready.',"
        "'cta'=>$ar?'راجع صفحة المنتج في TrendPilot ←':'Review the TrendPilot product page →',"
        "'buy_cta'=>$ar?'افتح عرض AliExpress الآن ←':'Open the AliExpress offer now →',"
        "'point1'=>$ar?'A1612P • منفاخ محمول • 150PSI • شاشة LCD':'A1612P • portable inflator • 150PSI • LCD display',"
        "'point2'=>$ar?'آخر سعر كتالوج لدينا 26.56 دولار؛ السعر النهائي لدى البائع':'Latest catalog price: $26.56; seller checkout remains authoritative',"
        "'point3'=>$ar?'تحقق من النسخة والشحن إلى السعودية قبل الدفع':'Confirm the variant and Saudi shipping before payment',"
        "'allowed_hosts'=>['rzekl.com','www.rzekl.com','s.click.aliexpress.com','aliexpress.com','www.aliexpress.com']], "
    )
    s = s.replace(marker, spec + marker, 1)

p.write_text(s, encoding='utf-8')
print('SA_TIRE_EMAIL_BACKEND_PATCHED')
