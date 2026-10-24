const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
let playwright;try{playwright=require('playwright');}catch{playwright=require('./browser-check/node_modules/playwright');}
const staged=process.env.DOSPREP_OUTPUT_ROOT||'D:/Codex/DosPrepMigration',oldOrigin='https://suryamandalapu-boop.github.io',newOrigin='https://dosprep.vercel.app';
const coreText=fs.readFileSync('app/migration-core.js','utf8').replace("'./progress-model.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('app/progress-model.js')).toString('base64')));
const sample={id:'migration-test',date:'2026-10-23T12:00:00.000Z',pace:'Steady',subject:'Reading and Writing',best:1,answers:[{id:'deadbeef',correct:true,seconds:12,stars:3,skill:'Words in Context',difficulty:'Easy',selected:'A'}]};
const progress=JSON.stringify({history:[sample],flags:['deadbeef'],highlights:{deadbeef:['0:1']}});
class Storage{constructor(entries=[]){this.map=new Map(entries);}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
(async()=>{
 const core=await import('data:text/javascript;base64,'+Buffer.from(coreText).toString('base64'));
 const pending={kind:'session',key:sample.id,value:JSON.stringify(sample),revision:'rev-b',changedAt:200,deleted:false};
 const queue=JSON.stringify([{id:'solo_migration_event',questionId:'deadbeef',mode:'solo',timing:true,seconds:12,correct:true,queuedAt:Date.now(),version:2}]);
 const source=new Storage([['reading-rush-v1',progress],['dosprep-progress-account123',progress],['dosprep-cloud-ledger-account123',JSON.stringify({records:{},pending:{['session:'+sample.id]:pending}})],['dosprep-answer-queue',queue],['firebase:authUser:private','TOKEN MUST NEVER MOVE'],['unrelated-project','unrelated']]);
 const bundle=core.snapshot(source,oldOrigin);assert.equal(bundle.entries.length,4);
 const destination=new Storage([['reading-rush-v1',JSON.stringify({history:[],flags:['cafebabe'],highlights:{deadbeef:['0:2']}})]]);
 core.importBundle(destination,bundle,oldOrigin);assert.equal(source.getItem('reading-rush-v1'),progress);
 const merged=JSON.parse(destination.getItem('reading-rush-v1'));assert.deepEqual(merged.flags,['cafebabe','deadbeef']);assert.deepEqual(merged.highlights.deadbeef,['0:2','0:1']);
 assert.equal(JSON.parse(destination.getItem('dosprep-cloud-ledger-account123')).pending['session:'+sample.id].revision,'rev-b');
 assert.equal(destination.getItem('firebase:authUser:private'),null);assert.equal(destination.getItem('unrelated-project'),null);
 core.importBundle(destination,bundle,oldOrigin);assert.equal(JSON.parse(destination.getItem('reading-rush-v1')).history.length,1);assert.equal(JSON.parse(destination.getItem('dosprep-answer-queue')).length,1);
 assert.throws(()=>core.importBundle(destination,{...bundle,source:'https://evil.test'},oldOrigin));
 assert.throws(()=>core.importBundle(destination,{...bundle,entries:[['firebase:authUser:private','bad']]},oldOrigin));
 const failed=new Storage([['reading-rush-v1',progress]]),before=[...failed.map];let writes=0;
 failed.setItem=function(k,v){if(++writes===2)throw Error('quota');this.map.set(k,v);};
 assert.throws(()=>core.importBundle(failed,bundle,oldOrigin),/No transfer was completed/);assert.deepEqual([...failed.map],before);
 const url=core.destination({pathname:'/reading-rush/live.html',search:'?test=1',hash:'#ABC234'},{oldBasePath:'/reading-rush/',targetOrigin:newOrigin});assert.equal(url,newOrigin+'/live.html?test=1#ABC234');
 assert.equal(new URL(core.destination({pathname:'/reading-rush///evil.test',search:'',hash:''},{oldBasePath:'/reading-rush/',targetOrigin:newOrigin})).origin,newOrigin);
 console.log('PASS: safe storage allowlist, merge/idempotency, private pending data and queues preserved, quota rollback, no auth-token transfer, path/query/hash mapping.');
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:1000}}),errors=[];
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'};
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(![oldOrigin,newOrigin].includes(url.origin))return route.abort();
   if(url.origin===newOrigin&&url.pathname==='/practice.html')return route.fulfill({contentType:'text/html',body:'<h1>New DosPrep practice</h1>'});
   let relative=url.pathname.replace(url.origin===oldOrigin?'/reading-rush/':'/','')||'index.html';
   const file=path.resolve(staged,url.origin===oldOrigin?'dist-pages':'dist',relative);
   if(!file.startsWith(path.resolve(staged)+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
   return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(oldOrigin+'/reading-rush/practice.html?migration=1');
  await page.evaluate(({progress,queue,pending})=>{
   localStorage.setItem('reading-rush-v1',progress);localStorage.setItem('dosprep-progress-account123',progress);localStorage.setItem('dosprep-answer-queue',queue);localStorage.setItem('dosprep-cloud-ledger-account123',JSON.stringify({records:{},pending:{['session:'+pending.key]:pending}}));localStorage.setItem('dosprep-live-room','ABC234');localStorage.setItem('firebase:authUser:private','do-not-transfer');
  },{progress,queue,pending});
  await page.reload();await page.waitForSelector('#move-data');assert.match(await page.locator('#migration-status').innerText(),/Transfer/);
  assert.match(await page.locator('#finish-room').getAttribute('href'),/legacy\/live.html#ABC234/);
  await page.screenshot({path:'tmp/migration-gate.png',fullPage:true});
  await page.click('#move-data');await page.waitForURL(newOrigin+'/practice.html?migration=1');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-rush-v1')).history[0].id),sample.id);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dosprep-cloud-ledger-account123')).pending['session:migration-test'].revision),'rev-b');
  assert.equal(await page.evaluate(()=>localStorage.getItem('firebase:authUser:private')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('dosprep-live-room')),null);
  const original=await context.newPage();await original.goto(oldOrigin+'/reading-rush/practice.html?migration=1');assert.equal(await original.evaluate(()=>JSON.parse(localStorage.getItem('reading-rush-v1')).history[0].id),sample.id);
  // Dirty storage blocks redirect; an empty browser redirects and retains the room hash.
  const clean=await browser.newContext();await clean.route('**/*',async route=>{const url=new URL(route.request().url());if(![oldOrigin,newOrigin].includes(url.origin))return route.abort();if(url.origin===newOrigin)return route.fulfill({contentType:'text/html',body:'<h1>Room</h1>'});const relative=url.pathname.replace('/reading-rush/','')||'index.html',file=path.resolve(staged,'dist-pages',relative);return route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});});
  const invite=await clean.newPage();await invite.goto(oldOrigin+'/reading-rush/live.html?mode=quiz#ABC234');await invite.waitForURL(newOrigin+'/live.html?mode=quiz#ABC234');
  assert.deepEqual(errors,[]);console.log('PASS: real cross-origin popup handshake and saved-data acknowledgement, account backups/guest history/queues, source originals retained, old room recovery link, clean redirect preserves query and room code.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
