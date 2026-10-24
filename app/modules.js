/* DosPrep practice blueprints, not College Board difficulty quotas or adaptive scoring. */
window.DosPrepModules=(()=>{
 const subjects={
  'Reading and Writing':{count:27,seconds:1920,domains:{'Craft and Structure':8,'Information and Ideas':7,'Standard English Conventions':7,'Expression of Ideas':5}},
  Math:{count:22,seconds:2100,domains:{Algebra:8,'Advanced Math':8,'Problem-Solving and Data Analysis':3,'Geometry and Trigonometry':3}}
 };
 const types=[
  {id:'foundation',title:'Easy + Medium',description:'A full-length practice run to build confidence. No hard questions.',mix:{'Reading and Writing':[14,13,0],Math:[11,11,0]}},
  {id:'module1',title:'Module 1',description:'A balanced starting module with easy, medium, and hard questions.',mix:{'Reading and Writing':[9,12,6],Math:[7,10,5]}},
  {id:'module2easy',title:'Module 2 Easy',description:'An easier second-module practice mix, with mostly easy and medium questions.',mix:{'Reading and Writing':[16,9,2],Math:[13,8,1]}},
  {id:'module2hard',title:'Module 2 Hard',description:'A harder second-module practice mix, with mostly medium and hard questions.',mix:{'Reading and Writing':[3,9,15],Math:[2,7,13]}}
 ];
 function random(seed){
  let state=2166136261;for(const c of seed)state=Math.imul(state^c.charCodeAt(0),16777619);
  return ()=>{state+=0x6D2B79F5;let n=state;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
 }
 function shuffle(values,rng){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function build(bank,subject,typeId,form='A',seed){
  const spec=subjects[subject],type=types.find(t=>t.id===typeId);
  if(!spec||!type||!['A','B','C','random'].includes(form))throw Error('Choose a valid subject, module, and form.');
  const selectionSeed=form==='random'?(seed||crypto.randomUUID()):`dosprep-modules-v1:${subject}:${typeId}:${form}`;
  const rng=random(selectionSeed),difficultyNames=['Easy','Medium','Hard'];
  const difficulties=shuffle(type.mix[subject].flatMap((n,i)=>Array(n).fill(difficultyNames[i])),rng);
  const domains=Object.entries(spec.domains).flatMap(([domain,n])=>Array(n).fill(domain));
  const used=new Set(),qs=domains.map((domain,i)=>{
   const candidates=bank.filter(q=>q.subject===subject&&q.domain===domain&&q.difficulty===difficulties[i]&&!used.has(q.id)).sort((a,b)=>a.id.localeCompare(b.id));
   if(!candidates.length)throw Error(`Not enough ${difficulties[i].toLowerCase()} questions in ${domain} to build this module.`);
   const q=candidates[Math.floor(rng()*candidates.length)];used.add(q.id);return q;
  });
  const domainOrder=Object.keys(spec.domains);
  qs.sort((a,b)=>subject==='Math'?difficultyNames.indexOf(a.difficulty)-difficultyNames.indexOf(b.difficulty):domainOrder.indexOf(a.domain)-domainOrder.indexOf(b.domain)||a.skill.localeCompare(b.skill)||difficultyNames.indexOf(a.difficulty)-difficultyNames.indexOf(b.difficulty));
  return {qs,module:{id:typeId,title:type.title,form:form==='random'?'Random set':`Form ${form}`,seed:selectionSeed,seconds:spec.seconds,mix:Object.fromEntries(difficultyNames.map((d,i)=>[d,type.mix[subject][i]]))}};
 }
 return {subjects,types,build};
})();
