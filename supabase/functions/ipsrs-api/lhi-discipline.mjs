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


/**
 * Evaluate active staff using one deterministic date rule.
 * Employment status is the monitoring gate; individual access status is
 * deliberately ignored so a blocked staff member can still trigger day 10.
 */
export function evaluateDiscipline(staffRows, reportsByStaff, todayWib) {
  parseDateKey(todayWib, "Tanggal hari ini");
  const evaluations = [];

  for (const staff of Array.isArray(staffRows) ? staffRows : []) {
    if (String(staff?.status || "").toLowerCase() !== "aktif") continue;
    if (!staff?.staff_id || !staff?.lhi_active_since) {
      throw new TypeError("Petugas aktif wajib memiliki staff_id dan lhi_active_since.");
    }

    const reports = reportsByStaff instanceof Map
      ? reportsByStaff.get(staff.staff_id) || []
      : reportsByStaff?.[staff.staff_id] || [];
    const anchorWib = complianceAnchorWibDate(reports, staff.lhi_active_since);
    const missedDays = missedFullCalendarDays(todayWib, anchorWib);
    const stage = disciplineStage(missedDays);

    evaluations.push({
      staff_id: staff.staff_id,
      nama: staff.nama || staff.staff_id,
      role: staff.role || null,
      employment_status: staff.status,
      access_status: staff.lhi_access_status || "NORMAL",
      anchor_wib: anchorWib,
      missed_full_days: missedDays,
      stage_day: stage.stageDay,
      action: stage.action,
    });
  }

  const warnings = {};
  for (const action of ["WARNING_1", "WARNING_2", "WARNING_3"]) {
    warnings[action] = evaluations.filter((row) => row.action === action);
  }

  return {
    evaluations,
    warnings,
    individualBlocks: evaluations.filter((row) => row.action === "BLOCK_INDIVIDUAL_ACCESS"),
    globalBlockTriggers: evaluations.filter((row) => row.action === "GLOBAL_BLOCK"),
  };
}


/**
 * Build one team broadcast per warning stage and date, with every delinquent
 * name included. Personal notifications are represented separately so the
 * database writer can apply an idempotency key per recipient.
 */
export function buildWarningNotifications(evaluations, activeStaff, todayWib) {
  parseDateKey(todayWib, "Tanggal notifikasi");
  const stages = [
    { action: "WARNING_1", label: "Peringatan 1", day: 4 },
    { action: "WARNING_2", label: "Peringatan 2", day: 6 },
    { action: "WARNING_3", label: "Peringatan 3", day: 7 },
  ];
  const recipients = (Array.isArray(activeStaff) ? activeStaff : [])
    .filter((staff) => String(staff?.status || "").toLowerCase() === "aktif")
    .map((staff) => staff.staff_id)
    .filter(Boolean);

  return stages.flatMap((stage) => {
    const delinquents = (Array.isArray(evaluations) ? evaluations : [])
      .filter((row) => row.action === stage.action);
    if (!delinquents.length) return [];

    const names = delinquents.map((row) => row.nama || row.staff_id);
    const warning = stage.action === "WARNING_3"
      ? "Jika sampai besok belum mengisi LHI sah, hak akses aplikasi akan diblokir pada hari ke-8."
      : "Mohon segera mengisi LHI sah dan saling mengingatkan rekan yang tercantum.";
    const fullDaysWithoutInput = stage.day - 1;
    const message = `${stage.label} (hari ke-${stage.day}; ${fullDaysWithoutInput} hari kalender penuh tanpa LHI): ${names.join(", ")}. ${warning}`;

    return [{
      // Stable team event identity: later staff entering the same stage on the
      // same WIB date updates this single broadcast instead of creating a
      // second notification for every recipient.
      event_key: `LHI:${todayWib}:${stage.action}:TEAM`,
      action: stage.action,
      subject: stage.label,
      message,
      delinquent_staff_ids: delinquents.map((row) => row.staff_id),
      recipients: recipients.map((recipient) => ({
        recipient_staff_id: recipient,
        event_key: `LHI:${todayWib}:${stage.action}:${recipient}`,
      })),
    }];
  });
}

/**
 * Build the day-8 in-app notice for active staff whose access remains NORMAL.
 * Staff blocked individually are not recipients; they receive the login denial
 * from the server instead. One team message names every staff member blocked
 * on the same WIB date, with a stable per-recipient idempotency key.
 */
export function buildIndividualBlockNotifications(evaluations, activeStaff, todayWib) {
  parseDateKey(todayWib, "Tanggal notifikasi");
  const blocked = (Array.isArray(evaluations) ? evaluations : [])
    .filter((row) => row.action === "BLOCK_INDIVIDUAL_ACCESS");
  if (!blocked.length) return [];

  const blockedIds = new Set(blocked.map((row) => row.staff_id));
  const recipients = (Array.isArray(activeStaff) ? activeStaff : [])
    .filter((staff) => String(staff?.status || "").toLowerCase() === "aktif")
    .filter((staff) => !blockedIds.has(staff.staff_id))
    .filter((staff) => String(staff?.lhi_access_status || "NORMAL").toUpperCase() !== "BLOCKED_LHI")
    .map((staff) => staff.staff_id)
    .filter(Boolean);

  if (!recipients.length) return [];
  const names = blocked.map((row) => row.nama || row.staff_id);
  const message = `Hak akses aplikasi petugas berikut telah diblokir pada hari ke-8 karena belum mengisi LHI sah selama 7 hari kalender penuh: ${names.join(", ")}. Mohon saling mengingatkan dan membantu petugas yang tercantum untuk melengkapi LHI.`;

  return [{
    // Stable per-date team event identity; a later blocked employee updates
    // the same broadcast rather than generating duplicate team notifications.
    event_key: `LHI:${todayWib}:BLOCK_INDIVIDUAL:TEAM`,
    subject: "Pemberitahuan blokir hak akses LHI hari ke-8",
    message,
    blocked_staff_ids: [...blockedIds],
    recipients: recipients.map((recipient) => ({
      recipient_staff_id: recipient,
      event_key: `LHI:${todayWib}:BLOCK_INDIVIDUAL:${recipient}`,
    })),
  }];
}

/** One grace obligation per delinquent active employee, never per missed day. */
export function buildGraceSnapshot(evaluations, snapshotAt) {
  if (Number.isNaN(new Date(snapshotAt).getTime())) {
    throw new TypeError("Waktu snapshot tidak valid.");
  }
  const unique = new Map();
  for (const row of Array.isArray(evaluations) ? evaluations : []) {
    if (row.action !== "GLOBAL_BLOCK" || row.employment_status?.toLowerCase() !== "aktif") continue;
    if (!row.staff_id) throw new TypeError("staff_id wajib tersedia pada snapshot.");
    if (!unique.has(row.staff_id)) {
      unique.set(row.staff_id, {
        staff_id: row.staff_id,
        snapshot_created_at: new Date(snapshotAt).toISOString(),
        anchor_wib: row.anchor_wib,
        missed_full_days_at_snapshot: row.missed_full_days,
        obligation_status: "PENDING",
      });
    }
  }
  return [...unique.values()];
}

/**
 * Evaluate a grace snapshot against current employment state and valid LHI
 * saved inside [startedAt, deadlineAt). EXCLUDED_INACTIVE is terminal: later
 * reactivation must not revive an old snapshot obligation.
 */
export function evaluateGraceSnapshot(snapshotMembers, staffById, reportsByStaff, startedAt, deadlineAt) {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(deadlineAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new TypeError("Rentang kelonggaran 12 jam tidak valid.");
  }

  const getStaff = (id) => staffById instanceof Map ? staffById.get(id) : staffById?.[id];
  const getReports = (id) => reportsByStaff instanceof Map
    ? reportsByStaff.get(id) || []
    : reportsByStaff?.[id] || [];

  const members = (Array.isArray(snapshotMembers) ? snapshotMembers : []).map((member) => {
    if (member.obligation_status === "EXCLUDED_INACTIVE") {
      return { ...member, obligation_status: "EXCLUDED_INACTIVE", qualifying_report_id: null };
    }

    const staff = getStaff(member.staff_id);
    if (!staff || String(staff.status || "").toLowerCase() !== "aktif") {
      return {
        ...member,
        obligation_status: "EXCLUDED_INACTIVE",
        exclusion_reason: "STATUS_NONAKTIF",
        qualifying_report_id: null,
      };
    }

    const qualifying = getReports(member.staff_id)
      .filter((report) => report && report.deleted_at == null && report.created_at)
      .filter((report) => {
        const created = new Date(report.created_at).getTime();
        return Number.isFinite(created) && created >= startMs && created < endMs;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

    return qualifying
      ? { ...member, obligation_status: "COMPLETED", qualifying_report_id: qualifying.id || qualifying.report_id || null }
      : { ...member, obligation_status: "PENDING", qualifying_report_id: null };
  });

  const pendingActive = members.filter((member) => member.obligation_status === "PENDING");
  return {
    members,
    pendingActive,
    allSatisfied: pendingActive.length === 0,
    shouldReactivateGlobalBlock: pendingActive.length > 0,
  };
}
