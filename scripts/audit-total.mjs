#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const reportDir = path.join(root, 'audit-output');
fs.mkdirSync(reportDir, { recursive: true });

const failures = [], warnings = [], checks = [];
const add = (name, status, detail = '') => checks.push({name, status, detail});
const fail = (name, detail) => { add(name, 'FAIL', detail); failures.push({name, detail}); };
const warn = (name, detail) => { add(name, 'WARN', detail); warnings.push({name, detail}); };
const pass = (name, detail = '') => add(name, 'PASS', detail);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    if (['.git','node_modules','audit-output'].includes(e.name)) continue;
    const p = path.join(dir,e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const files = walk(root);
const rel = p => path.relative(root,p).replaceAll(path.sep,'/');
const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('/supabase/functions/'));
const htmlFiles = files.filter(f => f.endsWith('.html'));

for (const f of jsFiles) {
  try { execFileSync('node', ['--check', f], {stdio:'pipe'}); }
  catch (e) { fail('JavaScript syntax: '+rel(f), String(e.stderr||e.stdout||e.message).trim()); }
}
if (!failures.some(x=>x.name.startsWith('JavaScript syntax:'))) pass('JavaScript syntax', jsFiles.length+' frontend JS files checked');

for (const f of htmlFiles) {
  const s=fs.readFileSync(f,'utf8');
  const refs=[...s.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(m=>m[1]);
  for (const ref of refs) {
    if (/^(https?:|data:|#)/i.test(ref)) continue;
    const clean=ref.split('?')[0].split('#')[0];
    const target=path.resolve(path.dirname(f),clean);
    if (!fs.existsSync(target)) fail('Referenced asset exists: '+rel(f), 'Missing '+ref);
  }
}
if (!failures.some(x=>x.name.startsWith('Referenced asset exists:'))) pass('HTML asset references','All local script/style references resolve');

const allText = files.filter(f=>/\.(js|html|css|sql|json|yml|yaml|md)$/i.test(f));
const secretPatterns = [/SUPABASE_SERVICE_ROLE_KEY\\s*[:=]/gi,/sb_secret_[A-Za-z0-9_-]+/g,/-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----/g];
for (const f of allText) {
  const s=fs.readFileSync(f,'utf8');
  for (const re of secretPatterns) {
    if (re.test(s)) fail('Secret exposure scan', rel(f)+' matches '+re);
    re.lastIndex=0;
  }
}
if (!failures.some(x=>x.name==='Secret exposure scan')) pass('Secret exposure scan','No exposed service-role key/private-key patterns found in tracked text');

const migrationDir=path.join(root,'supabase','migrations');
if (fs.existsSync(migrationDir)) {
  const names=fs.readdirSync(migrationDir).filter(x=>x.endsWith('.sql'));
  const stamps=names.map(x=>(x.match(/^(\d{14})_/)||[])[1]).filter(Boolean);
  const dup=stamps.filter((x,i)=>stamps.indexOf(x)!==i);
  if (dup.length) fail('Migration timestamp uniqueness',[...new Set(dup)].join(', '));
  else pass('Migration timestamp uniqueness',names.length+' migration files checked');
} else warn('Migration directory','supabase/migrations not present');

let changed=[];
try {
  const base = process.env.GITHUB_EVENT_NAME==='pull_request'
    ? execFileSync('git',['rev-parse','origin/'+process.env.GITHUB_BASE_REF],{encoding:'utf8'}).trim()
    : execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim();
  changed=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
} catch {}
add('Changed-file impact scan','INFO',changed.length ? changed.join(', ') : 'No previous commit available');

// Deferred-page navigation safety: every lazily mounted page must be guarded
// before goPage() touches its DOM node. This prevents blank-screen races while
// preserving lazy loading and parallel startup downloads.
const indexPath=path.join(root,'frontend','index.html');
const appPath=path.join(root,'frontend','app.js');
if(fs.existsSync(indexPath) && fs.existsSync(appPath)){
  const indexText=fs.readFileSync(indexPath,'utf8');
  const appText=fs.readFileSync(appPath,'utf8');
  // TAHAP 31/DEPLOY GATE:
  // Validasi marker implementasi lazy-page yang benar-benar digunakan saat ini.
  // Versi lama audit mencari "deferredMounts"/"deferredNames", padahal aplikasi
  // sekarang menggunakan lazyMounts + __ipsrsPageReady + ensureDeferredPageReady_.
  const hasDeferredPages=indexText.includes("const lazyMounts=") &&
    indexText.includes("window.__ipsrsPageReady") &&
    indexText.includes("window.__ipsrsEnsurePage=ensurePage") &&
    indexText.includes("lazyUrls") &&
    indexText.includes("dashboard:'page-dashboard'") &&
    indexText.includes("laporan:'page-laporan'") &&
    indexText.includes("online:'page-online'");
  const hasNavigationGuard=appText.includes("function ensureDeferredPageReady_(name, timeoutMs)") &&
    appText.includes("const IPSRS_DEFERRED_PAGE_NAMES = new Set(['dashboard','laporan','online'])") &&
    appText.includes("!document.getElementById('page-'+name)") &&
    appText.includes("return ensureDeferredPageReady_(waitName,10000)");
  if(hasDeferredPages && hasNavigationGuard) pass('Deferred navigation race gate','Lazy page mounting is guarded before DOM activation');
  else fail('Deferred navigation race gate','Deferred pages exist without a verified navigation readiness guard');
}else{
  fail('Deferred navigation race gate','frontend/index.html or frontend/app.js is missing');
}

const changedJs=changed.filter(x=>x.endsWith('.js'));
if (changedJs.length) {
  const stale=[];
  for (const jf of changedJs) {
    for (const hf of htmlFiles) {
      const s=fs.readFileSync(hf,'utf8');
      const srcs=[...s.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]);
      const hit=srcs.find(x=>x.split('?')[0].endsWith(jf) || x.split('?')[0].endsWith(path.basename(jf)));
      if (hit && !hit.includes('?v=') && !hit.includes('?version=')) stale.push(jf+' referenced by '+rel(hf)+' without cache version');
    }
  }
  if (stale.length) fail('Cache/version impact gate',stale.join('\n'));
  else pass('Cache/version impact gate','Changed JS dependencies have cache-versioned HTML references');
} else pass('Cache/version impact gate','No changed frontend JS detected');

const functionNames=new Map();
for (const f of jsFiles) {
  const s=fs.readFileSync(f,'utf8');
  for (const m of s.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const n=m[1]; if(!functionNames.has(n)) functionNames.set(n,[]); functionNames.get(n).push(rel(f));
  }
}
const dup=[...functionNames.entries()].filter(([,v])=>v.length>1);
if (dup.length) warn('Duplicate global function names',dup.map(([n,v])=>n+': '+v.join(', ')).join('\n'));
else pass('Duplicate global function names','No duplicate top-level function declarations');

const direct=[];
for (const f of files.filter(f=>/\.(js|html)$/i.test(f) && !f.includes('/supabase/functions/'))) {
  const s=fs.readFileSync(f,'utf8');
  if (/\.from\s*\(/.test(s) && /supabase/i.test(s)) direct.push(rel(f));
}
if (direct.length) warn('Frontend direct Supabase access',direct.join(', '));
else pass('Frontend direct Supabase access','No obvious direct .from() Supabase access detected in frontend');

// Security + permission regression gate:
// Guard the authorization invariants that must survive frontend/backend optimizations.
// This is static CI protection only; it does not modify production permissions.
const securityApiPath=path.join(root,'supabase','functions','ipsrs-api','index.ts');
const securityAppPath=path.join(root,'frontend','app.js');
if(fs.existsSync(securityApiPath) && fs.existsSync(securityAppPath)){
  const api=fs.readFileSync(securityApiPath,'utf8');
  const app=fs.readFileSync(securityAppPath,'utf8');
  const securityChecks=[
    ['API authentication gate', api.includes('withSupabase({auth:"user"}')],
    ['Active staff gate', api.includes('status).toLowerCase()!=="aktif"')],
    ['KA report view privacy', api.includes('if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS")return false;')],
    ['KA report edit privacy', api.includes('Laporan KA IPSRS hanya dapat diedit oleh KA IPSRS.')],
    ['KA-only delete gate', api.includes('if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat menghapus laporan."};')],
    ['Batch report visibility policy', api.includes('async function reportPolicyBatch(db:any,s:any,rows:any[])')],
    ['Backend CanEdit authority', api.includes('return{ok:true,data:map(data,ce.ok)}')],
    ['Lazy Dashboard DOM safety', app.includes('if(adminStaffPanel) adminStaffPanel.classList.remove') &&
      app.includes('if(dashStaffFilterWrap) dashStaffFilterWrap.classList.remove') &&
      app.includes('if(dashStaffCard) dashStaffCard.classList.remove')]
  ];
  const bad=securityChecks.filter(([,ok])=>!ok).map(([name])=>name);
  if(bad.length) fail('Security + permission regression gate','Missing invariant(s): '+bad.join(', '));
  else pass('Security + permission regression gate','Auth, active-staff, KA privacy, KA-only delete, batch policy, CanEdit authority, and lazy-Dashboard DOM guards detected');
}else{
  fail('Security + permission regression gate','Backend API or frontend app file is missing');
}

// Delete Report safety contract: UI placement + API authorization + soft-delete/RLS.
const deleteApi=path.join(root,'supabase','functions','ipsrs-api','index.ts');
const deletePage=path.join(root,'frontend','pages','Page_Input.html');
const deleteApp=path.join(root,'frontend','app.js');
const deleteMigrationFiles=fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter(x=>x.includes('soft_delete_reports') && x.endsWith('.sql')) : [];
if(fs.existsSync(deleteApi) && fs.existsSync(deletePage) && fs.existsSync(deleteApp)){
  const api=fs.readFileSync(deleteApi,'utf8'), page=fs.readFileSync(deletePage,'utf8'), app=fs.readFileSync(deleteApp,'utf8');
  const ok = api.includes('if(a==="apiDeleteReport")') && api.includes('s.role!=="KA_IPSRS"') && api.includes('deleted_at') && api.includes('audit(db,s,"DELETE_REPORT"') &&
    app.includes("case 'apiDeleteReport'") && app.includes('async function deleteCurrentReport()') &&
    page.includes('id="btnDeleteReport"') && page.includes('onclick="deleteCurrentReport()"');
  if(ok) pass('Delete Report safety contract','KA-only API + soft delete + audit + edit-form button contract detected');
  else fail('Delete Report safety contract','Required KA-only/soft-delete/audit/UI contract is incomplete');
  if(deleteMigrationFiles.length) pass('Delete Report RLS contract','Soft-delete migration file present: '+deleteMigrationFiles.join(', '));
  else fail('Delete Report RLS contract','Soft-delete migration file not found');
}else fail('Delete Report safety contract','Required Delete Report files are missing');

const md = [
  '# IPSRS Automated Audit Report','',
  'Generated: '+new Date().toISOString(),
  'Commit: '+(process.env.GITHUB_SHA || 'local'),'',
  '## Result: '+(failures.length ? '❌ BLOCKED' : '✅ PASSED'),'',
  '## Checklist',
  ...checks.map(c=>'- ['+(c.status==='PASS'?'x':' ')+'] **'+c.status+'** — '+c.name+(c.detail ? '\n  - '+c.detail.replaceAll('\n','\n  - ') : '')),
  '','## Failures',
  ...(failures.length ? failures.map(x=>'- ❌ **'+x.name+'**: '+x.detail) : ['- None']),
  '','## Warnings',
  ...(warnings.length ? warnings.map(x=>'- ⚠️ **'+x.name+'**: '+x.detail) : ['- None']),
  '','## Meaning',
  '- PASS: completed without a blocking finding.',
  '- WARN: review required, but does not block deployment.',
  '- FAIL: deployment gate must stop until corrected.'
].join('\n');

fs.writeFileSync(path.join(reportDir,'audit-report.md'),md);
fs.writeFileSync(path.join(reportDir,'audit-report.json'),JSON.stringify({generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,failures,warnings,checks},null,2));
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md+'\n');
process.exitCode=failures.length ? 1 : 0;
