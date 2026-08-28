from pathlib import Path

repo = Path('.')
api = repo/'api/save-search.php'
go = repo/'api/go.php'
ar = repo/'events/el-clasico-2026/ar/index.html'
en = repo/'events/el-clasico-2026/en-gb/index.html'


def must_replace(path, old, new):
    s = path.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'missing expected text in {path}: {old[:120]!r}')
    path.write_text(s.replace(old, new, 1), encoding='utf-8')

# 1) Give El Clasico its own email campaign identity.
must_replace(
    api,
    "if(str_contains($p,'/events/manchester-derby-2026/'))return 'manchester_derby_2026';return 'generic_offer';}",
    "if(str_contains($p,'/events/manchester-derby-2026/'))return 'manchester_derby_2026';if(str_contains($p,'/events/el-clasico-2026/'))return 'el_clasico_2026';return 'generic_offer';}"
)

needle = "'allowed_hosts'=>['zmgig.com','www.ticombo.com','ticombo.com','www.sportsevents365.com','sportsevents365.com','www.livefootballtickets.com','livefootballtickets.com','www.footballticketpad.com','footballticketpad.com']], 'generic_offer'=>"
el = "'allowed_hosts'=>['zmgig.com','www.ticombo.com','ticombo.com','www.sportsevents365.com','sportsevents365.com','www.livefootballtickets.com','livefootballtickets.com','www.footballticketpad.com','footballticketpad.com']], 'el_clasico_2026'=>['return_base'=>$ar?'https://trendpilotchoice.com/events/el-clasico-2026/ar/':'https://trendpilotchoice.com/events/el-clasico-2026/en-gb/','badge'=>$ar?'تنبيه تذاكر • الكلاسيكو':'TICKET ALERT • EL CLÁSICO','subject'=>$ar?'حفظنا عرض الكلاسيكو لك':'Your El Clásico offer is saved','headline'=>$ar?'عرض الكلاسيكو الذي اخترته محفوظ':'Your El Clásico offer is saved','intro'=>$ar?'احتفظنا بالعرض لتتمكن من مراجعة السعر والمقاعد بسرعة.':'We saved this offer so you can quickly review the price and seats.','cta'=>$ar?'راجع السعر والمقاعد الآن ←':'Review price & seats →','buy_cta'=>$ar?'الذهاب إلى البائع لإكمال الشراء ←':'Continue to seller →','point1'=>$ar?'المباراة: برشلونة ضد ريال مدريد':'Fixture: FC Barcelona vs Real Madrid','point2'=>$ar?'Spotify Camp Nou • 25 أكتوبر 2026 • التوقيت لم يحدد بعد':'Spotify Camp Nou • 25 Oct 2026 • kick-off TBA','point3'=>$ar?'السعر النهائي وشروط المقعد لدى البائع هي المرجع':'Seller checkout price and seat terms remain authoritative','allowed_hosts'=>['www.sportsevents365.com','sportsevents365.com','www.livefootballtickets.com','livefootballtickets.com','seatpick.com','www.seatpick.com','fanpass.es','www.fanpass.es']], 'generic_offer'=>"
must_replace(api, needle, el)

# 2) Permit secure email handoff for this campaign too.
must_replace(
    go,
    "if ($campaign === 'manchester_derby_2026' && !in_array($host, $allowedTicketHosts, true)) {",
    "$allowedElClasicoHosts = [\n    'sportsevents365.com','www.sportsevents365.com',\n    'livefootballtickets.com','www.livefootballtickets.com',\n    'seatpick.com','www.seatpick.com','fanpass.es','www.fanpass.es'\n];\nif ($campaign === 'manchester_derby_2026' && !in_array($host, $allowedTicketHosts, true)) {"
)
must_replace(
    go,
    "    exit('Seller link not allowed');\n}\n\n$click = [",
    "    exit('Seller link not allowed');\n}\nif ($campaign === 'el_clasico_2026' && !in_array($host, $allowedElClasicoHosts, true)) {\n    http_response_code(400);\n    exit('Seller link not allowed');\n}\n\n$click = ["
)

# 3) Add a clear official-source block, seat guide and Gulf travel intent to both locales.
ar_anchor = '<section class="ticket card accent-card"><span class="kicker">لماذا هذه المباراة؟</span>'
ar_insert = '''<section class="more card"><span class="kicker">المصدر الرسمي للمباراة</span><h2>المباراة مدرجة رسميًا لدى FC Barcelona.</h2><p>النادي يعرض برشلونة ضد ريال مدريد ضمن الجولة 10 في <bdi dir="ltr">Spotify Camp Nou</bdi> خلال 24–25 أكتوبر 2026، ووقت البداية ما زال <bdi dir="ltr">TBA</bdi>. لذلك اجعل حجوزات الطيران والفندق مرنة حتى تثبيت التوقيت النهائي.</p><a class="btn btn-secondary" href="https://www.fcbarcelona.com/en/tickets/football/regular/laliga/fcbarcelona-realmadrid" target="_blank" rel="nofollow noopener">راجع معلومات المباراة الرسمية</a></section>\n<section class="more card"><span class="kicker">أي مقعد يناسبك؟</span><h2>لا تقارن السعر وحده — قارن زاوية المشاهدة أيضًا.</h2><div class="areas"><div class="area"><strong>Budget</strong><span>خلف المرمى أو المستويات العليا غالبًا أقل تكلفة؛ مناسب إذا كانت الأولوية لحضور الكلاسيكو بأقل ميزانية.</span></div><div class="area"><strong>Better view</strong><span>المقاعد الجانبية تمنح رؤية أوضح لبناء اللعب والتحركات عبر الملعب.</span></div><div class="area"><strong>Premium / VIP</strong><span>مقاعد أفضل وقد تتضمن ضيافة أو خدمات إضافية؛ افحص ما يتضمنه السعر قبل الدفع.</span></div></div></section>\n'''
must_replace(ar, ar_anchor, ar_insert + ar_anchor)

ar_trip = '<p>موعد المباراة مؤكد حاليًا في 25 أكتوبر، لكن توقيت البداية قد يتغير. اختر حجوزات مرنة قدر الإمكان.</p>'
ar_trip_new = '<p>إذا كنت قادمًا من <strong>مسقط أو دبي أو الرياض أو الدوحة أو الكويت أو البحرين</strong>، خطط عادةً للوصول إلى برشلونة قبل المباراة بيوم على الأقل. الموعد ضمن 24–25 أكتوبر حاليًا، لكن وقت البداية لم يثبت بعد؛ اختر حجوزات مرنة قدر الإمكان.</p>'
must_replace(ar, ar_trip, ar_trip_new)

en_anchor = '<section class="ticket card accent-card"><span class="kicker">WHY THIS MATCH?</span>'
en_insert = '''<section class="more card"><span class="kicker">OFFICIAL FIXTURE SOURCE</span><h2>FC Barcelona lists this El Clásico at Spotify Camp Nou.</h2><p>The club currently lists Barcelona vs Real Madrid for Matchday 10 across 24–25 October 2026, with kick-off still <strong>TBA</strong>. Keep flights and hotel flexible until the final broadcast time is confirmed.</p><a class="btn btn-secondary" href="https://www.fcbarcelona.com/en/tickets/football/regular/laliga/fcbarcelona-realmadrid" target="_blank" rel="nofollow noopener">Check the official fixture page</a></section>\n<section class="more card"><span class="kicker">WHICH SEAT FITS YOU?</span><h2>Compare the view, not only the headline price.</h2><div class="areas"><div class="area"><strong>Budget</strong><span>Behind-goal or upper-tier areas are often cheaper if your priority is simply being inside for El Clásico.</span></div><div class="area"><strong>Better view</strong><span>Side-on seating generally gives a clearer view of shape, movement and both penalty areas.</span></div><div class="area"><strong>Premium / VIP</strong><span>Better-positioned seats may include hospitality or extras; verify exactly what is included before paying.</span></div></div></section>\n'''
must_replace(en, en_anchor, en_insert + en_anchor)

en_trip = '<p>The match is currently scheduled for 25 October, while kick-off time remains subject to confirmation. Prefer flexible travel where practical.</p>'
en_trip_new = '<p>If you are travelling from <strong>Muscat, Dubai, Riyadh, Doha, Kuwait or Bahrain</strong>, aim to reach Barcelona at least a day before the match. The fixture sits across 24–25 October while kick-off remains TBA, so flexible travel is preferable.</p>'
must_replace(en, en_trip, en_trip_new)

# 4) Label seller-link status honestly until tracked affiliate deep links are verified.
for path, labels in [
    (ar, {'Sports Events 365':'مرجع حالي — رابط Affiliate العميق قيد التحقق','LiveFootballTickets':'رابط بائع للمقارنة','SeatPick':'رابط مقارنة خارجي','Fanpass':'رابط بائع للمقارنة'}),
    (en, {'Sports Events 365':'Current reference — affiliate deep link pending verification','LiveFootballTickets':'Seller comparison link','SeatPick':'External comparison link','Fanpass':'Seller comparison link'})
]:
    s = path.read_text(encoding='utf-8')
    for seller, label in labels.items():
        token = f'<span class="seller">{seller}</span>'
        if token not in s:
            raise SystemExit(f'missing seller {seller} in {path}')
        s = s.replace(token, token + f'<span class="convert">{label}</span>', 1)
    path.write_text(s, encoding='utf-8')

print('El Clasico funnel completed: email campaign, handoff, official source, seat guide, Gulf travel and seller-link labels.')
