/**
 * LHI restricted-recovery policy.
 *
 * Pure policy functions for unit tests. These checks are NOT a substitute for
 * server-side JWT verification, cryptographic nonce hashing/comparison,
 * atomic nonce consumption, capability signing, or database transactions.
 * Do not expose recovery secrets or bearer capabilities to frontend code.
 */

const RECOVERY_ROLE = "KA_IPSRS";
const RECOVERY_ACTIONS = new Set(["apiRecoveryStatus", "apiStartLhiGrace"]);

function timestampMs(value, label) {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) throw new TypeError(`${label} tidak valid.`);
  return ms;
}

/** Exact allowlist: no role aliases and no broad admin fallback. */
export function isRecoveryRole(role) {
  return String(role ?? "").trim().toUpperCase() === RECOVERY_ROLE;
}

/** Only the two recovery endpoints may be called in a recovery-only session. */
export function recoveryActionAllowed(action) {
  return RECOVERY_ACTIONS.has(String(action ?? ""));
}

/**
 * Validate a server-stored nonce record after the caller has performed a
 * constant-time comparison between the submitted nonce hash and stored hash.
 * This function intentionally receives a boolean comparison result; it does
 * not compare secrets itself.
 */
export function validateRecoveryNonce({
  nonceRecord,
  submittedNonceHashMatches,
  now,
  incidentId,
}) {
  if (!nonceRecord) return { valid: false, reason: "NONCE_NOT_FOUND" };
  if (submittedNonceHashMatches !== true) return { valid: false, reason: "NONCE_MISMATCH" };
  if (nonceRecord.consumed_at != null) return { valid: false, reason: "NONCE_ALREADY_USED" };
  if (!incidentId || nonceRecord.incident_id !== incidentId) {
    return { valid: false, reason: "INCIDENT_MISMATCH" };
  }

  const nowMs = timestampMs(now, "Waktu sekarang");
  const expiresMs = timestampMs(nonceRecord.expires_at, "Waktu kedaluwarsa nonce");
  if (expiresMs <= nowMs) return { valid: false, reason: "NONCE_EXPIRED" };
  return { valid: true, reason: "OK" };
}

/**
 * Policy gate after Supabase Auth has verified the user's password/token.
 * The caller must supply the server-verified auth user and the staff row
 * fetched by auth_user_id, never a staff_id/role supplied by the browser.
 */
export function evaluateRecoveryExchange({
  authUser,
  staff,
  nonceRecord,
  submittedNonceHashMatches,
  now,
  incidentId,
}) {
  if (!authUser?.id) return { allowed: false, reason: "AUTH_REQUIRED" };
  if (!staff || staff.auth_user_id !== authUser.id) {
    return { allowed: false, reason: "STAFF_AUTH_MISMATCH" };
  }
  if (!isRecoveryRole(staff.role)) return { allowed: false, reason: "ROLE_NOT_ALLOWED" };
  if (String(staff.status ?? "").toLowerCase() !== "aktif") {
    return { allowed: false, reason: "EMPLOYMENT_INACTIVE" };
  }

  const nonce = validateRecoveryNonce({
    nonceRecord,
    submittedNonceHashMatches,
    now,
    incidentId,
  });
  if (!nonce.valid) return { allowed: false, reason: nonce.reason };
  return {
    allowed: true,
    reason: "OK",
    subject: authUser.id,
    scope: "lhi.recovery",
    incident_id: incidentId,
  };
}

/** Verify the scope, subject, expiry and incident binding of a recovery capability. */
export function recoveryCapabilityAllows({
  capability,
  authUserId,
  action,
  now,
  incidentId,
}) {
  if (!capability) return { allowed: false, reason: "CAPABILITY_REQUIRED" };
  if (capability.scope !== "lhi.recovery") return { allowed: false, reason: "SCOPE_INVALID" };
  if (!authUserId || capability.subject !== authUserId) {
    return { allowed: false, reason: "SUBJECT_MISMATCH" };
  }
  if (capability.incident_id !== incidentId) {
    return { allowed: false, reason: "INCIDENT_MISMATCH" };
  }
  if (!recoveryActionAllowed(action)) return { allowed: false, reason: "ACTION_FORBIDDEN" };

  const nowMs = timestampMs(now, "Waktu sekarang");
  const expiresMs = timestampMs(capability.expires_at, "Waktu kedaluwarsa capability");
  if (expiresMs <= nowMs) return { allowed: false, reason: "CAPABILITY_EXPIRED" };
  return { allowed: true, reason: "OK" };
}

/**
 * Idempotent incident transition policy.
 * A real database RPC must implement this under row locks in one transaction.
 * Repeated requests during GRACE must preserve the original deadline/snapshot.
 */
export function planGraceRecovery({ incident, now, graceHours = 12 }) {
  if (!incident?.incident_id) throw new TypeError("Incident aktif wajib tersedia.");
  const status = String(incident.status ?? "").toUpperCase();

  if (status === "GRACE") {
    return {
      allowed: true,
      idempotent: true,
      incident_id: incident.incident_id,
      started_at: incident.started_at,
      deadline_at: incident.deadline_at,
      create_snapshot: false,
    };
  }

  if (status !== "LOCKED") {
    return { allowed: false, reason: "INCIDENT_NOT_RECOVERABLE" };
  }
  if (!Number.isFinite(graceHours) || graceHours !== 12) {
    throw new TypeError("Masa kelonggaran harus tepat 12 jam.");
  }

  const startedMs = timestampMs(now, "Waktu mulai pemulihan");
  return {
    allowed: true,
    idempotent: false,
    incident_id: incident.incident_id,
    started_at: new Date(startedMs).toISOString(),
    deadline_at: new Date(startedMs + 12 * 60 * 60 * 1000).toISOString(),
    create_snapshot: true,
  };
}
