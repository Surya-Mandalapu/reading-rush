import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createWriteStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),outputRoot=path.resolve(process.env.DOSPREP_OUTPUT_ROOT||root),output=path.resolve(outputRoot,'dist');
if(outputRoot!==root&&outputRoot!==path.resolve('D:/Codex/DosPrepMigration'))throw Error('Invalid local staging workspace');
if(path.dirname(output)!==outputRoot||path.basename(output)!=='dist')throw Error('Invalid build output');
const migration=JSON.parse(await fs.readFile('migration.json','utf8'));
const origin=process.env.DOSPREP_ORIGIN||migration.targetOrigin;
if(!origin||new URL(origin).origin!==origin||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))throw Error('Set DOSPREP_ORIGIN to the verified production Vercel origin.');
const lock=JSON.parse(await fs.readFile('asset-lock.json','utf8'));
if(!/^[a-f0-9]{40}$/.test(lock.commit)||lock.repository!=='suryamandalapu-boop/reading-rush')throw Error('Invalid asset snapshot');
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
for(const entry of await fs.readdir('app',{withFileTypes:true}))if(entry.name!=='assets'&&entry.name!=='questions.js')await fs.cp(path.join('app',entry.name),path.join(output,entry.name),{recursive:true});
let source=root,temp;
try{
 if(process.env.DOSPREP_FETCH_ASSETS==='1'||!await fs.stat('app/assets').then(()=>true,()=>false)){
  temp=await fs.mkdtemp(path.join(process.env.DOSPREP_TEMP_ROOT||os.tmpdir(),'dosprep-build-'));source=temp;
  const archive=path.join(temp,'assets.tar.gz'),response=await fetch(`https://codeload.github.com/${lock.repository}/tar.gz/${lock.commit}`);
  if(!response.ok)throw Error(`Pinned asset download failed: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(archive));
  const prefix=`reading-rush-${lock.commit}`;
  execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',temp,`${prefix}/app/assets`,`${prefix}/app/questions.js`],{stdio:'inherit'});
 }
 let bytes=0;
 const entries=Object.entries(lock.files);
 for(let start=0;start<entries.length;start+=24)await Promise.all(entries.slice(start,start+24).map(async([relative,expected])=>{
  if(relative.startsWith('/')||relative.includes('..')||relative.includes('\\'))throw Error('Unsafe asset path');
  const data=await fs.readFile(path.join(source,'app',relative));
  if(data.length!==expected.bytes||crypto.createHash('sha256').update(data).digest('hex')!==expected.sha256)throw Error(`Asset integrity mismatch: ${relative}. Regenerate the asset lock after committing imports.`);
  await fs.mkdir(path.dirname(path.join(output,relative)),{recursive:true});await fs.writeFile(path.join(output,relative),data);bytes+=data.length;
 }));
 const oldBase=migration.oldOrigin+migration.oldBasePath;
 for(const entry of await fs.readdir(output))if(/\.(html|xml|txt)$/.test(entry)){
  const file=path.join(output,entry);let text=(await fs.readFile(file,'utf8')).replaceAll(oldBase,origin+'/');
  if(entry.endsWith('.html')&&entry!=='migration.html'){
   if(!text.includes('rel="canonical"'))text=text.replace('</head>',`<link rel="canonical" href="${origin}/${entry==='index.html'?'':entry}"></head>`);
   text=text.replace('</body>','<script src="migration-settings.js"></script><script src="migration-notice.js"></script></body>');
  }
  if(entry==='privacy.html')text=text.replace('hosted by GitHub Pages','hosted by Vercel').replace('https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement','https://vercel.com/legal/privacy-policy').replace("GitHub's privacy statement","Vercel’s privacy policy");
  await fs.writeFile(file,text);
 }
 await fs.writeFile(path.join(output,'migration-settings.js'),'window.DOSPREP_MIGRATION='+JSON.stringify({...migration,targetOrigin:origin})+';\n');
 await fs.writeFile(path.join(output,'build-info.json'),JSON.stringify({staticOnly:true,assetCommit:lock.commit,assetFiles:entries.length,assetBytes:bytes,firebaseProject:'dosprep-study-a7f31',origin})+'\n');
 console.log(`Static output ready: ${entries.length} verified assets (${bytes} bytes); no Functions or Middleware. Origin: ${origin}`);
}finally{if(temp){const resolved=path.resolve(temp);if(path.dirname(resolved)!==path.resolve(process.env.DOSPREP_TEMP_ROOT||os.tmpdir())||!path.basename(resolved).startsWith('dosprep-build-'))throw Error('Unsafe temporary cleanup');await fs.rm(resolved,{recursive:true,force:true});}}
