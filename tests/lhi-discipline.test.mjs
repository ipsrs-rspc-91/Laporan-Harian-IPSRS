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
