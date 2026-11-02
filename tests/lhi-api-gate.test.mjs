import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(
  new URL("../supabase/functions/ipsrs-api/index.ts", import.meta.url),
  "utf8",
);
const blockStatus = await readFile(
  new URL("../supabase/functions/lhi-block-status/index.ts", import.meta.url),
  "utf8",
);
const config = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);

test("normal API rejects every role while global LHI lock is active", () => {
  assert.match(api, /LHI_GLOBAL_BLOCK/);
  assert.match(api, /globalLockState==="AKTIF"/);
  assert.match(api, /globalLockState!=="NONAKTIF"/);
  assert.match(api, /MODE FORM BLOK APLIKASI AKTIF/);
});

test("KA IPSRS cannot enter normal API during GRACE recovery", () => {
  assert.match(api, /String\(data\.role\|\|""\)==="KA_IPSRS"/);
  assert.match(api, /\.eq\("status","GRACE"\)/);
  assert.match(api, /Dashboard dan menu operasional tidak tersedia selama masa grace/);
});

test("legacy normal API route cannot invoke old unsafe Reset RPC", () => {
  assert.match(api, /Jalur Reset lama dinonaktifkan/);
  assert.doesNotMatch(api, /rpc\("open_lhi_global_grace"/);
});

test("block status endpoint is GET-only and fails closed when setting cannot be read", () => {
  assert.match(blockStatus, /req\.method !== "GET"/);
  assert.match(blockStatus, /blocked: true/);
  assert.match(blockStatus, /if \(error \|\| !data\)/);
  assert.match(blockStatus, /lockState !== "AKTIF" && lockState !== "NONAKTIF"/);
  assert.match(blockStatus, /LHI_ALLOWED_ORIGINS/);
  assert.doesNotMatch(blockStatus, /Access-Control-Allow-Origin.*\*/);
});

test("main operational API retains gateway JWT verification", () => {
  assert.match(config, /\[functions\.ipsrs-api\]\s*verify_jwt = true/);
  assert.match(config, /\[functions\.lhi-block-status\]\s*verify_jwt = false/);
});

test("global lock is checked before staff lookup or auth mapping fallback", () => {
  const lockCheck = api.indexOf("const globalLockState=");
  const staffLookup = api.indexOf("from(\"staff\").select(staffFields)");
  const fallbackWrite = api.indexOf(".update({auth_user_id:uid})");
  assert.ok(lockCheck >= 0 && staffLookup > lockCheck && fallbackWrite > lockCheck);
});

test("block status reports active grace deadline without globally blocking normal staff", () => {
  assert.match(blockStatus, /\.eq\("status", "GRACE"\)/);
  assert.match(blockStatus, /grace_active: Boolean\(graceIncident\)/);
  assert.match(blockStatus, /grace_deadline_at/);
});
