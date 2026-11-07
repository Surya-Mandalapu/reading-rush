import {escapeHTML as esc,isCorrect} from './live-utils.js';

// Private scratch work stays in this tab, never in a room or answer document.
const notes=new Map();
export function roundNotes(key){
 if(!notes.has(key)){
  let value;try{value=JSON.parse(sessionStorage.getItem('dosprep-live-notes:'+key)||'null');}catch{}
  notes.set(key,{marks:new Set(Array.isArray(value?.marks)?value.marks:[]),eliminated:new Set(Array.isArray(value?.eliminated)?value.eliminated:[])});
 }
 return notes.get(key);
}
export function saveNotes(key){const n=roundNotes(key);try{sessionStorage.setItem('dosprep-live-notes:'+key,JSON.stringify({marks:[...n.marks],eliminated:[...n.eliminated]}));}catch{}}
export function livePassage(q,key){
 const n=roundNotes(key);
 return `<div class="highlight-tools"><span class="auto-highlight-label">▰ Select text to highlight</span><button data-live-clear-highlights>Clear highlights</button><small>Highlights and crossed-out choices are private to you.</small></div><div id="live-highlight-status" role="status"></div>`+q.passage.map((src,part)=>`<div class="document" data-live-notes="${esc(key)}"><img class="pdf-img" src="${esc(src)}" alt="Question ${esc(q.id)}" draggable="false"><div class="word-layer">${(q.passageText?.[part]||[]).map((w,i)=>`<span data-word="${part}:${i}" class="word ${n.marks.has(part+':'+i)?'highlighted':''}" style="left:${w.x}%;top:${w.y}%;width:${w.w}%;height:${w.h}%;font-size:${w.font}cqw">${esc(w.text)} </span>`).join('')}</div></div>`).join('');
}
export function bindLiveHighlights(root){
 let dragging=false,delay;
 const highlight=()=>{
  const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;
  const layer=node=>(node?.nodeType===1?node:node?.parentElement)?.closest('.document[data-live-notes]');
  const start=layer(selection.anchorNode),end=layer(selection.focusNode);
  if(!start||!end||!root.contains(start)||start.dataset.liveNotes!==end.dataset.liveNotes)return;
  const key=start.dataset.liveNotes,n=roundNotes(key),range=selection.getRangeAt(0);
  root.querySelectorAll('.document [data-word]').forEach(word=>{if(word.closest('.document').dataset.liveNotes===key&&range.intersectsNode(word)){n.marks.add(word.dataset.word);word.classList.add('highlighted');}});
  saveNotes(key);selection.removeAllRanges();const status=root.querySelector('#live-highlight-status');if(status)status.textContent='Highlight saved privately.';
 };
 document.addEventListener('pointerdown',e=>{dragging=Boolean(e.target.closest('.word-layer'));});
 document.addEventListener('pointerup',()=>{dragging=false;clearTimeout(delay);delay=setTimeout(highlight,0);});
 document.addEventListener('pointercancel',()=>{dragging=false;});
 document.addEventListener('selectionchange',()=>{clearTimeout(delay);if(!dragging)delay=setTimeout(highlight,350);});
 document.addEventListener('keyup',e=>{if(e.key==='Shift')highlight();});
 return ()=>{const selection=window.getSelection(),node=selection?.anchorNode,element=node?.nodeType===1?node:node?.parentElement;return dragging||Boolean(selection&&!selection.isCollapsed&&element&&root.contains(element)&&element.closest('.word-layer'));};
}
export function liveStreak(count,celebrate=false){
 return `<span class="streak-badge ${count?'streak-active':''} ${count>=3?'streak-hot':''} ${celebrate?'streak-celebrate':''}" aria-label="${count} correct answers in a row"><span class="streak-fire"><svg class="ui-icon icon-flame" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2c1 5-3 6-2 10 2-1 3-3 3-5 4 4 6 7 5 10a7.3 7.3 0 0 1-14-1c-1-4 2-8 5-11-1 4 0 5 1 5 2-3 1-5 2-8Z"/><path fill="#fff1b5" d="M12 13c1 3 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5Z"/></svg></span><b class="streak-count">${count}</b><span>streak</span>${celebrate?'<span class="streak-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>':''}</span>`;
}
export function revealedStreaks(memberIds,rounds,questionIds,byId){
 const streaks=new Map(memberIds.map(id=>[id,0]));
 rounds.forEach((answers,i)=>{const q=byId.get(questionIds[i]);for(const id of memberIds){const a=answers.find(a=>a.uid===id);streaks.set(id,q&&a&&isCorrect(q,a.answer)?streaks.get(id)+1:0);}});
 return streaks;
}
