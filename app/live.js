import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth,signInAnonymously,connectAuthEmulator,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFirestore,connectFirestoreEmulator,doc,collection,getDoc,getDocs,onSnapshot,runTransaction,writeBatch,serverTimestamp,Timestamp,arrayUnion,arrayRemove} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {escapeHTML as esc,numericValue,isCorrect,shuffled,roomCode} from './live-utils.js';

const root=document.getElementById('live-app'),status=document.getElementById('live-status'),bank=window.QUESTIONS;
const byId=new Map(bank.map(q=>[q.id,q]));
const firebaseApp=getApps().length?getApp():initializeApp(window.DOSPREP_CONFIG.firebase);
const auth=getAuth(firebaseApp),db=getFirestore(firebaseApp,'dosprep-rooms');
if(window.DOSPREP_CONFIG.liveEmulator&&['localhost','127.0.0.1'].includes(location.hostname)){
 connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
}
let uid,code='',room=null,players=[],responses=[],responsesReady=false,ownResponse=null,selection='',busy=false,connected=navigator.onLine,autoRevealing=false;
let unsubscribers=[],answerUnsubscribe=null,answerKey='',scores=new Map(),scoreLoading='',errorText='';
const settings={subject:'Reading and Writing',category:'All',count:10,play:false,name:''};
const imageList=(paths,label)=>paths.map(src=>`<img class="pdf-img" src="${esc(src)}" alt="${esc(label)}" draggable="false">`).join('');
const roomRef=()=>doc(db,'rooms',code);
const responseRef=(round,user=uid)=>doc(db,'rooms',code,'rounds',String(round),'answers',user);
const isHost=()=>room?.owner===uid;
const hasAnswered=()=>room?.answeredIds.includes(uid);
function notify(message,error=false){errorText=message;status.textContent=message;status.classList.toggle('error',error);}
function report(error){
 console.error('Live quiz:',error.code||'',error.message);
 const text=error.code==='permission-denied'?'This room is unavailable, has expired, or the action is no longer allowed.':error.code==='unavailable'?'Connection interrupted. Reconnect to continue.':error.message||'Something went wrong. Try again.';
 notify(text,true);
}
function forgetRoom(){
 unsubscribers.forEach(stop=>stop());unsubscribers=[];answerUnsubscribe?.();answerUnsubscribe=null;answerKey='';room=null;code='';players=[];responses=[];ownResponse=null;scores.clear();selection='';scoreLoading='';
 try{localStorage.removeItem('dosprep-live-room');}catch{}history.replaceState(null,'',location.pathname);render();
}
function categories(){return [...new Set(bank.filter(q=>q.subject===settings.subject).map(q=>q.domain))];}
function questionPool(){return bank.filter(q=>q.subject===settings.subject&&(settings.category==='All'||q.domain===settings.category));}
function renderEntry(){
 const invite=location.hash.slice(1).replace(/[^A-Z2-9]/gi,'').toUpperCase().slice(0,6);
 root.innerHTML=`<main class="live-home"><span class="eyebrow">Study together</span><h1>Your next rush.<br>With your people.</h1><p class="muted">Same questions. Private answers. A shared reveal.</p><div class="live-entry-grid"><section class="card"><h2>Join a room</h2><p>Get the code from your host. No account needed.</p><form id="join-room"><label for="join-code">Room code</label><input id="join-code" name="code" maxlength="6" pattern="[A-Za-z2-9]{6}" required autocomplete="off" autocapitalize="characters" value="${esc(invite)}" placeholder="ABC234"><label for="join-name">Your nickname</label><input id="join-name" name="name" maxlength="24" required autocomplete="nickname" placeholder="What should we call you?"><button class="primary" ${busy||!connected?'disabled':''}>Join room →</button></form></section><section class="card"><h2>Host a live quiz</h2><p>Choose a set, share the code, then start when everyone is here.</p><form id="create-room"><label for="live-subject">Subject</label><select id="live-subject"><option>Reading and Writing</option><option>Math</option></select><label for="live-category">Category</label><select id="live-category"><option value="All">All categories</option>${categories().map(d=>`<option ${d===settings.category?'selected':''}>${esc(d)}</option>`).join('')}</select><label for="live-count">Questions</label><select id="live-count">${[5,10,20].map(n=>`<option value="${n}" ${n===settings.count?'selected':''}>${n} questions</option>`).join('')}</select><label class="check live-play"><input id="host-plays" type="checkbox" ${settings.play?'checked':''}>I want to answer too</label><label for="host-name">Host nickname ${settings.play?'':'(optional)'}</label><input id="host-name" maxlength="24" ${settings.play?'required':''} value="${esc(settings.name)}" placeholder="Your nickname"><button class="primary" ${busy||!connected?'disabled':''}>Create room →</button></form></section></div><p class="live-footnote">Up to 20 players · 20 questions · 100 points per correct answer<br>Rooms accept new players until the host starts. Answers lock after submission. No time limit.</p></main>`;
 document.getElementById('live-subject').value=settings.subject;
}
function roster(){
 return room.memberIds.map(id=>{const p=players.find(p=>p.uid===id);return `<li><span class="player-avatar" aria-hidden="true">${esc((p?.name||'?').slice(0,1).toUpperCase())}</span><span>${esc(p?.name||'Joining…')}${id===uid?' <small>(you)</small>':''}</span><span class="player-status">${room.state==='question'?(room.answeredIds.includes(id)?'✓ Answered':'Thinking…'):''}</span>${isHost()&&room.state==='lobby'&&id!==uid?`<button class="remove-player" data-remove-player="${esc(id)}" aria-label="Remove ${esc(p?.name||'player')}">Remove</button>`:''}</li>`;}).join('');
}
function roomHeading(){return `<div class="live-room-heading"><div><span class="eyebrow">${esc(room.subject)} · Live Quiz</span><h1>${room.state==='lobby'?'Your room is ready.':room.state==='finished'?'Every round is progress.':`Question ${room.round+1} of ${room.questionIds.length}`}</h1></div><div class="room-code-block"><span>ROOM CODE</span><strong id="room-code">${code}</strong><button data-live-action="copy">Copy invite link</button></div></div>`;}
function renderLobby(){
 return `<main class="live-room">${roomHeading()}<div class="live-lobby-grid"><section class="card"><h2>Who's in? <span class="muted">${room.memberIds.length}/20</span></h2><ul class="live-roster">${roster()||'<li class="muted">Waiting for your first player…</li>'}</ul></section><section class="card"><h2>${isHost()?'Ready when you are.':'Make yourself comfortable.'}</h2><p>${room.questionIds.length} hard ${esc(room.subject)} questions. Everyone sees the same question and answers privately.</p><p class="muted">Once everyone answers, the room reveals each player's choice and whether it was correct. The host can reveal early if someone is away.</p>${isHost()?`<button class="primary" data-live-action="start" ${busy||!room.memberIds.length||!connected?'disabled':''}>Start quiz →</button><p class="muted">${room.memberIds.includes(uid)?'You are playing too.':'You are hosting as a spectator.'}</p>`:'<p class="waiting-label" role="status">Waiting for the host to start…</p>'}<button data-live-action="leave">${isHost()?'Close room':'Leave lobby'}</button></section></div></main>`;
}
function currentResults(q){
 return `<section class="card live-reveal"><span class="eyebrow">The reveal</span><h2>Correct answer: ${esc(q.correct)}</h2><p class="muted">Every submitted answer is now visible.</p><ul class="answer-reveal-list">${room.roundPlayers.map(id=>{const p=players.find(p=>p.uid===id),answer=responses.find(a=>a.uid===id),correct=isCorrect(q,answer?.answer);return `<li class="${correct?'answer-right':'answer-wrong'}"><span>${esc(p?.name||'Player')}${id===uid?' (you)':''}</span><strong>${answer?esc(answer.answer):'No answer'}</strong><span>${correct?'✓ Correct':answer?'✕ Incorrect':'— Unanswered'}</span></li>`;}).join('')}</ul><details><summary>Show explanation</summary>${imageList(q.explanation,'College Board answer explanation')}</details></section>`;
}
function leaderboard(){
 const rows=room.memberIds.map(id=>({uid:id,name:players.find(p=>p.uid===id)?.name||'Player',correct:scores.get(id)||0})).sort((a,b)=>b.correct-a.correct||a.name.localeCompare(b.name));
 return `<section class="card live-leaderboard"><h2>Leaderboard</h2><p class="muted">100 points per correct answer. Everyone gets the time they need.</p><ol>${rows.map(p=>`<li><span>${esc(p.name)}${p.uid===uid?' (you)':''}</span><strong>${p.correct*100} <small>pts</small></strong></li>`).join('')}</ol></section>`;
}
function renderQuestion(){
 const q=byId.get(room.questionIds[room.round]);if(!q)return '<main><h1>Question unavailable</h1><p>Refresh to load the latest question library.</p></main>';
 const revealing=room.state==='reveal',participant=room.roundPlayers.includes(uid),answered=hasAnswered(),locked=answered||revealing||!participant||busy||!connected;
 const choiceView=q.type==='numeric'?`<div class="card"><label for="live-answer"><b>Your answer</b></label><p class="muted">Enter a number, decimal, or fraction.</p><input id="live-answer" maxlength="80" autocomplete="off" value="${esc(ownResponse?.answer||selection)}" ${locked?'disabled':''} aria-describedby="live-answer-hint"><small id="live-answer-hint">Examples: 12, -0.5, 2/3</small></div>`:`<div class="choices">${'ABCD'.split('').map(k=>`<button data-live-choice="${k}" class="choice ${selection===k||ownResponse?.answer===k?'chosen':''} ${revealing&&q.correct===k?'correct':''}" ${locked?'disabled':''} aria-pressed="${selection===k||ownResponse?.answer===k}" aria-label="Answer ${k}"><span class="letter">${k}</span><div class="choice-content">${imageList(q.choices[k],'Answer choice '+k)}</div></button>`).join('')}</div>`;
 return `<div class="live-game"><div class="live-room live-game-head">${roomHeading()}<div class="live-round-status"><span role="status">${revealing?'Answers revealed':`${room.answeredIds.length} / ${room.roundPlayers.length} answered`}</span>${isHost()?`<div class="toolbar">${revealing?`<button class="primary" data-live-action="next" ${busy||!connected?'disabled':''}>${room.round+1===room.questionIds.length?'Finish quiz':'Next question →'}</button>`:`<button data-live-action="reveal" ${busy||!connected?'disabled':''}>Reveal now</button>`}<button data-live-action="end">End quiz</button></div>`:''}</div></div><section class="study"><p class="muted">${esc(q.skill)} · Hard · ID ${esc(q.id)}</p><div class="paper">${imageList(q.passage,'Question '+q.id)}</div><div class="live-answer-area">${revealing?(responsesReady?`${q.type!=='numeric'?choiceView:''}${currentResults(q)}`:'<p class="waiting-label" role="status">Loading the reveal…</p>'):participant?`${choiceView}<button class="primary live-submit" data-live-action="answer" ${locked||!validSelection(q)?'disabled':''}>${answered?'Answer submitted ✓':busy?'Submitting…':'Lock in answer'}</button><p class="muted live-answer-note" role="status">${answered?'Your answer is private until the reveal. Waiting for the others…':'Your answer locks when you submit. Nobody else can see it before the reveal.'}</p>`:`${q.type!=='numeric'?choiceView:''}<div class="card"><h2>Everyone is thinking.</h2><p class="muted">You are hosting as a spectator. Player choices stay hidden until the reveal.</p></div>`}</div>${revealing?leaderboard():`<details class="card live-roster-card"><summary>Players · ${room.roundPlayers.length}</summary><ul class="live-roster">${roster()}</ul></details>`}${revealing&&!isHost()?'<p class="waiting-label" role="status">Waiting for the host to continue…</p>':''}</section></div>`;
}
function render(){
 const active=document.activeElement,restore=active?.id==='live-answer'?{start:active.selectionStart,end:active.selectionEnd}:null;
 if(!room){renderEntry();return;}
 if(room.state==='lobby')root.innerHTML=renderLobby();
 else if(room.state==='finished')root.innerHTML=`<main class="live-room">${roomHeading()}${leaderboard()}<p class="muted">Quiz complete. Thanks for studying together.</p><div class="toolbar">${isHost()?'<button data-live-action="delete">Delete room & answers</button>':''}<button class="primary" data-live-action="back">Back to Live Quiz</button></div></main>`;
 else root.innerHTML=renderQuestion();
 if(restore){const input=document.getElementById('live-answer');if(input&&!input.disabled){input.focus();input.setSelectionRange(restore.start,restore.end);}}
}
function validSelection(q){return q.type==='numeric'?numericValue(selection)!==null:'ABCD'.includes(selection)&&selection.length===1;}
function watchAnswers(){
 if(room.state==='lobby'){answerUnsubscribe?.();answerUnsubscribe=null;answerKey='';return;}
 const mode=room.state==='reveal'||room.state==='finished'?'public':'private',key=`${code}:${room.round}:${mode}`;
 if(answerKey===key)return;answerKey=key;answerUnsubscribe?.();responses=[];responsesReady=false;ownResponse=null;
 const watchedCode=code,round=room.round;
 const answerError=error=>{if(code===watchedCode&&room?.state!=='finished')report(error);};
 if(mode==='public')answerUnsubscribe=onSnapshot(collection(db,'rooms',code,'rounds',String(round),'answers'),{includeMetadataChanges:true},snapshot=>{
  if(code!==watchedCode||room?.round!==round||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;responses=snapshot.docs.map(d=>d.data());responsesReady=true;render();loadScores();
 },answerError);
 else answerUnsubscribe=onSnapshot(responseRef(round),snapshot=>{if(code!==watchedCode||room?.round!==round)return;ownResponse=snapshot.exists()?snapshot.data():null;render();},answerError);
}
async function loadScores(){
 if(!room||!['reveal','finished'].includes(room.state))return;
 const stamp=`${code}:${room.round}:${room.state}:${responses.length}`;if(scoreLoading===stamp)return;scoreLoading=stamp;
 const activeCode=code,round=room.round,ids=[...room.questionIds];
 try{
  const rounds=await Promise.all(Array.from({length:round+1},(_,i)=>getDocs(collection(db,'rooms',activeCode,'rounds',String(i),'answers'))));
  if(code!==activeCode||room?.round!==round||!['reveal','finished'].includes(room.state))return;
  scores=new Map();rounds.forEach((snapshot,i)=>snapshot.forEach(d=>{const a=d.data();if(byId.has(ids[i])&&isCorrect(byId.get(ids[i]),a.answer))scores.set(a.uid,(scores.get(a.uid)||0)+1);}));render();
 }catch(error){report(error);}
}
function watch(codeToWatch){
 unsubscribers.forEach(stop=>stop());answerUnsubscribe?.();unsubscribers=[];answerUnsubscribe=null;answerKey='';scores.clear();scoreLoading='';selection='';code=codeToWatch;
 history.replaceState(null,'',location.pathname+'#'+code);try{localStorage.setItem('dosprep-live-room',code);}catch{}
 unsubscribers.push(onSnapshot(doc(db,'rooms',code),{includeMetadataChanges:true},snapshot=>{
  // Start protected reads only after the room's phase change is server-confirmed.
  if(snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache)return;
  if(!snapshot.exists()){forgetRoom();notify('This room has closed. You can create or join another one.');return;}
  const next=snapshot.data();if(next.owner!==uid&&!next.memberIds.includes(uid)){forgetRoom();notify('You left this room or the host removed you.');return;}
  if(room?.round!==next.round)selection='';room=next;
  if(room.expiresAt.toMillis()<=Date.now()&&!isHost()){forgetRoom();notify('This room has expired.');return;}
  watchAnswers();render();if(['reveal','finished'].includes(room.state))loadScores();else maybeReveal();
 },error=>{forgetRoom();report(error);}));
 unsubscribers.push(onSnapshot(collection(db,'rooms',code,'players'),snapshot=>{players=snapshot.docs.map(d=>({uid:d.id,...d.data()}));render();},error=>{if(error.code!=='permission-denied')report(error);}));
}
async function maybeReveal(){
 if(autoRevealing||!room||room.state!=='question'||!room.roundPlayers.length||room.answeredIds.length!==room.roundPlayers.length||room.answeredIds.at(-1)!==uid)return;
 autoRevealing=true;try{await changeRoom('auto-reveal');}catch(error){report(error);}finally{autoRevealing=false;}
}
async function changeRoom(action){
 const ref=roomRef();await runTransaction(db,async transaction=>{
  const snapshot=await transaction.get(ref);if(!snapshot.exists())throw Error('The room has closed.');const r=snapshot.data();
  if(action==='auto-reveal'){
   if(r.state==='question'&&r.roundPlayers.length&&r.answeredIds.length===r.roundPlayers.length)transaction.update(ref,{state:'reveal'});return;
  }
  if(r.owner!==uid)throw Error('Only the host can do that.');
  if(action==='start'){if(r.state!=='lobby'||!r.memberIds.length)throw Error('Wait for at least one player to join.');transaction.update(ref,{state:'question',roundPlayers:r.memberIds,answeredIds:[]});}
  else if(action==='reveal'){if(r.state!=='question')return;transaction.update(ref,{state:'reveal'});}
  else if(action==='next'){if(r.state!=='reveal')return;transaction.update(ref,r.round+1===r.questionIds.length?{state:'finished'}:{state:'question',round:r.round+1,roundPlayers:r.memberIds,answeredIds:[]});}
  else if(action==='end')transaction.update(ref,{state:'finished'});
 });
}
async function createRoom(){
 const pool=questionPool();if(!pool.length)throw Error('No questions match these filters.');
 const name=settings.name.trim();if(settings.play&&!name)throw Error('Enter your nickname to play.');
 for(let attempt=0;attempt<5;attempt++){
  const generated=roomCode(),ref=doc(db,'rooms',generated);
  const created=await runTransaction(db,async transaction=>{
   if((await transaction.get(ref)).exists())return false;
   transaction.set(ref,{owner:uid,subject:settings.subject,questionIds:shuffled(pool).slice(0,settings.count).map(q=>q.id),state:'lobby',round:0,memberIds:settings.play?[uid]:[],roundPlayers:[],answeredIds:[],createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+23*60*60*1000)});
   if(settings.play)transaction.set(doc(db,'rooms',generated,'players',uid),{name,joinedAt:serverTimestamp()});return true;
  });if(created){watch(generated);return;}
 }throw Error('Could not create a room code. Try again.');
}
async function joinRoom(joinCode,name){
 joinCode=joinCode.replace(/\s/g,'').toUpperCase();name=name.trim();
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(joinCode)||!name||name.length>24)throw Error('Enter a six-character room code and a nickname.');
 const ref=doc(db,'rooms',joinCode);
 const snapshot=await getDoc(ref);if(!snapshot.exists())throw Error('No room has that code. Check it with your host.');const r=snapshot.data();
 if(r.owner!==uid&&!r.memberIds.includes(uid)){
  if(r.state!=='lobby')throw Error('This quiz has already started. Join the next room.');
  if(r.memberIds.length>=20)throw Error('This room is full (20 players).');
  const batch=writeBatch(db);batch.update(ref,{memberIds:arrayUnion(uid)});batch.set(doc(db,'rooms',joinCode,'players',uid),{name,joinedAt:serverTimestamp()});await batch.commit();
 }watch(joinCode);
}
async function submitAnswer(){
 if(!room||room.state!=='question'||hasAnswered()||!room.roundPlayers.includes(uid))return;
 const round=room.round,answer=selection,q=byId.get(room.questionIds[round]);if(!validSelection(q))return;
 // The array transform merges simultaneous submissions without replacing a peer's status.
 const batch=writeBatch(db);batch.set(responseRef(round),{uid,round,answer,submittedAt:serverTimestamp()});batch.update(roomRef(),{answeredIds:arrayUnion(uid)});await batch.commit();
 window.DosPrepAnswerEvents?.live(`live_${code}_${room.createdAt.toMillis()}_${round}_${uid}`,q.id);
}
async function removePlayer(playerUid){
 if(room.state!=='lobby')throw Error('Players can leave only in the lobby.');
 const batch=writeBatch(db);batch.update(roomRef(),{memberIds:arrayRemove(playerUid)});batch.delete(doc(db,'rooms',code,'players',playerUid));await batch.commit();if(playerUid===uid)forgetRoom();
}
async function deleteRoom(){
 if(!isHost()||room.state!=='finished')return;
 const activeCode=code,memberDocs=await getDocs(collection(db,'rooms',code,'players'));
 const roundDocs=await Promise.all(Array.from({length:room.round+1},(_,i)=>getDocs(collection(db,'rooms',code,'rounds',String(i),'answers'))));
 const batch=writeBatch(db);memberDocs.forEach(d=>batch.delete(d.ref));roundDocs.forEach(snapshot=>snapshot.forEach(d=>batch.delete(d.ref)));batch.delete(doc(db,'rooms',activeCode));await batch.commit();forgetRoom();notify('Room and submitted answers deleted.');
}
async function act(task){if(busy)return;if(!connected){notify('Reconnect to continue.',true);return;}busy=true;notify('');render();try{await task();}catch(error){report(error);}finally{busy=false;render();}}
root.addEventListener('submit',event=>{
 event.preventDefault();if(event.target.id==='create-room')act(createRoom);
 if(event.target.id==='join-room'){const form=event.target;const joinCode=form.elements.code.value,name=form.elements.name.value;act(()=>joinRoom(joinCode,name));}
});
root.addEventListener('change',event=>{
 const el=event.target;
 if(el.id==='live-subject'){settings.subject=el.value;settings.category='All';render();}
 if(el.id==='live-category')settings.category=el.value;
 if(el.id==='live-count')settings.count=Number(el.value);
 if(el.id==='host-plays'){settings.play=el.checked;render();}
});
root.addEventListener('input',event=>{
 if(event.target.id==='host-name')settings.name=event.target.value;
 if(event.target.id==='live-answer'){selection=event.target.value.trim();const button=root.querySelector('[data-live-action="answer"]');if(button)button.disabled=busy||!connected||!validSelection(byId.get(room.questionIds[room.round]));}
});
root.addEventListener('keydown',event=>{if(event.target.id==='live-answer'&&event.key==='Enter'){event.preventDefault();act(submitAnswer);}});
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.liveChoice&&room?.state==='question'&&!hasAnswered()&&room.roundPlayers.includes(uid)){selection=button.dataset.liveChoice;render();return;}
 if(button.dataset.removePlayer){act(()=>removePlayer(button.dataset.removePlayer));return;}
 const action=button.dataset.liveAction;
 if(action==='answer')act(submitAnswer);
 if(action==='copy')navigator.clipboard.writeText(location.origin+location.pathname+'#'+code).then(()=>notify('Invite link copied.')).catch(()=>notify('Share this room code: '+code));
 if(['start','next'].includes(action))act(()=>changeRoom(action));
 if(action==='reveal'&&confirm('Reveal now? Players who have not submitted will be marked unanswered.'))act(()=>changeRoom('reveal'));
 if(action==='end'&&confirm('End this quiz and show the leaderboard?'))act(()=>changeRoom('end'));
 if(action==='leave'){if(isHost())act(()=>changeRoom('end'));else act(()=>removePlayer(uid));}
 if(action==='delete'&&confirm('Delete this room and all its submitted answers?'))act(deleteRoom);
 if(action==='back')forgetRoom();
});
window.addEventListener('offline',()=>{connected=false;notify('You are offline. Your submitted answer is saved; reconnect to continue.',true);render();});
window.addEventListener('online',()=>{connected=true;notify('Connection restored.');render();});
async function initialize(){
 try{
  await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);uid=auth.currentUser.uid;
  let previous='';try{previous=localStorage.getItem('dosprep-live-room')||'';}catch{}
  const invited=location.hash.slice(1).toUpperCase(),restore=invited||previous;
  if(/^[A-HJ-NP-Z2-9]{6}$/.test(restore)){
   const snapshot=await getDoc(doc(db,'rooms',restore));if(snapshot.exists()&&(snapshot.data().owner===uid||snapshot.data().memberIds.includes(uid))){watch(restore);return;}
  }render();
 }catch(error){render();report(error);}
}
initialize();
