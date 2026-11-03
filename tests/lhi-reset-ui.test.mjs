import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
const login = await readFile(new URL("../frontend/pages/Page_Login.html", import.meta.url), "utf8");
const resetVerify = await readFile(new URL("../supabase/functions/lhi-reset-verify/index.ts", import.meta.url), "utf8");
const recoveryExchange = await readFile(new URL("../supabase/functions/lhi-recovery-exchange/index.ts", import.meta.url), "utf8");

test("global block replaces the normal login form but captures its exact existing markup first", () => {
  const renderStart = app.indexOf("function renderLhiGlobalBlockScreen_");
  const renderEnd = app.indexOf("function removeLhiRecoveryResumeUi_", renderStart);
  const render = app.slice(renderStart, renderEnd);
  const capture = render.indexOf("captureLhiLoginMarkup_(screen)");
  const replace = render.indexOf("screen.innerHTML=");
  assert.ok(capture >= 0 && replace > capture, "login markup must be captured before the block screen replaces it");
  assert.match(login, /<form[^>]+id="ipsrsLoginForm"/);
  assert.match(app, /function captureLhiLoginMarkup_\(screen\)[\s\S]*?originalLhiLoginMarkup_=screen\.innerHTML/);
});

test("correct Reset restores the same login form before showing the login screen", () => {
  const renderStart = app.indexOf("function renderLhiGlobalBlockScreen_");
  const renderEnd = app.indexOf("function removeLhiRecoveryResumeUi_", renderStart);
  const render = app.slice(renderStart, renderEnd);
  const restore = render.indexOf("restoreLhiLoginMarkup_(screen)");
  const setChallenge = render.indexOf("pendingLhiRecoveryChallenge_=challenge");
  const showLogin = render.indexOf("showLoginScreen('Kode reset diterima.");
  assert.ok(restore >= 0 && setChallenge > restore && showLogin > setChallenge);
  assert.match(app, /function restoreLhiLoginMarkup_\(screen\)[\s\S]*?screen\.innerHTML=originalLhiLoginMarkup_[\s\S]*?querySelector\('#ipsrsLoginForm'\)/);
  assert.match(app, /if\(loginScreen && !loginScreen\.querySelector\('#ipsrsLoginForm'\)\)[\s\S]*?restoreLhiLoginMarkup_\(loginScreen\)/);
});

test("legacy Reset endpoint without a challenge gives an explicit server-upgrade message and never opens login", () => {
  assert.match(app, /if\(challenge\.length<32\) throw new Error\('Kode Reset diterima server, tetapi layanan pemulihan KA IPSRS belum lengkap di server\./);
  assert.match(app, /const challenge=String\(result\.challenge\|\|''\)\.trim\(\);[\\s\\S]*?if\(challenge\.length<32\) throw new Error/);
  assert.match(app, /administrator harus menyelesaikan pembaruan layanan pemulihan/);
});

test("incorrect Reset never restores login or issues a recovery challenge", () => {
  const renderStart = app.indexOf("function renderLhiGlobalBlockScreen_");
  const renderEnd = app.indexOf("function removeLhiRecoveryResumeUi_", renderStart);
  const render = app.slice(renderStart, renderEnd);
  const verify = render.indexOf("if(!response.ok||!result||result.valid!==true)");
  const restore = render.indexOf("restoreLhiLoginMarkup_(screen)");
  assert.ok(verify >= 0 && restore > verify);
  const failurePath = render.slice(verify, restore);
  assert.match(failurePath, /throw new Error/);
  assert.doesNotMatch(failurePath, /pendingLhiRecoveryChallenge_=challenge/);
});

test("Reset challenge is server-issued, single-use, and bound to the authenticated KA identity", () => {
  assert.match(resetVerify, /create_lhi_recovery_challenge/);
  assert.match(resetVerify, /LHI_RESET_CODE_HASH/);
  assert.doesNotMatch(resetVerify, /192645/);
  assert.match(recoveryExchange, /db\.auth\.getUser\(bearer\)/);
  assert.match(recoveryExchange, /consume_lhi_recovery_challenge/);
  assert.doesNotMatch(recoveryExchange, /body\?\.staff_id|body\?\.role/);
});

test("after Reset, KA authentication is exchanged for restricted recovery and never enters normal app", () => {
  const branch = app.indexOf("if(pendingLhiRecoveryChallenge_){");
  const normalAuth = app.indexOf("action:'apiWhoAmI'", branch);
  assert.ok(branch >= 0 && normalAuth > branch);
  const block = app.slice(branch, normalAuth);
  assert.match(block, /exchangeLhiRecoveryChallenge_\(session\.access_token,challenge\)/);
  assert.match(block, /client\.auth\.signOut\(\{scope:'local'\}\)/);
  assert.match(block, /renderLhiRecoveryOnlyScreen_\(recoveryStatus\)/);
  assert.doesNotMatch(block, /setSession\(|afterAuthReady\(|goPage\(/);
});
