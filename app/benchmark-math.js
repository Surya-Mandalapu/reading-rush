export const MIN_SAMPLES=20;
export function summarize(data){
 const entries=Object.entries(data?.bins||{}).map(([seconds,count])=>[Number(seconds),count]).filter(([s,n])=>Number.isInteger(s)&&s>=1&&s<=7200&&Number.isInteger(n)&&n>0).sort((a,b)=>a[0]-b[0]);
 const samples=entries.reduce((sum,[,n])=>sum+n,0);
 if(!samples||samples!==data?.samples)return {samples:0};
 function atRank(rank){let seen=0;for(const [seconds,count] of entries){seen+=count;if(rank<seen)return seconds;}return entries.at(-1)[0];}
 function percentile(p){const index=(samples-1)*p,lower=Math.floor(index),fraction=index-lower;return atRank(lower)*(1-fraction)+atRank(Math.ceil(index))*fraction;}
 return {samples,mean:data.totalSeconds/samples,median:percentile(.5),p25:percentile(.25),p75:percentile(.75)};
}
export function duration(seconds){const rounded=Math.round(seconds);return `${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,'0')}`;}
