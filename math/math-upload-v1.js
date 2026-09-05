(()=>{
  const original=document.querySelector('[data-form]');
  if(!original)return;

  const form=original.cloneNode(true);
  original.replaceWith(form);

  const oldResult=form.querySelector('[data-result]');
  if(oldResult)oldResult.remove();

  const contact=document.createElement('div');
  contact.className='upload-contact';
  contact.innerHTML=`
    <div class="row">
      <label><span data-upload-t="nameLabel">الاسم</span><input name="customer_name" type="text" maxlength="100" autocomplete="name" placeholder="اسمك" data-upload-ph="name"></label>
      <label><span data-upload-t="emailLabel">البريد الإلكتروني *</span><input name="customer_email" type="email" maxlength="180" autocomplete="email" required placeholder="name@example.com" data-upload-ph="email"></label>
    </div>
    <label><span data-upload-t="filesLabel">أرفق ملفاتك أو صور المسائل</span></label>
    <div class="upload-zone" data-dropzone>
      <div class="upload-icon">↑</div>
      <strong data-upload-t="dropTitle">اضغط لاختيار الملفات أو اسحبها هنا</strong>
      <small data-upload-t="dropHelp">PDF، صور، Word، Excel أو PowerPoint — حتى 5 ملفات</small>
      <input name="files[]" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx" data-files>
    </div>
    <div class="upload-files" data-file-list hidden></div>
    <p class="upload-limit" data-upload-t="limit">الحد الأقصى: 6 MB للملف الواحد و12 MB لجميع الملفات.</p>
    <div class="upload-privacy"><i>🔒</i><span data-upload-t="privacy">تُستخدم الملفات لمراجعة طلبك فقط، وتُحفظ نسخة احتياطية خاصة لمدة محدودة.</span></div>
    <input type="text" name="website" value="" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
    <input type="hidden" name="page_lang" value="ar" data-page-lang>
  `;

  const detailsLabel=form.querySelector('textarea[name="details"]')?.closest('label');
  if(detailsLabel)detailsLabel.insertAdjacentElement('afterend',contact);
  else form.prepend(contact);

  const submit=form.querySelector('button[type="submit"]');
  if(submit){submit.classList.add('upload-submit');submit.textContent='إرسال الطلب والملفات';}
  const note=form.querySelector('.form-note');
  if(note)note.textContent='بعد الإرسال سيصلك بريد تلقائي يؤكد استلام الطلب. لن يتم تحصيل أي مبلغ قبل تأكيد السعر.';

  const status=document.createElement('div');
  status.className='upload-status';
  status.hidden=true;
  form.append(status);

  const fileInput=form.querySelector('[data-files]');
  const fileList=form.querySelector('[data-file-list]');
  const zone=form.querySelector('[data-dropzone]');
  const langHidden=form.querySelector('[data-page-lang]');
  const langBtn=document.querySelector('[data-lang]');

  const strings={
    ar:{nameLabel:'الاسم',namePh:'اسمك',emailLabel:'البريد الإلكتروني *',emailPh:'name@example.com',filesLabel:'أرفق ملفاتك أو صور المسائل',dropTitle:'اضغط لاختيار الملفات أو اسحبها هنا',dropHelp:'PDF، صور، Word، Excel أو PowerPoint — حتى 5 ملفات',limit:'الحد الأقصى: 6 MB للملف الواحد و12 MB لجميع الملفات.',privacy:'تُستخدم الملفات لمراجعة طلبك فقط، وتُحفظ نسخة احتياطية خاصة لمدة محدودة.',submit:'إرسال الطلب والملفات',sending:'جارٍ إرسال الطلب...',note:'بعد الإرسال سيصلك بريد تلقائي يؤكد استلام الطلب. لن يتم تحصيل أي مبلغ قبل تأكيد السعر.',tooMany:'يمكنك رفع 5 ملفات كحد أقصى.',tooLarge:'حجم الملفات أكبر من الحد المسموح.',badType:'نوع أحد الملفات غير مدعوم.',successTitle:'تم استلام طلبك بنجاح ✓',successText:'أرسلنا رسالة تأكيد تلقائية إلى بريدك الإلكتروني.',ref:'رقم الطلب',errorTitle:'تعذر إرسال الطلب',errorText:'تحقق من البيانات وحاول مرة أخرى.'},
    en:{nameLabel:'Name',namePh:'Your name',emailLabel:'Email address *',emailPh:'name@example.com',filesLabel:'Attach your files or problem images',dropTitle:'Tap to choose files or drop them here',dropHelp:'PDF, images, Word, Excel or PowerPoint — up to 5 files',limit:'Maximum: 6 MB per file and 12 MB total.',privacy:'Files are used only to review your request and a private backup is kept for a limited time.',submit:'Send Request & Files',sending:'Sending your request...',note:'You will receive an automatic confirmation email after submitting. No payment is collected before the price is confirmed.',tooMany:'You can upload up to 5 files.',tooLarge:'The selected files exceed the upload limit.',badType:'One of the selected file types is not supported.',successTitle:'Your request was received ✓',successText:'An automatic confirmation email has been sent to your email address.',ref:'Request ID',errorTitle:'Could not send the request',errorText:'Please check the details and try again.'}
  };

  const allowed=['pdf','jpg','jpeg','png','webp','heic','heif','doc','docx','xls','xlsx','ppt','pptx'];
  const maxEach=6*1024*1024,maxTotal=12*1024*1024,maxFiles=5;

  function lang(){return document.documentElement.lang==='en'?'en':'ar'}
  function applyLang(){
    const l=lang(),s=strings[l];
    if(langHidden)langHidden.value=l;
    form.querySelectorAll('[data-upload-t]').forEach(el=>{const k=el.dataset.uploadT;const map={nameLabel:'nameLabel',emailLabel:'emailLabel',filesLabel:'filesLabel',dropTitle:'dropTitle',dropHelp:'dropHelp',limit:'limit',privacy:'privacy'};if(map[k])el.textContent=s[map[k]]});
    const name=form.querySelector('[data-upload-ph="name"]'),email=form.querySelector('[data-upload-ph="email"]');
    if(name)name.placeholder=s.namePh;if(email)email.placeholder=s.emailPh;
    if(submit&&!submit.disabled)submit.textContent=s.submit;
    if(note)note.textContent=s.note;
  }

  function ext(name){return (name.split('.').pop()||'').toLowerCase()}
  function validateFiles(files){
    const s=strings[lang()];
    if(files.length>maxFiles)return s.tooMany;
    let total=0;
    for(const f of files){
      if(!allowed.includes(ext(f.name)))return s.badType;
      if(f.size>maxEach)return s.tooLarge;
      total+=f.size;
    }
    if(total>maxTotal)return s.tooLarge;
    return '';
  }
  function human(bytes){if(bytes<1024)return bytes+' B';if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';return (bytes/1048576).toFixed(1)+' MB'}
  function renderFiles(){
    const files=[...(fileInput?.files||[])];
    if(!fileList)return;
    if(!files.length){fileList.hidden=true;fileList.innerHTML='';return;}
    fileList.hidden=false;fileList.innerHTML=files.map(f=>`<div class="upload-file"><span>${f.name.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span><small>${human(f.size)}</small></div>`).join('');
  }
  if(fileInput)fileInput.addEventListener('change',renderFiles);
  if(zone&&fileInput){
    ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag')}));
    ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag')}));
    zone.addEventListener('drop',e=>{if(e.dataTransfer?.files){const dt=new DataTransfer();[...e.dataTransfer.files].slice(0,maxFiles).forEach(f=>dt.items.add(f));fileInput.files=dt.files;renderFiles();}});
  }

  if(langBtn)langBtn.addEventListener('click',()=>setTimeout(applyLang,0));
  applyLang();

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const files=[...(fileInput?.files||[])];
    const problem=validateFiles(files);
    const s=strings[lang()];
    if(problem){status.hidden=false;status.className='upload-status error';status.innerHTML=`<strong>${s.errorTitle}</strong>${problem}`;return;}
    if(submit){submit.disabled=true;submit.textContent=s.sending;}
    status.hidden=true;
    try{
      const fd=new FormData(form);
      fd.set('page_lang',lang());
      const res=await fetch('/math/submit-request.php',{method:'POST',body:fd,headers:{'Accept':'application/json'}});
      let data={};try{data=await res.json()}catch(_e){}
      if(!res.ok||!data.ok)throw new Error(data.message||s.errorText);
      status.hidden=false;status.className='upload-status success';status.innerHTML=`<strong>${s.successTitle}</strong>${s.successText}<br><b>${s.ref}: ${data.request_id||''}</b>`;
      form.reset();renderFiles();applyLang();
      try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'math_request_submitted',request_id:data.request_id||'',language:lang(),files_count:files.length});}catch(_e){}
      status.scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(err){
      status.hidden=false;status.className='upload-status error';status.innerHTML=`<strong>${s.errorTitle}</strong>${String(err.message||s.errorText)}`;
    }finally{if(submit){submit.disabled=false;submit.textContent=s.submit;}}
  });
})();