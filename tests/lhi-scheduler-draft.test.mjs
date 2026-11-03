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
  assert.match(sql, /IF v_pending > 0 THEN[\s\S]*?status = 'LOCKED'/);
  assert.match(sql, /status = 'COMPLETED'/);
});

test("grace obligations exclude inactive staff and reverse cancelled reports", () => {
  assert.match(sql, /obligation_status = 'EXCLUDED_INACTIVE'/);
  assert.match(sql, /s\.status <> 'Aktif'/);
  assert.match(sql, /r\.deleted_at IS NULL/);
  assert.match(sql, /CASE WHEN c\.report_id IS NULL THEN 'PENDING' ELSE 'COMPLETED' END/);
  assert.match(sql, /REPORT_QUALIFIED/);
  assert.match(sql, /REPORT_CANCELLED/);
  assert.match(sql, /OBLIGATION_REOPENED/);
});

test("scheduler creates only a LOCKED incident; snapshot waits for atomic Reset", () => {
  assert.doesNotMatch(sql, /INSERT INTO public\.lhi_discipline_snapshot_members/i);
  assert.match(sql, /locked_at/);
  assert.match(sql, /'LOCKED'/);
  assert.match(schemaSql, /UNIQUE \(incident_id, grace_cycle, staff_id\)/);
});

test("each grace evaluation is isolated to the active Reset cycle", () => {
  assert.match(sql, /m\.grace_cycle = v_grace\.grace_cycle/);
  assert.match(sql, /v_grace\.grace_cycle/);
});

test("scheduler pauses new discipline cleanly until HR anchors are verified", () => {
  assert.match(sql, /lhi_active_since IS NULL OR lhi_active_since_verified_at IS NULL/);
  assert.match(sql, /ANCHOR_RECONCILIATION_REQUIRED/);
  assert.match(sql, /Siklus disiplin baru ditahan sampai tanggal aktivasi\/reaktivasi seluruh pegawai Aktif diverifikasi HR/);
  assert.match(sql, /Konfigurasi LHI_GLOBAL_BLOCK tidak ada atau tidak valid/);
  assert.match(sql, /Insiden LOCKED ditemukan tetapi LHI_GLOBAL_BLOCK tidak AKTIF/);
  assert.match(sql, /Incident GRACE ditemukan tetapi LHI_GLOBAL_BLOCK bukan NONAKTIF/);
  assert.match(sql, /LHI_GLOBAL_BLOCK AKTIF tetapi incident LOCKED tidak ditemukan/);
});

test("existing LOCKED/GRACE recovery is processed before HR-anchor gate", () => {
  const graceComment = sql.indexOf("-- A GRACE incident suspends normal discipline evaluation.");
  const graceDeadlineCheck = sql.indexOf("IF v_now < v_grace.deadline_at THEN", graceComment);
  const normalCycleGate = sql.indexOf("-- No active incident remains.", graceDeadlineCheck);
  const anchorGate = sql.indexOf("lhi_active_since_verified_at", normalCycleGate);
  assert.ok(graceComment > 0 && graceDeadlineCheck > graceComment);
  assert.ok(normalCycleGate > graceDeadlineCheck && anchorGate > normalCycleGate);
  assert.match(sql.slice(normalCycleGate, anchorGate), /Before starting a new discipline cycle/);
});

test("warning team broadcast contains all names and day-7 notice explains day-8 block", () => {
  assert.match(sql, /string_agg\(x\.nama, ', ' ORDER BY x\.nama\)/);
  assert.match(sql, /GROUP BY x\.stage\s+LOOP/);
  assert.doesNotMatch(sql, /GROUP BY x\.stage, x\.missed_full_days/);
  assert.match(sql, /Blokir akses individual berlaku pada hari ke-8/);
  assert.match(sql, /:TEAM/);
  assert.match(sql, /:TEAM'/);
  assert.match(sql, /ON CONFLICT \(event_key, recipient_staff_id\) DO UPDATE/);
  assert.match(sql, /FROM public\.staff s\s+WHERE s\.status = 'Aktif'/);
  assert.doesNotMatch(sql, /:PERSONAL:/);
});


test("scheduler functions are not executable by client roles", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.run_lhi_discipline_scheduler_v2\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
});

test("day-8 in-app notification reaches active staff whose access is not blocked", () => {
  const start = sql.indexOf("'LHI:' || v_today_wib::text || ':BLOCK_INDIVIDUAL:TEAM'");
  assert.notEqual(start, -1);
  const end = sql.indexOf("ON CONFLICT (event_key, recipient_staff_id) DO UPDATE", start);
  assert.notEqual(end, -1);
  const recipientQuery = sql.slice(start, end);
  assert.match(recipientQuery, /WHERE s\.status = 'Aktif'/);
  assert.match(recipientQuery, /COALESCE\(s\.lhi_access_status, 'NORMAL'\) <> 'BLOCKED_LHI'/);
  assert.match(sql, /:BLOCK_INDIVIDUAL:TEAM'/);
  assert.match(sql, /ON CONFLICT \(event_key, recipient_staff_id\) DO UPDATE/);
});

test("scheduler fails closed when multiple LOCKED or GRACE incidents coexist", () => {
  assert.match(sql, /SELECT count\(\*\)[\s\S]*FROM public\.lhi_discipline_incidents\s+WHERE status IN \('LOCKED', 'GRACE'\)/);
  assert.match(sql, /Lebih dari satu insiden LHI aktif ditemukan/);
});

test("scheduler fails closed when the global lock setting is missing or invalid", () => {
  assert.match(sql, /IF NOT FOUND OR v_lock IS NULL OR v_lock NOT IN \('AKTIF', 'NONAKTIF'\)/);
});


test("day-8 SQL notification event identity matches the JavaScript discipline helper", async () => {
  const helper = await readFile(
    new URL("../supabase/functions/ipsrs-api/lhi-discipline.mjs", import.meta.url),
    "utf8",
  );
  assert.match(sql, /:BLOCK_INDIVIDUAL:TEAM'/);
  assert.match(helper, /event_key: `LHI:\$\{todayWib\}:BLOCK_INDIVIDUAL:TEAM`/);
});


test("Supabase local E2E pins a fixed CLI release instead of resolving latest at runtime", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/lhi-supabase-local-e2e.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /uses: supabase\/setup-cli@v3/);
  assert.match(workflow, /version: "2\.122\.1"/);
  assert.doesNotMatch(workflow, /version: latest/);
});

test("production cron cutover pauses and resumes the same single job", async () => {
  const pause = await readFile(
    new URL("../docs/drafts/2026-11-03-lhi-cron-pause-v2-review.sql", import.meta.url),
    "utf8",
  );
  const cutover = await readFile(
    new URL("../docs/drafts/2026-11-03-lhi-cron-switch-v2-review.sql", import.meta.url),
    "utf8",
  );
  assert.match(pause, /jobname = 'lhi-discipline-scheduler-every-5-minutes'/);
  assert.match(pause, /status = 'running'/);
  assert.match(pause, /active := false/);
  assert.match(cutover, /active IS DISTINCT FROM false/);
  assert.match(cutover, /command := 'select public\.run_lhi_discipline_scheduler_v2\(\);'/);
  assert.match(cutover, /active := true/);
  assert.match(cutover, /schedule = '\*\/5 \* \* \* \*'/);
  assert.match(cutover, /count\(\*\)[\s\S]*run_lhi_discipline_scheduler/);
  const workflow = await readFile(
    new URL("../.github/workflows/lhi-supabase-local-e2e.yml", import.meta.url),
    "utf8",
  );
  assert.ok(
    workflow.indexOf("2026-11-03-lhi-cron-pause-v2-review.sql")
      < workflow.indexOf("2026-11-03-lhi-cron-switch-v2-review.sql"),
  );
});

test("LHI production migrations are generated by the pinned Supabase CLI in dependency order", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/lhi-supabase-local-e2e.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /uses: supabase\/setup-cli@v3/);
  assert.match(workflow, /version: "2\.122\.1"/);
  assert.match(workflow, /supabase migration new/);
  assert.match(workflow, /contents: write/);
  const schema = workflow.indexOf("create_migration lhi_schema_v2");
  const challenge = workflow.indexOf("create_migration lhi_restricted_recovery_challenges");
  const scheduler = workflow.indexOf("create_migration lhi_scheduler_v2");
  const atomic = workflow.indexOf("create_migration lhi_atomic_reset_grace_v2");
  assert.ok(schema > 0 && challenge > schema && scheduler > challenge && atomic > scheduler);
  assert.match(workflow, /schema_ts.*-lt.*challenge_ts/);
  assert.match(workflow, /challenge_ts.*-lt.*scheduler_ts/);
  assert.match(workflow, /scheduler_ts.*-lt.*atomic_ts/);
});
