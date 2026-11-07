(()=>{
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function update(user){
  const name=user?.displayName?.trim()||user?.email||'Your account';
  document.querySelectorAll('[data-landing-account]').forEach(slot=>{
   slot.removeAttribute('aria-busy');
   slot.innerHTML=user?`<a class="landing-account" href="practice.html" aria-label="Signed in as ${esc(name)}. Continue practicing" title="Signed in as ${esc(name)}"><span class="landing-avatar" aria-hidden="true">${esc(name.slice(0,1).toUpperCase())}</span><span class="landing-account-label"><small>✓ Signed in</small><strong>${esc(name)}</strong></span></a>`:'<a href="signin.html">Sign in</a>';
  });
  document.querySelectorAll('[data-landing-practice]').forEach(link=>{link.textContent=user?'Continue practicing →':'Start practicing ↗';});
 }
 document.addEventListener('dosprep-auth-change',event=>update(event.detail.user));
 if(window.DosPrepAuth?.user)update(window.DosPrepAuth.user);
})();
