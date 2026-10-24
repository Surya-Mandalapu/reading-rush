(()=>{
 const settings=window.DOSPREP_MIGRATION;if(!settings||location.origin!==settings.targetOrigin)return;
 if(localStorage.getItem('dosprep-migration-received'))return;
 const banner=document.createElement('aside');banner.className='library-note';banner.style.cssText='margin:16px auto;max-width:1000px';
 const text=document.createElement('span');text.textContent='Used DosPrep on GitHub Pages? Move this browser’s guest progress and pending changes. ';
 const link=document.createElement('a');link.href=settings.oldOrigin+settings.oldBasePath+'practice.html?migration=1';link.textContent='Move my browser data →';banner.append(text,link);document.body.prepend(banner);
})();
