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
