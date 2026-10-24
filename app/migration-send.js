import {snapshot,destination} from './migration-core.js';
const settings=window.DOSPREP_MIGRATION,status=document.getElementById('migration-status');
if(!settings?.enabled||!settings.targetOrigin||location.origin!==settings.oldOrigin)throw Error('Site migration is not active.');
const target=destination(location,settings),bundle=snapshot(localStorage,settings.oldOrigin);
const room=localStorage.getItem('dosprep-live-room');
const legacy=new URL(settings.oldBasePath+'legacy/'+(location.pathname.slice(settings.oldBasePath.length)||'index.html')+location.search+location.hash,settings.oldOrigin);
document.getElementById('stay-old').href=legacy.href;
document.getElementById('continue-new').href=target;
const roomLink=document.getElementById('finish-room');
if(room){roomLink.hidden=false;roomLink.href=settings.oldBasePath+'legacy/live.html#'+encodeURIComponent(room);}
let popup,nonce,sent;
document.getElementById('move-data').addEventListener('click',()=>{
 nonce=crypto.randomUUID();sent=snapshot(localStorage,settings.oldOrigin);popup=window.open(settings.targetOrigin+'/migration.html#'+nonce,'dosprep-migration-'+nonce,'popup,width=850,height=800');
 status.textContent=popup?'Transferring in a new window. Keep this tab open until it confirms that your browser data is saved.':'Your browser blocked the transfer window. Allow this popup, or download a backup and restore it on the new site.';
});
window.addEventListener('message',event=>{
 if(!popup||event.source!==popup||event.origin!==settings.targetOrigin||event.data?.nonce!==nonce)return;
 if(event.data.type==='dosprep-transfer-ready')popup.postMessage({type:'dosprep-transfer',nonce,bundle:sent},settings.targetOrigin);
 if(event.data.type==='dosprep-transfer-error')status.textContent=event.data.message;
 if(event.data.type==='dosprep-transfer-saved'){
  const current=snapshot(localStorage,settings.oldOrigin);
  if(JSON.stringify(current.entries)!==JSON.stringify(sent.entries)){status.textContent='Your old-site data changed during the transfer. Close other old DosPrep tabs, then transfer again. Nothing was deleted.';return;}
  popup.close();location.replace(target);
 }
});
document.getElementById('download-data').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify(snapshot(localStorage,settings.oldOrigin),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dosprep-browser-migration-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Backup downloaded. Keep it private: it includes study history and pending changes. Restore it on the new site using the browser-data transfer page.';
});
// Never strand offline users, stored room identities, guest history, or any pending cloud/answer data.
if(!bundle.entries.length&&navigator.onLine&&!new URLSearchParams(location.search).has('migration'))location.replace(target);
else status.textContent=navigator.onLine?'This browser has DosPrep data. Transfer it or download a backup before continuing. Your originals remain available on the old site.':'You are offline. Your progress is still on this browser. Stay here or download a backup; transfer after reconnecting.';
