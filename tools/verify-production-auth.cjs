let pw;try{pw=require('playwright');}catch{pw=require('./browser-check/node_modules/playwright');}
const assert=require('node:assert/strict');
(async()=>{
const browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
const p=await browser.newPage();const base=process.env.DOSPREP_URL||'http://127.0.0.1:8767/';const email='qa-dosprep-'+Date.now()+'@example.invalid',password='Temporary-QA-Only-96!';let created=false;
try{
 await p.goto(base+'signin.html');await p.waitForFunction(()=>!document.getElementById('submit-auth').disabled);
 assert.equal(await p.evaluate(()=>DOSPREP_CONFIG.firebase.projectId),'dosprep-study-a7f31');
 await p.click('#toggle-auth');await p.fill('#email',email);await p.fill('#password',password);await p.click('#submit-auth');
 await p.waitForURL('**/practice.html');created=true;await p.waitForFunction(()=>activeAccountId===DosPrepAuth.user?.uid&&Boolean(activeAccountId));
 await p.locator('[data-signout]').first().click();await p.waitForFunction(()=>!DosPrepAuth.user);
 await p.goto(base+'signin.html');await p.waitForFunction(()=>!document.getElementById('submit-auth').disabled);
 await p.fill('#email',email);await p.fill('#password',password);await p.click('#submit-auth');await p.waitForURL('**/practice.html');await p.waitForFunction(()=>Boolean(DosPrepAuth.user));
 console.log('PASS: real DosPrep Firebase email signup, persisted session, sign-out, and login. Temporary QA account will be deleted.');
}finally{
 if(created){await p.evaluate(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');const auth=sdk.getAuth();if(auth.currentUser)await sdk.deleteUser(auth.currentUser);});console.log('Temporary QA account deleted.');}
 await browser.close();
}
})().catch(e=>{console.error(e);process.exitCode=1;});
