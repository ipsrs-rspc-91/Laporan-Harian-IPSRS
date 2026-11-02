import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261103120000_lhi_restricted_recovery_challenges.sql", import.meta.url),
  "utf8",
);
const resetRpc = await readFile(
  new URL("../docs/drafts/2026-11-03-lhi-atomic-reset-grace-v2-review.sql", import.meta.url),
  "utf8",
);

test("challenge issuance supports only consistent LOCKED or GRACE/global-lock pairs", () => {
  assert.match(migration, /status IN \('LOCKED', 'GRACE'\)/);
  assert.match(migration, /v_lock = 'AKTIF' AND v_incident_status = 'LOCKED'/);
  assert.match(migration, /v_lock = 'NONAKTIF' AND v_incident_status = 'GRACE'/);
});

test("challenge consumption is incident-bound and checks same lock-state pair", () => {
  assert.match(migration, /incident_id::text = v_challenge\.incident_id/);
  assert.match(migration, /v_lock = 'AKTIF' AND v_incident_status = 'LOCKED'/);
  assert.match(migration, /v_lock = 'NONAKTIF' AND v_incident_status = 'GRACE'/);
  assert.match(migration, /consumed_at IS NULL/);
});

test("recovery challenge, exchange and validation serialize with scheduler", () => {
  assert.ok((migration.match(/pg_advisory_xact_lock\(hashtextextended\('lhi_discipline_scheduler_v2', 0\)\)/g)||[]).length >= 3);
});

test("recovery capability remains bounded by the active grace deadline", () => {
  assert.match(resetRpc, /SET expires_at = v_now \+ interval '12 hours'/);
  assert.match(resetRpc, /WHERE token_hash = p_recovery_session_token_hash/);
  assert.match(resetRpc, /AND incident_id = v_incident\.incident_id::text/);
});
