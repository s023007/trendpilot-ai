from pathlib import Path
p=Path('api/save-search.php')
s=p.read_text(encoding='utf-8')
s=s.replace("'buy_cta'=>$ar?'فتح التذاكر على موقع البائع ←':'Open tickets on seller site →'", "'buy_cta'=>$ar?'اختر مقعدك الآن ←':'Choose your seat now →'")
s=s.replace("'buy_cta'=>$ar?'الذهاب إلى البائع ←':'Continue to seller →'", "'buy_cta'=>$ar?'شاهد المقاعد المتاحة الآن ←':'See available seats now →'")
s=s.replace("سيتم المرور عبر TrendPilot أولًا لتسجيل اختيارك ثم تحويلك إلى صفحة البائع. تحقق من السعر النهائي والمقاعد قبل الدفع.", "اضغط لاختيار مقعدك ومراجعة التوفر الحالي. تحقق من السعر النهائي وتفاصيل المقعد قبل الدفع.")
s=s.replace("You will pass through TrendPilot first to record your selection, then continue to the seller. Confirm final price and seat terms before payment.", "Choose your seat and review current availability. Confirm the final price and seat details before payment.")
p.write_text(s,encoding='utf-8')
print('Updated email CTA copy for stronger seat-selection intent.')
