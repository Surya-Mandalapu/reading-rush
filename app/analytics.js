(function(){
 'use strict';
 const config=window.DOSPREP_CONFIG||{},key='dosprep-analytics-consent';
 let enabled=false;
 function choice(){try{return localStorage.getItem(key);}catch{return 'denied';}}
 function track(name,params={}){
  if(!enabled)return;
  const allowed={practice_start:['subject','pace','question_count'],practice_complete:['subject','pace','question_count'],view_insights:['subject'],login:['method'],sign_up:['method']};
  if(!allowed[name])return;
  const clean={};allowed[name].forEach(k=>{if(typeof params[k]==='string'||typeof params[k]==='number')clean[k]=params[k];});
  window.gtag('event',name,clean);
 }
 function activate(){
  if(enabled||choice()!=='granted'||!/^G-[A-Z0-9]+$/.test(config.measurementId||''))return;
  if(!document.getElementById('pulse-consented-tracker')){const p=document.createElement('script');p.id='pulse-consented-tracker';p.src='https://project-pulse-events-surya.creamymango256.chatgpt.site/pulse.js';p.dataset.project='dosprep';p.dataset.consentKey=key;document.head.appendChild(p);}
  enabled=true;window['ga-disable-'+config.measurementId]=false;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());
  window.gtag('config',config.measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
  window.gtag('event','page_view',{page_title:document.title,page_location:location.origin+location.pathname});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(config.measurementId);document.head.appendChild(script);
 }
 function save(value){try{localStorage.setItem(key,value);}catch{}document.getElementById('analytics-choice')?.remove();if(value==='granted')activate();else if(enabled){window['ga-disable-'+config.measurementId]=true;enabled=false;}}
 function settings(){
  if(!config.measurementId)return;
  document.getElementById('analytics-choice')?.remove();
  const bar=document.createElement('section');bar.id='analytics-choice';bar.className='analytics-choice';bar.setAttribute('aria-label','Analytics preference');
  bar.innerHTML='<div><b>Help improve DosPrep?</b><p>Allow usage analytics to understand which features people use. Question answers and account emails are never included. <a href="privacy.html">Privacy details</a></p></div><button data-consent="denied">No thanks</button><button class="primary" data-consent="granted">Allow analytics</button>';
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-consent]');if(b)save(b.dataset.consent);});document.body.appendChild(bar);
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-analytics-settings]')){e.preventDefault();settings();}});
 window.DosPrepAnalytics={track,settings};
 if(choice()==='granted')activate();else if(!choice()&&/^G-[A-Z0-9]+$/.test(config.measurementId||''))settings();
})();
