let playwright;try{playwright=require('playwright');}catch{playwright=require('./browser-check/node_modules/playwright');}
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BENCHMARK_URL||'http://127.0.0.1:8876/practice.html';
(async()=>{
 // Clear only the local emulator's disposable data; never a production endpoint.
 const cleared=await fetch('http://127.0.0.1:8080/emulator/v1/projects/dosprep-study-a7f31/databases/dosprep-rooms/documents',{method:'DELETE'});assert.ok(cleared.ok);
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE}),context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await context.route('**/site-config.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('app/site-config.js','utf8')+'\nwindow.DOSPREP_CONFIG={...window.DOSPREP_CONFIG,liveEmulator:true,authEmulator:true};'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().includes('Community contribution'))console.log('Browser:',m.text().slice(0,1200));});
 async function data(path){return page.evaluate(async path=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');const snapshot=await f.getDoc(f.doc(f.getFirestore(undefined,'dosprep-rooms'),...path.split('/')));return snapshot.exists()?snapshot.data():null;},path);}
 async function waitCount(count){for(let i=0;i<60;i++){const r=await fetch('http://127.0.0.1:8080/v1/projects/dosprep-study-a7f31/databases/dosprep-rooms/documents/siteStats/answers',{headers:{Authorization:'Bearer owner'}});const data=await r.json();if(Number(data.fields?.count?.integerValue)===count)return;await new Promise(r=>setTimeout(r,200));}throw Error('Server counter did not reach '+count);}
 async function choose(correct){const key=await page.evaluate(correct=>{const key=session.qs[session.index].correct;return correct?key:key==='A'?'B':'A';},correct);await page.click(`[data-choice=${key}]`);await page.click('[data-action=submit]');}
 try{
  await page.goto(base);if(await page.locator('[data-consent=denied]').count())await page.click('[data-consent=denied]');
  await page.waitForSelector('dosprep-site-count[data-loaded=true]');assert.equal(await page.locator('dosprep-site-count').innerText(),'0');
  await page.click('[data-action=start]');await page.waitForFunction(()=>session.questionStarted!==null);await page.clock.install();await page.clock.fastForward(5000);await choose(false);await waitCount(1);
  assert.match(await page.locator('.benchmark-sample-note').innerText(),/0 \/ 20/);console.log('Default-off count and empty benchmark passed');
  await page.click('[data-action=retry]');await choose(true);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dosprep-answer-queue')||'[]').length===0);assert.equal((await data('siteStats/answers')).count,1);
  await page.evaluate(()=>finish());await page.click('[data-action=setup]');await page.click('[data-benchmark-consent=granted]');await page.check('#skip');
  await page.click('[data-action=start]');await page.waitForFunction(()=>session.questionStarted!==null);const question=await page.evaluate(()=>session.qs[0].id);
  await page.clock.fastForward(10000);await page.click('[data-action=pause]');await page.clock.fastForward(30000);await page.click('[data-action=resume]');await page.clock.fastForward(5000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(60000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(5000);await choose(true);await waitCount(2);
  let stats=await data(`questionStats/${question}/groups/all`);assert.ok(stats,'Opt-in sample was not saved');assert.equal(stats.samples,1);assert.ok(stats.totalSeconds>=19&&stats.totalSeconds<=22,`active seconds ${stats.totalSeconds}`);assert.ok(await page.evaluate(()=>session.answers[0].seconds)>75);
  console.log('Opt-in visible time excludes pauses/hidden time and includes overtime');
  // Seed 19 different emulator identities using the same guarded batch shape.
  const seeded=await page.evaluate(async question=>{
   const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),authSDK=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');
   async function write(index,bad=false,existing=null){
    const app=existing?.app||a.initializeApp(window.DOSPREP_CONFIG.firebase,'sample-'+index+'-'+crypto.randomUUID()),auth=authSDK.getAuth(app),db=f.getFirestore(app,'dosprep-rooms');
    if(!existing){authSDK.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});f.connectFirestoreEmulator(db,'127.0.0.1',8080);await authSDK.signInAnonymously(auth);}
    const uid=auth.currentUser.uid,id='sample_'+crypto.randomUUID(),seconds=index,correct=index%2===0,group=correct?'correct':'incorrect',batch=f.writeBatch(db);
    batch.set(f.doc(db,'answerContributions',id),{uid,questionId:question,mode:'solo',eligible:true,seconds,correct,createdAt:f.serverTimestamp()});
    batch.set(f.doc(db,'contributors',uid),{lastEvent:id,updatedAt:f.serverTimestamp()});batch.set(f.doc(db,'timingParticipants',uid,'questions',question),{eventId:id,createdAt:f.serverTimestamp()});
    batch.update(f.doc(db,'siteStats','answers'),{count:f.increment(1),solo:f.increment(1),live:f.increment(0),updatedAt:f.serverTimestamp()});
    for(const g of ['all',group])batch.set(f.doc(db,'questionStats',question,'groups',g),{samples:f.increment(1),totalSeconds:f.increment(seconds),bins:{[String(bad?seconds+1:seconds)]:f.increment(1)},updatedAt:f.serverTimestamp()},{merge:true});
    try{await batch.commit();return {uid,id,allowed:true,appName:app.name};}catch(error){return {allowed:false,code:error.code,appName:app.name};}finally{if(!existing&&index!==1)await f.terminate(db);}
   }
   window.seedTiming=write;
   const results=[];for(let i=1;i<=19;i++)results.push(await write(i));return results;
  },question);
  assert.ok(seeded.every(r=>r.allowed),JSON.stringify(seeded));await waitCount(21);
  await page.waitForSelector('.benchmark-metrics');stats=await data(`questionStats/${question}/groups/all`);assert.equal(stats.samples,20);assert.equal(stats.totalSeconds,190+(Object.entries(stats.bins).filter(([s])=>Number(s)>=20).reduce((n,[s,count])=>n+Number(s)*count,0)));
  const math=await page.evaluate(async stats=>{const {summarize}=await import('./benchmark-math.js');return summarize(stats);},stats);assert.equal(math.median,10.5);assert.equal(math.p25,5.75);assert.equal(math.p75,15.25);assert.equal(math.mean,stats.totalSeconds/20);
  await page.click('[data-benchmark-group=correct]');await page.waitForFunction(()=>document.querySelector('.benchmark-sample-note')?.textContent.includes('10 / 20'));assert.equal(await page.locator('.benchmark-metrics').count(),0);
  await page.click('[data-benchmark-group=incorrect]');await page.waitForFunction(()=>document.querySelector('.benchmark-sample-note')?.textContent.includes('10 / 20'));
  await page.click('[data-benchmark-group=all]');await page.waitForSelector('.benchmark-metrics');await page.screenshot({path:'tmp/question-benchmarks.png',fullPage:true});
  assert.equal(await page.locator('.your-time-comparison').count(),1);
  assert.match(await page.locator('.your-time-comparison').innerText(),/slower than the median/);
  console.log('20-identity sample threshold, histogram median/mean/quartiles, outcome groups and personal comparison passed');
  const checks=await page.evaluate(async({question,foreign})=>{
   const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js');const db=f.getFirestore(undefined,'dosprep-rooms');
   async function attempt(action){try{await action();return true;}catch(error){if(error.code!=='permission-denied')throw error;return false;}}
   const results={};results.counter=await attempt(()=>f.updateDoc(f.doc(db,'siteStats','answers'),{count:f.increment(1),solo:f.increment(1),updatedAt:f.serverTimestamp()}));
   results.stats=await attempt(()=>f.updateDoc(f.doc(db,'questionStats',question,'groups','all'),{samples:100000}));
   results.raw=await attempt(()=>f.getDoc(f.doc(db,'answerContributions',foreign.id)));
   results.list=await attempt(()=>f.getDocs(f.collection(db,'answerContributions')));
   const ownId=(await f.getDoc(f.doc(db,'contributors',(await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')).getAuth().currentUser.uid))).data().lastEvent;
   results.edit=await attempt(()=>f.updateDoc(f.doc(db,'answerContributions',ownId),{seconds:7000}));
   const bad=await window.seedTiming(30,true);results.histogram=bad.allowed;
   const repeated=await window.seedTiming(30,false,{app:a.getApp(foreign.appName)});results.repeatTiming=repeated.allowed;
   return results;
  },{question,foreign:seeded[0]});assert.deepEqual(checks,{counter:false,stats:false,raw:false,list:false,edit:false,histogram:false,repeatTiming:false});await waitCount(21);
  const liveId='live_test_'+Date.now();await page.evaluate(({id,question})=>DosPrepAnswerEvents.live(id,question),{id:liveId,question});await waitCount(22);
  await page.evaluate(({id,question})=>DosPrepAnswerEvents.live(id,question),{id:liveId,question});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dosprep-answer-queue')||'[]').length===0);assert.equal((await data('siteStats/answers')).count,22);
  await page.evaluate(question=>{const id='repeat_'+crypto.randomUUID();DosPrepAnswerEvents.begin(id,question);window.repeatEvent=id;},question);await page.clock.fastForward(5000);await page.evaluate(question=>DosPrepAnswerEvents.solo(window.repeatEvent,question,true,5),question);await waitCount(23);assert.equal((await data(`questionStats/${question}/groups/all`)).samples,20);
  const unseen=await page.evaluate(question=>BANK.find(q=>q.subject==='Math'&&q.id!==question).id,question);
  await context.setOffline(true);await page.evaluate(question=>{window.offlineEvent='offline_'+crypto.randomUUID();DosPrepAnswerEvents.begin(window.offlineEvent,question);},unseen);await page.clock.fastForward(5000);await page.evaluate(question=>DosPrepAnswerEvents.solo(window.offlineEvent,question,true,5),unseen);
  await page.evaluate(()=>DosPrepAnswerEvents.setConsent('denied'));assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('dosprep-answer-queue')).every(e=>e.seconds===0&&e.correct===false)));
  await context.setOffline(false);await waitCount(24);assert.equal(await data(`questionStats/${unseen}/groups/all`),null);assert.equal((await data('siteStats/answers')).live,1);
  const simultaneous=await page.evaluate(()=>Promise.all([20,21,22].map(i=>window.seedTiming(i))));assert.ok(simultaneous.every(r=>r.allowed),JSON.stringify(simultaneous));await waitCount(27);
  await page.evaluate(({question,unseen})=>{const answer={id:question,seconds:25,correct:true,stars:1,skill:BANK.find(q=>q.id===question).skill,difficulty:'Hard'};showResults({id:'comparison-test',date:new Date().toISOString(),pace:'Steady',subject:'Reading and Writing',best:1,answers:[answer,{...answer,id:unseen,seconds:8}],planned:2});},{question,unseen});
  await page.waitForSelector('dosprep-question-benchmarks[compact] .your-time-comparison');
  const compact=page.locator('dosprep-question-benchmarks[compact]');
  assert.equal(await compact.nth(0).locator('.pacing-fallback').count(),0);
  assert.match(await compact.nth(0).innerText(),/0:25/);assert.match(await compact.nth(0).innerText(),/slower than the median/);
  assert.equal(await compact.nth(1).locator('.pacing-fallback').count(),1);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tmp/pacing-comparison-mobile.png',fullPage:true});
  await page.evaluate(()=>showReview(0));await page.waitForSelector('.your-time-comparison');assert.match(await page.locator('.your-time-comparison').innerText(),/0:25/);
  // The comparison describes faster, slower and equal times without changing stored data.
  const variants=await page.evaluate(()=>{const el=document.querySelector('dosprep-question-benchmarks'),stats={samples:20,median:25,mean:25,p25:20,p75:30};return [10,25,40].map(seconds=>{el.setAttribute('your-seconds',seconds);el.render(stats);return el.querySelector('.your-time-comparison p').textContent;});});
  assert.deepEqual(variants,['0:15 faster than the median.','You matched the median time.','0:15 slower than the median.']);
  await page.goto(base.replace('practice.html','index.html'));await page.waitForSelector('dosprep-site-count[data-loaded=true]');assert.equal(await page.locator('dosprep-site-count').innerText(),'27');await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'tmp/community-answer-count-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: no opt-in by default, real practice event wiring, pause/visibility exclusion, 20-sample gating, correctness groups, exact whole-second quantiles, guarded concurrent aggregates, private raw markers, deduplication, live/solo counts, repeat-sample exclusion, offline consent withdrawal, homepage total/mobile.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
