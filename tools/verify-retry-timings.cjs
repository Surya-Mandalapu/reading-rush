const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let now=100000;
 const storage=new Map([['dosprep-answer-queue',JSON.stringify([{id:'solo_old_0_retry_1',questionId:'deadbeef',mode:'solo',timing:true,seconds:9,correct:true,queuedAt:now,version:2}])]]);
 const context=vm.createContext({window:{},document:{hidden:false,addEventListener(){}},navigator:{onLine:true},console,Date:class extends Date{static now(){return now;}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},setTimeout(){},clearTimeout(){}});
 context.window.addEventListener=()=>{};
 vm.runInContext(fs.readFileSync('app/answer-events.js','utf8'),context);
 const bridge=context.window.DosPrepAnswerEvents;
 bridge.begin('solo_first_0','deadbeef');now+=5000;bridge.solo('solo_first_0','deadbeef',false,5);
 bridge.begin('solo_first_0_retry_1','deadbeef');now+=9000;bridge.solo('solo_first_0_retry_1','deadbeef',true,14);
 bridge.begin('solo_newround_0','deadbeef');now+=6000;bridge.solo('solo_newround_0','deadbeef',true,6);
 const queue=JSON.parse(storage.get('dosprep-answer-queue'));
 assert.equal(queue.length,4,'Keep every submission, including retries');
 for(const retry of queue.filter(e=>e.id.includes('_retry_')))assert.deepEqual({timing:retry.timing,seconds:retry.seconds,correct:retry.correct},{timing:false,seconds:0,correct:false});
 assert.deepEqual(queue.filter(e=>e.timing).map(e=>e.seconds),[5,6]);

 // Execute the actual contribution function against an in-memory batch adapter.
 // No Firebase requests or real visitor/answer statistics are created.
 const data=new Map([['siteStats/answers',{count:0}]]);
 const statsContext=vm.createContext({window:{},db:{},counterRef:'siteStats/answers',ready:async()=>({uid:'test-user'}),crypto:require('node:crypto').webcrypto,TextEncoder,document:{dispatchEvent(){}},Event,ensureCounter:async()=>{},alreadyRecorded:async path=>data.has(path),doc:(_, ...segments)=>segments.join('/'),increment:n=>({increment:n}),serverTimestamp:()=>null,writeBatch:()=>{
  const ops=[];return {set:(path,value)=>ops.push({path,value}),update:(path,value)=>ops.push({path,value}),commit:async()=>{for(const {path,value} of ops){const current=data.get(path)||{};for(const [key,item] of Object.entries(value))current[key]=item&&typeof item==='object'&&'increment'in item?(current[key]||0)+item.increment:item;data.set(path,current);}}};
 }});
 const source=fs.readFileSync('app/benchmarks.js','utf8');
 vm.runInContext(source.slice(source.indexOf('async function contribute('),source.indexOf('bridge.setSink(')),statsContext);
 const send=(id,timing=true)=>statsContext.contribute({id,questionId:'deadbeef',mode:'solo',timing,seconds:10,correct:true,version:2});
 for(let i=0;i<19;i++)await send('solo_round'+i+'_0');
 for(let i=1;i<=5;i++)await send('solo_round0_0_retry_'+i);
 const stats=data.get('questionStats/deadbeef/groups/all');
 assert.equal(stats.samples,19,'Retries cannot unlock the 20-sample comparison');
 assert.equal(stats.totalSeconds,190);
 assert.equal(data.get('siteStats/answers').count,24,'Retries still count toward total answers');
 await send('solo_round19_0');assert.equal(stats.samples,20);assert.equal(stats.totalSeconds/20,10);
 assert.deepEqual(Object.keys(data.get('answerContributions/'+require('node:crypto').createHash('sha256').update('solo_round0_0_retry_1').digest('hex'))).sort(),['createdAt','eligible','mode','questionId','uid']);
 console.log('PASS: new and offline retries stay recorded but cannot change community samples, mean, or the 20-sample threshold; normal repeat sessions remain eligible; contribution markers contain no times/outcomes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
