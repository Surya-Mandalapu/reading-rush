import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth,setPersistence,browserLocalPersistence,signInAnonymously,connectAuthEmulator,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,onSnapshot,writeBatch,increment,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {summarize,duration,MIN_SAMPLES} from './benchmark-math.js';
const app=getApps().length?getApp():initializeApp(window.DOSPREP_CONFIG.firebase),auth=getAuth(app),db=getFirestore(app,'dosprep-rooms');
if(window.DOSPREP_CONFIG.liveEmulator&&['localhost','127.0.0.1'].includes(location.hostname)){
 try{connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});}catch{}
 try{connectFirestoreEmulator(db,'127.0.0.1',8080);}catch{}
}
const counterRef=doc(db,'siteStats','answers'),bridge=window.DosPrepAnswerEvents;
let readyPromise;
function ready(){
 if(readyPromise)return readyPromise;
 readyPromise=(async()=>{await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);return auth.currentUser;})().finally(()=>{readyPromise=null;});
 return readyPromise;
}
onAuthStateChanged(auth,()=>document.dispatchEvent(new Event('dosprep-benchmark-auth')));
async function ensureCounter(){
 const snapshot=await getDoc(counterRef);if(snapshot.exists())return;
 try{await setDoc(counterRef,{count:0,solo:0,live:0,startedAt:serverTimestamp(),updatedAt:serverTimestamp()});}
 catch(error){if(!(await getDoc(counterRef)).exists())throw error;}
}
async function alreadyRecorded(ref,uid){try{return (await getDoc(ref)).exists();}catch(error){if(error.code==='permission-denied'&&auth.currentUser?.uid===uid)return true;throw error;}}
async function contribute(event){
 if(window.DOSPREP_TEST_MODE)return;
 if(!/^[A-Za-z0-9_-]{1,180}$/.test(event.id)||!/^[a-f0-9]{8}$/.test(event.questionId)||!['solo','live'].includes(event.mode))return;
 const user=await ready(),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(event.id)),id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const eventRef=doc(db,'answerContributions',id),pointer=doc(db,'contributors',user.uid);
 await ensureCounter();
 if(event.version!==2&&await alreadyRecorded(doc(db,'answerContributions',event.id),user.uid))return;
 for(let attempt=0;attempt<3;attempt++){
  if(await alreadyRecorded(eventRef,user.uid))return;
  const eligible=Boolean(event.timing&&Number.isInteger(event.seconds)&&event.seconds>=1&&event.seconds<=7200);
  // Identity is used only for private replay protection. Never store a person's time or outcome here.
  const data={uid:user.uid,questionId:event.questionId,mode:event.mode,eligible,createdAt:serverTimestamp()};
  const batch=writeBatch(db);batch.set(eventRef,data);batch.set(pointer,{lastEvent:id,updatedAt:serverTimestamp()});
  batch.update(counterRef,{count:increment(1),solo:increment(event.mode==='solo'?1:0),live:increment(event.mode==='live'?1:0),updatedAt:serverTimestamp()});
  if(eligible){
   for(const group of ['all',event.correct?'correct':'incorrect'])batch.set(doc(db,event.mode==='live'?'liveQuestionStats':'questionStats',event.questionId,'groups',group),{samples:increment(1),totalSeconds:increment(event.seconds),bins:{[String(event.seconds)]:increment(1)},updatedAt:serverTimestamp()},{merge:true});
  }
  try{await batch.commit();document.dispatchEvent(new Event('dosprep-answer-saved'));return;}
  catch(error){if(error.code!=='permission-denied'||attempt===2)throw error;}
 }
}
bridge.setSink(contribute);
class SiteCount extends HTMLElement{
 connectedCallback(){this.generation=0;this.authChanged=()=>this.load();document.addEventListener('dosprep-benchmark-auth',this.authChanged);this.load();}
 load(){const generation=++this.generation;this.stop?.();this.textContent='…';ready().then(async()=>{if(!this.isConnected||generation!==this.generation)return;await ensureCounter();if(!this.isConnected||generation!==this.generation)return;this.stop=onSnapshot(counterRef,{includeMetadataChanges:true},snapshot=>{if(snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache)return;this.textContent=Number(snapshot.data()?.count||0).toLocaleString();this.dataset.loaded='true';this.title='Recorded submissions in solo practice and Live Quiz, including retries and repeat questions.';},()=>{this.textContent='Unavailable';});}).catch(()=>{this.textContent='Unavailable';});}
 disconnectedCallback(){this.generation++;this.stop?.();document.removeEventListener('dosprep-benchmark-auth',this.authChanged);}
}
class QuestionBenchmarks extends HTMLElement{
 connectedCallback(){this.fallback=this.innerHTML;this.group='all';this.generation=0;this.authChanged=()=>this.load();document.addEventListener('dosprep-benchmark-auth',this.authChanged);this.addEventListener('click',this.handleClick);this.load();}
 disconnectedCallback(){this.generation++;this.stop?.();document.removeEventListener('dosprep-benchmark-auth',this.authChanged);this.removeEventListener('click',this.handleClick);}
 handleClick(event){const group=event.target.closest('[data-benchmark-group]')?.dataset.benchmarkGroup;if(group&&group!==this.group){this.group=group;this.load();}}
 async load(){
  const generation=++this.generation;this.stop?.();this.render(null,'Loading…');
  try{await ready();if(!this.isConnected||generation!==this.generation)return;const question=this.getAttribute('question-id');if(!/^[a-f0-9]{8}$/.test(question))return;
   this.stop=onSnapshot(doc(db,'questionStats',question,'groups',this.group),{includeMetadataChanges:true},snapshot=>{if(snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache)return;this.render(snapshot.exists()?summarize(snapshot.data()):{samples:0});},()=>this.render(null,'Benchmarks are temporarily unavailable.'));
  }catch{this.render(null,'Benchmarks are temporarily unavailable.');}
 }
 render(stats,message){
  const own=Number(this.getAttribute('your-seconds')),hasOwn=this.hasAttribute('your-seconds')&&Number.isFinite(own)&&own>=0;
  const enough=stats?.samples>=MIN_SAMPLES;
  const delta=enough&&hasOwn?Math.round(own-stats.median):0;
  const comparison=enough&&hasOwn?`<div class="your-time-comparison"><div><span>Your first try</span><strong>${duration(own)}</strong></div><div><span>Community median</span><strong>${duration(stats.median)}</strong></div><p>${delta===0?'You matched the median time.':`${duration(Math.abs(delta))} ${delta<0?'faster':'slower'} than the median.`}</p></div>`:'';
  if(this.hasAttribute('compact')){
   if(!enough){this.innerHTML=this.fallback;return;}
   const label=this.fallback.match(/Q[0-9]+/)?.[0]||'Question';
   this.innerHTML=`<div class="pacing-label">${label}</div>${comparison}<small>${stats.samples.toLocaleString()} samples · ${stats.samples<100?'Early estimate · ':''}Median of recorded attempts</small>`;return;
  }
  this.innerHTML=`<section class="card question-benchmarks"><span class="eyebrow">Community pacing · solo practice</span><h2>How long does this question take?</h2><div class="seg benchmark-groups" role="group" aria-label="Answer outcome">${[['all','All'],['correct','Correct'],['incorrect','Incorrect']].map(([key,label])=>`<button data-benchmark-group="${key}" class="${this.group===key?'selected':''}" aria-pressed="${this.group===key}">${label}</button>`).join('')}</div>${message?`<p class="muted" role="status">${message}</p>`:stats.samples<MIN_SAMPLES?`<p class="benchmark-sample-note" role="status"><b>${stats.samples} / ${MIN_SAMPLES} samples</b> · Still collecting timings for this question.</p><p class="muted">Median and mean appear after ${MIN_SAMPLES} recorded attempts in this group.</p>`:`${comparison}<div class="benchmark-metrics"><div><span>Median</span><strong>${duration(stats.median)}</strong></div><div><span>Mean</span><strong>${duration(stats.mean)}</strong></div><div><span>Middle 50%</span><strong>${duration(stats.p25)}–${duration(stats.p75)}</strong></div></div><p class="benchmark-sample-note">${stats.samples.toLocaleString()} recorded attempts${stats.samples<100?' · Early estimate':''}</p><p class="muted">Times are recorded to the nearest second. Recorded automatically, including retries and repeat questions. Pauses and hidden-tab time are excluded. Community statistics contain no account identifiers or individual timing records. Your session timer may include background-tab time. Overtime answers are included, up to two hours.</p>`}</section>`;
 }
}
customElements.define('dosprep-site-count',SiteCount);customElements.define('dosprep-question-benchmarks',QuestionBenchmarks);
