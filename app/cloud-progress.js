import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFirestore,connectFirestoreEmulator,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {flatten,materialize,compare,chunks,recordId} from './progress-model.js';
const app=getApps().length?getApp():initializeApp(window.DOSPREP_CONFIG.firebase),auth=getAuth(app),db=getFirestore(app,'dosprep-rooms');
if(window.DOSPREP_CONFIG.liveEmulator&&['localhost','127.0.0.1'].includes(location.hostname)){try{connectFirestoreEmulator(db,'127.0.0.1',8080);}catch{}}
let state=null,stop=null,timer=null,status='Guest · saved on this device';
function show(text){status=text;document.querySelectorAll('[data-cloud-status]').forEach(el=>el.textContent=text);document.dispatchEvent(new Event('dosprep-cloud-status'));}
function store(s){try{const records=Object.fromEntries(Object.entries(s.records).map(([key,{value,...metadata}])=>[key,metadata]));localStorage.setItem('dosprep-cloud-ledger-'+s.uid,JSON.stringify({records,pending:s.pending}));}catch{show('Local backup full · keep this tab open until synced');}}
function current(s){return state===s&&auth.currentUser?.uid===s.uid&&!auth.currentUser?.isAnonymous;}
function updateStatus(s){if(!current(s))return;show(!navigator.onLine?'Offline · changes saved on this device':!s.loaded?'Connecting progress…':Object.keys(s.pending).length?'Saving progress…':'Progress synced');}
function publish(s){if(!current(s))return;const progress=materialize(s.records);s.baseline=flatten(progress);store(s);s.apply(progress);updateStatus(s);}
function queue(s,record){const key=record.kind+':'+record.key;s.records[key]=record;s.pending[key]=record;}
function capture(progress){
 const s=state;if(!s||!current(s))return;const next=flatten(progress);
 for(const [key,value] of next){if(s.baseline.get(key)?.value!==value.value)queue(s,{...value,deleted:false,changedAt:Math.max(Date.now(),(s.records[key]?.changedAt||0)+1),revision:crypto.randomUUID()});}
 for(const [key,value] of s.baseline){if(!next.has(key))queue(s,{...value,value:'',deleted:true,changedAt:Math.max(Date.now(),(s.records[key]?.changedAt||0)+1),revision:crypto.randomUUID()});}
 s.baseline=next;store(s);updateStatus(s);clearTimeout(timer);timer=setTimeout(()=>drain(s),750);
}
async function drain(s){
 if(!current(s)||!s.loaded||s.sending||!navigator.onLine)return;s.sending=true;
 try{
  while(current(s)&&Object.keys(s.pending).length){
   const [key,record]=Object.entries(s.pending)[0],parts=chunks(record.value);if(parts.length>256)throw Error('progress-too-large');
   const id=await recordId(record.kind,record.key);if(!current(s))return;
   await runTransaction(db,async transaction=>{
    const first=await transaction.get(doc(db,'userProgress',s.uid,'records',id+'_0'));
    if(first.exists()&&(record.migration||compare(first.data(),record)>0))return;
    parts.forEach((value,part)=>transaction.set(doc(db,'userProgress',s.uid,'records',id+'_'+part),{kind:record.kind,key:record.key,part,parts:parts.length,value,deleted:record.deleted,revision:record.revision,changedAt:record.changedAt,updatedAt:serverTimestamp()}));
   });if(!current(s))return;
   if(s.pending[key]?.revision===record.revision)delete s.pending[key];
   if(s.records[key]?.revision===record.revision)delete s.records[key].migration;
   store(s);
  }
  updateStatus(s);
 }catch(error){if(current(s)){console.warn('Progress sync pending:',error.code||error.message);show(error.code==='resource-exhausted'?'Cloud quota reached · saved on this device':error.message==='progress-too-large'?'Progress is too large to sync · export a backup':'Sync paused · saved on this device. Reconnecting…');clearTimeout(timer);timer=setTimeout(()=>drain(s),30000);}}
 finally{s.sending=false;}
}
function connect(uid,progress,apply){
 if(state?.uid===uid)return;
 stop?.();stop=null;clearTimeout(timer);state=null;
 if(!uid){show('Guest · saved on this device');return;}
 let ledger={};try{ledger=JSON.parse(localStorage.getItem('dosprep-cloud-ledger-'+uid)||'{}');}catch{}
 const s=state={uid,records:ledger.records||{},pending:ledger.pending||{},baseline:flatten(progress),apply,loaded:false,sending:false};
 for(const [key,record] of Object.entries(s.records))s.records[key]=s.pending[key]||{...record,value:record.deleted?'':s.baseline.get(key)?.value||record.value||''};
 // Migrate existing account data only where the server has no record, including tombstones.
 for(const [key,value] of s.baseline)if(!s.records[key])queue(s,{...value,deleted:false,changedAt:Date.now(),revision:crypto.randomUUID(),migration:true});
 store(s);updateStatus(s);
 stop=onSnapshot(collection(db,'userProgress',uid,'records'),{includeMetadataChanges:true},snapshot=>{
  if(!current(s)||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
  const grouped=new Map();
  for(const document of snapshot.docs){const r=document.data(),key=r.kind+':'+r.key,old=grouped.get(key);if(!old||compare(r,old[0])>0)grouped.set(key,[r]);else if(r.revision===old[0].revision)old.push(r);}
  for(const [key,group] of grouped){const first=group[0],parts=group.filter(r=>r.revision===first.revision).sort((a,b)=>a.part-b.part);
   if(parts.length!==first.parts||parts.some((r,i)=>r.part!==i))continue;
   const remote={kind:first.kind,key:first.key,deleted:first.deleted,revision:first.revision,changedAt:first.changedAt,value:parts.map(r=>r.value).join('')},local=s.records[key];
   if(!local||local.migration||compare(remote,local)>=0){s.records[key]=remote;if(s.pending[key]&&(s.pending[key].migration||compare(remote,s.pending[key])>=0))delete s.pending[key];}
  }
  s.loaded=true;publish(s);drain(s);
 },error=>{if(current(s)){console.warn('Progress connection:',error.code);show('Cloud unavailable · saved on this device. Reload to reconnect.');}});
}
window.DosPrepCloudProgress={connect,save:capture,get status(){return status;},retry(){if(state)drain(state);}};
window.addEventListener('online',()=>{if(state){updateStatus(state);drain(state);}});window.addEventListener('offline',()=>{if(state)updateStatus(state);});
document.dispatchEvent(new Event('dosprep-cloud-ready'));
