import {validSession,compare} from './progress-model.js';
const fixed=new Set(['reading-rush-v1','dosprep-answer-queue','dosprep-reading-size','dosprep-analytics-consent','dosprep-live-room','project-pulse-browser-v1']);
export const allowedKey=key=>fixed.has(key)||/^dosprep-(progress|cloud-ledger)-[A-Za-z0-9_-]{1,128}$/.test(key);
export function snapshot(storage,source){
 const entries=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(allowedKey(key))entries.push([key,storage.getItem(key)]);}
 entries.sort(([a],[b])=>a.localeCompare(b));return {version:1,source,createdAt:Date.now(),entries};
}
export function validateBundle(bundle,source){
 if(!bundle||bundle.version!==1||bundle.source!==source||!Array.isArray(bundle.entries)||JSON.stringify(bundle).length>12000000)throw Error('Invalid DosPrep browser backup.');
 const seen=new Set();for(const entry of bundle.entries){if(!Array.isArray(entry)||entry.length!==2||!allowedKey(entry[0])||typeof entry[1]!=='string'||seen.has(entry[0]))throw Error('Backup contains an unsupported or duplicate storage key.');seen.add(entry[0]);}
 return bundle;
}
function progress(text){
 const p=JSON.parse(text||'{}');
 if(!p||!Array.isArray(p.history||[])||!(p.history||[]).every(validSession)||!Array.isArray(p.flags||[])||!(p.flags||[]).every(id=>typeof id==='string')||!p.highlights&&p.highlights!==undefined||p.highlights&&typeof p.highlights!=='object')throw Error('Study progress is invalid. Export the original browser backup before continuing.');
 return {history:p.history||[],flags:p.flags||[],highlights:p.highlights||{}};
}
function mergeProgress(current,incoming){
 const a=progress(current),b=progress(incoming),history=new Map(a.history.map(h=>[h.id,h]));
 for(const h of b.history){const old=history.get(h.id);const weight=x=>x.answers.length*100000+x.answers.reduce((n,a)=>n+(a.retryCount||0),0);if(!old||weight(h)>weight(old)||weight(h)===weight(old)&&Date.parse(h.date)>Date.parse(old.date))history.set(h.id,h);}
 const highlights=Object.create(null);for(const p of [a,b])for(const [id,marks] of Object.entries(p.highlights)){if(!Array.isArray(marks)||!marks.every(m=>typeof m==='string'))throw Error('Invalid highlights.');highlights[id]=[...new Set([...(highlights[id]||[]),...marks])];}
 return JSON.stringify({history:[...history.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)),flags:[...new Set([...a.flags,...b.flags])],highlights});
}
function ledger(text){
 const l=JSON.parse(text||'{}');for(const group of ['records','pending']){if(l[group]&&typeof l[group]!=='object')throw Error('Invalid pending cloud data.');for(const [key,r] of Object.entries(l[group]||{}))if(!r||!['session','flag','highlight'].includes(r.kind)||typeof r.key!=='string'||key!==r.kind+':'+r.key||!Number.isFinite(r.changedAt)||typeof r.revision!=='string'||group==='pending'&&typeof r.value!=='string')throw Error('Invalid pending cloud record.');}
 return {records:l.records||{},pending:l.pending||{}};
}
function mergeLedger(current,incoming){
 const a=ledger(current),b=ledger(incoming),records=Object.create(null),pending=Object.create(null);
 for(const l of [a,b])for(const [key,r] of Object.entries({...l.records,...l.pending}))if(!records[key]||compare(r,records[key])>0)records[key]=r;
 for(const l of [a,b])for(const [key,r] of Object.entries(l.pending))if(records[key].revision===r.revision)pending[key]=r;
 return JSON.stringify({records,pending});
}
function mergeQueue(current,incoming){
 const events=new Map();for(const value of [current,incoming]){const queue=JSON.parse(value||'[]');if(!Array.isArray(queue))throw Error('Invalid queued statistics.');for(const event of queue){if(typeof event.id!=='string'||!Number.isFinite(event.queuedAt))throw Error('Invalid queued submission.');events.set(event.id,event);}}
 // Do not silently discard pending entries; the normal recorder applies its documented retention policy.
 if(events.size>100)throw Error('Both browsers have queued submissions. Sync their statistics before moving to avoid dropping pending answers.');
 return JSON.stringify([...events.values()].sort((a,b)=>a.queuedAt-b.queuedAt));
}
export function importBundle(storage,bundle,source){
 validateBundle(bundle,source);const writes=new Map();
 for(const [key,value] of bundle.entries){const old=storage.getItem(key);
  if(key==='reading-rush-v1'||key.startsWith('dosprep-progress-'))writes.set(key,mergeProgress(old,value));
  else if(key.startsWith('dosprep-cloud-ledger-'))writes.set(key,mergeLedger(old,value));
  else if(key==='dosprep-answer-queue')writes.set(key,mergeQueue(old,value));
  // A destination guest identity cannot resume an old-origin anonymous room. The full backup retains its code.
  else if(key==='dosprep-live-room')continue;
  else if(old===null)writes.set(key,value);
 }
 const id=crypto.randomUUID(),backupKey='dosprep-migration-backup-'+id;
 writes.set(backupKey,JSON.stringify(bundle));writes.set('dosprep-migration-received',JSON.stringify({id,at:Date.now(),source}));
 const previous=new Map([...writes.keys()].map(key=>[key,storage.getItem(key)])),written=[];
 try{for(const [key,value] of writes){storage.setItem(key,value);written.push(key);}}
 catch(error){for(const key of written)storage.removeItem(key);for(const [key,value] of previous)if(value!==null)storage.setItem(key,value);throw Error('Browser storage is full or unavailable. No transfer was completed. Download a backup on the old site and keep its browser data.');}
 return id;
}
export function destination(location,settings){
 const path=location.pathname.startsWith(settings.oldBasePath)?location.pathname.slice(settings.oldBasePath.length):'';
 const result=new URL(settings.targetOrigin);result.pathname='/'+path;result.search=location.search;result.hash=location.hash;return result.href;
}
