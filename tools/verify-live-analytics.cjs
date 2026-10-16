let playwright;try{playwright=require('playwright');}catch{playwright=require('./browser-check/node_modules/playwright');}
const assert=require('node:assert/strict');
(async()=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
 const page=await browser.newPage();
 const base=process.env.DOSPREP_URL||'https://suryamandalapu-boop.github.io/reading-rush/';
 const receipts=[],tagRequests=[];
 const isCollect=url=>{const u=new URL(url);return u.hostname.endsWith('google-analytics.com')&&u.pathname.endsWith('/g/collect');};
 page.on('request',r=>{if(r.url().startsWith('https://www.googletagmanager.com/gtag/js'))tagRequests.push(r.url());});
 page.on('response',r=>{if(isCollect(r.url()))receipts.push({status:r.status(),id:new URL(r.url()).searchParams.get('tid')});});
 try{
  await page.goto(base);
  await page.waitForSelector('[data-consent=granted]');
  assert.equal(tagRequests.length,0,'Google tag loaded before consent');
  const measurement=await page.evaluate(()=>DOSPREP_CONFIG.measurementId);assert.equal(measurement,'G-H9PYRFYZ4R');
  const view=page.waitForResponse(r=>isCollect(r.url())&&new URL(r.url()).searchParams.get('tid')===measurement,{timeout:30000});
  await page.click('[data-consent=granted]');const response=await view;assert.ok(response.status()>=200&&response.status()<300);
  assert.equal(await page.evaluate(()=>localStorage.getItem('dosprep-analytics-consent')),'granted');
  console.log('PASS: consent required before Google tag load; Google Analytics accepted the page-view request for '+measurement+' (HTTP '+response.status()+').');
  await page.evaluate(()=>DosPrepAnalytics.settings());await page.click('[data-consent=denied]');await page.waitForTimeout(800);
  const before=receipts.length;await page.evaluate(()=>DosPrepAnalytics.track('view_insights',{subject:'Math'}));await page.waitForTimeout(1500);
  assert.equal(receipts.length,before);assert.equal(await page.evaluate(id=>window['ga-disable-'+id],measurement),true);
  await page.reload();await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>localStorage.getItem('dosprep-analytics-consent')),'denied');assert.equal(await page.locator('script[src^="https://www.googletagmanager.com/gtag/js"]').count(),0);
  console.log('PASS: withdrawing consent disables events and remains disabled after reload.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
