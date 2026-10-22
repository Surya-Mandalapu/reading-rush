(function(){
 'use strict';
 const consentKey='dosprep-benchmark-consent',queueKey='dosprep-answer-queue';
 let queue=[],sink=null,sending=false,retryTimer=null,clock=null;
 try{queue=JSON.parse(localStorage.getItem(queueKey)||'[]').filter(e=>Date.now()-e.queuedAt<86400000).slice(-100);}catch{}
 function save(){try{localStorage.setItem(queueKey,JSON.stringify(queue));}catch{}}
 function consent(){try{return localStorage.getItem(consentKey)||'unknown';}catch{return 'denied';}}
 function flush(){if(clock?.since!==null&&clock?.since!==undefined){clock.ms+=Math.max(0,Date.now()-clock.since);clock.since=null;}}
 function resumeClock(){if(clock&&!clock.paused&&!document.hidden&&clock.since===null)clock.since=Date.now();}
 function enqueue(event){
  if(window.DOSPREP_TEST_MODE)return;
  if(!queue.some(item=>item.id===event.id)){queue.push({...event,queuedAt:Date.now()});queue=queue.slice(-100);save();}drain();
 }
 async function drain(){
  if(!sink||sending||!navigator.onLine)return;sending=true;clearTimeout(retryTimer);
  try{while(queue.length){const item=queue[0];await sink(item);queue=queue.filter(e=>e.id!==item.id);save();}}
  catch(error){console.warn('Community contribution pending:',error.code||error.message);retryTimer=setTimeout(drain,30000);}finally{sending=false;}
 }
 window.DosPrepAnswerEvents={
  consent,
  setConsent(value){try{localStorage.setItem(consentKey,value);}catch{}if(value!=='granted'){queue=queue.map(e=>({...e,timing:false,seconds:0,correct:false}));save();}document.dispatchEvent(new Event('dosprep-benchmark-consent'));},
  begin(id,questionId){if(clock?.id===id)return;clock={id,questionId,ms:0,since:document.hidden?null:Date.now(),paused:false};},
  pause(){flush();if(clock)clock.paused=true;},
  resume(){if(clock)clock.paused=false;resumeClock();},
  solo(id,questionId,correct,actualSeconds,previouslySeen=false){
   const matching=clock?.id===id;flush();const seconds=matching?Math.round(Math.min(clock.ms/1000,actualSeconds)):0;
   const timing=consent()==='granted'&&!previouslySeen&&matching&&seconds>=1&&seconds<=7200;clock=null;
   enqueue({id,questionId,mode:'solo',timing,seconds:timing?seconds:0,correct:timing?Boolean(correct):false});
  },
  live(id,questionId){enqueue({id,questionId,mode:'live',timing:false,seconds:0,correct:false});},
  setSink(fn){sink=fn;drain();},drain
 };
 document.addEventListener('visibilitychange',()=>{flush();resumeClock();});window.addEventListener('online',drain);
 window.addEventListener('storage',event=>{if(event.key===consentKey){if(consent()!=='granted'){queue=queue.map(e=>({...e,timing:false,seconds:0,correct:false}));save();}document.dispatchEvent(new Event('dosprep-benchmark-consent'));}});
})();
