const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {speedPoints,answerPoints}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('app/live-utils.js','utf8')).toString('base64'));
 for(const [elapsed,expected] of [[0,200],[25000,175],[50000,150],[99999,100],[100000,0],[-1,0],[NaN,0]])assert.equal(speedPoints(true,elapsed),expected);
 assert.equal(speedPoints(false,0),0);
 const question={correct:'A'},response={answer:'A',submittedAt:{toMillis:()=>1500}};
 assert.equal(answerPoints(question,response,{startedAt:{toMillis:()=>1000}}),200);
 assert.equal(answerPoints(question,response,null),100);
 assert.equal(answerPoints(question,response,{startedAt:{toMillis:()=>2000},legacy:true}),100);
 assert.equal(answerPoints(question,{answer:'B'},null),0);
 console.log('PASS: speed scoring boundaries and legacy rounds.');
})().catch(error=>{console.error(error);process.exitCode=1;});
