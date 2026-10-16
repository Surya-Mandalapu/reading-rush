import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Accept only Firebase's PUBLIC web configuration. No credentials or tokens.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [configPath,measurementId='']=process.argv.slice(2);
if(!configPath){console.error('Usage: node tools/configure-site.mjs public-firebase-web-config.json [G-MEASUREMENTID]');process.exit(1);}
const input=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
if(input.private_key||input.client_email||input.refresh_token||input.access_token||input.type==='service_account')throw Error('Use public Firebase web configuration, not a service account or token.');
const required=['apiKey','authDomain','projectId','appId'];
if(!required.every(k=>typeof input[k]==='string'&&input[k]))throw Error('The Firebase web config needs apiKey, authDomain, projectId, and appId.');
if(measurementId&&!/^G-[A-Z0-9]+$/.test(measurementId))throw Error('GA4 measurement ID must start with G-.');
const allowed=[...required,'storageBucket','messagingSenderId','measurementId','databaseURL'];
const firebase=Object.fromEntries(allowed.filter(k=>typeof input[k]==='string').map(k=>[k,input[k]]));
const settings={firebase,measurementId:measurementId||firebase.measurementId||''};
fs.writeFileSync(path.join(root,'app','site-config.js'),'// Public browser configuration. Never add private keys or tokens.\nwindow.DOSPREP_CONFIG = Object.freeze('+JSON.stringify(settings,null,2)+');\n');
console.log('DosPrep public config written. Enable the auth providers and authorized domain in Firebase before deployment.');
