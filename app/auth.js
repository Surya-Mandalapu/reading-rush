(function(){
 'use strict';
 const config=window.DOSPREP_CONFIG?.firebase;
 let user=null,auth=null,sdk=null,unavailable=!config,busy=false,firstAuthState=true;
 const listeners=new Set();
 function emit(){listeners.forEach(fn=>fn(user));document.dispatchEvent(new CustomEvent('dosprep-auth-change',{detail:{user}}));}
 function message(text,error=false){const status=document.getElementById('auth-status');if(status){status.textContent=text;status.classList.toggle('error',error);}}
 function setBusy(value){busy=value;document.querySelectorAll('#auth-form button,#google-signin,#reset-password').forEach(b=>b.disabled=value||unavailable);}
 function failure(error){
  const messages={'auth/invalid-credential':'The email or password is incorrect.','auth/invalid-email':'Enter a valid email address.','auth/email-already-in-use':'This email already has an account. Try signing in.','auth/weak-password':'Choose a password with at least 8 characters.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/popup-blocked':'Allow popups for DosPrep, then try again.','auth/popup-closed-by-user':'Google sign-in was closed. You can try again.','auth/network-request-failed':'Check your connection and try again.','auth/operation-not-allowed':'This sign-in method is not available right now.','auth/unauthorized-domain':'Sign-in is not available on this address yet.'};
  message(messages[error.code]||'Sign-in could not be completed. Please try again.',true);
 }
 async function initialize(){
  if(!config){message('Accounts are not available yet. You can still practice on this device.');setBusy(false);emit();return;}
  try{
   const [appModule,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]);
   sdk=authModule;const app=appModule.getApps().length?appModule.getApp():appModule.initializeApp(config);auth=sdk.getAuth(app);
   if(window.DOSPREP_CONFIG?.authEmulator&&['localhost','127.0.0.1'].includes(location.hostname))sdk.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
   await sdk.setPersistence(auth,sdk.browserLocalPersistence);
   sdk.onAuthStateChanged(auth,next=>{const redirectExisting=firstAuthState&&Boolean(next&&!next.isAnonymous);firstAuthState=false;user=next&&!next.isAnonymous?next:null;unavailable=false;setBusy(false);emit();if(redirectExisting&&document.getElementById('auth-form'))location.replace('practice.html');});
   unavailable=false;message('');setBusy(false);
  }catch{unavailable=true;message('Sign-in is temporarily unavailable. You can continue practicing on this device.',true);setBusy(false);emit();}
 }
 function safeNext(){return 'practice.html';}
 document.getElementById('auth-form')?.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!auth||!sdk)return;
  const form=e.target,email=form.elements.email.value.trim(),password=form.elements.password.value,signup=document.getElementById('auth-mode')?.value==='signup';
  if(signup&&password.length<8){message('Choose a password with at least 8 characters.',true);return;}
  setBusy(true);message(signup?'Creating your account…':'Signing in…');
  try{await (signup?sdk.createUserWithEmailAndPassword(auth,email,password):sdk.signInWithEmailAndPassword(auth,email,password));window.DosPrepAnalytics?.track(signup?'sign_up':'login',{method:'password'});location.replace(safeNext());}catch(error){failure(error);setBusy(false);}
 });
 document.getElementById('google-signin')?.addEventListener('click',async()=>{
  if(busy||!auth||!sdk)return;setBusy(true);message('Opening Google sign-in…');
  try{const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await sdk.signInWithPopup(auth,provider);window.DosPrepAnalytics?.track('login',{method:'google'});location.replace(safeNext());}catch(error){failure(error);setBusy(false);}
 });
 document.getElementById('reset-password')?.addEventListener('click',async()=>{
  if(busy||!auth||!sdk)return;const email=document.getElementById('email').value.trim();
  if(!email){message('Enter your email address above first.',true);return;}
  setBusy(true);message('Sending reset instructions…');
  try{await sdk.sendPasswordResetEmail(auth,email,{url:location.origin+location.pathname,handleCodeInApp:false});message('If this email has an account, password reset instructions are on the way.');}catch(error){failure(error);}finally{setBusy(false);}
 });
 document.getElementById('toggle-auth')?.addEventListener('click',()=>{
  const mode=document.getElementById('auth-mode'),signup=mode.value!=='signup';mode.value=signup?'signup':'signin';
  document.getElementById('auth-title').textContent=signup?'Your next chapter starts here.':'Welcome back.';
  document.getElementById('submit-auth').textContent=signup?'Create account':'Sign in';
  document.getElementById('toggle-auth').textContent=signup?'Already have an account? Sign in':'New to DosPrep? Create an account';
  document.getElementById('password').autocomplete=signup?'new-password':'current-password';document.getElementById('password').minLength=signup?8:1;message(unavailable?'Accounts are not available yet. You can still practice on this device.':'');
 });
 window.DosPrepAuth={get user(){return user;},get configured(){return Boolean(config);},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async signOut(){if(!auth||!sdk)return;await sdk.signOut(auth);}};
 document.addEventListener('click',async e=>{
  if(!e.target.closest('[data-signout]'))return;
  try{await window.DosPrepAuth.signOut();}catch{alert('Could not sign out. Please check your connection and try again.');}
 });
 if(config)setBusy(true);initialize();
})();
