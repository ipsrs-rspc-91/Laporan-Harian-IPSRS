import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../docs/drafts/2026-11-03-lhi-scheduler-v2-review.sql", import.meta.url),
  "utf8",
);
const schemaSql = await readFile(
  new URL("../docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql", import.meta.url),
  "utf8",
);

test("scheduler draft is review-only and transaction wrapped", () => {
  assert.match(sql, /REVIEW DRAFT ONLY — NOT A DEPLOYABLE MIGRATION/);
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
});

test("discipline anchor uses created_at and Asia/Jakarta", () => {
  assert.match(sql, /max\(r\.created_at\)/);
  assert.match(sql, /AT TIME ZONE 'Asia\/Jakarta'/);
  assert.match(sql, /r\.created_at >= s\.lhi_active_since/);
  assert.doesNotMatch(sql, /r\.tanggal\s*=/);
});

test("README thresholds and day-9 waiting state are encoded", () => {
  assert.match(sql, /missed_full_days = 3 THEN 'WARNING_1'/);
  assert.match(sql, /missed_full_days = 5 THEN 'WARNING_2'/);
  assert.match(sql, /missed_full_days = 6 THEN 'WARNING_3'/);
  assert.match(sql, /missed_full_days = 8 THEN 'WAITING'/);
  assert.match(sql, /missed_full_days >= 9 THEN 'GLOBAL_BLOCK'/);
  assert.match(sql, /missed_full_days >= 7 THEN 'BLOCK_INDIVIDUAL_ACCESS'/);
});

test("all active staff are evaluated without role or access-status exclusion", () => {
  assert.match(sql, /WHERE s\.status = 'Aktif'/);
  assert.doesNotMatch(sql, /role\s*<>\s*'KA_IPSRS'/);
  assert.doesNotMatch(sql, /lhi_access_status\s*<>\s*'BLOCKED_LHI'\s*\n\s*\)/);
});

test("scheduler serializes executions and captures one timestamp", () => {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_now timestamptz := clock_timestamp\(\)/);
  assert.match(sql, /v_today_wib date := \(v_now AT TIME ZONE 'Asia\/Jakarta'\)::date/);
});

test("scheduler never changes employment status", () => {
  assert.doesNotMatch(sql, /UPDATE public\.staff\s+SET status\s*=/i);
  assert.doesNotMatch(sql, /SET status\s*=\s*'Aktif'/i);
  assert.match(sql, /SET lhi_access_status = 'BLOCKED_LHI'/);
});

test("grace is not finalized before its deadline", () => {
  assert.match(sql, /IF v_now < v_grace\.deadline_at THEN[\s\S]*?deadline_reached', false/);
  assert.match(sql, /IF v_pending > 0 THEN[\s\S]*?status = 'EXPIRED'/);
  assert.match(sql, /status = 'COMPLETED'/);
});

test("grace obligations exclude inactive staff and reverse cancelled reports", () => {
  assert.match(sql, /obligation_status = 'EXCLUDED_INACTIVE'/);
  assert.match(sql, /s\.status <> 'Aktif'/);
  assert.match(sql, /r\.deleted_at IS NULL/);
  assert.match(sql, /obligation_status = CASE WHEN q\.report_id IS NULL THEN 'PENDING' ELSE 'COMPLETED' END/);
});

test("scheduler creates only a LOCKED incident; snapshot waits for atomic Reset", () => {
  assert.doesNotMatch(sql, /INSERT INTO public\\.lhi_discipline_snapshot_members/i);
  assert.match(sql, /locked_at/);
  assert.match(sql, /'LOCKED'/);
  assert.match(schemaSql, /UNIQUE \\(incident_id, staff_id\\)/);
});

test("scheduler refuses inconsistent global lock and missing anchor", () => {
  assert.match(sql, /lhi_active_since IS NULL/);
  assert.match(sql, /Konfigurasi LHI_GLOBAL_BLOCK tidak ditemukan/);
  assert.match(sql, /Insiden LOCKED ditemukan tetapi LHI_GLOBAL_BLOCK tidak AKTIF/);
});

test("warning team broadcast contains all names and day-7 notice explains day-8 block", () => {
  assert.match(sql, /string_agg\(x\.nama, ', ' ORDER BY x\.nama\)/);
  assert.match(sql, /Blokir akses individual berlaku pada hari ke-8/);
  assert.match(sql, /:TEAM/);
});

test("scheduler functions are not executable by client roles", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.run_lhi_discipline_scheduler_v2\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
});
