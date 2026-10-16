'use strict';
const root=document.getElementById('app');
const BANK=window.QUESTIONS;
const KEY='reading-rush-v1';
let saved;
try{saved=JSON.parse(localStorage.getItem(KEY))||{};}catch{saved={};}
saved.history=Array.isArray(saved.history)?saved.history:[];
saved.flags=Array.isArray(saved.flags)?saved.flags:[];
const config={skills:[...new Set(BANK.map(q=>q.skill))],difficulty:'All',count:10,pace:'Steady',skip:false,pool:'all'};
let session=null,review=null,clock=null,currentView='setup';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{alert('Your browser could not save progress. Export your progress before closing.');}};
const images=(paths,alt)=>paths.map((p,i)=>`<img class="pdf-img" src="${esc(p)}" alt="${esc(alt)}${paths.length>1?' (part '+(i+1)+')':''}">`).join('');
const icon='<span class="logo">ϟ</span>';
function shell(body,active='rush'){return `<div class="shell"><aside class="sidebar"><div class="brand">${icon}reading<b>rush</b></div><div class="eyebrow">Your study space</div><nav class="nav"><button data-action="setup" class="${active==='rush'?'active':''}">ϟ &nbsp; Question Rush</button><button data-action="history" class="${active==='history'?'active':''}">◷ &nbsp; Practice history</button></nav><div class="aside-note">SAT · Reading and Writing<br>Personal practice library<br><br>Progress stays in this browser.<br><button data-action="export" style="margin-top:12px">Export progress</button><label style="display:block;margin-top:14px">Restore progress <input type="file" id="restore" accept="application/json" style="max-width:170px;margin-top:8px"></label></div></aside><main>${body}</main></div>`;}
function pool(){
 const answered=new Set(saved.history.flatMap(h=>h.answers.map(a=>a.id)));
 const missed=new Set(saved.history.flatMap(h=>h.answers.filter(a=>!a.correct).map(a=>a.id)));
 return BANK.filter(q=>config.skills.includes(q.skill)&&(config.difficulty==='All'||q.difficulty===config.difficulty)&&(!config.skip||!answered.has(q.id))&&(config.pool==='all'||config.pool==='mistakes'&&missed.has(q.id)||config.pool==='flagged'&&saved.flags.includes(q.id)));
}
function setup(){
 stopClock();currentView='setup';review=null;
 const available=pool().length,skills=[...new Set(BANK.map(q=>q.skill))];
 root.innerHTML=shell(`<div class="topline"><span class="eyebrow">Practice with purpose</span><span class="pill">Reading & Writing · ${BANK.length} questions</span></div><div class="hero"><div><h1>A little focus. A faster you.</h1><p>Build your reading rhythm, one question at a time. Choose your skills, set a pace, and find your flow.</p></div><div class="hero-mark">ϟ</div></div><div class="layout"><section class="card"><h2>Set up your rush</h2><small>A focused session, built around you.</small><div class="field"><label>01 &nbsp; Choose your skills</label><div class="skills">${skills.map(s=>`<label class="check"><input type="checkbox" data-skill="${esc(s)}" ${config.skills.includes(s)?'checked':''}><span>${esc(s)}</span><small>${BANK.filter(q=>q.skill===s).length}</small></label>`).join('')}</div></div><div class="field"><label for="difficulty">02 &nbsp; Difficulty</label><select id="difficulty">${['All','Easy','Medium','Hard'].map(d=>`<option ${config.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></div><div class="field"><label>03 &nbsp; Session length</label><div class="seg">${[10,20,30,'All'].map(n=>`<button data-count="${n}" class="${config.count===n?'selected':''}">${n}${n==='All'?' matching':' questions'}</button>`).join('')}</div></div><div class="field"><label>04 &nbsp; Your pace</label><div class="seg">${['Relaxed','Steady','Blitz'].map(p=>`<button data-pace="${p}" class="${config.pace===p?'selected':''}">${p}<br><small>${{Relaxed:'120',Steady:'75',Blitz:'45'}[p]}s / question</small></button>`).join('')}</div></div><div class="field"><label for="pool">Practice from</label><select id="pool"><option value="all">All questions</option><option value="mistakes">Previous mistakes</option><option value="flagged">Marked for review</option></select></div><label class="check" style="margin-top:18px"><input type="checkbox" id="skip" ${config.skip?'checked':''}><span>Skip previously attempted questions</span></label><div class="start"><div><b>${available} questions available</b><small>${available?Math.min(available,config.count==='All'?available:config.count)+' unique questions in this round':'Change your filters to find questions.'}</small></div><button class="primary" data-action="start" ${!available?'disabled':''}>Start rush &nbsp; →</button></div></section><aside><div class="card"><span class="eyebrow">Make every attempt count</span><h2 style="margin-top:12px">Find your pace.</h2>${[['1','Focus on a skill','A short set makes it easier to spot what slows you down.'],['2','Balance speed and accuracy','Correct answers earn up to three stars. Keep your streak going.'],['3','Learn from the details','Review every answer with the original explanation.']].map(([n,t,p])=>`<div class="how"><span class="step">${n}</span><div><h3>${t}</h3><p>${p}</p></div></div>`).join('')}<div class="library-note"><b>Your starting library</b><br>${BANK.length} official questions from your supplied College Board export. This batch covers Information and Ideas at Hard difficulty. Sessions use each matching question once.</div><p class="offline-note">Pace settings and star thresholds are this app’s own rules: 3 stars in the first third of the timer, 2 in the second, 1 in the last. Timeouts earn 0.</p></div><div class="card" style="margin-top:20px"><small>YOUR PRACTICE SO FAR</small><h2 style="margin-top:12px">${saved.history.length} sessions completed</h2><button data-action="history">View practice history →</button></div></aside></div>`);
 document.getElementById('pool').value=config.pool;
}
function shuffle(xs){const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function start(){
 const qs=shuffle(pool()).slice(0,config.count==='All'?Infinity:config.count);if(!qs.length)return;
 session={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),qs,index:0,answers:[],selected:null,eliminated:[],limit:{Relaxed:120,Steady:75,Blitz:45}[config.pace],pace:config.pace,streak:0,best:0,started:Date.now(),questionStarted:Date.now(),showExplanation:false};
 renderQuestion();startClock();
}
function stopClock(){clearInterval(clock);clock=null;}
function startClock(){stopClock();clock=setInterval(tick,200);tick();}
function elapsed(){return (Date.now()-session.questionStarted)/1000;}
function tick(){if(!session||currentView!=='question')return;const done=session.answers[session.index];const t=document.getElementById('timer');if(t)t.textContent=done?time(done.seconds):time(Math.ceil(session.limit-elapsed()));if(!done&&elapsed()>=session.limit)submit(true);}
function renderQuestion(){
 currentView='question';const q=session.qs[session.index],a=session.answers[session.index];
 root.innerHTML=`<header class="study-head"><div class="study-top"><button data-action="end">← End round</button><div class="study-status"><span>🔥 ${session.streak} streak</span><span>${session.answers.filter(a=>a.correct).length}/${session.answers.length} correct</span></div><div class="timer"><span class="stars">★</span> &nbsp; <span id="timer">${time(a?a.seconds:session.limit-elapsed())}</span></div></div><div class="progress"><span style="width:${100*session.answers.length/session.qs.length}%"></span></div></header><section class="study"><div class="question-meta"><span>READING & WRITING &nbsp; / &nbsp; ${esc(q.skill)} &nbsp; · &nbsp; ${q.difficulty}</span><button data-action="flag" class="${saved.flags.includes(q.id)?'flagged':''}">${saved.flags.includes(q.id)?'⚑ Marked':'⚐ Mark for review'}</button></div><div class="question-split"><div class="paper passage">${images(q.passage,'Original College Board question '+q.id)}</div><div><div class="choices">${'ABCD'.split('').map(k=>`<div class="choice-row"><button data-choice="${k}" ${a?'disabled':''} class="choice ${!a&&session.selected===k?'chosen':''} ${session.eliminated.includes(k)?'eliminated':''} ${a&&q.correct===k?'correct':''} ${a&&!a.correct&&a.selected===k?'wrong':''}" aria-label="Choose answer ${k}" aria-pressed="${session.selected===k}"><span class="letter">${k}</span><div class="choice-content">${images(q.choices[k],'Answer choice '+k)}</div></button><button data-eliminate="${k}" ${a?'disabled':''} class="eliminate" aria-label="${session.eliminated.includes(k)?'Restore':'Eliminate'} answer ${k}">${session.eliminated.includes(k)?'↶':'⊘'}</button></div>`).join('')}</div>${a?`<div class="feedback ${a.correct?'':'bad'}" role="status"><strong>${a.timeout?'Time’s up':a.correct?'Correct. Nicely done.':'Keep going. This is how you learn.'} <span class="stars">${'★'.repeat(a.stars)}</span></strong>Correct answer: ${q.correct} · Your time: ${time(a.seconds)}<br><button data-action="explanation" style="margin-top:12px">${session.showExplanation?'Hide':'Read'} explanation</button></div>`:''}</div></div>${a&&session.showExplanation?`<div class="card explanation"><h2>Answer explanation</h2>${images(q.explanation,'College Board answer rationale for '+q.id)}</div>`:''}</section><footer class="study-footer"><span>Question ${session.index+1} / ${session.qs.length}<br><small>ID ${q.id}</small></span><span class="muted">${session.pace} pace · ${session.limit}s</span><button class="primary" data-action="${a?'next':'submit'}" ${!a&&!session.selected?'disabled':''}>${a?(session.index+1===session.qs.length?'See results':'Next question →'):'Check answer'}</button></footer>`;
 tick();
}
function submit(timeout=false){
 if(session.answers[session.index]||!timeout&&!session.selected)return;
 const q=session.qs[session.index],seconds=Math.min(session.limit,elapsed()),correct=!timeout&&session.selected===q.correct;
 const stars=correct?(seconds<=session.limit/3?3:seconds<=session.limit*2/3?2:1):0;
 session.streak=correct?session.streak+1:0;session.best=Math.max(session.best,session.streak);
 session.answers.push({id:q.id,selected:timeout?null:session.selected,correct,seconds,stars,timeout,skill:q.skill,difficulty:q.difficulty});renderQuestion();
}
function next(){if(session.index+1===session.qs.length){finish();return;}session.index++;session.selected=null;session.eliminated=[];session.showExplanation=false;session.questionStarted=Date.now();renderQuestion();window.scrollTo(0,0);}
function finish(){
 stopClock();if(!session.answers.length){setup();return;}
 const result={id:session.id,date:new Date().toISOString(),pace:session.pace,limit:session.limit,best:session.best,answers:session.answers,planned:session.qs.length};
 saved.history.unshift(result);persist();showResults(result);session=null;
}
function showResults(h){
 stopClock();currentView='results';review=h;
 const n=h.answers.length,correct=h.answers.filter(a=>a.correct).length,total=h.answers.reduce((s,a)=>s+a.seconds,0),max=Math.max(1,...h.answers.map(a=>a.seconds));
 const skills=[...new Set(h.answers.map(a=>a.skill))];
 root.innerHTML=shell(`<div class="topline"><button data-action="setup">← Back to Question Rush</button><span class="pill">${esc(h.pace)} pace</span></div><div class="result-title"><span class="eyebrow">Every round is progress</span><h1>Session results</h1><p class="muted">Reading and Writing · ${new Date(h.date).toLocaleString()}</p></div><div class="stats">${[['Time',time(total)],['Correct',correct+'/'+n],['Accuracy',Math.round(100*correct/n)+'%'],['Best streak',h.best],['Stars',h.answers.reduce((s,a)=>s+a.stars,0)]].map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><div class="analytics"><div class="card"><h2>Your pacing</h2><small>Time spent on each question · session average ${time(total/n)}</small><div class="bars">${h.answers.map((a,i)=>`<div class="bar-item"><span>${Math.round(a.seconds)}s</span><div class="bar" style="height:${Math.max(3,120*a.seconds/max)}px;background:${a.correct?'#40b5e8':'#e9a2a4'}"></div><span>Q${i+1}</span></div>`).join('')}</div><small>Blue = correct · rose = incorrect or timed out</small></div><div class="card"><h2>Reading and Writing</h2><small>Accuracy by skill</small>${skills.map(s=>{const as=h.answers.filter(a=>a.skill===s),p=Math.round(100*as.filter(a=>a.correct).length/as.length);return `<div class="topic-row"><div><span>${esc(s)}<br><small>${as.length} attempt${as.length===1?'':'s'}</small></span><b>${p}%</b></div><div class="topic-track"><i style="width:${p}%"></i></div></div>`;}).join('')}</div></div><div class="banner"><div><h2>Turn your attempts into understanding.</h2><small>Walk through each question and its original explanation.</small></div><button class="primary" data-review="0">Start review →</button></div><h3>Question review</h3><div class="review-grid">${h.answers.map((a,i)=>`<button class="review-tile" data-review="${i}"><b class="${a.correct?'ok':'bad-text'}">${a.correct?'✓':'✕'}</b> &nbsp; Question ${i+1}<span class="stars" style="float:right">${'★'.repeat(a.stars)}</span><small>${Math.round(a.seconds)}s &nbsp; · &nbsp; ${a.difficulty}${a.timeout?' · Timed out':''}</small></button>`).join('')}</div>`);
 window.scrollTo(0,0);
}
function showReview(i){
 currentView='review';const a=review.answers[i],q=BANK.find(q=>q.id===a.id);if(!q){alert('This question is not in the current library.');return;}
 root.innerHTML=`<div class="study"><div class="topline"><button data-action="results">← Session results</button><span class="pill">Question ${i+1} / ${review.answers.length}</span></div><h1>Make it click.</h1><p class="muted">${esc(q.skill)} · ${q.difficulty} · ID ${q.id}</p><div class="feedback ${a.correct?'':'bad'}"><strong>${a.correct?'Correct':'Incorrect'} · ${Math.round(a.seconds)} seconds</strong>Your answer: ${a.selected||'Timed out'} · Correct answer: ${q.correct}</div><div class="paper">${images(q.passage,'Question '+q.id)}<div class="choices" style="margin-top:25px">${'ABCD'.split('').map(k=>`<div class="choice ${k===q.correct?'correct':k===a.selected?'wrong':''}">${images(q.choices[k],'Answer '+k)}</div>`).join('')}</div></div><div class="card explanation"><h2>Why ${q.correct} is correct</h2>${images(q.explanation,'Original answer explanation')}</div><div class="toolbar" style="margin-top:20px"><button data-review="${i-1}" ${i===0?'disabled':''}>← Previous</button><button data-review="${i+1}" ${i===review.answers.length-1?'disabled':''}>Next question →</button></div></div>`;window.scrollTo(0,0);
}
function history(){stopClock();currentView='history';root.innerHTML=shell(`<div class="eyebrow">Your learning, over time</div><h1>Practice history</h1><p class="muted">Revisit your sessions, review mistakes, and keep building.</p><div class="card">${saved.history.length?saved.history.map((h,i)=>`<div class="history-row"><div><b>${h.answers.filter(a=>a.correct).length} / ${h.answers.length} correct</b><small>${new Date(h.date).toLocaleString()} · ${esc(h.pace)} pace · ${h.answers.reduce((s,a)=>s+a.stars,0)} stars</small></div><button data-history="${i}">View results →</button></div>`).join(''):'<div class="empty">Your first session starts here.<br><button data-action="setup" style="margin-top:15px">Start practicing</button></div>'}</div>`,'history');}
root.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.count){config.count=b.dataset.count==='All'?'All':Number(b.dataset.count);setup();return;}
 if(b.dataset.pace){config.pace=b.dataset.pace;setup();return;}
 if(b.dataset.choice){if(!session.answers[session.index]&&!session.eliminated.includes(b.dataset.choice)){session.selected=b.dataset.choice;renderQuestion();}return;}
 if(b.dataset.eliminate){const k=b.dataset.eliminate;if(session.eliminated.includes(k))session.eliminated=session.eliminated.filter(v=>v!==k);else{session.eliminated.push(k);if(session.selected===k)session.selected=null;}renderQuestion();return;}
 if(b.dataset.review!==undefined){showReview(Number(b.dataset.review));return;}
 if(b.dataset.history!==undefined){showResults(saved.history[Number(b.dataset.history)]);return;}
 switch(b.dataset.action){
 case 'setup':setup();break;case 'start':start();break;case 'submit':submit();break;case 'next':next();break;
 case 'end':if(confirm('End this round? Completed answers will be saved.'))finish();break;
 case 'history':history();break;case 'results':showResults(review);break;
 case 'flag':{const id=session.qs[session.index].id;saved.flags=saved.flags.includes(id)?saved.flags.filter(v=>v!==id):[...saved.flags,id];persist();renderQuestion();break;}
 case 'explanation':session.showExplanation=!session.showExplanation;renderQuestion();break;
 case 'export':{const blob=new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='reading-rush-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
 }
});
root.addEventListener('change',async e=>{
 const el=e.target;
 if(el.dataset.skill){config.skills=el.checked?[...config.skills,el.dataset.skill]:config.skills.filter(s=>s!==el.dataset.skill);setup();}
 if(el.id==='difficulty'){config.difficulty=el.value;setup();}
 if(el.id==='pool'){config.pool=el.value;setup();}
 if(el.id==='skip'){config.skip=el.checked;setup();}
 if(el.id==='restore'&&el.files[0]){try{const data=JSON.parse(await el.files[0].text());if(!Array.isArray(data.history)||!Array.isArray(data.flags)||!data.flags.every(x=>typeof x==='string')||!data.history.every(h=>typeof h.id==='string'&&Number.isFinite(h.best)&&!isNaN(Date.parse(h.date))&&typeof h.pace==='string'&&Array.isArray(h.answers)&&h.answers.length>0&&h.answers.every(a=>typeof a.id==='string'&&typeof a.skill==='string'&&typeof a.difficulty==='string'&&typeof a.correct==='boolean'&&Number.isFinite(a.seconds)&&a.seconds>=0&&Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3)))throw Error();if(confirm('Replace this browser’s progress with the selected backup?')){saved=data;persist();history();}}catch{alert('That file is not a valid Reading Rush progress backup.');}}
});
document.addEventListener('keydown',e=>{if(currentView!=='question'||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toUpperCase();if('ABCD'.includes(k)&&k.length===1&&!session.answers[session.index]){session.selected=k;session.eliminated=session.eliminated.filter(x=>x!==k);renderQuestion();}if(e.key==='Enter'&&e.target===document.body){e.preventDefault();if(session.answers[session.index])next();else submit();}});
window.addEventListener('beforeunload',e=>{if(currentView==='question'){e.preventDefault();e.returnValue='';}});
setup();
