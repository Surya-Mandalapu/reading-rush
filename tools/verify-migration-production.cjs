let pw;try{pw=require('playwright');}catch{pw=require('./browser-check/node_modules/playwright');}
const assert=require('node:assert/strict'),fs=require('node:fs');
const old='https://suryamandalapu-boop.github.io/reading-rush/',current='https://dosprep.vercel.app/';
async function waitForAsync(page,fn,arg){for(let n=0;n<160;n++){if(await page.evaluate(fn,arg))return;await new Promise(r=>setTimeout(r,125));}throw Error('Backend verification timed out');}
(async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 const email=`qa-dosprep-migration-${Date.now()}@example.invalid`,password='Migration-QA-Only-26!',contexts=[];let uid,accountPage,recordPaths=[];
 try{
  const context=await browser.newContext();contexts.push(context);await context.addInitScript(()=>{window.DOSPREP_TEST_MODE=true;localStorage.setItem('dosprep-analytics-consent','denied');});
  const oldPage=await context.newPage();accountPage=oldPage;
  await oldPage.goto(old+'signin.html');await oldPage.waitForFunction(()=>!document.getElementById('submit-auth').disabled);await oldPage.click('#toggle-auth');await oldPage.fill('#email',email);await oldPage.fill('#password',password);await oldPage.click('#submit-auth');await oldPage.waitForURL('**/practice.html');await oldPage.waitForFunction(()=>Boolean(activeAccountId));uid=await oldPage.evaluate(()=>activeAccountId);
  const marker='migration-verification-'+Date.now();
  await oldPage.evaluate(marker=>{const q=BANK[0];saved.history.unshift({id:marker,date:new Date().toISOString(),pace:'Steady',subject:q.subject,best:0,answers:[{id:q.id,correct:false,selected:'A',seconds:12,stars:0,skill:q.skill,domain:q.domain,difficulty:q.difficulty}],planned:1});persist();},marker);
  await waitForAsync(oldPage,async marker=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');const s=await f.getDocs(f.collection(f.getFirestore(undefined,'dosprep-rooms'),'userProgress',activeAccountId,'records'));return s.docs.some(d=>d.data().kind==='session'&&JSON.parse(d.data().value).id===marker);},marker);
  const newPage=await context.newPage();await newPage.goto(current+'signin.html');await newPage.waitForFunction(()=>!document.getElementById('submit-auth').disabled);await newPage.fill('#email',email);await newPage.fill('#password',password);await newPage.click('#submit-auth');await newPage.waitForURL('**/practice.html');accountPage=newPage;
  await newPage.waitForFunction(uid=>activeAccountId===uid,uid);await newPage.waitForFunction(marker=>saved.history.some(h=>h.id===marker),marker);
  const qid=await newPage.evaluate(()=>BANK[0].id);await newPage.evaluate(qid=>{saved.flags.push(qid);persist();},qid);await oldPage.waitForFunction(qid=>saved.flags.includes(qid),qid);
  recordPaths=await newPage.evaluate(async()=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');return (await f.getDocs(f.collection(f.getFirestore(undefined,'dosprep-rooms'),'userProgress',activeAccountId,'records'))).docs.map(d=>d.ref.path);});
  assert.equal(await newPage.evaluate(()=>DOSPREP_CONFIG.firebase.projectId),'dosprep-study-a7f31');assert.equal(await newPage.evaluate(()=>DOSPREP_CONFIG.measurementId),'G-H9PYRFYZ4R');
  console.log('PASS production: old/new origins sign into the same account UID; existing cloud history downloads and new flags synchronize back to GitHub Pages.');
  const consent=await browser.newContext();contexts.push(consent);await consent.addInitScript(()=>{window.DOSPREP_TEST_MODE=true;localStorage.setItem('dosprep-analytics-consent','granted');});
  const requests=[];await consent.route('**/*',route=>{const url=route.request().url();if(/googletagmanager\.com|google-analytics\.com|project-pulse-events-surya/.test(url)){requests.push(url);return route.fulfill({contentType:'application/javascript',body:''});}return route.continue();});
  const analytics=await consent.newPage();await analytics.goto(current);const events=await analytics.evaluate(()=>window.dataLayer.map(v=>Array.from(v)));
  const pageView=events.find(v=>v[0]==='event'&&v[1]==='page_view');assert.equal(pageView[2].page_location,current);assert.ok(requests.some(u=>u.includes('gtag/js?id=G-H9PYRFYZ4R')));assert.ok(requests.some(u=>u.endsWith('/pulse.js')));
  await analytics.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');await a.getAuth().authStateReady();if(a.getAuth().currentUser?.isAnonymous)await a.deleteUser(a.getAuth().currentUser);});
  console.log('PASS production: original GA4 ID and Project Pulse tag retained; page views use the Vercel URL. QA analytics requests were intercepted.');
  for(const name of ['','privacy.html','signin.html','live.html','practice.html','robots.txt','sitemap.xml']){
   const r=await fetch(current+name);assert.equal(r.status,200,name);const body=await r.text();
   if(name.endsWith('.html')||name==='')assert.ok(body.includes(`rel="canonical" href="${current+(name==='index.html'?'':name)}"`),name+' canonical');
   if(['robots.txt','sitemap.xml'].includes(name)){assert.ok(body.includes(current));assert.ok(!body.includes('github.io'));}
  }
  const build=await fetch(current+'build-info.json').then(r=>r.json());assert.equal(build.staticOnly,true);assert.equal(build.assetFiles,21006);
  const css=await fetch(current+'style.css');assert.match(css.headers.get('x-content-type-options'),/nosniff/);
  for(const file of Object.keys(JSON.parse(fs.readFileSync('asset-lock.json','utf8')).files).filter(f=>f.endsWith('.webp')).filter((_,i)=>i%5000===0)){const r=await fetch(current+file);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/webp/);}
  console.log('PASS production: all public pages, SEO canonical/sitemap URLs, static build manifest, representative question assets and response headers.');
 }finally{
  if(uid){
   try{if(accountPage&&!accountPage.isClosed())recordPaths=await accountPage.evaluate(async()=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');return (await f.getDocs(f.collection(f.getFirestore(undefined,'dosprep-rooms'),'userProgress',activeAccountId,'records'))).docs.map(d=>d.ref.path);});}catch{}
   fs.writeFileSync('tmp/migration-qa-cleanup.json',JSON.stringify({uid,recordPaths}));
   try{await accountPage.evaluate(async({uid,email})=>{const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),user=a.getAuth().currentUser;if(user?.uid===uid&&user.email===email)await a.deleteUser(user);},{uid,email});console.log('Disposable migration QA account deleted; private test records queued for exact-path cleanup.');}catch(e){console.log('QA auth cleanup requires follow-up:',e.code||e.message);}
  }
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
