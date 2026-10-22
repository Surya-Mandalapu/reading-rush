export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function numericValue(input){
 const value=String(input??'').trim().replace(/−/g,'-');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(value))return null;
 const parts=value.split('/').map(Number),result=parts.length===2?parts[0]/parts[1]:parts[0];return Number.isFinite(result)?result:null;
}
export function isCorrect(question,answer){
 if(answer===undefined||answer===null)return false;
 if(question.type!=='numeric')return answer===question.correct;
 const value=numericValue(answer);return value!==null&&question.correct.split(/,|;|\bor\b/).some(expected=>{const n=numericValue(expected);return n!==null&&Math.abs(value-n)<=1e-10*Math.max(1,Math.abs(n));});
}
export function shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function roomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...crypto.getRandomValues(new Uint8Array(6))].map(n=>alphabet[n%alphabet.length]).join('');}
