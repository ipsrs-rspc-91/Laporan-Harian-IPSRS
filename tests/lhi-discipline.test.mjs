import test from "node:test";
import assert from "node:assert/strict";
import {
  wibDateKey,
  latestValidInputAt,
  complianceAnchorWibDate,
  missedFullCalendarDays,
  disciplineStage,
} from "../supabase/functions/ipsrs-api/lhi-discipline.mjs";

test("WIB date conversion handles UTC timestamps crossing midnight", () => {
  assert.equal(wibDateKey("2026-10-31T17:05:00.000Z"), "2026-11-01");
  assert.equal(wibDateKey("2026-11-01T16:59:59.000Z"), "2026-11-01");
  assert.equal(wibDateKey("2026-11-01T17:00:00.000Z"), "2026-11-02");
});

test("multiple reports on one input date produce one active date via latest timestamp", () => {
  const reports = [
    { created_at: "2026-11-01T01:00:00Z", deleted_at: null },
    { created_at: "2026-11-01T10:00:00Z", deleted_at: null },
  ];
  assert.equal(latestValidInputAt(reports, "2026-10-01T00:00:00Z"), "2026-11-01T10:00:00.000Z");
  assert.equal(complianceAnchorWibDate(reports, "2026-10-01T00:00:00Z"), "2026-11-01");
});

test("cancelled report is not a valid LHI input", () => {
  const reports = [
    { created_at: "2026-11-02T03:00:00Z", deleted_at: "2026-11-02T04:00:00Z" },
    { created_at: "2026-11-01T03:00:00Z", deleted_at: null },
  ];
  assert.equal(latestValidInputAt(reports, "2026-10-01T00:00:00Z"), "2026-11-01T03:00:00.000Z");
});

test("reactivation timestamp resets the anchor and ignores older LHI", () => {
  const reports = [
    { created_at: "2026-10-20T02:00:00Z", deleted_at: null },
    { created_at: "2026-11-02T02:00:00Z", deleted_at: null },
  ];
  const activeSince = "2026-11-02T03:00:00Z";
  assert.equal(latestValidInputAt(reports, activeSince), null);
  assert.equal(complianceAnchorWibDate(reports, activeSince), "2026-11-02");
});

test("calendar day calculation excludes anchor date and current unfinished date", () => {
  assert.equal(missedFullCalendarDays("2026-10-22", "2026-10-22"), 0);
  assert.equal(missedFullCalendarDays("2026-10-23", "2026-10-22"), 0);
  assert.equal(missedFullCalendarDays("2026-10-24", "2026-10-22"), 1);
  assert.equal(missedFullCalendarDays("2026-11-01", "2026-10-22"), 9);
});

test("README stage boundaries are exact", () => {
  assert.deepEqual(disciplineStage(3), { stageDay: 4, action: "WARNING_1" });
  assert.deepEqual(disciplineStage(5), { stageDay: 6, action: "WARNING_2" });
  assert.deepEqual(disciplineStage(6), { stageDay: 7, action: "WARNING_3" });
  assert.deepEqual(disciplineStage(7), { stageDay: 8, action: "BLOCK_INDIVIDUAL_ACCESS" });
  assert.deepEqual(disciplineStage(8), { stageDay: 9, action: "WAITING" });
  assert.deepEqual(disciplineStage(9), { stageDay: 10, action: "GLOBAL_BLOCK" });
  assert.deepEqual(disciplineStage(12), { stageDay: 10, action: "GLOBAL_BLOCK" });
});


test("evaluation monitors every active role and keeps blocked staff in day-10 trigger set", async () => {
  const { evaluateDiscipline } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const staff = [
    { staff_id: "A", nama: "Agung", role: "STAFF", status: "Aktif", lhi_access_status: "BLOCKED_LHI", lhi_active_since: "2026-10-20T00:00:00Z" },
    { staff_id: "K", nama: "KA IPSRS", role: "KA_IPSRS", status: "Aktif", lhi_access_status: "NORMAL", lhi_active_since: "2026-10-20T00:00:00Z" },
    { staff_id: "N", nama: "Nonaktif", role: "STAFF", status: "Nonaktif", lhi_active_since: "2026-10-01T00:00:00Z" },
  ];
  const result = evaluateDiscipline(staff, {}, "2026-10-30");
  assert.deepEqual(result.evaluations.map((row) => row.staff_id), ["A", "K"]);
  assert.deepEqual(result.globalBlockTriggers.map((row) => row.staff_id), ["A", "K"]);
  assert.equal(result.evaluations[0].access_status, "BLOCKED_LHI");
});

test("discipline evaluation produces warning stages and day-8 block from the same anchor", async () => {
  const { evaluateDiscipline } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const staff = [3, 5, 6, 7, 8, 9].map((missed) => ({
    staff_id: String(missed),
    status: "Aktif",
    lhi_active_since: "2026-10-01T00:00:00Z",
  }));
  const today = "2026-10-20";
  const reports = Object.fromEntries(staff.map((row) => {
    const missed = Number(row.staff_id);
    const anchorDay = new Date(Date.UTC(2026, 9, 20 - missed - 1)).toISOString();
    return [row.staff_id, [{ created_at: anchorDay, deleted_at: null }]];
  }));
  const result = evaluateDiscipline(staff, reports, today);
  assert.deepEqual(result.warnings.WARNING_1.map((row) => row.staff_id), ["3"]);
  assert.deepEqual(result.warnings.WARNING_2.map((row) => row.staff_id), ["5"]);
  assert.deepEqual(result.warnings.WARNING_3.map((row) => row.staff_id), ["6"]);
  assert.deepEqual(result.individualBlocks.map((row) => row.staff_id), ["7"]);
  assert.deepEqual(result.evaluations.filter((row) => row.action === "WAITING").map((row) => row.staff_id), ["8"]);
  assert.deepEqual(result.globalBlockTriggers.map((row) => row.staff_id), ["9"]);
});


test("warning broadcast includes every delinquent name and deduplicated recipient keys", async () => {
  const { buildWarningNotifications } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const evaluations = [
    { staff_id: "A", nama: "Agung", action: "WARNING_3" },
    { staff_id: "B", nama: "Budi", action: "WARNING_3" },
  ];
  const notifications = buildWarningNotifications(evaluations, [
    { staff_id: "A", status: "Aktif" },
    { staff_id: "B", status: "Aktif" },
    { staff_id: "C", status: "Aktif" },
    { staff_id: "D", status: "Nonaktif" },
  ], "2026-11-03");
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /Agung, Budi/);
  assert.match(notifications[0].message, /hari ke-8/);
  assert.deepEqual(notifications[0].recipients.map((r) => r.recipient_staff_id), ["A", "B", "C"]);
  assert.equal(new Set(notifications[0].recipients.map((r) => r.event_key)).size, 3);
});

test("grace snapshot has one member per delinquent active staff, not one per missed day", async () => {
  const { buildGraceSnapshot } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const rows = [
    { staff_id: "A", employment_status: "Aktif", action: "GLOBAL_BLOCK", anchor_wib: "2026-10-20", missed_full_days: 10 },
    { staff_id: "A", employment_status: "Aktif", action: "GLOBAL_BLOCK", anchor_wib: "2026-10-20", missed_full_days: 10 },
    { staff_id: "B", employment_status: "Aktif", action: "WARNING_3", anchor_wib: "2026-10-25", missed_full_days: 6 },
    { staff_id: "C", employment_status: "Nonaktif", action: "GLOBAL_BLOCK", anchor_wib: "2026-10-20", missed_full_days: 10 },
  ];
  const snapshot = buildGraceSnapshot(rows, "2026-11-03T00:00:00Z");
  assert.deepEqual(snapshot.map((row) => row.staff_id), ["A"]);
  assert.equal(snapshot[0].obligation_status, "PENDING");
});

test("grace completion requires valid non-deleted report inside 12-hour window", async () => {
  const { evaluateGraceSnapshot } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const snapshot = [
    { staff_id: "A", obligation_status: "PENDING" },
    { staff_id: "B", obligation_status: "PENDING" },
    { staff_id: "C", obligation_status: "PENDING" },
  ];
  const staff = {
    A: { status: "Aktif" },
    B: { status: "Aktif" },
    C: { status: "Nonaktif" },
  };
  const reports = {
    A: [
      { id: "old", created_at: "2026-11-03T00:00:00Z", deleted_at: null },
      { id: "valid", created_at: "2026-11-03T05:00:00Z", deleted_at: null },
    ],
    B: [
      { id: "cancelled", created_at: "2026-11-03T05:00:00Z", deleted_at: "2026-11-03T06:00:00Z" },
      { id: "late", created_at: "2026-11-03T17:00:00Z", deleted_at: null },
    ],
  };
  const result = evaluateGraceSnapshot(snapshot, staff, reports, "2026-11-03T04:00:00Z", "2026-11-03T16:00:00Z");
  assert.deepEqual(result.members.map((row) => row.obligation_status), ["COMPLETED", "PENDING", "EXCLUDED_INACTIVE"]);
  assert.deepEqual(result.pendingActive.map((row) => row.staff_id), ["B"]);
  assert.equal(result.shouldReactivateGlobalBlock, true);
});

test("an inactive-excluded grace obligation stays excluded after later reactivation", async () => {
  const { evaluateGraceSnapshot } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const result = evaluateGraceSnapshot(
    [{ staff_id: "A", obligation_status: "EXCLUDED_INACTIVE" }],
    { A: { status: "Aktif" } },
    {},
    "2026-11-03T00:00:00Z",
    "2026-11-03T12:00:00Z",
  );
  assert.equal(result.members[0].obligation_status, "EXCLUDED_INACTIVE");
  assert.equal(result.allSatisfied, true);
});


test("day-8 block notice names every blocked employee and excludes blocked recipients", async () => {
  const { buildIndividualBlockNotifications } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const notices = buildIndividualBlockNotifications([
    { staff_id: "A", nama: "Agung", action: "BLOCK_INDIVIDUAL_ACCESS" },
    { staff_id: "B", nama: "Budi", action: "BLOCK_INDIVIDUAL_ACCESS" },
    { staff_id: "C", nama: "Citra", action: "WARNING_3" },
  ], [
    { staff_id: "A", status: "Aktif", lhi_access_status: "BLOCKED_LHI" },
    { staff_id: "B", status: "Aktif", lhi_access_status: "BLOCKED_LHI" },
    { staff_id: "C", status: "Aktif", lhi_access_status: "NORMAL" },
    { staff_id: "D", status: "Aktif", lhi_access_status: "NORMAL" },
    { staff_id: "E", status: "Nonaktif", lhi_access_status: "NORMAL" },
  ], "2026-11-03");
  assert.equal(notices.length, 1);
  assert.match(notices[0].message, /Agung, Budi/);
  assert.match(notices[0].message, /hari ke-8/);
  assert.deepEqual(notices[0].recipients.map((row) => row.recipient_staff_id), ["C", "D"]);
  assert.deepEqual(notices[0].blocked_staff_ids, ["A", "B"]);
  assert.equal(new Set(notices[0].recipients.map((row) => row.event_key)).size, 2);
});

test("day-8 notice is absent when nobody reaches individual block stage", async () => {
  const { buildIndividualBlockNotifications } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  assert.deepEqual(buildIndividualBlockNotifications(
    [{ staff_id: "A", action: "WARNING_3" }],
    [{ staff_id: "B", status: "Aktif" }],
    "2026-11-03",
  ), []);
});

test("grace report at exact start is valid and report at exact deadline is late", async () => {
  const { evaluateGraceSnapshot } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const result = evaluateGraceSnapshot(
    [
      { staff_id: "START", obligation_status: "PENDING" },
      { staff_id: "END", obligation_status: "PENDING" },
    ],
    { START: { status: "Aktif" }, END: { status: "Aktif" } },
    {
      START: [{ id: "at-start", created_at: "2026-11-03T04:00:00Z", deleted_at: null }],
      END: [{ id: "at-end", created_at: "2026-11-03T16:00:00Z", deleted_at: null }],
    },
    "2026-11-03T04:00:00Z",
    "2026-11-03T16:00:00Z",
  );
  assert.deepEqual(result.members.map((row) => row.obligation_status), ["COMPLETED", "PENDING"]);
});

test("deleting the only qualifying grace report reopens the obligation", async () => {
  const { evaluateGraceSnapshot } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const snapshot = [{ staff_id: "A", obligation_status: "COMPLETED", qualifying_report_id: "R1" }];
  const result = evaluateGraceSnapshot(
    snapshot,
    { A: { status: "Aktif" } },
    { A: [{ id: "R1", created_at: "2026-11-03T05:00:00Z", deleted_at: "2026-11-03T06:00:00Z" }] },
    "2026-11-03T04:00:00Z",
    "2026-11-03T16:00:00Z",
  );
  assert.equal(result.members[0].obligation_status, "PENDING");
  assert.equal(result.shouldReactivateGlobalBlock, true);
});

test("deleting one grace report does not reopen obligation when another valid report remains", async () => {
  const { evaluateGraceSnapshot } = await import("../supabase/functions/ipsrs-api/lhi-discipline.mjs");
  const result = evaluateGraceSnapshot(
    [{ staff_id: "A", obligation_status: "COMPLETED", qualifying_report_id: "R1" }],
    { A: { status: "Aktif" } },
    { A: [
      { id: "R1", created_at: "2026-11-03T05:00:00Z", deleted_at: "2026-11-03T06:00:00Z" },
      { id: "R2", created_at: "2026-11-03T07:00:00Z", deleted_at: null },
    ] },
    "2026-11-03T04:00:00Z",
    "2026-11-03T16:00:00Z",
  );
  assert.equal(result.members[0].obligation_status, "COMPLETED");
  assert.equal(result.shouldReactivateGlobalBlock, false);
});


test("recovery role allowlist accepts only KA_IPSRS", async () => {
  const { isRecoveryRole } = await import("../supabase/functions/ipsrs-api/recovery-policy.mjs");
  assert.equal(isRecoveryRole("KA_IPSRS"), true);
  assert.equal(isRecoveryRole("ka_ipsrs"), true);
  assert.equal(isRecoveryRole("ADMIN"), false);
  assert.equal(isRecoveryRole("SUPER_ADMIN"), false);
  assert.equal(isRecoveryRole("STAFF"), false);
});

test("recovery nonce rejects missing, mismatched, consumed, expired and cross-incident values", async () => {
  const { validateRecoveryNonce } = await import("../supabase/functions/ipsrs-api/recovery-policy.mjs");
  const base = {
    nonceRecord: { incident_id: "I-1", expires_at: "2026-11-03T06:00:00Z", consumed_at: null },
    submittedNonceHashMatches: true,
    now: "2026-11-03T05:00:00Z",
    incidentId: "I-1",
  };
  assert.deepEqual(validateRecoveryNonce(base), { valid: true, reason: "OK" });
  assert.equal(validateRecoveryNonce({ ...base, nonceRecord: null }).reason, "NONCE_NOT_FOUND");
  assert.equal(validateRecoveryNonce({ ...base, submittedNonceHashMatches: false }).reason, "NONCE_MISMATCH");
  assert.equal(validateRecoveryNonce({ ...base, nonceRecord: { ...base.nonceRecord, consumed_at: "2026-11-03T04:00:00Z" } }).reason, "NONCE_ALREADY_USED");
  assert.equal(validateRecoveryNonce({ ...base, now: "2026-11-03T06:00:00Z" }).reason, "NONCE_EXPIRED");
  assert.equal(validateRecoveryNonce({ ...base, incidentId: "I-2" }).reason, "INCIDENT_MISMATCH");
});

test("recovery exchange requires authenticated matching KA IPSRS and active employment", async () => {
  const { evaluateRecoveryExchange } = await import("../supabase/functions/ipsrs-api/recovery-policy.mjs");
  const input = {
    authUser: { id: "AUTH-1" },
    staff: { auth_user_id: "AUTH-1", role: "KA_IPSRS", status: "Aktif" },
    nonceRecord: { incident_id: "INC-1", expires_at: "2026-11-03T06:00:00Z", consumed_at: null },
    submittedNonceHashMatches: true,
    now: "2026-11-03T05:00:00Z",
    incidentId: "INC-1",
  };
  assert.equal(evaluateRecoveryExchange(input).allowed, true);
  assert.equal(evaluateRecoveryExchange({ ...input, authUser: null }).reason, "AUTH_REQUIRED");
  assert.equal(evaluateRecoveryExchange({ ...input, staff: { ...input.staff, auth_user_id: "OTHER" } }).reason, "STAFF_AUTH_MISMATCH");
  assert.equal(evaluateRecoveryExchange({ ...input, staff: { ...input.staff, role: "ADMIN" } }).reason, "ROLE_NOT_ALLOWED");
  assert.equal(evaluateRecoveryExchange({ ...input, staff: { ...input.staff, status: "Nonaktif" } }).reason, "EMPLOYMENT_INACTIVE");
});

test("recovery capability is incident-bound, user-bound, short-lived and action-restricted", async () => {
  const { recoveryCapabilityAllows, recoveryActionAllowed } = await import("../supabase/functions/ipsrs-api/recovery-policy.mjs");
  const capability = {
    subject: "AUTH-1",
    scope: "lhi.recovery",
    incident_id: "INC-1",
    expires_at: "2026-11-03T06:00:00Z",
  };
  assert.equal(recoveryActionAllowed("apiRecoveryStatus"), true);
  assert.equal(recoveryActionAllowed("apiStartLhiGrace"), true);
  assert.equal(recoveryActionAllowed("apiGetReports"), false);
  assert.equal(recoveryActionAllowed("apiGetDashboard"), false);
  const args = { capability, authUserId: "AUTH-1", action: "apiRecoveryStatus", now: "2026-11-03T05:00:00Z", incidentId: "INC-1" };
  assert.equal(recoveryCapabilityAllows(args).allowed, true);
  assert.equal(recoveryCapabilityAllows({ ...args, action: "apiGetReports" }).reason, "ACTION_FORBIDDEN");
  assert.equal(recoveryCapabilityAllows({ ...args, authUserId: "AUTH-2" }).reason, "SUBJECT_MISMATCH");
  assert.equal(recoveryCapabilityAllows({ ...args, incidentId: "INC-2" }).reason, "INCIDENT_MISMATCH");
  assert.equal(recoveryCapabilityAllows({ ...args, now: "2026-11-03T06:00:00Z" }).reason, "CAPABILITY_EXPIRED");
  assert.equal(recoveryCapabilityAllows({ ...args, capability: { ...capability, scope: "normal" } }).reason, "SCOPE_INVALID");
});

test("grace recovery is exactly 12 hours and retries preserve the original incident deadline", async () => {
  const { planGraceRecovery } = await import("../supabase/functions/ipsrs-api/recovery-policy.mjs");
  const first = planGraceRecovery({
    incident: { incident_id: "INC-1", status: "LOCKED" },
    now: "2026-11-03T05:00:00Z",
  });
  assert.equal(first.allowed, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.create_snapshot, true);
  assert.equal(first.deadline_at, "2026-11-03T17:00:00.000Z");

  const retry = planGraceRecovery({
    incident: { incident_id: "INC-1", status: "GRACE", started_at: first.started_at, deadline_at: first.deadline_at },
    now: "2026-11-03T08:00:00Z",
  });
  assert.equal(retry.idempotent, true);
  assert.equal(retry.create_snapshot, false);
  assert.equal(retry.started_at, first.started_at);
  assert.equal(retry.deadline_at, first.deadline_at);
  assert.equal(planGraceRecovery({ incident: { incident_id: "INC-2", status: "COMPLETED" }, now: "2026-11-03T05:00:00Z" }).allowed, false);
  assert.throws(() => planGraceRecovery({ incident: { incident_id: "INC-3", status: "LOCKED" }, now: "2026-11-03T05:00:00Z", graceHours: 24 }));
});


test("restricted recovery SQL keeps challenges and sessions private to server-side functions", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = fileURLToPath(new URL("../supabase/migrations/20261103120000_lhi_restricted_recovery_challenges.sql", import.meta.url));
  const sql = await readFile(path, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private\.lhi_recovery_challenges/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private\.lhi_recovery_sessions/);
  assert.match(sql, /ALTER TABLE private\.lhi_recovery_challenges ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE private\.lhi_recovery_sessions ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON private\.lhi_recovery_challenges FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.consume_lhi_recovery_challenge\(text, uuid, text\) TO service_role/);
  assert.match(sql, /v_staff\.role IS DISTINCT FROM 'KA_IPSRS'/);
  assert.match(sql, /lower\(coalesce\(v_staff\.status, ''\)\) <> 'aktif'/);
  assert.match(sql, /v_challenge\.expires_at <= v_now/);
  assert.match(sql, /v_challenge\.consumed_at IS NOT NULL/);
  assert.match(sql, /p_action NOT IN \('apiRecoveryStatus', 'apiStartLhiGrace'\)/);
  assert.match(sql, /interval '5 minutes'/);
  assert.match(sql, /interval '10 minutes'/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.(register_lhi_reset_attempt|create_lhi_recovery_challenge|consume_lhi_recovery_challenge|validate_lhi_recovery_session)[^;]* TO authenticated/i);
});

test("recovery capability contract permits blocked KA recovery but not normal operations", async () => {
  const { recoveryCapabilityAllows } = await import("../supabase/functions/ipsrs-api/recovery-policy.mjs");
  const capability = {
    subject: "AUTH-KA",
    scope: "lhi.recovery",
    incident_id: "INC-LOCKED",
    expires_at: "2026-11-03T06:00:00Z",
  };
  const valid = recoveryCapabilityAllows({
    capability,
    authUserId: "AUTH-KA",
    action: "apiStartLhiGrace",
    now: "2026-11-03T05:00:00Z",
    incidentId: "INC-LOCKED",
  });
  assert.deepEqual(valid, { allowed: true, reason: "OK" });
  for (const action of ["apiGetReports", "apiGetDashboard", "apiCreateReport", "apiGetMasterData", "apiChangePassword"]) {
    assert.equal(recoveryCapabilityAllows({
      capability,
      authUserId: "AUTH-KA",
      action,
      now: "2026-11-03T05:00:00Z",
      incidentId: "INC-LOCKED",
    }).allowed, false, action);
  }
});


test("recovery SQL explicitly rejects a missing action instead of allowing SQL NULL through", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = fileURLToPath(new URL("../supabase/migrations/20261103120000_lhi_restricted_recovery_challenges.sql", import.meta.url));
  const sql = await readFile(path, "utf8");
  assert.match(sql, /p_action IS NULL OR p_action NOT IN \('apiRecoveryStatus', 'apiStartLhiGrace'\)/);
});

// CI trigger: recovery schema contract assertions include fail-closed SQL NULL handling.


test("reset gate issues a nonce challenge and never uses wildcard CORS", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = fileURLToPath(new URL("../supabase/functions/lhi-reset-verify/index.ts", import.meta.url));
  const source = await readFile(path, "utf8");
  assert.match(source, /LHI_ALLOWED_ORIGINS/);
  assert.match(source, /LHI_RATE_LIMIT_SALT/);
  assert.match(source, /register_lhi_reset_attempt/);
  assert.match(source, /create_lhi_recovery_challenge/);
  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /challenge,/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/);
  assert.doesNotMatch(source, /console\.(log|error).*code/i);
});

test("recovery exchange verifies Supabase Auth and consumes challenge server-side", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = fileURLToPath(new URL("../supabase/functions/lhi-recovery-exchange/index.ts", import.meta.url));
  const source = await readFile(path, "utf8");
  assert.match(source, /LHI_ALLOWED_ORIGINS/);
  assert.match(source, /db\.auth\.getUser\(bearer\)/);
  assert.match(source, /consume_lhi_recovery_challenge/);
  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /recovery_capability: capability/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/);
  assert.doesNotMatch(source, /sessionStorage|localStorage/);
});

test("both reset endpoints explicitly disable gateway JWT because they verify their own proofs", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = fileURLToPath(new URL("../supabase/config.toml", import.meta.url));
  const config = await readFile(path, "utf8");
  assert.match(config, /\[functions\.lhi-reset-verify\]\s*verify_jwt = false/);
  assert.match(config, /\[functions\.lhi-recovery-exchange\]\s*verify_jwt = false/);
  assert.match(config, /\[functions\.ipsrs-api\]\s*verify_jwt = true/);
});
