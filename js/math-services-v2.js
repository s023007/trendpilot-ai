(()=>{
  const body=document.body;
  const form=document.querySelector('[data-math-form]');
  const result=document.querySelector('[data-math-result]');
  const summaryEl=document.querySelector('[data-math-summary]');
  const copyBtn=document.querySelector('[data-math-copy]');
  const waBtn=document.querySelector('[data-math-whatsapp]');
  const emailBtn=document.querySelector('[data-math-email]');
  const langButton=document.querySelector('[data-math-lang]');
  const EMAIL='hello@trendpilotchoice.com';

  const ar={};
  const arPlaceholders={};
  document.querySelectorAll('[data-i18n]').forEach(el=>{ar[el.dataset.i18n]=el.innerHTML;});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{arPlaceholders[el.dataset.i18nPlaceholder]=el.placeholder;});

  const en={
    navServices:'Services',navPricing:'Pricing',navRequest:'Send a request',
    heroEyebrow:'Online Math Support',heroTitle:'Understand math <span>more clearly.</span>',heroLead:'One-to-one lessons, step-by-step problem explanations, personalized videos, worksheets and tests for students and teachers.',heroCta1:'Send Your Question',heroCta2:'View Pricing',heroBadge:'Clear explanations • Step by step',trust1:'Arabic & English',trust2:'School & university',trust3:'One-to-one support',
    promiseTitle:'Important',promiseText:'This service is for teaching, explanation, practice and review only. We do not take tests or graded assessments on behalf of a student.',
    servicesEyebrow:'Our services',servicesTitle:'Choose the type of math support that fits your needs.',servicesLead:'Start with one question, a private lesson, a personalized video or a custom learning resource — without paying for more support than you need.',
    s1Title:'Problem Explanation',s1Text:'Send your question and receive a clear, structured, step-by-step explanation.',s1Price:'From 2 OMR',s2Title:'1-on-1 Lesson',s2Text:'Live explanation, revision and practice tailored to your level and learning goals.',s2Price:'From 4 OMR',s3Title:'Personalized Video',s3Text:'A recorded explanation made specifically for your question or topic, ready to review anytime.',s3Price:'From 3 OMR',s4Title:'Worksheets & Booklets',s4Text:'Custom worksheets, tests, question banks and revision booklets for students and teachers.',s4Price:'From 5 OMR',choose:'Choose this service',popular:'Most popular',
    topicsEyebrow:'Topics',topicsTitle:'From school foundations to advanced mathematics.',topic1:'Algebra',topic2:'Geometry',topic3:'Trigonometry',topic4:'Functions',topic5:'Calculus',topic6:'Statistics',topic7:'Vectors',topic8:'Discrete Math',
    pricingEyebrow:'Clear pricing',pricingTitle:'Know the price before you start.',pricingLead:'Simple services have fixed prices. Larger or advanced requests are quoted after reviewing the requirements.',omr:'OMR',pLessons:'1-on-1 Lessons',pL1:'30 minutes',pL2:'60 minutes',pL3:'4 lessons × 60 minutes',pL4:'8 lessons × 60 minutes',pL5:'90-minute intensive review',pProblems:'Problem Explanations',pP1:'One question + written explanation',pP2:'3 questions',pP3:'5 questions',pP4:'Advanced / university problem',pP5:'Large question set',from3:'From 3 OMR',customPrice:'Custom quote',pVideos:'Personalized Video',pV1:'Up to 5 minutes',pV2:'Up to 10 minutes',pV3:'Up to 20 minutes',pV4:'30–40 minute lesson explanation',pContent:'Worksheets & Booklets',pC1:'Short 1–2 page worksheet',pC2:'Worksheet up to 5 pages',pC3:'10-question test + answers',pC4:'20-question test + answers',pC5:'10-page booklet',from18:'From 18 OMR',
    launchOffer:'Starter option',offerTitle:'Your first 30-minute lesson: 4 OMR',offerText:'A simple way to experience the teaching style before booking a larger package.',offerCta:'Book the lesson',
    howEyebrow:'How it works',howTitle:'Three simple steps to get the support you need.',step1Title:'Send',step1Text:'Choose a service and describe your question or request.',step2Title:'Confirm details',step2Text:'We confirm the price, timing and delivery method or lesson details before starting.',step3Title:'Learn',step3Text:'Receive your explanation, lesson or learning material in the agreed format.',
    requestEyebrow:'Start now',requestTitle:'Tell me what you need help with in mathematics.',requestLead:'Describe what you need briefly. The appropriate service and price will be confirmed clearly before work begins.',fService:'Service type',fChoose:'Choose a service',fProblem:'Problem explanation',fLesson:'1-on-1 lesson',fVideo:'Video explanation',fContent:'Worksheet / test / booklet',fLevel:'Level',fSchool:'School',fUniversity:'University',fTeacher:'Teacher / educational content',fLanguage:'Explanation language',fTopic:'Topic',fTopicPh:'Example: Calculus or Geometry',fDetails:'Briefly describe what you need',fDetailsPh:'Write the question or describe your request. You can send an image after contact is established.',fSubmit:'Prepare My Request',fNote:'No payment is collected through this form. The service and price are confirmed before work begins.',resultTitle:'Your request summary is ready',sendEmail:'Send by email',sendWhatsapp:'Send via WhatsApp',copyRequest:'Copy request',
    faqTitle:'Frequently asked questions',faq1q:'Do I need to book a full lesson for one question?',faq1a:'No. You can request an explanation for a single question from 2 OMR.',faq2q:'Is support available in Arabic and English?',faq2a:'Yes. Choose your preferred explanation language when submitting the request.',faq3q:'Is the service available for university students?',faq3a:'Yes. Advanced university problems can be quoted after review if they require additional work.',faq4q:'Can I request a custom test or worksheet?',faq4a:'Yes. Custom worksheets, tests, answer keys, question banks and revision booklets can be prepared.',faq5q:'Do you take tests on behalf of students?',faq5a:'No. The service is for teaching, explanation, practice and review only, not taking assessments for a student.',
    finalTitle:'Don’t just get the answer — understand the math.',finalText:'Start with one question, then choose the level of support that fits you.',finalCta:'Send Your Question',footerText:'Online math education services — explanations, lessons and custom learning resources.',mobileCta:'Send Your Question'
  };
  const enPlaceholders={fTopicPh:en.fTopicPh,fDetailsPh:en.fDetailsPh};
  const serviceNames={ar:{problem:'شرح مسألة',lesson:'حصة فردية',video:'فيديو شرح',content:'ورقة عمل / اختبار / كتيب'},en:{problem:'Problem explanation',lesson:'1-on-1 lesson',video:'Video explanation',content:'Worksheet / test / booklet'}};
  const levelNames={ar:{school:'مدرسة',university:'جامعة',teacher:'معلم / محتوى تعليمي'},en:{school:'School',university:'University',teacher:'Teacher / educational content'}};
  let currentLang=(new URLSearchParams(location.search).get('lang')==='en'||localStorage.getItem('tp-math-lang')==='en')?'en':'ar';

  function setLang(lang){
    currentLang=lang;
    localStorage.setItem('tp-math-lang',lang);
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    body.dir=lang==='ar'?'rtl':'ltr';
    const dict=lang==='ar'?ar:en;
    const placeholders=lang==='ar'?arPlaceholders:enPlaceholders;
    document.querySelectorAll('[data-i18n]').forEach(el=>{const v=dict[el.dataset.i18n];if(v!==undefined)el.innerHTML=v;});
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const v=placeholders[el.dataset.i18nPlaceholder];if(v!==undefined)el.placeholder=v;});
    document.querySelectorAll('[data-lang-image]').forEach(img=>{
      const src=lang==='ar'?img.dataset.arSrc:img.dataset.enSrc;
      const alt=lang==='ar'?img.dataset.altAr:img.dataset.altEn;
      if(src&&img.getAttribute('src')!==src)img.src=src;
      if(alt)img.alt=alt;
    });
    if(langButton)langButton.textContent=lang==='ar'?'EN':'AR';
    document.title=lang==='ar'?'خدمات تعليم الرياضيات أونلاين | حصص وشرح مسائل وفيديوهات':'Online Math Help | 1-on-1 Lessons, Problem Explanations & Videos';
    const desc=document.querySelector('meta[name="description"]');
    if(desc)desc.content=lang==='ar'?'خدمات تعليم الرياضيات أونلاين: حصص فردية، شرح مسائل خطوة بخطوة، فيديوهات مخصصة، أوراق عمل واختبارات وكتيبات. أسعار واضحة تبدأ من 2 ر.ع.':'Online math support with one-to-one lessons, step-by-step problem explanations, personalized videos, worksheets and tests. Clear pricing from 2 OMR.';
  }

  setLang(currentLang);
  if(langButton)langButton.addEventListener('click',()=>setLang(currentLang==='ar'?'en':'ar'));
  document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{if(form?.elements?.service)form.elements.service.value=link.dataset.service;}));

  function buildSummary(data){
    const service=serviceNames[currentLang][data.get('service')]||data.get('service');
    const level=levelNames[currentLang][data.get('level')]||data.get('level');
    if(currentLang==='ar')return `طلب خدمة رياضيات\nالخدمة: ${service}\nالمستوى: ${level}\nلغة الشرح: ${data.get('language')||''}\nالموضوع: ${data.get('topic')||'غير محدد'}\nالتفاصيل: ${data.get('details')||''}`;
    return `Math service request\nService: ${service}\nLevel: ${level}\nExplanation language: ${data.get('language')||''}\nTopic: ${data.get('topic')||'Not specified'}\nDetails: ${data.get('details')||''}`;
  }

  if(form)form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const data=new FormData(form);
    const summary=buildSummary(data);
    summaryEl.textContent=summary;
    result.hidden=false;
    const subject=currentLang==='ar'?'طلب خدمة رياضيات':'Math service request';
    if(emailBtn)emailBtn.href=`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
    const number=(body.dataset.whatsapp||'').replace(/\D/g,'');
    if(number&&waBtn){waBtn.hidden=false;waBtn.onclick=()=>window.open(`https://wa.me/${number}?text=${encodeURIComponent(summary)}`,'_blank','noopener');}
    else if(waBtn)waBtn.hidden=true;
    result.scrollIntoView({behavior:'smooth',block:'nearest'});
    try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'math_request_prepared',math_service:data.get('service'),math_level:data.get('level'),language:currentLang,page_path:location.pathname});}catch(_e){}
  });

  if(copyBtn)copyBtn.addEventListener('click',async()=>{
    const text=summaryEl?.textContent||'';
    if(!text)return;
    try{await navigator.clipboard.writeText(text);copyBtn.textContent=currentLang==='ar'?'تم النسخ ✓':'Copied ✓';setTimeout(()=>setLang(currentLang),1600);}catch(_e){window.prompt(currentLang==='ar'?'انسخ الطلب:':'Copy the request:',text);}
  });
  document.querySelectorAll('[data-track]').forEach(el=>el.addEventListener('click',()=>{try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'math_cta_click',cta:el.dataset.track,language:currentLang,page_path:location.pathname});}catch(_e){}}));
})();