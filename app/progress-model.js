const qid=value=>typeof value==='string'&&/^[a-f0-9]{8}$/.test(value);
export function validSession(h){
 return h&&typeof h.id==='string'&&h.id.length>0&&h.id.length<=180&&Number.isFinite(Date.parse(h.date))&&['Relaxed','Steady','Blitz'].includes(h.pace)&&Number.isInteger(h.best)&&h.best>=0&&Array.isArray(h.answers)&&h.answers.length>0&&h.answers.length<=10000&&h.answers.every(a=>qid(a.id)&&typeof a.correct==='boolean'&&Number.isFinite(a.seconds)&&a.seconds>=0&&a.seconds<1e9&&Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3&&typeof a.skill==='string'&&a.skill.length<=150&&['Easy','Medium','Hard'].includes(a.difficulty)&&(!a.selected||typeof a.selected==='string'&&a.selected.length<=80));
}
export function flatten(progress){
 const records=new Map();
 for(const h of progress.history||[])if(validSession(h))records.set('session:'+h.id,{kind:'session',key:h.id,value:JSON.stringify(h)});
 for(const id of progress.flags||[])if(qid(id))records.set('flag:'+id,{kind:'flag',key:id,value:'true'});
 for(const [id,marks] of Object.entries(progress.highlights||{}))if(qid(id)&&Array.isArray(marks)&&marks.every(m=>typeof m==='string'&&/^\d+:\d+$/.test(m)))records.set('highlight:'+id,{kind:'highlight',key:id,value:JSON.stringify(marks)});
 return records;
}
export function materialize(records){
 const progress={history:[],flags:[],highlights:{}};
 for(const record of Object.values(records)){
  if(record.deleted)continue;
  try{const value=JSON.parse(record.value);
   if(record.kind==='session'&&validSession(value)&&value.id===record.key)progress.history.push(value);
   else if(record.kind==='flag'&&qid(record.key)&&value===true)progress.flags.push(record.key);
   else if(record.kind==='highlight'&&qid(record.key)&&Array.isArray(value)&&value.every(m=>typeof m==='string'&&/^\d+:\d+$/.test(m)))progress.highlights[record.key]=value;
  }catch{}
 }
 progress.history.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||a.id.localeCompare(b.id));return progress;
}
export function compare(a,b){return a.changedAt-b.changedAt||a.revision.localeCompare(b.revision);}
export function chunks(value){const chars=Array.from(value),result=[];for(let i=0;i<chars.length;i+=50000)result.push(chars.slice(i,i+50000).join(''));return result.length?result:[''];}
export async function recordId(kind,key){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));return kind+'_'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
