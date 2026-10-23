let playwright;try{playwright=require('playwright');}catch{playwright=require('./browser-check/node_modules/playwright');}
const assert=require('node:assert/strict'),fs=require('node:fs');
const production=process.env.LIVE_QUIZ_REAL==='1',base=process.env.LIVE_QUIZ_URL||'http://127.0.0.1:8875/live.html';
const sdk='https://www.gstatic.com/firebasejs/13.0.0/';
const source=fs.readFileSync('app/questions.js','utf8'),questions=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
assert.ok(questions.every(q=>/^[a-f0-9]{8}$/.test(q.id)));
const fixture=[...questions.filter(q=>q.subject==='Reading and Writing'&&q.difficulty==='Easy').slice(0,5),questions.find(q=>q.subject==='Reading and Writing'&&q.difficulty==='Medium'),questions.find(q=>q.type==='numeric'&&q.correct==='403')];
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 const contexts=[],pages=[],errors=[];
 async function newPlayer(){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);await context.addInitScript(()=>{window.DOSPREP_TEST_MODE=true;});
  if(!production)await context.route('**/site-config.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('app/site-config.js','utf8')+'\nwindow.DOSPREP_CONFIG={...window.DOSPREP_CONFIG,liveEmulator:true,authEmulator:true};'}));
  if(!production)await context.route('**/questions.js',route=>route.fulfill({contentType:'application/javascript',body:'window.QUESTIONS='+JSON.stringify(fixture)+';'}));
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text().slice(0,450));});
  page.on('response',async response=>{if(response.status()>=400&&response.url().includes('127.0.0.1:8080'))console.log('Database:',(await response.text()).slice(0,1600));});
  await page.goto(base);await page.waitForSelector('#create-room', {timeout:30000});
  await page.waitForFunction(async()=>{const {getAuth}=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');return Boolean(getAuth().currentUser);});
  if(await page.locator('[data-consent=denied]').count())await page.click('[data-consent=denied]');console.log('Connected test browser',pages.length);return page;
 }
 async function raw(page,operation,args={}){
  return page.evaluate(async({operation,args,sdk})=>{
   const f=await import(sdk+'firebase-firestore.js'),a=await import(sdk+'firebase-auth.js');const db=f.getFirestore(undefined,'dosprep-rooms'),uid=a.getAuth().currentUser.uid;
   const ref=f.doc(db,'rooms',args.code||location.hash.slice(1));
   try{
    if(operation==='room')return (await f.getDoc(ref)).data();
    if(operation==='uid')return uid;
    if(operation==='list')await f.getDocs(f.collection(db,'rooms'));
    if(operation==='getAnswer')return {allowed:true,data:(await f.getDoc(f.doc(ref,'rounds',String(args.round||0),'answers',args.uid))).data()};
    if(operation==='listAnswers')await f.getDocs(f.collection(ref,'rounds',String(args.round||0),'answers'));
    if(operation==='reveal')await f.updateDoc(ref,{state:'reveal'});
    if(operation==='owner')await f.updateDoc(ref,{owner:uid});
    if(operation==='spoofStatus'){const r=(await f.getDoc(ref)).data();await f.updateDoc(ref,{answeredIds:[...r.answeredIds,uid]});}
    if(operation==='editAnswer')await f.updateDoc(f.doc(ref,'rounds','0','answers',uid),{answer:'B'});
    if(operation==='forgeAnswer')await f.setDoc(f.doc(ref,'rounds','0','answers',args.uid),{uid:args.uid,round:0,answer:'A',submittedAt:f.serverTimestamp()});
    return {allowed:true};
   }catch(error){return {allowed:false,code:error.code};}
  },{operation,args,sdk});
 }
 async function denied(page,operation,args){const result=await raw(page,operation,args);assert.equal(result.allowed,false,operation+' must be denied');assert.equal(result.code,'permission-denied',operation);}
 async function join(page,code,name){await page.fill('#join-code',code);await page.fill('#join-name',name);await page.click('#join-room button');await page.waitForSelector('#room-code').catch(async error=>{console.log('Join failure:',name,await page.locator('#live-status').innerText(),page.url());throw error;});}
 async function answer(page,key){await page.click(`[data-live-choice="${key}"]`);await page.click('[data-live-action=answer]');}
 let host,code;
 try{
  host=await newPlayer();const alice=await newPlayer(),bob=await newPlayer(),outsider=await newPlayer();
  await host.selectOption('#live-count','5');await host.selectOption('#live-difficulty','Easy');await host.click('#create-room button');await host.waitForSelector('#room-code').catch(async e=>{console.log('Room creation status:',await host.locator('#live-status').innerText());throw e;});code=await host.locator('#room-code').innerText();assert.match(code,/^[A-HJ-NP-Z2-9]{6}$/);
  const chosen=await raw(host,'room',{code});assert.ok(chosen.questionIds.every(id=>questions.find(q=>q.id===id)?.difficulty==='Easy'));
  console.log('Created room',code);await Promise.all([join(alice,code,'Alice'),join(bob,code,'Bob')]);await host.waitForFunction(()=>document.querySelectorAll('.live-roster li').length===2);console.log('Lobby joined');
  await host.screenshot({path:'tmp/live-lobby.png',fullPage:true});
  const aliceUid=await raw(alice,'uid'),bobUid=await raw(bob,'uid');
  await denied(outsider,'list',{code});await denied(alice,'owner',{code});
  await host.click('[data-live-action=start]');await Promise.all([host,alice,bob].map(p=>p.waitForSelector('.live-game')));console.log('Round started');
  const headings=await Promise.all([host,alice,bob].map(p=>p.locator('.study>p').first().innerText()));assert.equal(new Set(headings).size,1);
  const firstQuestion=await alice.evaluate(async()=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');const r=(await f.getDoc(f.doc(f.getFirestore(undefined,'dosprep-rooms'),'rooms',location.hash.slice(1)))).data();return window.QUESTIONS.find(q=>q.id===r.questionIds[0]);});
  await denied(bob,'reveal',{code});await denied(bob,'spoofStatus',{code});await denied(alice,'forgeAnswer',{code,uid:bobUid});
  await answer(alice,firstQuestion.correct);await alice.waitForFunction(()=>document.querySelector('[data-live-action=answer]')?.textContent.includes('submitted'));
  await denied(host,'getAnswer',{code,uid:aliceUid});await denied(bob,'getAnswer',{code,uid:aliceUid});await denied(host,'listAnswers',{code});
  await denied(alice,'editAnswer',{code});
  assert.equal(await host.locator('.answer-reveal-list').count(),0);assert.equal(await bob.locator('.answer-reveal-list').count(),0);
  const own=await raw(alice,'getAnswer',{code,uid:aliceUid});assert.equal(own.data.answer,firstQuestion.correct);
  const wrong=firstQuestion.correct==='A'?'B':'A';await answer(bob,wrong);
  await Promise.all([host,alice,bob].map(p=>p.waitForSelector('.live-reveal')));console.log('Automatic reveal completed');
  assert.match(await host.locator('.answer-reveal-list').innerText(),/Alice/);assert.match(await host.locator('.answer-reveal-list').innerText(),/Bob/);
  assert.equal(await host.locator('.answer-right').count(),1);assert.equal(await host.locator('.answer-wrong').count(),1);
  await host.waitForFunction(()=>document.querySelector('.live-leaderboard')?.textContent.includes('100'));
  await host.waitForFunction(()=>[...document.querySelectorAll('.pdf-img')].every(img=>img.complete&&img.naturalWidth>0));await host.screenshot({path:'tmp/live-reveal.png',fullPage:true});
  assert.equal((await raw(bob,'getAnswer',{code,uid:aliceUid})).data.answer,firstQuestion.correct);
  await denied(outsider,'getAnswer',{code,uid:aliceUid});
  await host.click('[data-live-action=next]');await alice.waitForSelector('[data-live-action=answer]');await bob.reload();await bob.waitForSelector('[data-live-action=answer]');console.log('Next round/reload completed');
  assert.match(await bob.locator('.live-room-heading h1').innerText(),/Question 2/);assert.equal(await bob.locator('.choice.chosen').count(),0);
  await bob.setViewportSize({width:390,height:844});assert.equal(await bob.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await bob.screenshot({path:'tmp/live-mobile.png',fullPage:true});
  host.once('dialog',d=>d.accept());await host.click('[data-live-action=reveal]');await bob.waitForSelector('.live-reveal');assert.match(await bob.locator('.answer-reveal-list').innerText(),/Unanswered/);
  host.once('dialog',d=>d.accept());await host.click('[data-live-action=end]');await host.waitForSelector('[data-live-action=delete]');
  host.once('dialog',d=>d.accept());await host.click('[data-live-action=delete]');await host.waitForSelector('#create-room');await alice.waitForSelector('#create-room');await bob.waitForSelector('#create-room');
  console.log('First room deleted');
  // A second room covers numeric answers, a host who plays, lobby removal and joining again.
  await host.selectOption('#live-subject','Math');await host.selectOption('#live-difficulty','Hard');await host.check('#host-plays');await host.fill('#host-name','Host');await host.click('#create-room button');await host.waitForSelector('#room-code');code=await host.locator('#room-code').innerText();
  await join(alice,code,'Alice');await host.waitForFunction(()=>document.querySelectorAll('.live-roster li').length===2);
  await host.locator('[data-remove-player]').click();await alice.waitForSelector('#create-room');await join(alice,code,'Alice again');
  await host.click('[data-live-action=start]');await alice.waitForSelector('.live-game');
  // Production questions are random. All round types share the same privacy rules.
  const q=await raw(host,'room',{code});const question=await host.evaluate(id=>window.QUESTIONS.find(q=>q.id===id),q.questionIds[0]);
  if(!production)assert.equal(question.type,'numeric');
  await Promise.all([host,alice].map(async page=>{
   if(question.type==='numeric'){await page.fill('#live-answer','1/0');assert.ok(await page.locator('[data-live-action=answer]').isDisabled());await page.fill('#live-answer',!production?'806/2':question.correct.split(/,|;|\bor\b/)[0].trim());await page.click('[data-live-action=answer]');}
   else await answer(page,question.correct);
  }));
  await host.waitForSelector('.live-reveal');assert.equal(await host.locator('.answer-right').count(),2);
  host.once('dialog',d=>d.accept());await host.click('[data-live-action=end]');await host.waitForSelector('[data-live-action=delete]');
  host.once('dialog',d=>d.accept());await host.click('[data-live-action=delete]');await host.waitForSelector('#create-room');
  // Anonymous room identity must preserve the existing guest solo progress store.
  await alice.evaluate(()=>localStorage.setItem('reading-rush-v1',JSON.stringify({history:[],flags:['solo-guest-sentinel'],highlights:{}})));
  await alice.goto(base.replace('live.html','practice.html'));await alice.waitForFunction(async()=>{try{const {getAuth}=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');await getAuth().authStateReady();return Boolean(getAuth().currentUser);}catch{return false;}});await alice.waitForTimeout(200);
  assert.equal(await alice.evaluate(()=>KEY),'reading-rush-v1');assert.ok(await alice.evaluate(()=>saved.flags.includes('solo-guest-sentinel')));
  assert.deepEqual(errors,[]);
  console.log(`PASS (${production?'production':'emulators'}): room codes, 3 synchronized browsers, private answers including from host, immutable answers, no forged status/host escalation, automatic reveal, leaderboard, next round/reload, early reveal, mobile, host player, removal/rejoin, room deletion, guest solo-history isolation.`);
 }catch(error){console.error('Live test failed:',error.message);throw error;}finally{
  // Remove the disposable test room on failure as well.
  if(host&&!host.isClosed()&&code){try{await host.evaluate(async(code)=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');const db=f.getFirestore(undefined,'dosprep-rooms'),ref=f.doc(db,'rooms',code),snapshot=await f.getDoc(ref);if(!snapshot.exists()||snapshot.data().owner!==a.getAuth().currentUser.uid)return;await f.updateDoc(ref,{state:'finished'});const players=await f.getDocs(f.collection(ref,'players')),rounds=await Promise.all(Array.from({length:snapshot.data().round+1},(_,i)=>f.getDocs(f.collection(ref,'rounds',String(i),'answers'))));const batch=f.writeBatch(db);players.forEach(d=>batch.delete(d.ref));rounds.forEach(r=>r.forEach(d=>batch.delete(d.ref)));batch.delete(ref);await batch.commit();},code);}catch{}}
  for(const page of pages){try{await page.evaluate(async()=>{const {getAuth,deleteUser}=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');const user=getAuth().currentUser;if(user?.isAnonymous)await deleteUser(user);});}catch{}}
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
