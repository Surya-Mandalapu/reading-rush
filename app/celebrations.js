(()=>{
 const celebrated=new Set();
 window.DosPrepCelebrations={burst(key){
  if(celebrated.has(key))return;celebrated.add(key);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  // Keep the effect outside rendered views so live updates cannot restart it.
  document.querySelector('.celebration-confetti')?.remove();
  const layer=document.createElement('div');layer.className='celebration-confetti';layer.setAttribute('aria-hidden','true');
  const colors=['#36adf1','#f5a623','#087f79','#ef6b85','#a987ec','#49c68b'];
  for(let i=0;i<64;i++){
   const piece=document.createElement('i');
   piece.style.cssText=`--x:${Math.random()*100}vw;--drift:${(Math.random()-.5)*200}px;--spin:${(Math.random()-.5)*1080}deg;--delay:${Math.random()*.45}s;--fall:${2+Math.random()*.8}s;--color:${colors[i%colors.length]}`;
   layer.append(piece);
  }
  document.body.append(layer);setTimeout(()=>layer.remove(),3400);
 }};
})();
