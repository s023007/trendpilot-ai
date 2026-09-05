(()=>{
  const body=document.body;
  const form=document.querySelector('[data-math-form]');
  const result=document.querySelector('[data-math-result]');
  const summaryEl=document.querySelector('[data-math-summary]');
  const copyBtn=document.querySelector('[data-math-copy]');
  const waBtn=document.querySelector('[data-math-whatsapp]');
  const langButton=document.querySelector('[data-math-lang]');
  const EMAIL='hello@trendpilotchoice.com';

  const ar={};
  const arPlaceholders={};
  document.querySelectorAll('[data-i18n]').forEach(el=>{ar[el.dataset.i18n]=el.innerHTML;});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{arPlaceholders[el.dataset.i18nPlaceholder]=el.placeholder;});

  const en={
    navPricing:'Pricing',navRequest:'Send a question',heroEyebrow:'Clearer math. Step by step.',heroTitle:'Stuck on a math problem? <span>Send it. Understand it.</span>',heroLead:'One-to-one lessons, step-by-step problem explanations, personalized videos, worksheets and tests — choose the help you need from just OMR 2.',heroCta1:'📷 Send your question',heroCta2:'View pricing',trust1:'✓ Arabic & English',trust2:'✓ One-to-one support',trust3:'✓ School & university',quickTitle:'Start with one question',quickText:'You do not need to book a full lesson. Send the problem first and choose the type of explanation you want.',startingFrom:'Starting from',omr:'OMR',quickCta:'Start now',servicesEyebrow:'Choose what you need',servicesTitle:'Four ways to get the right level of math support.',servicesLead:'Do not pay for more help than you need. Start with a question, video, lesson or custom resource.',s1Title:'Problem explanation',s1Text:'Send your question and get a clear step-by-step explanation.',s1Price:'From OMR 2',s2Title:'Private lesson',s2Text:'Live explanation, revision and practice tailored to your level and goal.',s2Price:'From OMR 6',s3Title:'Personalized video',s3Text:'A recorded explanation made specifically for your question or topic.',s3Price:'From OMR 3',s4Title:'Worksheets & booklets',s4Text:'Custom tests, worksheets, question banks and revision booklets.',s4Price:'From OMR 5',choose:'Choose this service →',popular:'Most popular',pricingEyebrow:'Clear pricing',pricingTitle:'Know the price before you start.',pricingLead:'Simple services have fixed prices. Larger or advanced requests are quoted after reviewing the requirements.',pLessons:'🎓 Private lessons',pL1:'30 minutes',pL2:'60 minutes',pL3:'4 × 60-minute lessons',pL4:'8 × 60-minute lessons',pL5:'90-minute intensive review',pProblems:'📷 Problem explanations',pP1:'One question + written explanation',pP2:'3 questions',pP3:'5 questions',pP4:'Advanced / university problem',pP5:'Large question set',from3:'From OMR 3',customPrice:'Custom quote',pVideos:'🎥 Personalized video',pV1:'Up to 5 minutes',pV2:'Up to 10 minutes',pV3:'Up to 20 minutes',pV4:'30–40 minute lesson',pContent:'📘 Student & teacher resources',pC1:'Short 1–2 page worksheet',pC2:'Worksheet up to 5 pages',pC3:'10-question test + answers',pC4:'20-question test + answers',pC5:'10-page booklet',from18:'From OMR 18',launchOffer:'Launch offer',offerTitle:'Your first 30-minute lesson: OMR 4 instead of OMR 6',offerText:'Try the teaching style before booking a larger package.',offerCta:'Book the offer',topicsEyebrow:'Topics',topicsTitle:'From school foundations to advanced mathematics.',howEyebrow:'How it works',howTitle:'Only three steps.',step1Title:'Send',step1Text:'Choose the service and describe the question or resource you need.',step2Title:'Confirm',step2Text:'For custom work, the price and scope are confirmed before starting.',step3Title:'Learn',step3Text:'Receive the explanation, lesson or resource in the agreed format.',requestEyebrow:'Start now',requestTitle:'Tell me what you need help with in mathematics.',requestLead:'Complete only the essential details. You do not pay before the service and price are clear.',promiseTitle:'Important',promiseText:'This service is for teaching, explanation, practice and revision. We do not take tests or graded assessments on a student’s behalf.',fService:'Service',fChoose:'Choose a service',fProblem:'Problem explanation',fLesson:'Private lesson',fVideo:'Video explanation',fContent:'Worksheet / test / booklet',fLevel:'Level',fSchool:'School',fUniversity:'University',fTeacher:'Teacher / educational content',fLanguage:'Explanation language',fTopic:'Topic',fTopicPh:'Example: Calculus, Geometry, Trigonometry',fDetails:'Briefly describe what you need',fDetailsPh:'Write the question or describe what you need. You can attach an image after contact is established.',fSubmit:'Prepare my request',fNote:'Your request can be sent by email now. Direct WhatsApp sending will appear as soon as a dedicated service number is added.',resultTitle:'Your request summary is ready',sendWhatsapp:'Send via WhatsApp',copyRequest:'Copy request',faqTitle:'Frequently asked questions',faq1q:'Do I need to book a full lesson for one question?',faq1a:'No. You can request a single question explanation from OMR 2.',faq2q:'Is support available in Arabic and English?',faq2a:'Yes. Choose your preferred language when sending the request.',faq3q:'Do you help university students?',faq3a:'Yes. Advanced university problems can be quoted after review.',faq4q:'Can I request a custom test or worksheet?',faq4a:'Yes. Worksheets, tests, answer keys, question banks and revision booklets can be created.',faq5q:'Will you take a test on behalf of a student?',faq5a:'No. The service is for teaching, explanation, practice and revision, not taking graded assessments for a student.',finalTitle:'Do not just get the answer. Understand the math.',finalText:'Start with one question, then choose the level of support that fits you.',finalCta:'Send your question',footerText:'Online math education services — explanations, lessons and custom learning resources.',mobileCta:'📷 Send your question'
  };
  const enPlaceholders={fTopicPh:en.fTopicPh,fDetailsPh:en.fDetailsPh};
  const serviceNames={ar:{problem:'شرح مسألة',lesson:'حصة فردية',video:'فيديو شرح',content:'Worksheet / اختبار / كتيب'},en:{problem:'Problem explanation',lesson:'Private lesson',video:'Video explanation',content:'Worksheet / test / booklet'}};
  const levelNames={ar:{school:'مدرسة',university:'جامعة',teacher:'معلم / محتوى تعليمي'},en:{school:'School',university:'University',teacher:'Teacher / educational content'}};
  let currentLang=localStorage.getItem('tp-math-lang')==='en'?'en':'ar';

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
    if(langButton)langButton.textContent=lang==='ar'?'EN':'ع';
    document.title=lang==='ar'?'مساعدة الرياضيات أونلاين | حصص، شرح مسائل وفيديوهات مخصصة':'Online Math Help | Lessons, Problem Explanations & Custom Videos';
    updateDynamicLabels();
  }

  function updateDynamicLabels(){
    if(copyBtn)copyBtn.textContent=currentLang==='ar'?'نسخ الطلب':'Copy request';
    if(waBtn)waBtn.textContent=currentLang==='ar'?'إرسال عبر WhatsApp':'Send via WhatsApp';
    const emailBtn=document.querySelector('[data-math-email]');
    if(emailBtn)emailBtn.textContent=currentLang==='ar'?'إرسال بالبريد الإلكتروني':'Send by email';
    const note=document.querySelector('[data-i18n="fNote"]');
    if(note)note.textContent=currentLang==='ar'?'يمكن إرسال طلبك الآن بالبريد الإلكتروني. وسيظهر خيار WhatsApp مباشرة عند إضافة رقم مخصص للخدمة.':en.fNote;
  }

  setLang(currentLang);
  if(langButton)langButton.addEventListener('click',()=>setLang(currentLang==='ar'?'en':'ar'));

  document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{if(form?.elements?.service)form.elements.service.value=link.dataset.service;}));
  document.querySelectorAll('a[href="/contact"]').forEach(a=>a.href='/contact.html');
  document.querySelectorAll('a[href="/privacy"]').forEach(a=>a.href='/privacy.html');

  let emailBtn=null;
  const actionWrap=result?.querySelector('.math-result-actions');
  if(actionWrap){
    emailBtn=document.createElement('a');
    emailBtn.className='math-btn math-btn-primary';
    emailBtn.setAttribute('data-math-email','');
    emailBtn.textContent=currentLang==='ar'?'إرسال بالبريد الإلكتروني':'Send by email';
    actionWrap.insertBefore(emailBtn,copyBtn||null);
  }

  function buildSummary(data){
    const service=serviceNames[currentLang][data.get('service')]||data.get('service');
    const level=levelNames[currentLang][data.get('level')]||data.get('level');
    if(currentLang==='ar')return `طلب مساعدة رياضيات\nالخدمة: ${service}\nالمستوى: ${level}\nلغة الشرح: ${data.get('language')||''}\nالموضوع: ${data.get('topic')||'غير محدد'}\nالتفاصيل: ${data.get('details')||''}`;
    return `Math help request\nService: ${service}\nLevel: ${level}\nExplanation language: ${data.get('language')||''}\nTopic: ${data.get('topic')||'Not specified'}\nDetails: ${data.get('details')||''}`;
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
    if(number){waBtn.hidden=false;waBtn.onclick=()=>window.open(`https://wa.me/${number}?text=${encodeURIComponent(summary)}`,'_blank','noopener');}
    else waBtn.hidden=true;
    result.scrollIntoView({behavior:'smooth',block:'nearest'});
    try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'math_request_prepared',math_service:data.get('service'),math_level:data.get('level'),page_path:location.pathname});}catch(_e){}
  });

  if(copyBtn)copyBtn.addEventListener('click',async()=>{
    const text=summaryEl.textContent||'';
    if(!text)return;
    try{await navigator.clipboard.writeText(text);copyBtn.textContent=currentLang==='ar'?'تم النسخ ✓':'Copied ✓';setTimeout(updateDynamicLabels,1800);}catch(_e){window.prompt(currentLang==='ar'?'انسخ الطلب:':'Copy the request:',text);}
  });

  document.querySelectorAll('[data-track]').forEach(el=>el.addEventListener('click',()=>{try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'math_cta_click',cta:el.dataset.track,page_path:location.pathname});}catch(_e){}}));
})();
