from pathlib import Path

files = {
    Path('events/el-clasico-2026/ar/index.html'): [
        ('<a class="btn btn-primary" href="#prices">ارجع إلى الأسعار</a>', ''),
        ('<section class="final card"><span class="kicker">جاهز للمقارنة؟</span><h2>ابدأ بالمقعد الذي يناسبك ثم قارن التكلفة الكاملة للرحلة.</h2><a class="btn btn-primary" href="#prices">شاهد الأسعار مرة أخرى</a></section>',
         '<section class="final card"><span class="kicker">جاهز للكلاسيكو؟</span><h2>المقاعد تتغير بسرعة — اختر المقعد الذي يناسبك قبل أن يتغير السعر أو التوفر.</h2><a class="btn btn-primary price-link" href="https://www.livefootballtickets.com/fixtures/fc-barcelona-v-real-madrid-1-tickets-spanish-la-liga.html" target="_blank" rel="nofollow noopener">اختر مقعدك الآن ←</a></section>'),
        ('<div class="sticky-buy"><a class="btn btn-primary" href="#prices">قارن أسعار الكلاسيكو</a></div>',
         '<div class="sticky-buy"><a class="btn btn-primary price-link" href="https://www.livefootballtickets.com/fixtures/fc-barcelona-v-real-madrid-1-tickets-spanish-la-liga.html" target="_blank" rel="nofollow noopener">شاهد المقاعد المتاحة الآن ←</a></div>'),
    ],
    Path('events/el-clasico-2026/en-gb/index.html'): [
        ('<a class="btn btn-primary" href="#prices">Back to ticket prices</a>', ''),
        ('<section class="final card"><span class="kicker">READY TO COMPARE?</span><h2>Start with the seat, then compare the full trip cost.</h2><a class="btn btn-primary" href="#prices">See ticket prices again</a></section>',
         '<section class="final card"><span class="kicker">READY FOR EL CLÁSICO?</span><h2>Seat availability moves quickly — choose the option that fits you before price or availability changes.</h2><a class="btn btn-primary price-link" href="https://www.livefootballtickets.com/fixtures/fc-barcelona-v-real-madrid-1-tickets-spanish-la-liga.html" target="_blank" rel="nofollow noopener">Choose your seat now →</a></section>'),
        ('<div class="sticky-buy"><a class="btn btn-primary" href="#prices">Compare El Clásico prices</a></div>',
         '<div class="sticky-buy"><a class="btn btn-primary price-link" href="https://www.livefootballtickets.com/fixtures/fc-barcelona-v-real-madrid-1-tickets-spanish-la-liga.html" target="_blank" rel="nofollow noopener">See available seats now →</a></div>'),
    ],
}

for path, replacements in files.items():
    text = path.read_text(encoding='utf-8')
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'Missing expected CTA in {path}: {old[:90]}')
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')

print('Simplified El Clasico CTAs and made final/sticky CTAs direct-to-seat listing.')
