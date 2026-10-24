import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const files={};
async function walk(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.posix.join(directory,entry.name);if(entry.isDirectory())await walk(file);else {const data=await fs.readFile(file);files[file.replace(/^app\//,'')]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}}}
await walk('app/assets');const questions=await fs.readFile('app/questions.js');files['questions.js']={bytes:questions.length,sha256:crypto.createHash('sha256').update(questions).digest('hex')};
await fs.writeFile('asset-lock.json',JSON.stringify({repository:'suryamandalapu-boop/reading-rush',commit,files},null,2)+'\n');
console.log(`${Object.keys(files).length} pinned asset files, ${Object.values(files).reduce((n,f)=>n+f.bytes,0)} bytes, commit ${commit}`);
