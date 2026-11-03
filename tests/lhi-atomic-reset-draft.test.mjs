import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../docs/drafts/2026-11-03-lhi-atomic-reset-grace-v2-review.sql", import.meta.url),
  "utf8",
);

test("atomic Reset RPC is review-only and transaction wrapped", () => {
  assert.match(sql, /REVIEW DRAFT ONLY — NOT A DEPLOYABLE MIGRATION/);
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
});

test("Reset revalidates the recovery capability and exact allowed action", () => {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /validate_lhi_recovery_session/);
  assert.match(sql, /'apiStartLhiGrace'/);
  assert.match(sql, /Sesi pemulihan tidak valid atau tidak memiliki kewenangan/);
});

test("Reset is incident-bound and accepts only LOCKED or idempotent GRACE", () => {
  assert.match(sql, /v_incident_id := \(v_validation ->> 'incident_id'\)::bigint/);
  assert.match(sql, /v_incident\.status = 'GRACE'/);
  assert.match(sql, /v_incident\.status <> 'LOCKED' OR v_lock <> 'AKTIF'/);
});

test("retry returns original grace timestamps without shifting deadline", () => {
  assert.match(sql, /Idempotency:[\s\S]*never creates a second snapshot or shifts 12h/);
  assert.match(sql, /'already_open', true/);
  assert.match(sql, /'started_at', v_incident\.started_at/);
  assert.match(sql, /'deadline_at', v_incident\.deadline_at/);
});

test("snapshot is created atomically at Reset for delinquent active staff only", () => {
  assert.match(sql, /INSERT INTO public\.lhi_discipline_snapshot_members/);
  assert.match(sql, /e\.employment_status = 'Aktif'/);
  assert.match(sql, /e\.missed_full_days >= 9/);
  assert.match(sql, /GET DIAGNOSTICS v_snapshot_count = ROW_COUNT/);
  assert.match(sql, /v_snapshot_count < 1/);
  assert.match(sql, /SNAPSHOT_CREATED/);
});

test("Reset clears LHI access blocks but never changes employment status", () => {
  assert.match(sql, /SET lhi_access_status = 'NORMAL'/);
  assert.doesNotMatch(sql, /UPDATE public\.staff\s+SET status\s*=/i);
});

test("grace is exactly twelve hours and all changes are one RPC transaction", () => {
  assert.match(sql, /deadline_at = v_now \+ interval '12 hours'/);
  assert.match(sql, /SET status = 'GRACE'/);
  assert.match(sql, /SET value = 'NONAKTIF'/);
  assert.match(sql, /RAISE EXCEPTION[\s\S]*seluruh perubahan dibatalkan/);
});

test("only service_role can execute the atomic Reset RPC", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.open_lhi_global_grace_v2\(text\)[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.open_lhi_global_grace_v2\(text\)[\s\S]*TO service_role/);
});

test("a new Reset after grace relock creates a new immutable snapshot cycle", async () => {
  const schema = await readFile(
    new URL("../docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql", import.meta.url),
    "utf8",
  );
  assert.match(schema, /UNIQUE \(incident_id, grace_cycle, staff_id\)/);
  assert.match(sql, /ON CONFLICT \(incident_id, grace_cycle, staff_id\) DO NOTHING/);
  assert.match(sql, /v_incident\.grace_cycle \+ 1/);
  assert.match(sql, /WHERE m\.incident_id = v_incident\.incident_id\s+AND m\.grace_cycle = v_incident\.grace_cycle \+ 1\s+AND m\.snapshot_created_at = v_now/);
  assert.doesNotMatch(sql, /AND m\.grace_cycle = v_incident\.grace_cycle\s+AND m\.grace_cycle = v_incident\.grace_cycle \+ 1/);
  assert.match(sql, /SET status = 'GRACE',[\s\S]*?grace_cycle = v_incident\.grace_cycle \+ 1/);
});

test("atomic Reset rejects null or invalid global lock setting", () => {
  assert.match(sql, /v_lock IS NULL OR v_lock NOT IN \('AKTIF', 'NONAKTIF'\)/);
});


test("atomic Reset refuses unverified employment anchors", () => {
  assert.match(sql, /lhi_active_since IS NULL OR s\.lhi_active_since_verified_at IS NULL/);
  assert.match(sql, /anchor belum diverifikasi HR atau peristiwa reaktivasi/);
});
