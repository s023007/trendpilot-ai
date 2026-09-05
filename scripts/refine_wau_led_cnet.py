from pathlib import Path

p = Path('products/led-face-mask/bg/index.html')
s = p.read_text(encoding='utf-8')

# Current published WAU price at time of this editorial refresh.
s = s.replace('€421.95', '€419.95').replace('около €421.95', 'около €419.95')

css_anchor = '    .section{padding:62px 0}'
css = '''    .editorial-verdict{padding:38px 0 10px}.verdict-shell{background:#fff;border:1px solid var(--line);border-radius:28px;padding:26px;box-shadow:var(--shadow)}.verdict-head{display:grid;grid-template-columns:1.2fr .8fr;gap:20px;align-items:end}.verdict-head h2{margin:0;font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;line-height:1.08}.verdict-head p{margin:0;color:var(--muted);font-size:14px}.verdict-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}.verdict-card{border:1px solid var(--line);border-radius:20px;padding:18px;background:#fffaf8}.verdict-card:nth-child(2){background:#f5faf7}.verdict-card:nth-child(3){background:#fff7f5}.verdict-card .vtag{font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--rose);margin-bottom:8px}.verdict-card strong{display:block;font-size:18px;line-height:1.25}.verdict-card p{margin:8px 0 0;color:var(--muted);font-size:13px}.criteria{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}.criterion{background:#faf7f4;border:1px solid var(--line);border-radius:14px;padding:10px;text-align:center;font-size:12px;color:#65595c}.evidence-note{margin-top:16px;padding:14px 16px;border-radius:16px;background:#f5f7fb;color:#5d6572;font-size:12px}.evidence-note strong{color:#343b46}@media(max-width:860px){.verdict-head{grid-template-columns:1fr}.verdict-grid{grid-template-columns:1fr}.criteria{grid-template-columns:1fr 1fr}}@media(max-width:560px){.criteria{grid-template-columns:1fr}.verdict-shell{padding:20px;border-radius:22px}}
'''
if '.editorial-verdict{' not in s:
    if css_anchor not in s:
        raise SystemExit('CSS anchor missing')
    s = s.replace(css_anchor, css + css_anchor, 1)

section = '''
    <section class="editorial-verdict"><div class="wrap verdict-shell">
      <div class="verdict-head">
        <div><div class="section-kicker">Бърза редакционна преценка</div><h2>Първо реши дали тази маска изобщо пасва на теб.</h2></div>
        <p>Вместо да те притискаме към покупка, разделяме решението на практични въпроси: какво прави устройството, за кого е удобно, какво струва и какво трябва да провериш преди плащане.</p>
      </div>
      <div class="verdict-grid">
        <div class="verdict-card"><div class="vtag">Защо я разглеждаме</div><strong>Кратка, лесна за разбиране рутина.</strong><p>WAU публикува 5 светлинни режима, 3 нива на яркост и 10–15 минутни сесии. Това е по-полезно от гръмки обещания, ако искаш устройство, което реално ще използваш.</p></div>
        <div class="verdict-card"><div class="vtag">Най-подходяща за</div><strong>Човек, който иска beauty-tech у дома и ще бъде последователен.</strong><p>Има смисъл, ако цениш удобството, няколко режима и си готов/а да провериш актуалната цена, доставка, гаранция и връщане преди покупка.</p></div>
        <div class="verdict-card"><div class="vtag">По-добре пропусни, ако</div><strong>Очакваш незабавен или медицински гарантиран резултат.</strong><p>Това е beauty-tech продукт, не заместител на медицинска грижа. При фоточувствителност, лекарства или здравен въпрос провери официалните указания и говори с квалифициран специалист.</p></div>
      </div>
      <div class="criteria">
        <div class="criterion">Светлинни режими</div><div class="criterion">Комфорт и време</div><div class="criterion">Цена и стойност</div><div class="criterion">Гаранция и връщане</div><div class="criterion">Ясни ограничения</div>
      </div>
      <div class="evidence-note"><strong>Какво е проверено:</strong> страницата използва публикуваните спецификации, изображения и условия на WAU и независими buying-guide принципи. TrendPilot не представя това като собствен hands-on тест и не измисля рейтинг, клиничен резултат или сертификат, който не сме потвърдили.</div>
    </div></section>

'''
offer_anchor = '    <section class="section" id="offer">'
if 'Бърза редакционна преценка' not in s:
    if offer_anchor not in s:
        raise SystemExit('Offer anchor missing')
    s = s.replace(offer_anchor, section + offer_anchor, 1)

p.write_text(s, encoding='utf-8')
print('WAU landing editorial refinement applied')
