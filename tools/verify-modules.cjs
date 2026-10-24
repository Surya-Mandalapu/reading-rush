let playwright;try{playwright=require('playwright');}catch{playwright=require('./browser-check/node_modules/playwright');}
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/questions.js','utf8'),bank=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
const sandbox={window:{},crypto:require('node:crypto').webcrypto};vm.runInNewContext(fs.readFileSync('app/modules.js','utf8'),sandbox);
const modules=sandbox.window.DosPrepModules;
async function waitForAsync(page,fn,arg){for(let n=0;n<100;n++){if(await page.evaluate(fn,arg))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out waiting for backend verification');}
for(const [subject,spec] of Object.entries(modules.subjects))for(const type of modules.types)for(const form of ['A','B','C','random']){
 const {qs,module}=modules.build(bank,subject,type.id,form,'test-seed');
 assert.equal(qs.length,spec.count);assert.equal(new Set(qs.map(q=>q.id)).size,spec.count);
 assert.ok(qs.every(q=>q.subject===subject));assert.equal(module.seconds,subject==='Math'?2100:1920);
 for(const [i,difficulty] of ['Easy','Medium','Hard'].entries())assert.equal(qs.filter(q=>q.difficulty===difficulty).length,type.mix[subject][i]);
 for(const [domain,n] of Object.entries(spec.domains))assert.equal(qs.filter(q=>q.domain===domain).length,n);
 assert.equal(qs.map(q=>q.id).join(),modules.build([...bank].reverse(),subject,type.id,form,'test-seed').qs.map(q=>q.id).join(),'Stable forms independent of bank ordering');
}
for(const subject of Object.keys(modules.subjects))for(const type of modules.types){
 const ids=form=>modules.build(bank,subject,type.id,form).qs.map(q=>q.id).join();assert.notEqual(ids('A'),ids('B'));assert.notEqual(ids('random'),ids('random'));
}
console.log('PASS: exact size, difficulty and category quotas, unique IDs, repeatable presets, randomized fresh sets for both subjects.');
if(process.env.MODULE_UNIT_ONLY==='1')process.exit(0);
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>window.DOSPREP_TEST_MODE=false);
  await page.route('**/site-config.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('app/site-config.js','utf8')+'\nwindow.DOSPREP_CONFIG={...window.DOSPREP_CONFIG,liveEmulator:true,authEmulator:true};'}));
  await page.goto(process.env.READING_RUSH_URL||'http://127.0.0.1:8876/practice.html');
  if(await page.locator('[data-consent=denied]').count())await page.click('[data-consent=denied]');
  // Verify these sessions also use real signed-in progress synchronization (emulator only).
  await page.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');await a.createUserWithEmailAndPassword(a.getAuth(),`modules-${Date.now()}@dosprep.test`,'ModulesTest123!');});
  await page.waitForFunction(()=>Boolean(activeAccountId));
  await page.locator('.nav [data-action=modules]').click();assert.equal(await page.locator('.module-card').count(),4);
  await page.selectOption('#module-form','B');await page.click('[data-start-module=module2hard]');await page.waitForFunction(()=>session.questionStarted!==null);
  assert.equal(await page.evaluate(()=>session.qs.length),27);assert.match(await page.locator('.module-run-banner').innerText(),/Module 2 Hard · Form B/);
  const initial=await page.evaluate(()=>session.qs.map(q=>q.id));
  await page.click('[data-action=pause]');const paused=await page.evaluate(()=>moduleElapsed());await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>moduleElapsed()),paused);await page.click('[data-action=resume]');
  await page.waitForTimeout(1100);const first=await page.evaluate(()=>({id:session.qs[0].id,correct:session.qs[0].correct}));
  const baseline=await page.evaluate(async id=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),db=f.getFirestore(undefined,'dosprep-rooms');return {samples:(await f.getDoc(f.doc(db,'questionStats',id,'groups','all'))).data()?.samples||0,count:(await f.getDoc(f.doc(db,'siteStats','answers'))).data()?.count||0};},first.id);
  await page.click(`[data-choice=${first.correct}]`);await page.click('[data-action=submit]');
  const local=await page.evaluate(()=>saved.history[0]);assert.equal(local.module.id,'module2hard');assert.equal(local.answers[0].id,first.id);assert.equal(local.incomplete,true);
  await waitForAsync(page,async id=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),db=f.getFirestore(undefined,'dosprep-rooms'),stat=await f.getDoc(f.doc(db,'questionStats',id,'groups','all')),count=await f.getDoc(f.doc(db,'siteStats','answers'));return stat.exists()&&stat.data().samples>=1&&count.exists()&&count.data().count>=1;},first.id);
  await waitForAsync(page,async()=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),db=f.getFirestore(undefined,'dosprep-rooms'),snap=await f.getDocs(f.collection(db,'userProgress',activeAccountId,'records'));return snap.docs.some(d=>d.data().kind==='session'&&JSON.parse(d.data().value).module?.id==='module2hard');});
  const recorded=await page.evaluate(async id=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),db=f.getFirestore(undefined,'dosprep-rooms');return {stat:(await f.getDoc(f.doc(db,'questionStats',id,'groups','all'))).data(),count:(await f.getDoc(f.doc(db,'siteStats','answers'))).data(),records:(await f.getDocs(f.collection(db,'userProgress',activeAccountId,'records'))).docs.map(d=>d.data())};},first.id);
  assert.ok(recorded.stat.samples>=1);assert.ok(recorded.count.count>=1);assert.ok(recorded.count.solo>=1);
  assert.equal(recorded.stat.samples,baseline.samples+1);assert.equal(recorded.count.count,baseline.count+1);
  assert.ok(recorded.records.some(r=>r.kind==='session'&&JSON.parse(r.value).module?.id==='module2hard'));
  await page.click('[data-action=next]');await page.waitForFunction(()=>session.questionStarted!==null);const before=await page.evaluate(()=>moduleElapsed());assert.ok(before>=1);
  await page.evaluate(()=>{session.questionStarted=Date.now()-1921000;tick();});assert.match(await page.locator('#module-timer').innerText(),/^\+/);assert.ok(await page.locator('[data-choice=A]').isEnabled());
  await page.evaluate(()=>finish());assert.match(await page.locator('.result-title h1').innerText(),/Module results/);assert.match(await page.locator('.pill').first().innerText(),/Module 2 Hard/);
  // History, review, and the exact question ID use the normal session pipeline.
  await page.locator('.nav [data-action=history]').click();assert.match(await page.locator('.history-session').first().innerText(),/Module 2 Hard · Form B/);
  await page.locator('[data-history="0"]').click();await page.click('[data-review="0"]');assert.match(await page.locator('.study>p').innerText(),new RegExp(first.id));
  await page.evaluate(()=>modules());await page.selectOption('#module-subject','Math');await page.selectOption('#module-form','random');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'tmp/practice-modules-mobile.png',fullPage:true});
  await page.click('[data-start-module=foundation]');await page.waitForFunction(()=>session.questionStarted!==null);assert.equal(await page.evaluate(()=>session.qs.length),22);assert.ok(await page.evaluate(()=>session.qs.every(q=>q.difficulty!=='Hard')));
  assert.equal(await page.evaluate(()=>session.module.seconds),2100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const q=await page.evaluate(()=>session.qs[0]);if(q.type==='numeric'){await page.fill('#numeric-answer',q.correct.split(/,|;|\bor\b/)[0].trim());}else await page.click(`[data-choice=${q.correct}]`);await page.click('[data-action=submit]');
  await page.click('[data-action=explanation]');assert.equal(await page.locator('.feedback .explanation').count(),1);
  const persisted=await page.evaluate(()=>saved.history[0]);assert.equal(persisted.module.id,'foundation');assert.equal(persisted.answers[0].subject,'Math');
  // Module metadata survives the same serializer used for cloud progress.
  assert.equal(await page.evaluate(async h=>{const p=await import('./progress-model.js');const records={};for(const [key,value] of p.flatten({history:[h]}))records[key]=value;return p.materialize(records).history[0].module.id;},persisted),'foundation');
  assert.deepEqual(errors,[]);console.log('PASS: module UI, module pacing/pause/overtime, normal answer recording and site totals, private cloud records, history/review, numeric support, explanation placement, mobile layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
