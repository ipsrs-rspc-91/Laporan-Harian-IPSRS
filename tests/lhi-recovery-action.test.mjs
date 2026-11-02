import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase/functions/lhi-recovery-action/index.ts", import.meta.url),
  "utf8",
);
const resetVerify = await readFile(
  new URL("../supabase/functions/lhi-reset-verify/index.ts", import.meta.url),
  "utf8",
);
const config = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);

test("recovery action is a separate POST-only, no-store endpoint", () => {
  assert.match(source, /req\.method !== "POST"/);
  assert.match(source, /Cache-Control.*no-store/);
  assert.match(source, /LHI_ALLOWED_ORIGINS/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin.*\*/);
});

test("only the two explicitly allowed recovery actions can pass", () => {
  assert.match(source, /\["apiRecoveryStatus", "apiStartLhiGrace"\]/);
  assert.match(source, /Aksi pemulihan tidak diizinkan/);
});

test("opaque capability is hashed and validated server-side", () => {
  assert.match(source, /sha256\(capability\)/);
  assert.match(source, /validate_lhi_recovery_session/);
  assert.match(source, /p_session_token_hash: tokenHash/);
  assert.match(source, /p_action: action/);
});

test("Reset action calls only the v2 atomic grace RPC", () => {
  assert.match(source, /open_lhi_global_grace_v2/);
  assert.match(source, /p_recovery_session_token_hash: tokenHash/);
  assert.doesNotMatch(source, /open_lhi_global_grace\(/);
});

test("recovery action does not call normal app API or expose a general proxy", () => {
  assert.doesNotMatch(source, /ipsrs-api/);
  assert.doesNotMatch(source, /apiWhoAmI|apiGetReports|apiSaveReport|apiGetDashboard/);
  assert.match(source, /\["apiRecoveryStatus", "apiStartLhiGrace"\]/);
});

test("JWT gateway is bypassed only for recovery endpoints that verify their own proof", () => {
  assert.match(config, /\[functions\.lhi-recovery-action\]\s*verify_jwt = false/);
  assert.match(config, /\[functions\.ipsrs-api\]\s*verify_jwt = true/);
});

test("Reset rate limit trusts only edge-overwritten client IP header", () => {
  assert.match(resetVerify, /cf-connecting-ip/);
  assert.doesNotMatch(resetVerify, /headers\.get\(\"x-forwarded-for\"\)/i);
});
