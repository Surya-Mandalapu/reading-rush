import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),outputRoot=path.resolve(process.env.DOSPREP_OUTPUT_ROOT||root),output=path.resolve(outputRoot,'dist-pages'),settings=JSON.parse(await fs.readFile(process.env.DOSPREP_MIGRATION_CONFIG||'migration.json','utf8'));
if(outputRoot!==root&&outputRoot!==path.resolve('D:/Codex/DosPrepMigration'))throw Error('Invalid local staging workspace');
if(path.dirname(output)!==outputRoot||path.basename(output)!=='dist-pages')throw Error('Invalid Pages output directory');
if(settings.enabled&&(!settings.targetOrigin||!settings.verifiedDeployment))throw Error('A tested Vercel deployment is required before enabling redirects.');
await fs.rm(output,{recursive:true,force:true});await fs.cp('app',output,{recursive:true});
if(settings.enabled){
 const gate=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>DosPrep has moved</title><link rel="stylesheet" href="${settings.oldBasePath}style.css"><link rel="canonical" href="${settings.targetOrigin}/"></head><body><main class="privacy-page"><span class="eyebrow">Your study space has a new address</span><h1>DosPrep has moved.</h1><section class="card"><p id="migration-status" role="status">Checking this browser’s saved progress…</p><p>Continue at <strong>${new URL(settings.targetOrigin).hostname}</strong> with the same Firebase account, synced progress, live rooms, and statistics. Sign in again on the new site.</p><p>Guest history, account backups, pending cloud changes, and queued answer statistics are stored separately for each website address. Move this browser’s data before leaving. Original data will stay here as a backup; passwords and login tokens are never transferred.</p><div class="toolbar"><button id="move-data" class="primary">Move browser data & continue</button><button id="download-data">Download full browser backup</button></div><p><a id="finish-room" hidden>Finish my current live room here →</a></p><p><a id="stay-old">Stay on the old site to sync or recover progress</a></p><details><summary>Continue without transferring this browser’s data</summary><p>Your cloud account data will load after signing in again. Guest history and pending changes will remain only at the old address. Active anonymous room identities cannot move; finish that room here first.</p><a id="continue-new">Continue to new DosPrep →</a></details><noscript><p>JavaScript is needed to transfer browser data. Keep the old site’s browser storage and use a backup before visiting <a href="${settings.targetOrigin}/">new DosPrep</a>.</p></noscript></section></main><script src="${settings.oldBasePath}migration-settings.js"></script><script type="module" src="${settings.oldBasePath}migration-send.js"></script></body></html>`;
 await fs.mkdir(path.join(output,'legacy'),{recursive:true});
 for(const name of await fs.readdir(output))if(name.endsWith('.html')&&name!=='migration.html'){
  let original=await fs.readFile(path.join(output,name),'utf8');
  original=original.replace('<head>','<head><base href="'+settings.oldBasePath+'">').replace('</body>',`<aside class="library-note">DosPrep has moved. You can finish this live room or recover browser data here. <a href="${settings.oldBasePath}practice.html?migration=1">Move browser data to the new site →</a></aside></body>`);
  original=original.replace('name="robots" content="index,follow"','name="robots" content="noindex,follow"');
  if(!original.includes('name="robots"'))original=original.replace('</head>','<meta name="robots" content="noindex,follow"></head>');
  await fs.writeFile(path.join(output,'legacy',name),original);
  const canonical=settings.targetOrigin+'/'+(name==='index.html'?'':name);
  await fs.writeFile(path.join(output,name),gate.replace(`href="${settings.targetOrigin}/"`,`href="${canonical}"`));
 }
 await fs.writeFile(path.join(output,'404.html'),gate);
 await fs.writeFile(path.join(output,'migration-settings.js'),'window.DOSPREP_MIGRATION='+JSON.stringify(settings)+';\n');
 await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${settings.targetOrigin}/</loc></url><url><loc>${settings.targetOrigin}/privacy.html</loc></url></urlset>`);
}
console.log(settings.enabled?'Pages migration gate built; local data and old live-room recovery retained.':'Pages remains on the existing site; migration redirects are disabled.');
