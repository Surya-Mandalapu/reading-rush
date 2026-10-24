import {importBundle} from './migration-core.js';
const settings=window.DOSPREP_MIGRATION,status=document.getElementById('migration-status'),nonce=location.hash.slice(1);
if(!settings||location.origin!==settings.targetOrigin)throw Error('Migration destination is not configured.');
let finished=false;
window.addEventListener('message',event=>{
 if(finished||!window.opener||event.source!==window.opener||event.origin!==settings.oldOrigin||event.data?.type!=='dosprep-transfer'||event.data.nonce!==nonce)return;
 try{const id=importBundle(localStorage,event.data.bundle,settings.oldOrigin);finished=true;status.textContent='Browser data saved. Your original tab will continue to DosPrep; you can close this transfer window.';event.source.postMessage({type:'dosprep-transfer-saved',nonce,id},settings.oldOrigin);}
 catch(error){status.textContent=error.message;event.source.postMessage({type:'dosprep-transfer-error',nonce,message:error.message},settings.oldOrigin);}
});
const ready=()=>{if(!finished&&window.opener&&/^[a-f0-9-]{36}$/i.test(nonce))window.opener.postMessage({type:'dosprep-transfer-ready',nonce},settings.oldOrigin);};
ready();const timer=setInterval(ready,500);setTimeout(()=>clearInterval(timer),120000);
if(!window.opener)status.textContent='Open the old DosPrep site to transfer this browser’s progress, or restore a migration backup below.';
document.getElementById('migration-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>12000000)throw Error('This backup is too large.');const id=importBundle(localStorage,JSON.parse(await file.text()),settings.oldOrigin);status.textContent='Browser backup restored. Continue to practice and sign in with the same account to sync private pending changes.';}catch(error){status.textContent=error.message;}});
