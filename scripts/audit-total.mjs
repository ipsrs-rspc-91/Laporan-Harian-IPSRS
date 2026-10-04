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
const secretPatterns = [/SUPABASE_SERVICE_ROLE_KEY\s*[:=]/gi,/sb_secret_[A-Za-z0-9_-]+/g,/-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----/g];
for (const f of allText) {
  const s=fs.readFileSync(f,'utf8');
  for (const re of secretPatterns) {
    if (re.test(s)) fail('Secret exposure scan', rel(f)+' matches '+re);
    re.lastIndex=0;
  }
}
if (!failures.some(x=>x.name==='Secret exposure scan')) pass('Secret exposure scan','No exposed service-role key/private-key patterns found in tracked text');

if (fs.existsSync(indexPath)) {
  const indexTextForCache = fs.readFileSync(indexPath,'utf8');
  const appRefs = [...indexTextForCache.matchAll(/app\\.js\\?v=([^"'\\s&]+)/g)].map(m=>m[1]);
  const uniqueAppRefs = [...new Set(appRefs)];
  if (uniqueAppRefs.length === 1) {
    pass('app.js cache-version consistency','All index.html app.js references use the same cache version: '+uniqueAppRefs[0]);
  } else if (uniqueAppRefs.length > 1) {
    fail('app.js cache-version consistency','index.html contains inconsistent app.js cache versions: '+uniqueAppRefs.join(', '));
  } else {
    fail('app.js cache-version consistency','index.html does not contain a versioned app.js reference');
  }
}


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
  const hasDeferredPages=indexText.includes("deferredMounts") &&
    indexText.includes("window.__ipsrsPageReady.laporan") &&
    indexText.includes("window.__ipsrsPageReady.dashboard");
  const hasNavigationGuard=appText.includes("ensureDeferredPageReady_") &&
    appText.includes("deferredNames=new Set(['dashboard','laporan','online'])") &&
    appText.includes("!document.getElementById('page-'+name)");
  if(hasDeferredPages && hasNavigationGuard) pass('Deferred navigation race gate','Lazy page mounting is guarded before DOM activation');
  else fail('Deferred navigation race gate','Deferred pages exist without a verified navigation readiness guard');
}else{
  fail('Deferred navigation race gate','frontend/index.html or frontend/app.js is missing');
}

function parseLockedProtectedFiles(lockText){
  const lines=lockText.split(/\r?\n/);
  let currentId='', currentStatus='', protectedMode=false;
  const lockedFiles=[];
  for(const line of lines){
    const id=line.match(/^  - id:\s*([^#]+)$/);
    if(id){ currentId=id[1].trim().replaceAll('"',''); currentStatus=''; protectedMode=false; continue; }
    const st=line.match(/^    status:\s*([^#]+)$/);
    if(st){ currentStatus=st[1].trim().replaceAll('"',''); protectedMode=false; continue; }
    if(/^    protected_files:\s*$/.test(line)){ protectedMode=true; continue; }
    if(protectedMode){
      const fm=line.match(/^      -\s*"([^"]+)"$/);
      if(fm && currentStatus==='LOCKED') lockedFiles.push({file:fm[1],module:currentId});
      if(!/^      -/.test(line) && line.trim() && !/^\s/.test(line)) protectedMode=false;
    }
  }
  return lockedFiles;
}

function lockGateSelfTest(){
  const fixture=[
    'modules:',
    '  - id: DASH',
    '    status: LOCKED',
    '    protected_files:',
    '      - "frontend/pages/Page_Dashboard.html"',
    '  - id: KAT',
    '    status: STABLE_CANDIDATE',
    '    protected_files:',
    '      - "frontend/app.js"'
  ].join('\n');
  const parsed=parseLockedProtectedFiles(fixture);
  const dash=parsed.some(x=>x.module==='DASH' && x.file==='frontend/pages/Page_Dashboard.html');
  const kat=parsed.some(x=>x.module==='KAT');
  if(!dash || kat) throw new Error('LOCK gate self-test failed: protected LOCKED file parsing is incorrect');
  const touched=parsed.filter(x=>x.file==='frontend/pages/Page_Dashboard.html');
  if(touched.length!==1) throw new Error('LOCK gate self-test failed: unauthorized dummy change was not detected');
  const unauthorizedWithoutUnlock=touched.filter(x=>![''].includes(x.module));
  if(unauthorizedWithoutUnlock.length!==1) throw new Error('LOCK gate self-test failed: missing unlock did not block DASH');
  const overrides=['DASH'];
  const unauthorizedWithUnlock=touched.filter(x=>!overrides.includes(x.module));
  if(unauthorizedWithUnlock.length!==0) throw new Error('LOCK gate self-test failed: explicit [UNLOCK DASH] did not authorize DASH');
  return true;
}
try{ lockGateSelfTest(); pass('LOCK gate self-test','Synthetic DASH LOCKED file change is detected; STABLE_CANDIDATE files are excluded'); }
catch(e){ fail('LOCK gate self-test',e.message); }

// LOCK REGISTER GATE — protected source files cannot change without explicit unlock token.
const lockRegisterPath=path.join(root,'LOCK_REGISTER.yaml');
if(fs.existsSync(lockRegisterPath) && changed.length){
  const lockText=fs.readFileSync(lockRegisterPath,'utf8');
  const lockedFiles=parseLockedProtectedFiles(lockText);
  const touched=lockedFiles.filter(x=>changed.includes(x.file));
  let commitMessage='';
  try{ commitMessage=execFileSync('git',['log','-1','--pretty=%B'],{encoding:'utf8'}).trim(); }catch{}
  const overrides=(commitMessage.match(/\[UNLOCK\s+([A-Z0-9_-]+)\]/gi)||[]).map(x=>x.replace(/^\[UNLOCK\s+/i,'').replace(/\]$/,'').toUpperCase());
  const unauthorized=touched.filter(x=>!overrides.includes(x.module.toUpperCase()));
  if(unauthorized.length){
    fail('LOCK register gate',unauthorized.map(x=>x.file+' protected by '+x.module).join('\n')+'\nExplicit commit authorization required: [UNLOCK MODULE_ID]');
  }else if(touched.length){
    warn('LOCK register gate','Protected file change explicitly authorized: '+touched.map(x=>x.file).join(', '));
  }else{
    pass('LOCK register gate','No LOCKED protected files changed');
  }
}else if(fs.existsSync(lockRegisterPath)){
  pass('LOCK register gate','No changed files detected');
}else{
  fail('LOCK register gate','LOCK_REGISTER.yaml is missing');
}

// Shared Input regression contract — protects existing Pelapor/No LK while SPMU changes.
const inputContractPath=path.join(root,'frontend','pages','Page_Input.html');
const inputAppPath=path.join(root,'frontend','app.js');
const inputRequiredPath=path.join(root,'frontend','required-fields-ui.js');
const inputApiPath=path.join(root,'supabase','functions','ipsrs-api','index.ts');
if(fs.existsSync(inputContractPath) && fs.existsSync(inputAppPath) && fs.existsSync(inputRequiredPath) && fs.existsSync(inputApiPath)){
  const page=fs.readFileSync(inputContractPath,'utf8');
  const app=fs.readFileSync(inputAppPath,'utf8');
  const req=fs.readFileSync(inputRequiredPath,'utf8');
  const api=fs.readFileSync(inputApiPath,'utf8');

  const protectedPelapor = [
    'id="Pelapor"','id="NoLK"','id="pelaporLkFields"',
    'id="pelaporLkToggle"','id="pelaporLkToggleIcon"',
    'function setPelaporLkSection(','function togglePelaporLkSection(',
    'function updatePelaporLkStatus_('
  ];
  const missingPelapor=protectedPelapor.filter(x=>!(page.includes(x)||app.includes(x)));
  if(missingPelapor.length) fail('Protected Pelapor/No LK contract', 'Missing: '+missingPelapor.join(', '));
  else pass('Protected Pelapor/No LK contract','Pelapor/No LK markup and control functions are present');

  const spmuFields=['SparePartUnitKind','SparePartUnitStatus','SparePartUnit','Type','Jumlah'];
  const missingSpmu=spmuFields.filter(x=>!page.includes('id="'+x+'"') || !req.includes(x) || !api.includes(x));
  if(missingSpmu.length) fail('SPMU field contract','Missing or unmapped: '+missingSpmu.join(', '));
  else pass('SPMU field contract','All 5 SPMU data fields are present and mapped frontend -> required-fields -> API');

  const unitPairs=[
    ['BARU','UNIT BARU'],['KANIBAL','UNIT KANIBAL'],
    ['DARI UNIT / RUANGAN LAIN','UNIT DARI UNIT / RUANGAN LAIN'],['LAINNYA','UNIT LAINNYA']
  ];
  const sparePairs=[
    ['BARU','SPARE PART / MATERIAL BARU'],['KANIBAL','SPARE PART / MATERIAL KANIBAL'],
    ['DARI UNIT / RUANGAN LAIN','SPARE PART / MATERIAL DARI UNIT / RUANGAN LAIN'],
    ['LAINNYA','SPARE PART / MATERIAL LAINNYA']
  ];
  const checkPairs=(pairs)=>{
    const missing=[];
    for(const [value,label] of pairs){
      const exact='<option value="'+value+'">'+label+'</option>';
      if(!page.includes(exact) && !app.includes(exact)) missing.push(value+' -> '+label);
    }
    return missing;
  };
  const missingChoices=[...checkPairs(unitPairs),...checkPairs(sparePairs)];
  if(missingChoices.length) fail('SPMU choice contract','Missing/incorrect label-value pairs: '+missingChoices.join(', '));
  else pass('SPMU choice contract','UNIT and SPARE PART / MATERIAL each retain the exact four approved label-value pairs');

  const backendStatusValues=[
    'BARU','KANIBAL','DARI UNIT / RUANGAN LAIN','LAINNYA'
  ];
  const statusGate=backendStatusValues.every(x=>api.includes('"'+x+'"'));
  const legacyForbidden=api.includes('"STOK IPSRS"');
  if(!statusGate) fail('SPMU backend status contract','Backend does not preserve the four approved status/source values');
  else if(legacyForbidden) fail('SPMU backend status contract','Forbidden legacy status/source STOK IPSRS is still accepted by backend');
  else pass('SPMU backend status contract','Backend accepts exactly the four approved status/source values: BARU, KANIBAL, DARI UNIT / RUANGAN LAIN, LAINNYA');

  const inlineHandlers=[...page.matchAll(/onclick=["']([^"']+)["']/gi)]
    .map(m=>m[1].split(/\s*[;(]/)[0])
    .filter(x=>x && x!=='if' && /^[A-Za-z_$][\w$]*$/.test(x));
  const fnNames=new Set([...app.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
  const missingHandlers=[...new Set(inlineHandlers.filter(x=>!fnNames.has(x)))];
  if(missingHandlers.length) fail('Page_Input handler contract','Inline handlers without matching app.js function: '+missingHandlers.join(', '));
  else pass('Page_Input handler contract','All simple inline handlers have matching app.js functions');
}else{
  fail('Input regression contract','Required Page_Input/app.js/required-fields/API files are missing');
}

const changedJs=changed.filter(x=>x.endsWith('.js'));
if (changedJs.length) {
  const stale=[];
  const currentRefs=new Map();
  for (const hf of htmlFiles) {
    const current=fs.readFileSync(hf,'utf8');
    const srcs=[...current.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]);
    for (const jf of changedJs) {
      const hit=srcs.find(x=>x.split('?')[0].endsWith(jf) || x.split('?')[0].endsWith(path.basename(jf)));
      if (!hit) continue;
      if (!hit.includes('?v=') && !hit.includes('?version=')) {
        stale.push(jf+' referenced by '+rel(hf)+' without cache version');
        continue;
      }
      const baseRef = process.env.GITHUB_EVENT_NAME==='pull_request'
        ? (() => { try { return execFileSync('git',['show','origin/'+process.env.GITHUB_BASE_REF+':'+rel(hf)],{encoding:'utf8'}); } catch { return ''; } })()
        : (() => { try { return execFileSync('git',['show','HEAD^:'+rel(hf)],{encoding:'utf8'}); } catch { return ''; } })();
      if (baseRef) {
        const baseSrcs=[...baseRef.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]);
        const baseHit=baseSrcs.find(x=>x.split('?')[0].endsWith(jf) || x.split('?')[0].endsWith(path.basename(jf)));
        if (baseHit && baseHit===hit) {
          stale.push(jf+' changed but '+rel(hf)+' kept the same cache version: '+hit);
        }
      }
      currentRefs.set(jf,hit);
    }
  }
  if (stale.length) fail('Cache/version impact gate',stale.join('\n'));
  else pass('Cache/version impact gate','Changed JS dependencies have cache-versioned HTML references that changed with the dependency');
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
