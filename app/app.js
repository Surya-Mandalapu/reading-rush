'use strict';
const root=document.getElementById('app');
let readingSize='Comfortable';
try{const value=localStorage.getItem('dosprep-reading-size');if(['Compact','Comfortable','Large'].includes(value))readingSize=value;}catch{}
function applyReadingSize(){document.documentElement.dataset.readingSize=readingSize;}
applyReadingSize();
const BANK=window.QUESTIONS;
let KEY='reading-rush-v1';
let activeAccountId=null;
let saved;
try{saved=JSON.parse(localStorage.getItem(KEY))||{};}catch{saved={};}
saved.history=Array.isArray(saved.history)?saved.history:[];
saved.flags=Array.isArray(saved.flags)?saved.flags:[];
saved.highlights=saved.highlights&&typeof saved.highlights==='object'?saved.highlights:{};
const config={subject:'Reading and Writing',domains:[...new Set(BANK.filter(q=>q.subject==='Reading and Writing').map(q=>q.domain))],skills:[...new Set(BANK.map(q=>q.skill))],difficulty:'All',count:10,pace:'Steady',skip:false,pool:'all'};
let session=null,review=null,clock=null,currentView='setup',insightSubject='Reading and Writing',reviewRevealed=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{alert('Your browser could not save progress. Export your progress before closing.');}};
const images=(paths,alt)=>paths.map((p,i)=>`<img class="pdf-img" src="${esc(p)}" alt="${esc(alt)}${paths.length>1?' (part '+(i+1)+')':''}">`).join('');
const icon='<span class="logo">ϟ</span>';
function shell(body,active='rush'){return `<div class="shell"><aside class="sidebar"><a href="index.html" class="brand brand-link">${icon}Dos<b>Prep</b></a>${accountControls()}<div class="eyebrow">Your study space</div><nav class="nav"><button data-action="insights" class="${active==='insights'?'active':''}">◈ &nbsp; Category insights</button><button data-action="setup" class="${active==='rush'?'active':''}">ϟ &nbsp; Question Rush</button><button data-action="history" class="${active==='history'?'active':''}">◷ &nbsp; Practice history</button></nav><div class="aside-note">SAT · Reading, Writing & Math<br>Your practice library<br><br>Progress is saved on this device. Signing in does not sync it across devices.<br><button data-action="export" style="margin-top:12px">Export progress</button><label style="display:block;margin-top:14px">Restore progress <input type="file" id="restore" accept="application/json" style="max-width:170px;margin-top:8px"></label></div></aside><main><div class="mobile-nav">${accountControls()}<button data-action="setup">Practice</button><button data-action="insights">Insights</button><button data-action="history">History</button><button data-action="export">Backup</button></div>${body}</main></div>`;}
function pool(){
 const answered=new Set(saved.history.flatMap(h=>h.answers.map(a=>a.id)));
 const missed=new Set(saved.history.flatMap(h=>h.answers.filter(a=>!a.correct).map(a=>a.id)));
 return BANK.filter(q=>q.subject===config.subject&&config.domains.includes(q.domain)&&config.skills.includes(q.skill)&&(config.difficulty==='All'||q.difficulty===config.difficulty)&&(!config.skip||!answered.has(q.id))&&(config.pool==='all'||config.pool==='mistakes'&&missed.has(q.id)||config.pool==='flagged'&&saved.flags.includes(q.id)));
}
function subjectCategories(){return [...new Set(BANK.filter(q=>q.subject===config.subject).map(q=>q.domain))];}
function categorySelectors(){
 const categories=subjectCategories(),all=categories.every(d=>config.domains.includes(d));
 return `<fieldset class="category-selectors"><legend>Choose broad categories</legend><p class="muted">Pick one or more, then fine-tune the skills below.</p><button type="button" data-all-categories aria-pressed="${all}">${all?'✓ ':''}All categories</button><div class="category-options">${categories.map(d=>`<button type="button" data-category="${esc(d)}" aria-pressed="${config.domains.includes(d)}"><span class="category-check" aria-hidden="true">${config.domains.includes(d)?'✓':''}</span><span><b>${esc(d)}</b><small>${BANK.filter(q=>q.subject===config.subject&&q.domain===d).length} questions</small></span></button>`).join('')}</div>${!config.domains.length?'<p class="error" role="status">Choose at least one category to start a rush.</p>':''}</fieldset>`;
}
function changeCategories(domains){
 const previous=new Set(config.domains),selectedSkills=new Set(config.skills);
 config.domains=domains;
 config.skills=[...new Set(BANK.filter(q=>q.subject===config.subject&&domains.includes(q.domain)&&(selectedSkills.has(q.skill)||!previous.has(q.domain))).map(q=>q.skill))];
 setup();
}
function setup(){
 stopClock();currentView='setup';review=null;
 const available=pool().length,skills=[...new Set(BANK.filter(q=>q.subject===config.subject&&config.domains.includes(q.domain)).map(q=>q.skill))];
 root.innerHTML=shell(`<div class="topline"><span class="eyebrow">Practice with purpose</span><span class="pill">${esc(config.subject)} · ${BANK.filter(q=>q.subject===config.subject).length} questions</span></div><div class="hero"><div><h1>A little focus. A faster you.</h1><p>Build your test-day rhythm, one question at a time. Choose your skills, set a pace, and find your flow.</p></div><div class="hero-mark">ϟ</div></div><div class="layout"><section class="card"><h2>Set up your rush</h2><small>A focused session, built around you.</small><div class="field"><label for="subject">Subject</label><select id="subject"><option>Reading and Writing</option><option>Math</option></select></div>${categorySelectors()}<div class="field"><label>01 &nbsp; Choose your skills</label><div class="skills">${skills.map(s=>`<label class="check"><input type="checkbox" data-skill="${esc(s)}" ${config.skills.includes(s)?'checked':''}><span>${esc(s)}</span><small>${BANK.filter(q=>q.subject===config.subject&&q.skill===s).length}</small></label>`).join('')}</div></div><div class="field"><label for="difficulty">02 &nbsp; Difficulty</label><select id="difficulty">${['All','Easy','Medium','Hard'].map(d=>`<option ${config.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></div><div class="field"><label>03 &nbsp; Session length</label><div class="seg">${[10,20,30,'All'].map(n=>`<button data-count="${n}" class="${config.count===n?'selected':''}">${n}${n==='All'?' matching':' questions'}</button>`).join('')}</div></div><div class="field"><label>04 &nbsp; Your pace</label><div class="seg">${['Relaxed','Steady','Blitz'].map(p=>`<button data-pace="${p}" class="${config.pace===p?'selected':''}">${p}<br><small>${paceLimit(p,config.subject)}s / question</small></button>`).join('')}</div></div><div class="field"><label for="pool">Practice from</label><select id="pool"><option value="all">All questions</option><option value="mistakes">Previous mistakes</option><option value="flagged">Marked for review</option></select></div><label class="check" style="margin-top:18px"><input type="checkbox" id="skip" ${config.skip?'checked':''}><span>Skip previously attempted questions</span></label><div class="start"><div><b>${available} questions available</b><small>${available?Math.min(available,config.count==='All'?available:config.count)+' unique questions in this round':'Change your filters to find questions.'}</small></div><button class="primary" data-action="start" ${!available?'disabled':''}>Start rush &nbsp; →</button></div></section><aside><div class="card"><span class="eyebrow">Make every attempt count</span><h2 style="margin-top:12px">Find your pace.</h2>${[['1','Focus on a skill','A short set makes it easier to spot what slows you down.'],['2','Balance speed and accuracy','Correct answers earn up to three stars. Keep your streak going.'],['3','Learn from the details','Review every answer with the original explanation.']].map(([n,t,p])=>`<div class="how"><span class="step">${n}</span><div><h3>${t}</h3><p>${p}</p></div></div>`).join('')}<div class="library-note"><b>Your question library</b><br>${BANK.length} official questions from your uploaded College Board exports, covering Reading and Writing and Math. All questions in this library are Hard. Sessions use each matching question once.</div><p class="offline-note">Pace settings and star thresholds are this app’s own rules: 3 stars in the first third of the timer, 2 in the second, 1 in the last. Timeouts earn 0.</p></div><div class="card" style="margin-top:20px"><small>YOUR PRACTICE SO FAR</small><h2 style="margin-top:12px">${saved.history.length} sessions completed</h2><button data-action="history">View practice history →</button></div></aside></div>`);
 document.getElementById('pool').value=config.pool;document.getElementById('subject').value=config.subject;
}
function shuffle(xs){const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function start(){
 const qs=shuffle(pool()).slice(0,config.count==='All'?Infinity:config.count);if(!qs.length)return;
 session={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),qs,index:0,answers:[],selected:null,eliminated:[],limit:paceLimit(config.pace,config.subject),subject:config.subject,pace:config.pace,streak:0,best:0,started:Date.now(),questionStarted:null,showExplanation:false};
 renderQuestion();startClock();readyQuestion();window.DosPrepAnalytics?.track('practice_start',{subject:session.subject,pace:session.pace,question_count:session.qs.length});
}
function stopClock(){clearInterval(clock);clock=null;}
function startClock(){stopClock();clock=setInterval(tick,200);tick();}
function elapsed(){return session.questionStarted===null?0:(Date.now()-session.questionStarted)/1000;}
function tick(){
 if(!session||currentView!=='question')return;
 const t=document.getElementById('timer'),box=t?.closest('.timer');
 if(session.questionStarted===null){if(t)t.textContent=session.countingDown?'Get ready':'Loading…';return;}
 const done=session.answers[session.index],remaining=Math.max(0,session.limit-elapsed());
 if(t)t.textContent=done?time(done.seconds):time(Math.ceil(remaining));
 if(box){box.style.setProperty('--time-left',`${100*remaining/session.limit}%`);box.classList.toggle('urgent',!done&&remaining<=10);box.classList.toggle('timer-done',Boolean(done));box.setAttribute('aria-label',done?`Answered in ${time(done.seconds)}`:`Time remaining ${time(Math.ceil(remaining))}`);}
 if(!done&&remaining<=0)submit(true);
}
function renderQuestion(){
 currentView='question';const q=session.qs[session.index],a=session.answers[session.index];
 root.innerHTML=`<header class="study-head"><div class="study-top"><button data-action="end">← End round</button><div class="study-status"><span>🔥 ${session.streak} streak</span><span>${session.answers.filter(a=>a.correct).length}/${session.answers.length} correct</span></div><div class="timer"><span class="stars">★</span> &nbsp; <span id="timer">${time(a?a.seconds:session.limit-elapsed())}</span></div></div><div class="progress"><span style="width:${100*session.answers.length/session.qs.length}%"></span></div></header><section class="study"><div class="question-meta"><span>${esc(q.subject)} &nbsp; / &nbsp; ${esc(q.skill)} &nbsp; · &nbsp; ${q.difficulty}</span><button data-action="flag" class="${saved.flags.includes(q.id)?'flagged':''}">${saved.flags.includes(q.id)?'⚑ Marked':'⚐ Mark for review'}</button></div><div class="question-split"><div class="paper passage">${highlightTools(q)}${passage(q)}</div><div><div class="choices">${q.type==='numeric'?numericInput(q,a):'ABCD'.split('').map(k=>`<div class="choice-row"><button data-choice="${k}" ${a||session.questionStarted===null?'disabled':''} class="choice ${!a&&session.selected===k?'chosen':''} ${session.eliminated.includes(k)?'eliminated':''} ${a&&(a.correct||session.showExplanation)&&q.correct===k?'correct':''} ${a&&!a.correct&&a.selected===k?'wrong':''}" aria-label="Choose answer ${k}" aria-pressed="${session.selected===k}"><span class="letter">${k}</span><div class="choice-content">${images(q.choices[k],'Answer choice '+k)}</div></button><button data-eliminate="${k}" ${a?'disabled':''} class="eliminate" aria-label="${session.eliminated.includes(k)?'Restore':'Eliminate'} answer ${k}">${session.eliminated.includes(k)?'↶':'⊘'}</button></div>`).join('')}</div>${a?`<div class="feedback ${a.correct?'':'bad'}" role="status"><strong>${a.timeout?'Time’s up':a.correct?'Correct. Nicely done.':'Keep going. This is how you learn.'} <span class="stars">${'★'.repeat(a.stars)}</span></strong>${a.correct||session.showExplanation?'Correct answer: '+esc(q.correct)+' · ':''}Your time: ${time(a.seconds)}<br><button data-action="explanation" style="margin-top:12px">${session.showExplanation?'Hide explanation':'Reveal answer & explanation'}</button></div>`:''}${a?videos(q):''}</div></div>${a&&session.showExplanation?`<div class="card explanation"><h2>Answer explanation</h2>${images(q.explanation,'College Board answer rationale for '+q.id)}</div>`:''}</section><footer class="study-footer"><span>Question ${session.index+1} / ${session.qs.length}<br><small>ID ${q.id}</small></span><span class="muted">${session.pace} pace · ${session.limit}s</span><button class="primary" data-action="${a?'next':'submit'}" ${!a&&(!session.selected||session.questionStarted===null)?'disabled':''}>${a?(session.index+1===session.qs.length?'See results':'Next question →'):'Check answer'}</button></footer>`;
 tick();
}
function submit(timeout=false){
 if(session.questionStarted===null||session.answers[session.index]||!timeout&&(!session.selected||session.qs[session.index].type==='numeric'&&parseNumeric(session.selected)===null))return;
 const q=session.qs[session.index],seconds=Math.min(session.limit,elapsed()),correct=!timeout&&(q.type==='numeric'?numericCorrect(session.selected,q.correct):session.selected===q.correct);
 const stars=correct?(seconds<=session.limit/3?3:seconds<=session.limit*2/3?2:1):0;
 session.streak=correct?session.streak+1:0;session.best=Math.max(session.best,session.streak);
 session.answers.push({id:q.id,selected:timeout?null:session.selected,correct,seconds,stars,timeout,skill:q.skill,domain:q.domain,subject:q.subject,difficulty:q.difficulty});renderQuestion();
}
function next(){if(session.index+1===session.qs.length){finish();return;}session.index++;session.selected=null;session.eliminated=[];session.showExplanation=false;session.questionStarted=null;renderQuestion();readyQuestion();window.scrollTo(0,0);}
function finish(){
 stopClock();if(!session.answers.length){setup();return;}
 const result={id:session.id,date:new Date().toISOString(),pace:session.pace,subject:session.subject,limit:session.limit,best:session.best,answers:session.answers,planned:session.qs.length};
 saved.history.unshift(result);persist();window.DosPrepAnalytics?.track('practice_complete',{subject:result.subject,pace:result.pace,question_count:result.answers.length});showResults(result);session=null;
}
function showResults(h){
 stopClock();currentView='results';review=h;
 const n=h.answers.length,correct=h.answers.filter(a=>a.correct).length,total=h.answers.reduce((s,a)=>s+a.seconds,0),max=Math.max(1,...h.answers.map(a=>a.seconds));
 const skills=[...new Set(h.answers.map(a=>a.skill))];
 root.innerHTML=shell(`<div class="topline"><button data-action="setup">← Back to Question Rush</button><span class="pill">${esc(h.pace)} pace</span></div><div class="result-title"><span class="eyebrow">Every round is progress</span><h1>Session results</h1><p class="muted">${esc(h.subject||'Reading and Writing')} · ${new Date(h.date).toLocaleString()}</p></div><div class="stats">${[['Time',time(total)],['Correct',correct+'/'+n],['Accuracy',Math.round(100*correct/n)+'%'],['Best streak',h.best],['Stars',h.answers.reduce((s,a)=>s+a.stars,0)]].map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><div class="analytics"><div class="card"><h2>Your pacing</h2><small>Time spent on each question · session average ${time(total/n)}</small><div class="bars">${h.answers.map((a,i)=>`<div class="bar-item"><span>${Math.round(a.seconds)}s</span><div class="bar" style="height:${Math.max(3,120*a.seconds/max)}px;background:${a.correct?'#40b5e8':'#e9a2a4'}"></div><span>Q${i+1}</span></div>`).join('')}</div><small>Blue = correct · rose = incorrect or timed out</small></div><div class="card"><h2>${esc(h.subject||'Reading and Writing')}</h2><small>Accuracy by skill</small>${skills.map(s=>{const as=h.answers.filter(a=>a.skill===s),p=Math.round(100*as.filter(a=>a.correct).length/as.length);return `<div class="topic-row"><div><span>${esc(s)}<br><small>${as.length} attempt${as.length===1?'':'s'}</small></span><b>${p}%</b></div><div class="topic-track"><i style="width:${p}%"></i></div></div>`;}).join('')}</div></div>${categoryTable(h.answers,h.subject||'Reading and Writing')}<div class="banner"><div><h2>Turn your attempts into understanding.</h2><small>Walk through each question and its original explanation.</small></div><button class="primary" data-review="0">Start review →</button></div><h3>Question review</h3><div class="review-grid">${h.answers.map((a,i)=>`<button class="review-tile" data-review="${i}"><b class="${a.correct?'ok':'bad-text'}">${a.correct?'✓':'✕'}</b> &nbsp; Question ${i+1}<span class="stars" style="float:right">${'★'.repeat(a.stars)}</span><small>${Math.round(a.seconds)}s &nbsp; · &nbsp; ${a.difficulty}${a.timeout?' · Timed out':''}</small></button>`).join('')}</div>`);
 window.scrollTo(0,0);
}
function showReview(i,revealAnswer=false){
 reviewRevealed=revealAnswer;
 currentView='review';const a=review.answers[i],q=BANK.find(q=>q.id===a.id);if(!q){alert('This question is not in the current library.');return;}
 root.innerHTML=`<div class="study"><div class="topline"><button data-action="results">← Session results</button><span class="pill">Question ${i+1} / ${review.answers.length}</span></div><h1>Make it click.</h1><p class="muted">${esc(q.skill)} · ${q.difficulty} · ID ${q.id}</p><div class="feedback ${a.correct?'':'bad'}"><strong>${a.correct?'Correct':'Incorrect'} · ${Math.round(a.seconds)} seconds</strong>Your answer: ${esc(a.selected||'Timed out')}${a.correct||reviewRevealed?' · Correct answer: '+esc(q.correct):''}${!a.correct&&!reviewRevealed?`<br><button data-reveal-review="${i}" style="margin-top:10px">Reveal answer & explanation</button>`:''}</div><div class="paper">${highlightTools(q)}${passage(q)}<div class="choices" style="margin-top:25px">${q.type==='numeric'?`<p>Your response: <b>${esc(a.selected||'Timed out')}</b></p>`:'ABCD'.split('').map(k=>`<div class="choice ${(a.correct||reviewRevealed)&&k===q.correct?'correct':k===a.selected&&!a.correct?'wrong':''}">${images(q.choices[k],'Answer '+k)}</div>`).join('')}</div></div>${a.correct||reviewRevealed?`<div class="card explanation"><h2>Why ${esc(q.correct)} is correct</h2>${images(q.explanation,'Original answer explanation')}</div>`:''}${videos(q)}<div class="toolbar" style="margin-top:20px"><button data-review="${i-1}" ${i===0?'disabled':''}>← Previous</button><button data-review="${i+1}" ${i===review.answers.length-1?'disabled':''}>Next question →</button></div></div>`;window.scrollTo(0,0);
}
function history(){stopClock();currentView='history';root.innerHTML=shell(`<div class="eyebrow">Your learning, over time</div><h1>Practice history</h1><p class="muted">Revisit your sessions, review mistakes, and keep building.</p><div class="card">${saved.history.length?saved.history.map((h,i)=>`<div class="history-row"><div><b>${h.answers.filter(a=>a.correct).length} / ${h.answers.length} correct</b><small>${new Date(h.date).toLocaleString()} · ${esc(h.subject||'Reading and Writing')} · ${esc(h.pace)} pace · ${h.answers.reduce((s,a)=>s+a.stars,0)} stars</small></div><button data-history="${i}">View results →</button></div>`).join(''):'<div class="empty">Your first session starts here.<br><button data-action="setup" style="margin-top:15px">Start practicing</button></div>'}</div>`,'history');}
root.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.hasAttribute('data-all-categories')){changeCategories(subjectCategories());return;}
 if(b.dataset.category){const category=b.dataset.category;changeCategories(config.domains.includes(category)?config.domains.filter(d=>d!==category):[...config.domains,category]);return;}
 if(b.dataset.count){config.count=b.dataset.count==='All'?'All':Number(b.dataset.count);setup();return;}
 if(b.dataset.pace){config.pace=b.dataset.pace;setup();return;}
 if(b.dataset.choice){if(session.questionStarted!==null&&!session.answers[session.index]&&!session.eliminated.includes(b.dataset.choice)){session.selected=b.dataset.choice;renderQuestion();}return;}
 if(b.dataset.eliminate){const k=b.dataset.eliminate;if(session.eliminated.includes(k))session.eliminated=session.eliminated.filter(v=>v!==k);else{session.eliminated.push(k);if(session.selected===k)session.selected=null;}renderQuestion();return;}
 if(b.dataset.revealReview!==undefined){showReview(Number(b.dataset.revealReview),true);return;}
 if(b.dataset.drill){config.subject=b.dataset.subject;config.domains=b.dataset.domain?[b.dataset.domain]:subjectCategories();config.skills=b.dataset.drill==='all'?[...new Set(BANK.filter(q=>q.subject===config.subject).map(q=>q.skill))]:[b.dataset.drill];config.skip=false;config.pool='all';setup();return;}
 if(b.dataset.readingSize){readingSize=b.dataset.readingSize;applyReadingSize();try{localStorage.setItem('dosprep-reading-size',readingSize);}catch{}root.querySelectorAll('[data-reading-size]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.readingSize===readingSize)));return;}
 if(b.dataset.clearHighlights){delete saved.highlights[b.dataset.clearHighlights];persist();refreshHighlights();return;}
 if(b.dataset.review!==undefined){showReview(Number(b.dataset.review));return;}
 if(b.dataset.history!==undefined){showResults(saved.history[Number(b.dataset.history)]);return;}
 switch(b.dataset.action){
 case 'setup':setup();break;case 'start':start();break;case 'submit':submit();break;case 'next':next();break;
 case 'end':if(confirm('End this round? Completed answers will be saved.'))finish();break;
 case 'insights':insights();break;case 'history':history();break;case 'results':showResults(review);break;
 case 'flag':{const id=session.qs[session.index].id;saved.flags=saved.flags.includes(id)?saved.flags.filter(v=>v!==id):[...saved.flags,id];persist();renderQuestion();break;}
 case 'explanation':session.showExplanation=!session.showExplanation;renderQuestion();break;
 case 'export':{const blob=new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dosprep-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
 }
});
root.addEventListener('change',async e=>{
 const el=e.target;
 if(el.id==='subject'){config.subject=el.value;config.domains=subjectCategories();config.skills=[...new Set(BANK.filter(q=>q.subject===config.subject).map(q=>q.skill))];setup();}
 if(el.id==='insight-subject'){insightSubject=el.value;insights();}
 if(el.dataset.skill){config.skills=el.checked?[...config.skills,el.dataset.skill]:config.skills.filter(s=>s!==el.dataset.skill);setup();}
 if(el.id==='difficulty'){config.difficulty=el.value;setup();}
 if(el.id==='pool'){config.pool=el.value;setup();}
 if(el.id==='skip'){config.skip=el.checked;setup();}
 if(el.id==='restore'&&el.files[0]){try{const data=JSON.parse(await el.files[0].text());if(!Array.isArray(data.history)||!Array.isArray(data.flags)||!data.flags.every(x=>typeof x==='string')||!data.history.every(h=>typeof h.id==='string'&&Number.isFinite(h.best)&&!isNaN(Date.parse(h.date))&&typeof h.pace==='string'&&Array.isArray(h.answers)&&h.answers.length>0&&h.answers.every(a=>typeof a.id==='string'&&typeof a.skill==='string'&&typeof a.difficulty==='string'&&typeof a.correct==='boolean'&&Number.isFinite(a.seconds)&&a.seconds>=0&&Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3)))throw Error();if(confirm('Replace this browser’s progress with the selected backup?')){saved=data;saved.highlights=saved.highlights&&typeof saved.highlights==='object'?saved.highlights:{};persist();history();}}catch{alert('That file is not a valid DosPrep progress backup.');}}
});
document.addEventListener('keydown',e=>{if(currentView!=='question'||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toUpperCase();if(session.questionStarted!==null&&session.qs[session.index].type!=='numeric'&&'ABCD'.includes(k)&&k.length===1&&!session.answers[session.index]){session.selected=k;session.eliminated=session.eliminated.filter(x=>x!==k);renderQuestion();}if(e.key==='Enter'&&e.target===document.body){e.preventDefault();if(session.answers[session.index])next();else submit();}});
window.addEventListener('beforeunload',e=>{if(currentView==='question'){e.preventDefault();e.returnValue='';}});

function paceLimit(pace,subject){return (subject==='Math'?{Relaxed:150,Steady:95,Blitz:60}:{Relaxed:120,Steady:75,Blitz:45})[pace];}
async function readyQuestion(){
 const active=session,index=active.index;
 const imgs=[...root.querySelectorAll('.study .pdf-img')];
 try{
  await Promise.all(imgs.map(img=>img.complete?(img.naturalWidth?Promise.resolve():Promise.reject(Error('Image failed'))):new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});})));
  if(session!==active||session.index!==index||currentView!=='question')return;
  if(index===0&&!active.introShown&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   active.introShown=true;active.countingDown=true;tick();
   const intro=document.createElement('div');intro.className='round-intro';intro.setAttribute('role','status');intro.setAttribute('aria-live','polite');root.append(intro);
   for(const beat of ['3','2','1','Go!']){
    if(session!==active||currentView!=='question'||!intro.isConnected){intro.remove();return;}
    intro.innerHTML=`<div class="intro-card"><span class="eyebrow">${esc(active.subject)} · ${esc(active.pace)}</span><h2>Your rush starts now</h2><strong class="intro-number">${beat}</strong><p>${active.qs.length} questions. Find your flow.</p></div>`;
    await new Promise(resolve=>setTimeout(resolve,beat==='Go!'?300:650));
   }
   intro.remove();active.countingDown=false;
  }
  if(session!==active||session.index!==index||currentView!=='question')return;
  active.questionStarted=Date.now();renderQuestion();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)root.querySelector('.study')?.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'ease-out'});
 }catch{
  if(session!==active||session.index!==index)return;
  const status=document.getElementById('highlight-status');if(status)status.textContent='A question image could not load. Reload this page to try again. The timer has not started.';
 }
}
function parseNumeric(input){
 const s=String(input??'').trim().replace(/−/g,'-');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(s))return null;
 const parts=s.split('/').map(Number);const n=parts.length===2?parts[0]/parts[1]:parts[0];
 return Number.isFinite(n)?n:null;
}
function numericCorrect(input,expected){
 const value=parseNumeric(input);if(value===null)return false;
 // The export lists accepted rounded/truncated responses explicitly. Allow exact
 // numeric equivalence only, rather than inventing a broad rounding tolerance.
 return expected.split(/,|;|\bor\b/).some(s=>{const n=parseNumeric(s);return n!==null&&Math.abs(value-n)<=1e-10*Math.max(1,Math.abs(n));});
}
function numericInput(q,a){return `<div class="card"><label for="numeric-answer"><b>Your answer</b></label><p class="muted">Enter a number, decimal, or fraction.</p><input id="numeric-answer" type="text" inputmode="text" autocomplete="off" spellcheck="false" value="${esc(a?a.selected||'':session.selected||'')}" ${a||session.questionStarted===null?'disabled':''} aria-describedby="numeric-hint"><small id="numeric-hint">Examples: 12, -0.5, 2/3. Press Enter to check.</small><p id="numeric-error" class="error" role="status"></p></div>`;}
root.addEventListener('input',e=>{
 if(e.target.id!=='numeric-answer'||!session||session.answers[session.index])return;
 session.selected=e.target.value.trim();const valid=parseNumeric(session.selected)!==null;
 const button=root.querySelector('[data-action="submit"]');if(button)button.disabled=!valid;
 document.getElementById('numeric-error').textContent=session.selected&&!valid?'Enter a valid number or fraction (with a nonzero denominator).':'';
});
root.addEventListener('keydown',e=>{if(e.target.id==='numeric-answer'&&e.key==='Enter'&&!session.answers[session.index]&&parseNumeric(session.selected)!==null){e.preventDefault();submit();}});

function highlightTools(q){return `<div class="highlight-tools"><span class="auto-highlight-label">▰ Select text to highlight</span><button data-clear-highlights="${q.id}">Clear highlights</button><div class="reading-sizes" role="group" aria-label="Reading size">${['Compact','Comfortable','Large'].map(size=>`<button data-reading-size="${size}" aria-pressed="${size===readingSize}">${size}</button>`).join('')}</div><small>Highlights save automatically when you finish selecting text.</small></div><div id="highlight-status" role="status" aria-live="polite"></div>`;}
function passage(q){
 const marks=new Set(Array.isArray(saved.highlights[q.id])?saved.highlights[q.id]:[]);
 return q.passage.map((src,part)=>`<div class="document" data-question="${q.id}"><img class="pdf-img" src="${esc(src)}" alt="Original question ${q.id}" draggable="false"><div class="word-layer">${(q.passageText?.[part]||[]).map((w,i)=>`<span data-word="${part}:${i}" class="word ${marks.has(part+':'+i)?'highlighted':''}" style="left:${w.x}%;top:${w.y}%;width:${w.w}%;height:${w.h}%;font-size:${w.font}cqw">${esc(w.text)} </span>`).join('')}</div></div>`).join('');
}
// Wait until the drag ends; selectionchange also covers touch selection handles.
let selectingPassage=false,highlightDelay;
document.addEventListener('pointerdown',e=>{selectingPassage=Boolean(e.target.closest('.word-layer'));});
document.addEventListener('pointerup',()=>{selectingPassage=false;clearTimeout(highlightDelay);highlightDelay=setTimeout(addHighlight,0);});
document.addEventListener('pointercancel',()=>{selectingPassage=false;});
document.addEventListener('selectionchange',()=>{clearTimeout(highlightDelay);if(!selectingPassage)highlightDelay=setTimeout(addHighlight,350);});
document.addEventListener('keyup',e=>{if(e.key==='Shift')addHighlight();});
function addHighlight(){
 const selection=window.getSelection();const status=document.getElementById('highlight-status');
 if(!selection||selection.isCollapsed||!selection.rangeCount)return;
 const layer=node=>(node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement)?.closest('.word-layer');
 const startLayer=layer(selection.anchorNode),endLayer=layer(selection.focusNode);
 if(!startLayer||!endLayer||!root.contains(startLayer)||startLayer.closest('.document').dataset.question!==endLayer.closest('.document').dataset.question)return;
 const range=selection.getRangeAt(0);let count=0;
 root.querySelectorAll('.document [data-word]').forEach(word=>{
  if(!range.intersectsNode(word))return;
  const id=word.closest('.document').dataset.question;
  const marks=new Set(Array.isArray(saved.highlights[id])?saved.highlights[id]:[]);
  marks.add(word.dataset.word);saved.highlights[id]=[...marks];count++;
 });
 if(count){persist();refreshHighlights();selection.removeAllRanges();}
 if(status)status.textContent=count?'Highlight saved.':'Select text inside the passage.';
}
function refreshHighlights(){root.querySelectorAll('.document [data-word]').forEach(word=>{const id=word.closest('.document').dataset.question;word.classList.toggle('highlighted',Array.isArray(saved.highlights[id])&&saved.highlights[id].includes(word.dataset.word));});}
function videos(q){
 const entries=(window.SKILL_VIDEOS||{})[q.skill]||[];
 return `<section class="card videos"><h3>Learn this question type</h3><p class="muted">${esc(q.skill)} · reusable lessons, not a walkthrough of this exact question.</p>${entries.length?entries.map((v,i)=>`<a class="video-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer"><span>▶</span><span>${esc(v.title)}<small>${esc(v.provider)} · Opens on YouTube</small></span><span>↗</span></a>`).join(''):'<p>Video lessons for this skill are being added.</p>'}<small>Sources: <a href="https://satclimb.com/lessons" target="_blank" rel="noopener noreferrer">SAT Climb video library</a>. External videos may change availability.</small></section>`;
}
function enriched(answers){return answers.map(a=>{const q=BANK.find(q=>q.id===a.id);return {...a,subject:a.subject||q?.subject||'Reading and Writing',domain:a.domain||q?.domain||'Uncategorized'};});}
function categoryTable(answers,subject){
 const attempts=enriched(answers).filter(a=>a.subject===subject);
 const domains=[...new Set(BANK.filter(q=>q.subject===subject).map(q=>q.domain))];
 return `<section class="card category-card"><h2>Category by category</h2><small>Attempt-based metrics · repeated questions count as additional attempts.</small><div class="table-scroll"><table><thead><tr><th>Category</th><th>Attempts</th><th>Accuracy</th><th>Avg time</th><th>Timeouts</th><th></th></tr></thead><tbody>${domains.map(d=>{const as=attempts.filter(a=>a.domain===d),n=as.length;return `<tr><td>${esc(d)}</td><td>${n}</td><td>${n?Math.round(100*as.filter(a=>a.correct).length/n)+'%':'—'}</td><td>${n?time(as.reduce((s,a)=>s+a.seconds,0)/n):'—'}</td><td>${as.filter(a=>a.timeout).length}</td><td><button data-drill="all" data-subject="${esc(subject)}" data-domain="${esc(d)}">Practice</button></td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function insights(){
 stopClock();currentView='insights';const subject=insightSubject;window.DosPrepAnalytics?.track('view_insights',{subject});
 const attempts=enriched(saved.history.flatMap(h=>h.answers)).filter(a=>a.subject===subject);
 const skills=[...new Set(BANK.filter(q=>q.subject===subject).map(q=>q.skill))];
 const stats=skills.map(skill=>{const as=attempts.filter(a=>a.skill===skill),n=as.length,correct=as.filter(a=>a.correct).length;return {skill,as,n,correct,accuracy:n?correct/n:null,avg:n?as.reduce((s,a)=>s+a.seconds,0)/n:null};});
 const priority=stats.filter(s=>s.n>=3).sort((a,b)=>a.accuracy-b.accuracy||b.avg-a.avg)[0];
 root.innerHTML=shell(`<div class="eyebrow">Find your next focus</div><h1>Category insights</h1><p class="muted">All completed sessions, organized by category and skill.</p><label for="insight-subject">Subject</label><select id="insight-subject" style="margin:12px 0 24px;max-width:350px"><option>Reading and Writing</option><option>Math</option></select><div class="banner"><div><h2>${priority?'Focus next: '+esc(priority.skill):'Build your baseline'}</h2><small>${priority?Math.round(priority.accuracy*100)+'% accuracy across '+priority.n+' attempts. Review the lesson, then try a focused set.':'Complete at least 3 attempts in a skill to get a recommendation. Small samples are only an early signal.'}</small></div>${priority?`<button class="primary" data-drill="${esc(priority.skill)}" data-subject="${esc(subject)}">Practice this skill</button>`:''}</div>${categoryTable(attempts,subject)}<h2>Skill insights</h2><div class="skill-insights">${stats.map(s=>`<section class="card"><div class="eyebrow">${esc(BANK.find(q=>q.subject===subject&&q.skill===s.skill).domain)}</div><h3>${esc(s.skill)}</h3><div class="skill-metrics"><span><strong>${s.n?Math.round(s.accuracy*100)+'%':'—'}</strong>Accuracy</span><span><strong>${s.n}</strong>Attempts</span><span><strong>${s.n?time(s.avg):'—'}</strong>Avg time</span></div><p class="muted">${s.n?s.n<3?'Early signal — keep practicing for a clearer picture.':s.accuracy<.7?'Review this skill, then practice a short focused set.':s.avg>paceLimit('Steady',subject)?'Accuracy is developing. Try a steady round to work on pacing.':'Keep this skill fresh with occasional review.':'No attempts yet. Try a short set to establish a baseline.'}</p><div class="toolbar"><button data-drill="${esc(s.skill)}" data-subject="${esc(subject)}">Practice skill →</button></div><details><summary>Video lessons for this skill</summary>${videos({skill:s.skill})}</details></section>`).join('')}</div>`,'insights');
 document.getElementById('insight-subject').value=subject;window.scrollTo(0,0);
}

function accountControls(){
 const user=window.DosPrepAuth?.user;
 return `<div class="account-controls">${user?`<span>Signed in</span><button data-signout>Sign out</button>`:`<a href="signin.html">Sign in</a><small>or keep practicing as a guest</small>`}</div>`;
}
function normalizeProgress(value){
 const data=value&&typeof value==='object'?value:{};
 data.history=Array.isArray(data.history)?data.history:[];
 data.flags=Array.isArray(data.flags)?data.flags:[];
 data.highlights=data.highlights&&typeof data.highlights==='object'?data.highlights:{};
 return data;
}
function syncAccount(event){
 const next=event.detail.user?.uid||null;
 if(next!==activeAccountId){
  // Account data is isolated from guest data and other users on shared devices.
  try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{}
  activeAccountId=next;KEY=next?'dosprep-progress-'+next:'reading-rush-v1';
  try{saved=normalizeProgress(JSON.parse(localStorage.getItem(KEY)));}catch{saved=normalizeProgress({});}
 }
 if(currentView==='setup')setup();else if(currentView==='history')history();else if(currentView==='insights')insights();
}
document.addEventListener('dosprep-auth-change',syncAccount);
if(window.DosPrepAuth?.user)syncAccount({detail:{user:window.DosPrepAuth.user}});else setup();
