(()=>{
  if(document.getElementById('wau-editorial-picks')) return;
  const TRACK='https://axavl.com/g/p5q0qhi27e179d0dbedcd7a7e9fcda/';
  const style=document.createElement('style');
  style.textContent=`
  .tp-picks{padding:46px 0 18px}.tp-picks h2{font-size:clamp(31px,4.4vw,48px);letter-spacing:-.045em;line-height:1.06;margin:0 0 10px}.tp-picks .tp-lead{color:var(--muted);max-width:760px;margin:0 0 22px}.tp-pick-card{background:#fff;border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow);padding:24px;overflow:hidden}.tp-pick-head{display:grid;grid-template-columns:1fr 250px;gap:24px;align-items:center}.tp-pick-badge{display:inline-flex;align-items:center;gap:8px;background:#f4faf6;border:1px solid #dcece2;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;color:#557361}.tp-pick-badge:before{content:'✓';display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#6faa8c;color:#fff;font-size:12px}.tp-pick-kicker{margin-top:13px;color:#7b6d70;font-size:14px}.tp-pick-title{font-size:clamp(28px,4vw,44px);line-height:1.05;letter-spacing:-.04em;margin:5px 0 10px}.tp-pick-copy{color:var(--muted);max-width:650px;margin:0}.tp-pick-image{background:linear-gradient(145deg,#f8e5e2,#fff8f4);border:1px solid #f0dfda;border-radius:22px;padding:12px}.tp-pick-image img{display:block;width:100%;aspect-ratio:1/1;object-fit:contain;border-radius:16px;background:#fbefec}.tp-buy{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:22px;padding-top:20px;border-top:1px dotted #ded2ce}.tp-price strong{font-size:27px;letter-spacing:-.03em}.tp-price span{display:block;color:var(--muted);font-size:11px;margin-top:2px}.tp-buy .btn{min-width:260px;background:#dff4d7;color:#284432;box-shadow:none}.tp-buy .btn:hover{background:#d5efcc}.tp-detail{margin-top:18px;border-top:1px dotted #ded2ce}.tp-detail details{border-bottom:1px dotted #ded2ce}.tp-detail summary{list-style:none;cursor:pointer;padding:18px 4px;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.tp-detail summary::-webkit-details-marker{display:none}.tp-detail summary:after{content:'＋';font-size:24px;font-weight:500;color:var(--rose)}.tp-detail details[open] summary:after{content:'−'}.tp-pc{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:0 4px 20px}.tp-pc-col{background:#fbfaf8;border:1px solid var(--line);border-radius:18px;padding:17px}.tp-pc-col.good{background:#f5faf7}.tp-pc-col.care{background:#fff8f6}.tp-pc-col h4{margin:0 0 11px;font-size:15px}.tp-pc-list{display:grid;gap:10px;font-size:14px;color:#5f5558}.tp-pc-list span{display:flex;gap:9px}.tp-plus{color:#56866e;font-weight:950}.tp-minus{color:#b86c78;font-weight:950}.tp-expert{padding:0 4px 20px;color:#5f5558;font-size:14px}.tp-expert strong{color:var(--ink)}.tp-compare-title{font-size:24px;margin:28px 0 12px;letter-spacing:-.03em}.tp-compare{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.tp-model{background:#fff;border:1px solid var(--line);border-radius:20px;padding:17px}.tp-model.featured{background:#f5faf7;border-color:#d6e8dd}.tp-model .tag{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:var(--rose)}.tp-model h3{margin:6px 0 7px;font-size:19px;line-height:1.2}.tp-model .price{font-size:23px;font-weight:900;letter-spacing:-.03em}.tp-model .price-note{font-size:10px;color:var(--muted)}.tp-model ul{margin:12px 0 0;padding-left:18px;color:#655b5e;font-size:13px}.tp-model li+li{margin-top:5px}.tp-foot{margin-top:12px;color:#827679;font-size:11px}.tp-aff{margin-top:14px;color:#8b7e81;font-size:11px}@media(max-width:760px){.tp-pick-head{grid-template-columns:1fr}.tp-pick-image{max-width:360px;margin:auto}.tp-buy{grid-template-columns:1fr}.tp-buy .btn{width:100%;min-width:0}.tp-pc,.tp-compare{grid-template-columns:1fr}.tp-pick-card{padding:18px}.tp-picks{padding-top:34px}}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.className='tp-picks';
  section.id='wau-editorial-picks';
  section.innerHTML=`<div class="wrap">
    <div class="section-kicker">Нашият избор • 2026</div>
    <h2>Ако искаш бърз отговор, започни оттук.</h2>
    <p class="tp-lead">Не ти трябва още една страница, която нарича всичко „най-добро“. Ето практичния ни прочит на WAU LED FACE MASK 2.0 — с плюсове, ограничения и цена, която да провериш преди покупка.</p>
    <article class="tp-pick-card">
      <div class="tp-pick-head">
        <div><span class="tp-pick-badge">Практичен избор</span><div class="tp-pick-kicker">Най-добър баланс в серията за повечето хора</div><h3 class="tp-pick-title">WAU LED FACE MASK 2.0</h3><p class="tp-pick-copy">Подходяща, ако искаш кратка домашна LED рутина без да скачаш директно към най-скъпия модел. WAU посочва 5 светлинни режима, 3 нива на яркост и 10–15 минутна сесия.</p></div>
        <div class="tp-pick-image"><img src="assets/hero.png" alt="WAU LED FACE MASK 2.0" loading="lazy" width="600" height="600"></div>
      </div>
      <div class="tp-buy"><div class="tp-price"><strong>около €420</strong><span>ориентир; крайната цена и наличност са в WAU</span></div><a class="btn" href="${TRACK}" target="_blank" rel="sponsored nofollow noopener">Провери цената в WAU →</a></div>
      <div class="tp-detail">
        <details open><summary>Плюсове и минуси</summary><div class="tp-pc">
          <div class="tp-pc-col good"><h4>Какво ни харесва</h4><div class="tp-pc-list"><span><b class="tp-plus">＋</b> 5 светлинни режима.</span><span><b class="tp-plus">＋</b> 3 нива на яркост.</span><span><b class="tp-plus">＋</b> Кратка 10–15 минутна рутина.</span><span><b class="tp-plus">＋</b> До 140 минути работа без презареждане според WAU.</span><span><b class="tp-plus">＋</b> Публикуван 30-дневен срок за връщане; провери условията.</span></div></div>
          <div class="tp-pc-col care"><h4>Какво да имаш предвид</h4><div class="tp-pc-list"><span><b class="tp-minus">−</b> Около €420 е съществена покупка.</span><span><b class="tp-minus">−</b> Има смисъл само ако ще я използваш последователно.</span><span><b class="tp-minus">−</b> Производителските резултати не са гаранция за всеки човек.</span><span><b class="tp-minus">−</b> Провери официалните предупреждения, ако имаш фоточувствителност или приемаш лекарства.</span></div></div>
        </div></details>
        <details><summary>Нашата кратка преценка</summary><div class="tp-expert"><strong>Най-силната страна е удобството, не обещание за „чудо“.</strong> Ако 10–15 минути вечер са нещо, което реално ще правиш, 2.0 изглежда като разумния баланс в серията. Ако бюджетът е по-важен, сравни 1.0. Ако търсиш премиум безжичен вариант, виж 3.0.</div></details>
      </div>
    </article>
    <h3 class="tp-compare-title">Трите WAU LED варианта — за 30 секунди</h3>
    <div class="tp-compare">
      <div class="tp-model"><div class="tag">По-достъпен</div><h3>LED MASK 1.0</h3><div class="price">≈ €293</div><div class="price-note">последно видян ориентир</div><ul><li>4 светлинни спектъра</li><li>По-ниска входна цена</li><li>За човек, който пази бюджета</li></ul></div>
      <div class="tp-model featured"><div class="tag">Нашият баланс</div><h3>LED FACE MASK 2.0</h3><div class="price">≈ €420</div><div class="price-note">последно видян ориентир</div><ul><li>5 светлинни режима</li><li>3 нива на яркост</li><li>10–15 минути на сесия</li></ul></div>
      <div class="tp-model"><div class="tag">Премиум</div><h3>LED MASK 3.0</h3><div class="price">≈ €724</div><div class="price-note">последно видян ориентир</div><ul><li>Безжичен 3D модел</li><li>Червена, синя и инфрачервена светлина</li><li>За човек, който търси най-високия клас в серията</li></ul></div>
    </div>
    <div class="tp-foot">Цените са ориентири и могат да се променят според държава, валута и промоция.</div>
    <div class="tp-aff">Партньорско разкриване: при покупка през основния бутон TrendPilot може да получи комисиона без допълнителна цена за теб.</div>
  </div>`;

  const offer=document.getElementById('offer');
  if(offer) offer.parentNode.insertBefore(section,offer); else document.querySelector('main')?.appendChild(section);
})();
