import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(
  new URL("../frontend/app.js", import.meta.url),
  "utf8",
);
const recoveryAction = await readFile(
  new URL("../supabase/functions/lhi-recovery-action/index.ts", import.meta.url),
  "utf8",
);
const accessControl = await readFile(
  new URL("../frontend/access-control.js", import.meta.url),
  "utf8",
);

test("Reset challenge is kept in memory and exchanged before apiWhoAmI", () => {
  assert.match(app, /pendingLhiRecoveryChallenge_\s*=\s*String\(result\.challenge\|\|''\)/);
  assert.match(app, /exchangeLhiRecoveryChallenge_\(session\.access_token,challenge\)/);
  const recoveryBranch = app.indexOf("if(pendingLhiRecoveryChallenge_){");
  const whoAmI = app.indexOf("action:'apiWhoAmI'");
  assert.ok(recoveryBranch >= 0 && whoAmI > recoveryBranch);
  assert.doesNotMatch(app, /IPSRS_LHI_RESET_AUTH_MODE/);
});

test("successful recovery login returns before normal session and dashboard initialization", () => {
  const branch = app.indexOf("if(pendingLhiRecoveryChallenge_){");
  const branchEnd = app.indexOf("const who=await fetch", branch);
  const block = app.slice(branch, branchEnd);
  assert.match(block, /renderLhiRecoveryOnlyScreen_\(recoveryStatus\)/);
  assert.match(block, /client\.auth\.signOut\(\{scope:'local'\}\)/);
  assert.ok(block.indexOf("client.auth.signOut({scope:'local'})") < block.indexOf("renderLhiRecoveryOnlyScreen_(recoveryStatus)"));
  assert.match(block, /CURRENT_SESSION=null/);
  assert.match(block, /sessionStorage\.removeItem\(SESSION_KEY\)/);
  assert.ok(block.indexOf("sessionStorage.removeItem(SESSION_KEY)") < block.indexOf("renderLhiRecoveryOnlyScreen_(recoveryStatus)"));
  assert.match(block, /return true/);
  assert.doesNotMatch(block, /setSession\(|afterAuthReady\(|goPage\(/);
});

test("restricted recovery UI hides app shell and exposes only recovery actions", () => {
  const start = app.indexOf("function renderLhiRecoveryOnlyScreen_");
  const end = app.indexOf("async function performLogin", start);
  const block = app.slice(start, end);
  assert.match(block, /appShell/);
  assert.match(block, /apiRecoveryStatus/);
  assert.match(block, /apiStartLhiGrace/);
  assert.doesNotMatch(block, /apiWhoAmI|apiGetReports|apiCreateReport|goPage\(/);
});

test("opaque recovery capability is memory-only and discarded on refresh", () => {
  assert.match(app, /let lhiRecoveryCapability_ = null/);
  assert.match(app, /function setLhiRecoveryCapability_\(value\)\s*\{\s*lhiRecoveryCapability_=String\(value\|\|''\);\s*\}/);
  assert.match(app, /function clearSession\(\)\s*\{[\s\S]*?lhiRecoveryCapability_ = null/);
  assert.doesNotMatch(app, /IPSRS_LHI_RECOVERY_CAPABILITY|savedRecoveryCapability/);
  assert.doesNotMatch(app, /sessionStorage\.(?:setItem|getItem)\([^)]*RECOVERY/i);
  assert.doesNotMatch(app, /localStorage\.(?:setItem|getItem)\([^)]*RECOVERY/i);
  assert.match(app, /refresh intentionally drops the memory-only capability/);
});

test("recovery action endpoint rejects anything beyond status and start-grace", () => {
  assert.match(recoveryAction, /\["apiRecoveryStatus", "apiStartLhiGrace"\]/);
});

test("KA can resume restricted recovery from a fresh tab during grace", () => {
  assert.match(app, /function renderLhiRecoveryResumeUi_\(/);
  assert.match(app, /LANJUTKAN PEMULIHAN KA IPSRS/);
  assert.match(app, /lhi-reset-verify/);
  assert.match(app, /pendingLhiRecoveryChallenge_=String\(result\.challenge\|\|''\)/);
  assert.match(app, /status\.grace_active/);
});


test("Cloudflare preview hosts never inherit the production Supabase endpoint", async () => {
  const config = await readFile(
    new URL("../frontend/config.js", import.meta.url),
    "utf8",
  );
  assert.match(config, /host\.endsWith\('\.rspc\.workers\.dev'\)/);
  assert.match(config, /host!=='laporan-harian-ipsrs\.rspc\.workers\.dev'/);
  assert.match(config, /IPSRS_PREVIEW_BACKEND_DISABLED=true/);
  assert.match(config, /IPSRS_SUPABASE_URL=''/);
});

test("server discipline warning escapes staff names before inserting them into HTML", async () => {
  const login = await readFile(
    new URL("../frontend/login-fast.js", import.meta.url),
    "utf8",
  );
  assert.match(login, /const escapeHtml=\(value\)=>String\(value==null\?'':value\)\.replace\(\/\[&<>"'\]\/g/);
  assert.match(login, /names\.map\(x=>'🔴 '\+escapeHtml\(x\.nama\)\)/);
  assert.doesNotMatch(login, /names\.map\(x=>'🔴 '\+x\.nama\)/);
});

test("global lock screen does not claim a delinquent person is listed when server has no names", () => {
  const start = app.indexOf("function renderLhiGlobalBlockScreen_");
  const end = app.indexOf("function removeLhiRecoveryResumeUi_", start);
  const block = app.slice(start, end);
  assert.match(block, /const triggerIntro=trigger[\s\S]*?Mode Blok Aplikasi diaktifkan oleh server karena kewajiban LHI belum dipenuhi/);
  assert.ok(block.includes('<p class="lhi-lock-intro">${triggerIntro}</p>'));
});


test("operational access panel never exposes the obsolete direct global-unlock action", () => {
  assert.doesNotMatch(accessControl, /deactivateLhiGlobalBlock|onclick=["']deactivateLhiGlobalBlock/);
  assert.match(accessControl, /Gunakan jalur Reset khusus pada Form Blok Aplikasi/);
  assert.match(accessControl, /seluruh login normal ditutup/);
  assert.match(accessControl, /grace\.data\.excluded/);
});


test("failed Reset authentication keeps the recovery-specific fail-closed message reachable", () => {
  const recoveryIndex = app.indexOf("const recoveryAttempt=recoveryLoginAttempt||!!pendingLhiRecoveryChallenge_");
  const clearIndex = app.indexOf("clearSession()", recoveryIndex);
  const branchIndex = app.indexOf("if(recoveryAttempt)", clearIndex);
  assert.ok(recoveryIndex >= 0);
  assert.ok(clearIndex > recoveryIndex);
  assert.ok(branchIndex > clearIndex);
  const catchStart = app.lastIndexOf("}catch(err){", recoveryIndex);
  const catchEnd = app.indexOf("const rawMsg=", branchIndex);
  const catchBlock = app.slice(catchStart, catchEnd);
  assert.match(catchBlock, /client\.auth\.signOut\(\{scope:'local'\}\)/);
  const block = app.slice(recoveryIndex, catchEnd);
  assert.match(block, /Login pemulihan gagal\. Blokir aplikasi tetap aktif/);
  assert.match(block, /setTimeout\(\(\)=>checkAuthAndInit\(\),0\)/);
  assert.match(app, /let recoveryLoginAttempt=false/);
  const recoveryBranch = app.indexOf("recoveryLoginAttempt=true;");
  const challengeClear = app.indexOf("pendingLhiRecoveryChallenge_=null", recoveryBranch);
  assert.ok(recoveryBranch >= 0 && challengeClear > recoveryBranch);
  assert.ok(block.includes("recoveryLoginAttempt||!!pendingLhiRecoveryChallenge_"));
});


test("access panel never reports zero unverified anchors when the server read fails", () => {
  assert.match(accessControl, /anchorReviewAvailable=!!\(anchorReview&&anchorReview\.ok&&Array\.isArray\(anchorReview\.data\)\)/);
  assert.match(accessControl, /STATUS VERIFIKASI TIDAK TERSEDIA/);
  assert.match(accessControl, /Jangan menganggap seluruh tanggal aktif telah terverifikasi/);
  assert.match(accessControl, /STATUS KELONGGARAN TIDAK TERSEDIA/);
  assert.match(accessControl, /jangan menganggap tidak ada insiden/);
});


test("maintenance role rejection signs out only the current device", () => {
  const marker = app.indexOf("if(IPSRS_MAINTENANCE_MODE");
  const end = app.indexOf("setSession(Object.assign", marker);
  const block = app.slice(marker, end);
  assert.match(block, /client\.auth\.signOut\(\{scope:'local'\}\)/);
  assert.doesNotMatch(block, /client\.auth\.signOut\(\)/);
});
