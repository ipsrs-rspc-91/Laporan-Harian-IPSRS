-- LHI restricted recovery challenge/session foundation.
-- NOT APPLIED TO ANY DATABASE BY THIS COMMIT.
-- The Edge Functions must be deployed only after this migration is reviewed
-- and applied to a non-production Supabase project.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.lhi_reset_rate_limits (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  last_attempt_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS private.lhi_recovery_challenges (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash text NOT NULL UNIQUE CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  incident_id text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS lhi_recovery_challenges_expiry_idx
  ON private.lhi_recovery_challenges (expires_at);

CREATE TABLE IF NOT EXISTS private.lhi_recovery_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  auth_user_id uuid NOT NULL,
  staff_id text NOT NULL,
  incident_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS lhi_recovery_sessions_expiry_idx
  ON private.lhi_recovery_sessions (expires_at);

ALTER TABLE private.lhi_reset_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.lhi_recovery_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.lhi_recovery_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.lhi_reset_rate_limits FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON private.lhi_recovery_challenges FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON private.lhi_recovery_sessions FROM PUBLIC, anon, authenticated, service_role;

-- Register every attempt before checking the submitted code. Atomic upsert
-- avoids the race condition in the previous access_settings timestamp throttle.
CREATE OR REPLACE FUNCTION public.register_lhi_reset_attempt(p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_attempts integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'INVALID_CLIENT_KEY');
  END IF;

  INSERT INTO private.lhi_reset_rate_limits (
    ip_hash, window_started_at, attempt_count, last_attempt_at
  ) VALUES (p_ip_hash, v_now, 1, v_now)
  ON CONFLICT (ip_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN private.lhi_reset_rate_limits.window_started_at <= v_now - interval '15 minutes'
          THEN v_now
        ELSE private.lhi_reset_rate_limits.window_started_at
      END,
      attempt_count = CASE
        WHEN private.lhi_reset_rate_limits.window_started_at <= v_now - interval '15 minutes'
          THEN 1
        ELSE private.lhi_reset_rate_limits.attempt_count + 1
      END,
      last_attempt_at = v_now
  RETURNING attempt_count INTO v_attempts;

  RETURN jsonb_build_object(
    'allowed', v_attempts <= 5,
    'attempts', v_attempts,
    'retry_after_seconds', CASE WHEN v_attempts <= 5 THEN 0 ELSE 900 END
  );
END;
$function$;

-- Called only after the server has verified the reset code. A challenge is
-- random, opaque, short-lived, single-use, and bound to a consistent LOCKED
-- incident or an active GRACE incident (for KA recovery-session resumption).
CREATE OR REPLACE FUNCTION public.create_lhi_recovery_challenge(
  p_nonce_hash text,
  p_ip_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lock text;
  v_incident_id text;
  v_incident_status text;
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lhi_discipline_scheduler_v2', 0));

  IF p_nonce_hash IS NULL OR p_nonce_hash !~ '^[0-9a-f]{64}$'
     OR p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid recovery challenge input.';
  END IF;

  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  SELECT incident_id::text, status INTO v_incident_id, v_incident_status
  FROM public.lhi_discipline_incidents
  WHERE status IN ('LOCKED', 'GRACE')
  ORDER BY incident_id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_incident_id IS NULL OR NOT (
    (v_lock = 'AKTIF' AND v_incident_status = 'LOCKED') OR
    (v_lock = 'NONAKTIF' AND v_incident_status = 'GRACE')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RECOVERY_INCIDENT_NOT_AVAILABLE');
  END IF;

  v_expires := v_now + interval '5 minutes';
  INSERT INTO private.lhi_recovery_challenges (
    nonce_hash, incident_id, ip_hash, created_at, expires_at
  ) VALUES (p_nonce_hash, v_incident_id, p_ip_hash, v_now, v_expires);

  RETURN jsonb_build_object(
    'ok', true,
    'incident_id', v_incident_id,
    'created_at', v_now,
    'expires_at', v_expires
  );
END;
$function$;

-- Consume the challenge and issue an opaque recovery capability in one transaction.
-- Initial LOCKED sessions are short-lived; Reset extends the capability only to
-- the exact grace deadline. Auth identity comes from auth.getUser() in the Edge
-- Function; this RPC independently checks the staff mapping and exact role.
CREATE OR REPLACE FUNCTION public.consume_lhi_recovery_challenge(
  p_nonce_hash text,
  p_auth_user_id uuid,
  p_session_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_challenge private.lhi_recovery_challenges%ROWTYPE;
  v_staff public.staff%ROWTYPE;
  v_lock text;
  v_incident_status text;
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lhi_discipline_scheduler_v2', 0));

  IF p_nonce_hash IS NULL OR p_nonce_hash !~ '^[0-9a-f]{64}$'
     OR p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_challenge
  FROM private.lhi_recovery_challenges
  WHERE nonce_hash = p_nonce_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CHALLENGE_NOT_FOUND');
  END IF;
  IF v_challenge.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CHALLENGE_ALREADY_USED');
  END IF;
  IF v_challenge.expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CHALLENGE_EXPIRED');
  END IF;

  SELECT * INTO v_staff
  FROM public.staff
  WHERE auth_user_id = p_auth_user_id
  FOR SHARE;

  IF NOT FOUND OR v_staff.role IS DISTINCT FROM 'KA_IPSRS'
     OR lower(coalesce(v_staff.status, '')) <> 'aktif' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KA_ACTIVE_REQUIRED');
  END IF;

  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  SELECT status INTO v_incident_status
  FROM public.lhi_discipline_incidents
  WHERE incident_id::text = v_challenge.incident_id
  FOR UPDATE;

  IF NOT FOUND OR NOT (
    (v_lock = 'AKTIF' AND v_incident_status = 'LOCKED') OR
    (v_lock = 'NONAKTIF' AND v_incident_status = 'GRACE')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INCIDENT_CHANGED');
  END IF;

  UPDATE private.lhi_recovery_challenges
  SET consumed_at = v_now, consumed_by = p_auth_user_id
  WHERE challenge_id = v_challenge.challenge_id
    AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CHALLENGE_ALREADY_USED');
  END IF;

  v_expires := v_now + interval '10 minutes';
  INSERT INTO private.lhi_recovery_sessions (
    token_hash, auth_user_id, staff_id, incident_id, created_at, expires_at
  ) VALUES (
    p_session_token_hash, p_auth_user_id, v_staff.staff_id,
    v_challenge.incident_id, v_now, v_expires
  );

  RETURN jsonb_build_object(
    'ok', true,
    'staff_id', v_staff.staff_id,
    'staff_name', v_staff.nama,
    'role', v_staff.role,
    'incident_id', v_challenge.incident_id,
    'expires_at', v_expires
  );
END;
$function$;

-- Validate every recovery-only request server-side. Individual LHI access
-- status is intentionally not a gate here; this capability cannot access
-- normal application actions and is bound to one authenticated KA account.
CREATE OR REPLACE FUNCTION public.validate_lhi_recovery_session(
  p_session_token_hash text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_session private.lhi_recovery_sessions%ROWTYPE;
  v_staff public.staff%ROWTYPE;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_lock text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lhi_discipline_scheduler_v2', 0));

  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_SESSION');
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('apiRecoveryStatus', 'apiStartLhiGrace') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ACTION_FORBIDDEN');
  END IF;

  SELECT * INTO v_session
  FROM private.lhi_recovery_sessions
  WHERE token_hash = p_session_token_hash
  FOR SHARE;

  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'SESSION_EXPIRED_OR_REVOKED');
  END IF;

  SELECT * INTO v_staff
  FROM public.staff
  WHERE staff_id = v_session.staff_id
    AND auth_user_id = v_session.auth_user_id
    AND role = 'KA_IPSRS'
    AND lower(coalesce(status, '')) = 'aktif'
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KA_IDENTITY_NO_LONGER_VALID');
  END IF;

  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR SHARE;

  SELECT * INTO v_incident
  FROM public.lhi_discipline_incidents
  WHERE incident_id::text = v_session.incident_id
  FOR SHARE;

  IF NOT FOUND OR NOT (
    (v_incident.status = 'LOCKED' AND v_lock = 'AKTIF') OR
    (v_incident.status = 'GRACE' AND v_lock = 'NONAKTIF')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INCIDENT_NO_LONGER_RECOVERABLE');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'staff_id', v_staff.staff_id,
    'staff_name', v_staff.nama,
    'role', v_staff.role,
    'incident_id', v_session.incident_id,
    'incident_status', v_incident.status,
    'started_at', v_incident.started_at,
    'deadline_at', v_incident.deadline_at,
    'action', p_action
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_lhi_reset_attempt(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_lhi_recovery_challenge(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_lhi_recovery_challenge(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_lhi_recovery_session(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_lhi_reset_attempt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_lhi_recovery_challenge(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_lhi_recovery_challenge(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_lhi_recovery_session(text, text) TO service_role;

-- Expired challenge/session/rate-limit rows require a scheduled cleanup job.
-- Do not add another frequent cron job; cleanup can be folded into the existing
-- LHI scheduler after its production-safe rewrite is reviewed.
