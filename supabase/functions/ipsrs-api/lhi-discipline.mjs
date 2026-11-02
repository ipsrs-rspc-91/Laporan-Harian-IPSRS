/**
 * LHI discipline date rules.
 *
 * Pure functions only: no database, network, clock mutation, or side effects.
 * The scheduler rewrite must use these same acceptance rules.
 */

export function wibDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Tanggal/waktu tidak valid.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseDateKey(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TypeError(`${label} harus berformat YYYY-MM-DD.`);
  }
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`${label} bukan tanggal kalender yang valid.`);
  }
  return date;
}

export function calendarDateDifference(laterDate, earlierDate) {
  const later = parseDateKey(laterDate, "Tanggal akhir");
  const earlier = parseDateKey(earlierDate, "Tanggal awal");
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

/**
 * Select the latest valid LHI input timestamp in the current active period.
 * A soft-deleted report is never valid. Reports saved before activeSince are
 * ignored after reactivation, even if they have a later work-event date.
 */
export function latestValidInputAt(reports, activeSince) {
  if (!activeSince) throw new TypeError("Waktu mulai aktif wajib tersedia.");
  const activeSinceMs = new Date(activeSince).getTime();
  if (Number.isNaN(activeSinceMs)) throw new TypeError("Waktu mulai aktif tidak valid.");

  let latest = null;
  for (const report of Array.isArray(reports) ? reports : []) {
    if (!report || report.deleted_at != null || !report.created_at) continue;
    const createdMs = new Date(report.created_at).getTime();
    if (Number.isNaN(createdMs) || createdMs < activeSinceMs) continue;
    if (latest == null || createdMs > new Date(latest).getTime()) {
      latest = new Date(createdMs).toISOString();
    }
  }
  return latest;
}

/**
 * Returns the anchor date in WIB. The activation timestamp is the anchor
 * until a valid LHI has actually been saved during this active period.
 */
export function complianceAnchorWibDate(reports, activeSince) {
  if (!activeSince) throw new TypeError("Waktu mulai aktif wajib tersedia.");
  const latest = latestValidInputAt(reports, activeSince);
  return wibDateKey(latest || activeSince);
}

/**
 * Counts completed calendar dates without a valid LHI.
 * The anchor date itself and today's unfinished date are not counted.
 *
 * Example: anchor 2026-10-22, today 2026-11-01 => 9 full missed dates.
 */
export function missedFullCalendarDays(todayWib, anchorWib) {
  return Math.max(0, calendarDateDifference(todayWib, anchorWib) - 1);
}

/**
 * README stages:
 * missed=3 => warning 1/day 4
 * missed=5 => warning 2/day 6
 * missed=6 => warning 3/day 7
 * missed=7 => individual access block/day 8
 * missed=8 => waiting/day 9
 * missed=9 => global block trigger/day 10
 */
export function disciplineStage(missedDays) {
  const days = Number(missedDays);
  if (!Number.isInteger(days) || days < 0) {
    throw new TypeError("Jumlah hari tanpa input harus bilangan bulat >= 0.");
  }
  const stageDay = days + 1;
  if (days >= 9) return { stageDay: 10, action: "GLOBAL_BLOCK" };
  if (days === 8) return { stageDay: 9, action: "WAITING" };
  if (days === 7) return { stageDay: 8, action: "BLOCK_INDIVIDUAL_ACCESS" };
  if (days === 6) return { stageDay: 7, action: "WARNING_3" };
  if (days === 5) return { stageDay: 6, action: "WARNING_2" };
  if (days === 3) return { stageDay: 4, action: "WARNING_1" };
  return { stageDay, action: "MONITOR" };
}
