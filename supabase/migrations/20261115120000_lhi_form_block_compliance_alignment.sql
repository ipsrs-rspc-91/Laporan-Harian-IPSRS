-- Server-side reset rate limiting and limited recovery-session validation.
CREATE TABLE IF NOT EXISTS public.lhi_reset_attempts (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}ALTER TABLE public.lhi_reset_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lhi_reset_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lhi_reset_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.register_lhi_reset_attempt(p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.lhi_reset_attempts%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  INSERT INTO public.lhi_reset_attempts(ip_hash, window_started_at, attempt_count, updated_at)
  VALUES (p_ip_hash, v_now, 1, v_now)
  ON CONFLICT (ip_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN public.lhi_reset_attempts.window_started_at <= v_now - interval '15 minutes'
          THEN v_now
        ELSE public.lhi_reset_attempts.window_started_at
      END,
      attempt_count = CASE
        WHEN public.lhi_reset_attempts.window_started_at <= v_now - interval '15 minutes'
          THEN 1
        WHEN public.lhi_reset_attempts.locked_until > v_now
          THEN public.lhi_reset_attempts.attempt_count
        ELSE public.lhi_reset_attempts.attempt_count + 1
      END,
      locked_until = CASE
        WHEN public.lhi_reset_attempts.locked_until > v_now
          THEN public.lhi_reset_attempts.locked_until
        WHEN public.lhi_reset_attempts.window_started_at <= v_now - interval '15 minutes'
          THEN NULL
        WHEN public.lhi_reset_attempts.attempt_count + 1 >= 5
          THEN v_now + interval '15 minutes'
        ELSE NULL
      END,
      updated_at = v_now
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'allowed', v_row.locked_until IS NULL,
    'attempts', v_row.attempt_count,
    'retry_at', v_row.locked_until
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.register_lhi_reset_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_lhi_reset_attempt(text) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_lhi_recovery_session(
  p_session_token_hash text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session public.lhi_recovery_sessions%ROWTYPE;
  v_incident_status text;
BEGIN
  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_session
  FROM public.lhi_recovery_sessions
  WHERE session_token_hash = p_session_token_hash
    AND role = 'KA_IPSRS'
    AND revoked_at IS NULL
    AND expires_at > clock_timestamp()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RECOVERY_SESSION_INVALID');
  END IF;

  SELECT status INTO v_incident_status
  FROM public.lhi_discipline_incidents
  WHERE incident_id = v_session.incident_id;

  IF v_incident_status IS NULL
     OR (p_action = 'apiStartLhiGrace' AND v_incident_status NOT IN ('LOCKED', 'EXPIRED', 'GRACE'))
     OR (p_action = 'apiRecoveryStatus' AND v_incident_status NOT IN ('LOCKED', 'EXPIRED', 'GRACE')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INCIDENT_NOT_AVAILABLE');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'staff_id', v_session.staff_id,
    'staff_name', v_session.staff_name,
    'role', v_session.role,
    'incident_id', v_session.incident_id,
    'expires_at', v_session.expires_at,
    'action', p_action
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_lhi_recovery_session(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_lhi_recovery_session(text, text) TO service_role;

-- Align LHI discipline with README-FORM-BLOK-APLIKASI.md.
-- Employment status and application access are stored independently.
-- This migration is intentionally additive and preserves existing incident history.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS lhi_access_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lhi_employment_activated_at timestamptz;

ALTER TABLE public.lhi_discipline_obligations
  ADD COLUMN IF NOT EXISTS snapshot_last_lhi_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_missed_days integer,
  ADD COLUMN IF NOT EXISTS snapshot_employment_status text,
  ADD COLUMN IF NOT EXISTS snapshot_name text,
  ADD COLUMN IF NOT EXISTS snapshot_role text;

UPDATE public.staff
SET lhi_employment_activated_at = COALESCE(lhi_employment_activated_at, created_at)
WHERE lhi_employment_activated_at IS NULL;

-- Migrate legacy access-block values back to the true employment status.
-- The block is retained in the dedicated access field.
UPDATE public.staff
SET lhi_access_blocked_at = COALESCE(lhi_access_blocked_at, updated_at, clock_timestamp()),
    status = 'Aktif'
WHERE status IN ('DIBLOKIR_LHI_7_HARI', 'Nonaktif_LHI_HARI_8');

UPDATE public.lhi_discipline_obligations o
SET snapshot_employment_status = COALESCE(o.snapshot_employment_status, s.status),
    snapshot_name = COALESCE(o.snapshot_name, s.nama),
    snapshot_role = COALESCE(o.snapshot_role, s.role)
FROM public.staff s
WHERE s.staff_id = o.staff_id
  AND (o.snapshot_employment_status IS NULL OR o.snapshot_name IS NULL OR o.snapshot_role IS NULL);

CREATE TABLE IF NOT EXISTS public.lhi_discipline_obligation_events (
  event_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  incident_id bigint NOT NULL REFERENCES public.lhi_discipline_incidents(incident_id),
  obligation_id bigint REFERENCES public.lhi_discipline_obligations(obligation_id),
  staff_id text NOT NULL,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  event_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_staff_id text,
  actor_name text,
  reason text,
  report_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lhi_obligation_events_incident_staff_time
  ON public.lhi_discipline_obligation_events(incident_id, staff_id, event_at);

ALTER TABLE public.lhi_discipline_obligation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lhi_discipline_obligation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.lhi_discipline_obligation_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.lhi_discipline_obligation_events_event_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.reject_lhi_obligation_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'Riwayat peristiwa kewajiban LHI bersifat append-only dan tidak dapat diubah atau dihapus.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_lhi_obligation_events_append_only
  ON public.lhi_discipline_obligation_events;
CREATE TRIGGER trg_lhi_obligation_events_append_only
BEFORE UPDATE OR DELETE ON public.lhi_discipline_obligation_events
FOR EACH ROW EXECUTE FUNCTION public.reject_lhi_obligation_event_mutation();

REVOKE ALL ON FUNCTION public.reject_lhi_obligation_event_mutation() FROM PUBLIC, anon, authenticated;

-- Backfill the current/legacy incident snapshot metadata from the best
-- auditable point available: the incident's recorded start timestamp.
-- New incidents capture these fields directly at day-10 snapshot creation.
WITH snapshot_context AS (
  SELECT DISTINCT
    o.incident_id, o.staff_id, i.started_at,
    s.nama, s.role,
    GREATEST(
      COALESCE(s.lhi_employment_activated_at, s.created_at),
      COALESCE(s.lhi_discipline_reset_at, s.lhi_employment_activated_at, s.created_at)
    ) AS baseline_at
  FROM public.lhi_discipline_obligations o
  JOIN public.lhi_discipline_incidents i ON i.incident_id = o.incident_id
  JOIN public.staff s ON s.staff_id = o.staff_id
),
snapshot_input AS (
  SELECT c.*,
    (
      SELECT max(r.created_at)
      FROM public.reports r
      WHERE r.staff_id = c.staff_id
        AND r.deleted_at IS NULL
        AND r.created_at >= c.baseline_at
        AND r.created_at < c.started_at
    ) AS last_lhi_created_at
  FROM snapshot_context c
),
snapshot_values AS (
  SELECT *,
    GREATEST(
      0,
      (started_at AT TIME ZONE 'Asia/Jakarta')::date
      - COALESCE(
          (last_lhi_created_at AT TIME ZONE 'Asia/Jakarta')::date,
          (baseline_at AT TIME ZONE 'Asia/Jakarta')::date
        ) - 1
    ) AS missed_days_at_snapshot
  FROM snapshot_input
),
updated_snapshot AS (
  UPDATE public.lhi_discipline_obligations o
  SET snapshot_last_lhi_created_at = COALESCE(o.snapshot_last_lhi_created_at, v.last_lhi_created_at),
      snapshot_missed_days = COALESCE(o.snapshot_missed_days, v.missed_days_at_snapshot),
      snapshot_employment_status = COALESCE(o.snapshot_employment_status, 'Aktif'),
      snapshot_name = COALESCE(o.snapshot_name, v.nama),
      snapshot_role = COALESCE(o.snapshot_role, v.role)
  FROM snapshot_values v
  WHERE o.incident_id = v.incident_id
    AND o.staff_id = v.staff_id
    AND (
      o.snapshot_missed_days IS NULL
      OR o.snapshot_employment_status IS NULL
      OR o.snapshot_name IS NULL
      OR o.snapshot_role IS NULL
    )
  RETURNING o.incident_id, o.obligation_id, o.staff_id
)
INSERT INTO public.lhi_discipline_obligation_events(
  incident_id, obligation_id, staff_id, event_type,
  previous_status, new_status, event_at, actor_staff_id, actor_name, reason
)
SELECT u.incident_id, u.obligation_id, u.staff_id,
       'SNAPSHOT_BACKFILLED', NULL, 'SNAPSHOT_RECORDED',
       clock_timestamp(), 'SYSTEM', 'SYSTEM',
       'Metadata snapshot historis dilengkapi dari created_at LHI sah sebelum waktu mulai insiden yang tercatat.'
FROM updated_snapshot u
WHERE NOT EXISTS (
  SELECT 1 FROM public.lhi_discipline_obligation_events e
  WHERE e.obligation_id = u.obligation_id
    AND e.event_type = 'SNAPSHOT_BACKFILLED'
);

CREATE OR REPLACE FUNCTION public.track_lhi_employment_reactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_was_access_blocked boolean := OLD.lhi_access_blocked_at IS NOT NULL;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND lower(COALESCE(OLD.status, '')) <> 'aktif'
     AND lower(COALESCE(NEW.status, '')) = 'aktif' THEN
    NEW.lhi_employment_activated_at := v_now;
    NEW.lhi_discipline_reset_at := v_now;
    IF v_was_access_blocked THEN
      NEW.lhi_access_blocked_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_track_lhi_employment_reactivation ON public.staff;
CREATE TRIGGER trg_track_lhi_employment_reactivation
BEFORE UPDATE OF status ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.track_lhi_employment_reactivation();

CREATE OR REPLACE FUNCTION public.exclude_lhi_obligations_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF lower(COALESCE(OLD.status, '')) = 'aktif'
     AND lower(COALESCE(NEW.status, '')) <> 'aktif' THEN
    WITH candidates AS (
      SELECT o.obligation_id, o.incident_id, o.staff_id,
        CASE WHEN o.completed_at IS NULL THEN 'PENDING' ELSE 'COMPLETED' END AS old_status
      FROM public.lhi_discipline_obligations o
      JOIN public.lhi_discipline_incidents i ON i.incident_id = o.incident_id
      WHERE o.staff_id = NEW.staff_id
        AND i.status IN ('LOCKED', 'GRACE')
        AND o.excluded_at IS NULL
    ),
    changed AS (
      UPDATE public.lhi_discipline_obligations o
      SET excluded_at = v_now
      FROM candidates c
      WHERE o.obligation_id = c.obligation_id
      RETURNING o.obligation_id
    )
    INSERT INTO public.lhi_discipline_obligation_events(
      incident_id, obligation_id, staff_id, event_type,
      previous_status, new_status, event_at, actor_staff_id, actor_name, reason
    )
    SELECT c.incident_id, c.obligation_id, c.staff_id,
      'OBLIGATION_EXCLUDED_INACTIVE', c.old_status,
      'EXCLUDED_INACTIVE', v_now, 'SYSTEM', 'SYSTEM',
      'Status kepegawaian berubah menjadi NONAKTIF; kewajiban snapshot dikecualikan secara permanen, termasuk bila petugas diaktifkan kembali.'
    FROM candidates c
    JOIN changed u ON u.obligation_id = c.obligation_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_exclude_lhi_obligations_on_deactivation ON public.staff;
CREATE TRIGGER trg_exclude_lhi_obligations_on_deactivation
AFTER UPDATE OF status ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.exclude_lhi_obligations_on_deactivation();

CREATE OR REPLACE FUNCTION public.audit_lhi_employment_reactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND lower(COALESCE(OLD.status, '')) <> 'aktif'
     AND lower(COALESCE(NEW.status, '')) = 'aktif' THEN
    INSERT INTO public.lhi_discipline_obligation_events(
      incident_id, obligation_id, staff_id, event_type,
      previous_status, new_status, event_at, actor_staff_id, actor_name, reason
    )
    SELECT o.incident_id, o.obligation_id, o.staff_id,
      'STAFF_REACTIVATED_AFTER_EXCLUSION',
      'EXCLUDED_INACTIVE', 'EXCLUDED_INACTIVE',
      clock_timestamp(), 'SYSTEM', 'SYSTEM',
      'Status kepegawaian AKTIF kembali; titik awal kepatuhan di-reset, tetapi kewajiban snapshot yang telah dikecualikan tidak diaktifkan kembali.'
    FROM public.lhi_discipline_obligations o
    JOIN public.lhi_discipline_incidents i ON i.incident_id = o.incident_id
    WHERE o.staff_id = NEW.staff_id
      AND o.excluded_at IS NOT NULL
      AND i.status IN ('LOCKED', 'GRACE');

    INSERT INTO public.audit_log(
      username, staff_id, action, report_id, keterangan,
      field_changed, old_value, new_value
    ) VALUES (
      'SYSTEM', NEW.staff_id, 'LHI_EMPLOYMENT_REACTIVATED', NULL,
      CASE WHEN OLD.lhi_access_blocked_at IS NOT NULL
        THEN 'Status kepegawaian diaktifkan kembali; titik awal kepatuhan di-reset dan blokir akses individual LHI dibuka.'
        ELSE 'Status kepegawaian diaktifkan kembali; titik awal kepatuhan di-reset.'
      END,
      'status,lhi_employment_activated_at,lhi_discipline_reset_at,lhi_access_blocked_at',
      OLD.status,
      NEW.status || ' @ ' || COALESCE(NEW.lhi_employment_activated_at::text, '')
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_lhi_employment_reactivation ON public.staff;
CREATE TRIGGER trg_audit_lhi_employment_reactivation
AFTER UPDATE OF status ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.audit_lhi_employment_reactivation();

CREATE OR REPLACE FUNCTION public.get_lhi_discipline_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH clock AS (
    SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date AS today_wib
  ),
  staff_base AS (
    SELECT
      s.staff_id, s.nama, s.role, s.status,
      s.lhi_access_blocked_at,
      GREATEST(
        COALESCE(s.lhi_employment_activated_at, s.created_at),
        COALESCE(s.lhi_discipline_reset_at, s.lhi_employment_activated_at, s.created_at)
      ) AS baseline_at
    FROM public.staff s
    WHERE s.status = 'Aktif'
  ),
  latest_input AS (
    SELECT
      b.staff_id,
      max(r.created_at) AS last_lhi_created_at
    FROM staff_base b
    LEFT JOIN public.reports r
      ON r.staff_id = b.staff_id
     AND r.deleted_at IS NULL
     AND r.created_at >= b.baseline_at
    GROUP BY b.staff_id
  ),
  calculated AS (
    SELECT
      b.staff_id, b.nama, b.role, b.status,
      b.lhi_access_blocked_at,
      li.last_lhi_created_at,
      COALESCE(
        (li.last_lhi_created_at AT TIME ZONE 'Asia/Jakarta')::date,
        (b.baseline_at AT TIME ZONE 'Asia/Jakarta')::date
      ) AS anchor_date,
      c.today_wib
    FROM staff_base b
    LEFT JOIN latest_input li ON li.staff_id = b.staff_id
    CROSS JOIN clock c
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'staff_id', staff_id,
    'nama', nama,
    'role', role,
    'employment_status', status,
    'last_lhi_created_at', last_lhi_created_at,
    'last_lhi_input_date_wib', (last_lhi_created_at AT TIME ZONE 'Asia/Jakarta')::date,
    'discipline_baseline_date_wib', anchor_date,
    'missed_full_calendar_days', GREATEST(0, today_wib - anchor_date - 1),
    'lhi_access_blocked_at', lhi_access_blocked_at
  ) ORDER BY nama, staff_id), '[]'::jsonb)
  FROM calculated;
$function$;

REVOKE ALL ON FUNCTION public.get_lhi_discipline_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lhi_discipline_status() TO service_role;

-- Enforce global and individual LHI blocks at the Data API/RLS layer too.
-- The recovery Edge Functions use service_role and therefore remain available.
CREATE OR REPLACE FUNCTION private.lhi_normal_access_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.access_settings a
      ON a.key = 'LHI_GLOBAL_BLOCK'
    WHERE s.auth_user_id = auth.uid()
      AND s.status = 'Aktif'
      AND s.lhi_access_blocked_at IS NULL
      AND upper(COALESCE(a.value, '')) = 'NONAKTIF'
  );
$function$;

REVOKE ALL ON FUNCTION private.lhi_normal_access_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.lhi_normal_access_allowed() TO authenticated;

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
FOR INSERT TO authenticated
WITH CHECK (
  staff_id = (SELECT private.current_staff_id())
  AND (SELECT private.lhi_normal_access_allowed())
);

DROP POLICY IF EXISTS reports_select_authorized ON public.reports;
CREATE POLICY reports_select_authorized ON public.reports
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (SELECT private.lhi_normal_access_allowed())
  AND (SELECT private.can_view_report(reports.staff_id, reports.role_snapshot))
);

DROP POLICY IF EXISTS reports_update_authorized ON public.reports;
CREATE POLICY reports_update_authorized ON public.reports
FOR UPDATE TO authenticated
USING (
  deleted_at IS NULL
  AND (SELECT private.lhi_normal_access_allowed())
  AND (SELECT private.can_edit_report(reports.staff_id, reports.role_snapshot))
)
WITH CHECK (
  deleted_at IS NULL
  AND (SELECT private.lhi_normal_access_allowed())
  AND (SELECT private.can_edit_report(reports.staff_id, reports.role_snapshot))
);

DROP POLICY IF EXISTS report_history_select_authorized ON public.report_history;
CREATE POLICY report_history_select_authorized ON public.report_history
FOR SELECT TO authenticated
USING (
  (SELECT private.current_staff_role()) = ANY (ARRAY['KA_IPSRS'::text, 'ADMINISTRASI'::text])
  AND (SELECT private.lhi_normal_access_allowed())
  AND EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.report_id = report_history.report_id
      AND (SELECT private.can_view_report(r.staff_id, r.role_snapshot))
  )
);

DROP POLICY IF EXISTS audit_log_select_authorized ON public.audit_log;
CREATE POLICY audit_log_select_authorized ON public.audit_log
FOR SELECT TO authenticated
USING (
  (SELECT private.lhi_normal_access_allowed())
  AND (
    (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
    OR (
      (SELECT private.current_staff_role()) = 'ADMINISTRASI'::text
      AND (
        report_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.reports r
          WHERE r.report_id = audit_log.report_id
            AND (SELECT private.can_view_report(r.staff_id, r.role_snapshot))
        )
      )
    )
  )
);

DROP POLICY IF EXISTS access_settings_delete_ka ON public.access_settings;
CREATE POLICY access_settings_delete_ka ON public.access_settings
FOR DELETE TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
  AND key <> 'LHI_RESET_CODE_HASH'::text
  AND key <> 'LHI_GLOBAL_BLOCK'::text
);

DROP POLICY IF EXISTS access_settings_insert_ka ON public.access_settings;
CREATE POLICY access_settings_insert_ka ON public.access_settings
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
  AND key <> 'LHI_RESET_CODE_HASH'::text
  AND key <> 'LHI_GLOBAL_BLOCK'::text
);

DROP POLICY IF EXISTS access_settings_read_ka ON public.access_settings;
CREATE POLICY access_settings_read_ka ON public.access_settings
FOR SELECT TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
  AND key <> 'LHI_RESET_CODE_HASH'::text
  AND key <> 'LHI_GLOBAL_BLOCK'::text
);

DROP POLICY IF EXISTS access_settings_update_ka ON public.access_settings;
CREATE POLICY access_settings_update_ka ON public.access_settings
FOR UPDATE TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
  AND key <> 'LHI_RESET_CODE_HASH'::text
  AND key <> 'LHI_GLOBAL_BLOCK'::text
)
WITH CHECK (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
  AND key <> 'LHI_RESET_CODE_HASH'::text
  AND key <> 'LHI_GLOBAL_BLOCK'::text
);

DROP POLICY IF EXISTS edit_permissions_delete_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_delete_ka ON public.edit_permissions
FOR DELETE TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
);

DROP POLICY IF EXISTS edit_permissions_insert_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_insert_ka ON public.edit_permissions
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
);

DROP POLICY IF EXISTS edit_permissions_read_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_read_ka ON public.edit_permissions
FOR SELECT TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
);

DROP POLICY IF EXISTS edit_permissions_update_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_update_ka ON public.edit_permissions
FOR UPDATE TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
)
WITH CHECK (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'::text
  AND (SELECT private.lhi_normal_access_allowed())
);

DROP POLICY IF EXISTS migration_errors_read_admins ON public.migration_errors;
CREATE POLICY migration_errors_read_admins ON public.migration_errors
FOR SELECT TO authenticated
USING (
  (SELECT private.current_staff_role()) = ANY (ARRAY['KA_IPSRS'::text, 'ADMINISTRASI'::text])
  AND (SELECT private.lhi_normal_access_allowed())
);

DROP POLICY IF EXISTS authenticated_read_master_data ON public.master_data;
CREATE POLICY authenticated_read_master_data ON public.master_data
FOR SELECT TO authenticated
USING (
  is_active = true
  AND (SELECT private.lhi_normal_access_allowed())
);

CREATE OR REPLACE VIEW public.staff_dropdown AS
SELECT staff_id, nama, jabatan, role, bidang, status
FROM public.staff
WHERE lower(trim(status)) = 'aktif'
  AND upper(trim(role)) <> 'KA_IPSRS'
ORDER BY nama;

-- The backend service role uses this view. Browser roles must not query it directly.
REVOKE ALL ON TABLE public.staff_dropdown FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.staff_dropdown TO service_role;

CREATE OR REPLACE FUNCTION public.run_lhi_discipline_scheduler()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date;
  v_staff record;
  v_baseline timestamptz;
  v_last_input_at timestamptz;
  v_last_input_date date;
  v_anchor_date date;
  v_days integer;
  v_event text;
  v_message text;
  v_incident bigint;
  v_active_grace bigint;
  v_deadline timestamptz;
  v_pending integer := 0;
  v_trigger_names text;
  v_trigger_count integer := 0;
  v_lock text;
  v_blocked_count integer := 0;
BEGIN
  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  IF v_lock IS NULL OR v_lock NOT IN ('AKTIF', 'NONAKTIF') THEN
    RAISE EXCEPTION 'Status LHI_GLOBAL_BLOCK tidak valid; scheduler dihentikan secara fail-closed.';
  END IF;

  SELECT incident_id, deadline_at
  INTO v_active_grace, v_deadline
  FROM public.lhi_discipline_incidents
  WHERE status = 'GRACE'
  ORDER BY incident_id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_active_grace IS NOT NULL THEN
    -- A snapshot member who becomes non-active is permanently excluded.
    WITH candidates AS (
      SELECT o.obligation_id, o.incident_id, o.staff_id,
             CASE WHEN o.completed_at IS NULL THEN 'PENDING' ELSE 'COMPLETED' END AS old_status
      FROM public.lhi_discipline_obligations o
      JOIN public.staff s ON s.staff_id = o.staff_id
      WHERE o.incident_id = v_active_grace
        AND s.status IS DISTINCT FROM 'Aktif'
        AND o.excluded_at IS NULL
    ),
    changed AS (
      UPDATE public.lhi_discipline_obligations o
      SET excluded_at = v_now
      FROM candidates c
      WHERE o.obligation_id = c.obligation_id
      RETURNING o.obligation_id
    )
    INSERT INTO public.lhi_discipline_obligation_events(
      incident_id, obligation_id, staff_id, event_type,
      previous_status, new_status, event_at, actor_staff_id, actor_name, reason
    )
    SELECT c.incident_id, c.obligation_id, c.staff_id,
           'OBLIGATION_EXCLUDED_INACTIVE', c.old_status,
           'EXCLUDED_INACTIVE', v_now, 'SYSTEM', 'SYSTEM',
           'Status kepegawaian berubah menjadi NONAKTIF selama masa kelonggaran.'
    FROM candidates c
    JOIN changed u ON u.obligation_id = c.obligation_id;

    -- A report voided before the deadline reopens the member obligation.
    WITH candidates AS (
      SELECT o.obligation_id, o.incident_id, o.staff_id, o.completed_at
      FROM public.lhi_discipline_obligations o
      JOIN public.staff s ON s.staff_id = o.staff_id
      WHERE o.incident_id = v_active_grace
        AND o.completed_at IS NOT NULL
        AND o.excluded_at IS NULL
        AND s.status = 'Aktif'
        AND NOT EXISTS (
          SELECT 1
          FROM public.lhi_discipline_incidents i
          JOIN public.reports r ON r.staff_id = o.staff_id
          WHERE i.incident_id = o.incident_id
            AND i.status = 'GRACE'
            AND r.deleted_at IS NULL
            AND r.created_at >= i.started_at
            AND r.created_at < i.deadline_at
        )
    ),
    changed AS (
      UPDATE public.lhi_discipline_obligations o
      SET completed_at = NULL
      FROM candidates c
      WHERE o.obligation_id = c.obligation_id
      RETURNING o.obligation_id
    )
    INSERT INTO public.lhi_discipline_obligation_events(
      incident_id, obligation_id, staff_id, event_type,
      previous_status, new_status, event_at, actor_staff_id, actor_name, reason
    )
    SELECT c.incident_id, c.obligation_id, c.staff_id,
           'OBLIGATION_REOPENED_AFTER_REPORT_VOID', 'COMPLETED',
           'PENDING', v_now, 'SYSTEM', 'SYSTEM',
           'LHI yang memenuhi kewajiban telah dibatalkan atau tidak lagi sah; tidak ada LHI sah pengganti dalam periode kelonggaran.'
    FROM candidates c
    JOIN changed u ON u.obligation_id = c.obligation_id;

    -- One valid input created during the grace window completes the member.
    WITH candidates AS (
      SELECT o.obligation_id, o.incident_id, o.staff_id, r.report_id
      FROM public.lhi_discipline_obligations o
      JOIN public.staff s ON s.staff_id = o.staff_id
      JOIN public.lhi_discipline_incidents i ON i.incident_id = o.incident_id
      JOIN LATERAL (
        SELECT r0.report_id
        FROM public.reports r0
        WHERE r0.staff_id = o.staff_id
          AND r0.deleted_at IS NULL
          AND r0.created_at >= i.started_at
          AND r0.created_at < i.deadline_at
        ORDER BY r0.created_at, r0.report_id
        LIMIT 1
      ) r ON true
      WHERE o.incident_id = v_active_grace
        AND o.completed_at IS NULL
        AND o.excluded_at IS NULL
        AND s.status = 'Aktif'
        AND i.status = 'GRACE'
    ),
    changed AS (
      UPDATE public.lhi_discipline_obligations o
      SET completed_at = v_now
      FROM candidates c
      WHERE o.obligation_id = c.obligation_id
      RETURNING o.obligation_id
    )
    INSERT INTO public.lhi_discipline_obligation_events(
      incident_id, obligation_id, staff_id, event_type,
      previous_status, new_status, event_at, actor_staff_id, actor_name,
      reason, report_id
    )
    SELECT c.incident_id, c.obligation_id, c.staff_id,
           'OBLIGATION_COMPLETED', 'PENDING', 'COMPLETED',
           v_now, 'SYSTEM', 'SYSTEM',
           'Petugas menginput minimal satu LHI sah selama kelonggaran 120 jam.',
           c.report_id
    FROM candidates c
    JOIN changed u ON u.obligation_id = c.obligation_id;

    SELECT count(DISTINCT o.staff_id)
    INTO v_pending
    FROM public.lhi_discipline_obligations o
    JOIN public.staff s ON s.staff_id = o.staff_id
    WHERE o.incident_id = v_active_grace
      AND o.completed_at IS NULL
      AND o.excluded_at IS NULL
      AND s.status = 'Aktif';

    IF v_now >= v_deadline AND v_pending = 0 THEN
      UPDATE public.lhi_discipline_incidents
      SET status = 'COMPLETED', completed_at = v_now
      WHERE incident_id = v_active_grace AND status = 'GRACE';

      UPDATE public.access_settings
      SET value = 'NONAKTIF', updated_at = v_now,
          updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
      WHERE key = 'LHI_GLOBAL_BLOCK';

      INSERT INTO public.audit_log(
        username, staff_id, action, report_id, keterangan,
        field_changed, old_value, new_value
      ) VALUES (
        'SYSTEM', 'SYSTEM', 'LHI_GLOBAL_BLOCK_COMPLETED', NULL,
        'Kelonggaran 120 jam berakhir dan seluruh kewajiban snapshot yang masih berlaku telah dipenuhi atau dikecualikan karena status NONAKTIF.',
        'LHI_GLOBAL_BLOCK,lhi_discipline_incidents.status',
        'GRACE / NONAKTIF', 'COMPLETED / NONAKTIF'
      );

      INSERT INTO public.lhi_discipline_obligation_events(
        incident_id, obligation_id, staff_id, event_type,
        previous_status, new_status, event_at, actor_staff_id, actor_name, reason
      )
      SELECT o.incident_id, o.obligation_id, o.staff_id,
             'GRACE_FINALIZED', CASE WHEN o.excluded_at IS NOT NULL THEN 'EXCLUDED_INACTIVE'
               WHEN o.completed_at IS NOT NULL THEN 'COMPLETED' ELSE 'PENDING' END,
             'FINALIZED', v_now, 'SYSTEM', 'SYSTEM',
             'Evaluasi akhir tenggat kelonggaran 120 jam.'
      FROM public.lhi_discipline_obligations o
      WHERE o.incident_id = v_active_grace;

    ELSIF v_now >= v_deadline THEN
      UPDATE public.lhi_discipline_incidents
      SET status = 'EXPIRED', reactivated_at = v_now
      WHERE incident_id = v_active_grace AND status = 'GRACE';

      UPDATE public.access_settings
      SET value = 'AKTIF', updated_at = v_now,
          updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
      WHERE key = 'LHI_GLOBAL_BLOCK';

      INSERT INTO public.audit_log(
        username, staff_id, action, report_id, keterangan,
        field_changed, old_value, new_value
      ) VALUES (
        'SYSTEM', 'SYSTEM', 'REACTIVATE_LHI_GLOBAL_BLOCK_TIMEOUT', NULL,
        'Kelonggaran 120 jam berakhir dan masih ada kewajiban snapshot dari petugas yang tetap AKTIF dan belum dikecualikan.',
        'LHI_GLOBAL_BLOCK,lhi_discipline_incidents.status',
        'NONAKTIF / GRACE', 'AKTIF / EXPIRED'
      );

      INSERT INTO public.lhi_discipline_notifications(event_key, recipient_staff_id, subject, message)
      SELECT 'INCIDENT:' || v_active_grace || ':GRACE_EXPIRED',
             s.staff_id, 'Mode Blok Aplikasi diaktifkan kembali',
             'Masa kelonggaran 5 hari (120 jam) berakhir. Masih ada ' ||
             v_pending || ' kewajiban LHI yang belum dipenuhi oleh petugas yang tetap AKTIF. Mode Blok Aplikasi kembali AKTIF.'
      FROM public.staff s
      WHERE s.status = 'Aktif'
      ON CONFLICT(event_key, recipient_staff_id) DO NOTHING;
    END IF;
  END IF;

  -- A scheduler invocation that handled a GRACE incident must never fall through
  -- into the daily discipline scan. In particular, when the 120-hour window is
  -- finalized, the old streak snapshot must not immediately re-lock the app in
  -- the same invocation. A fresh invocation will recalculate from actual LHI
  -- created_at values and the latest reset baseline.
  IF v_active_grace IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'date_wib', v_today,
      'processed', true,
      'grace_incident_id', v_active_grace,
      'discipline_cycle_skipped', true
    );
  END IF;

  -- The discipline cycle is paused while the 120-hour recovery window is open.
  IF v_lock = 'NONAKTIF' THEN
    FOR v_staff IN
      SELECT staff_id, nama, role, status, created_at,
             lhi_employment_activated_at, lhi_discipline_reset_at,
             lhi_access_blocked_at
      FROM public.staff
      WHERE status = 'Aktif'
      ORDER BY nama, staff_id
    LOOP
      v_baseline := GREATEST(
        COALESCE(v_staff.lhi_employment_activated_at, v_staff.created_at),
        COALESCE(v_staff.lhi_discipline_reset_at,
                 v_staff.lhi_employment_activated_at, v_staff.created_at)
      );

      SELECT max(r.created_at),
             max((r.created_at AT TIME ZONE 'Asia/Jakarta')::date)
      INTO v_last_input_at, v_last_input_date
      FROM public.reports r
      WHERE r.staff_id = v_staff.staff_id
        AND r.deleted_at IS NULL
        AND r.created_at >= v_baseline;

      v_anchor_date := COALESCE(
        v_last_input_date,
        (v_baseline AT TIME ZONE 'Asia/Jakarta')::date
      );
      v_days := GREATEST(0, v_today - v_anchor_date - 1);

      IF v_days IN (4, 6, 7) THEN
        v_event := v_staff.staff_id || ':' || v_anchor_date::text || ':DAY_' || v_days;
        v_message := CASE v_days
          WHEN 4 THEN 'Peringatan 1: ' || v_staff.nama ||
            ' belum menginput LHI selama 4 hari kalender penuh berturut-turut. Mohon segera mengingatkan dan melengkapi LHI.'
          WHEN 6 THEN 'Peringatan 2: ' || v_staff.nama ||
            ' belum menginput LHI selama 6 hari kalender penuh berturut-turut. Mohon segera melengkapi LHI.'
          ELSE 'Peringatan 3: ' || v_staff.nama ||
            ' belum menginput LHI selama 7 hari kalender penuh berturut-turut. Jika besok belum menginput LHI, hak akses aplikasinya akan diblokir.'
        END;

        INSERT INTO public.lhi_discipline_notifications(event_key, recipient_staff_id, subject, message)
        SELECT v_event, s.staff_id, 'Peringatan LHI Hari ke-' || v_days, v_message
        FROM public.staff s
        WHERE s.status = 'Aktif'
        ON CONFLICT(event_key, recipient_staff_id) DO NOTHING;
      END IF;

      IF v_days >= 8 AND v_staff.lhi_access_blocked_at IS NULL THEN
        UPDATE public.staff
        SET lhi_access_blocked_at = v_now
        WHERE staff_id = v_staff.staff_id
          AND status = 'Aktif'
          AND lhi_access_blocked_at IS NULL;

        GET DIAGNOSTICS v_blocked_count = ROW_COUNT;

        IF v_blocked_count > 0 THEN
          INSERT INTO public.audit_log(
            username, staff_id, action, report_id, keterangan,
            field_changed, old_value, new_value
          ) VALUES (
            'SYSTEM', v_staff.staff_id, 'BLOCK_LHI_APPLICATION_ACCESS_DAY_8', NULL,
            'Hak akses aplikasi diblokir setelah jumlah hari kalender penuh tanpa LHI sah melewati 7 hari. Status kepegawaian tetap AKTIF.',
            'lhi_access_blocked_at,status',
            'NULL / Aktif', v_now::text || ' / Aktif'
          );

          v_event := v_staff.staff_id || ':' || v_anchor_date::text || ':DAY_8';
          INSERT INTO public.lhi_discipline_notifications(event_key, recipient_staff_id, subject, message)
          SELECT v_event, s.staff_id, 'Hak akses LHI petugas diblokir',
            'Hak akses aplikasi ' || v_staff.nama ||
            ' diblokir karena belum menginput LHI selama lebih dari 7 hari kalender penuh. Status kepegawaiannya tetap AKTIF. Mohon bantu mengingatkan petugas tersebut.'
          FROM public.staff s
          WHERE s.status = 'Aktif'
            AND s.staff_id <> v_staff.staff_id
          ON CONFLICT(event_key, recipient_staff_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;

    -- One active employee reaching day 10 is sufficient to lock the whole app.
    WITH staff_base AS (
      SELECT s.*,
        GREATEST(
          COALESCE(s.lhi_employment_activated_at, s.created_at),
          COALESCE(s.lhi_discipline_reset_at,
                   s.lhi_employment_activated_at, s.created_at)
        ) AS baseline_at
      FROM public.staff s
      WHERE s.status = 'Aktif'
    ),
    latest_input AS (
      SELECT b.staff_id, max(r.created_at) AS last_lhi_created_at
      FROM staff_base b
      LEFT JOIN public.reports r
        ON r.staff_id = b.staff_id
       AND r.deleted_at IS NULL
       AND r.created_at >= b.baseline_at
      GROUP BY b.staff_id
    ),
    calculated AS (
      SELECT b.staff_id, b.nama, b.role,
        COALESCE(
          (li.last_lhi_created_at AT TIME ZONE 'Asia/Jakarta')::date,
          (b.baseline_at AT TIME ZONE 'Asia/Jakarta')::date
        ) AS anchor_date,
        li.last_lhi_created_at
      FROM staff_base b
      LEFT JOIN latest_input li ON li.staff_id = b.staff_id
    ),
    delinquent AS (
      SELECT *, GREATEST(0, v_today - anchor_date - 1) AS missed_days
      FROM calculated
    )
    SELECT string_agg(nama, ', ' ORDER BY nama), count(*)
    INTO v_trigger_names, v_trigger_count
    FROM delinquent
    WHERE missed_days >= 10;

    IF v_trigger_count > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.lhi_discipline_incidents
         WHERE status IN ('LOCKED', 'GRACE', 'EXPIRED')
       )
       AND (SELECT value FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK') = 'NONAKTIF' THEN

      UPDATE public.access_settings
      SET value = 'AKTIF', updated_at = v_now,
          updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
      WHERE key = 'LHI_GLOBAL_BLOCK';

      INSERT INTO public.lhi_discipline_incidents(
        started_at, deadline_at, status, started_by_staff_id, started_by_name
      ) VALUES (
        v_now, v_now + interval '120 hours', 'LOCKED', 'SYSTEM', 'SYSTEM'
      )
      RETURNING incident_id INTO v_incident;

      WITH staff_base AS (
        SELECT s.*,
          GREATEST(
            COALESCE(s.lhi_employment_activated_at, s.created_at),
            COALESCE(s.lhi_discipline_reset_at,
                     s.lhi_employment_activated_at, s.created_at)
          ) AS baseline_at
        FROM public.staff s
        WHERE s.status = 'Aktif'
      ),
      latest_input AS (
        SELECT b.staff_id, max(r.created_at) AS last_lhi_created_at
        FROM staff_base b
        LEFT JOIN public.reports r
          ON r.staff_id = b.staff_id
         AND r.deleted_at IS NULL
         AND r.created_at >= b.baseline_at
        GROUP BY b.staff_id
      ),
      calculated AS (
        SELECT b.staff_id, b.nama, b.role,
          COALESCE(
            (li.last_lhi_created_at AT TIME ZONE 'Asia/Jakarta')::date,
            (b.baseline_at AT TIME ZONE 'Asia/Jakarta')::date
          ) AS anchor_date,
          li.last_lhi_created_at
        FROM staff_base b
        LEFT JOIN latest_input li ON li.staff_id = b.staff_id
      ),
      delinquent AS (
        SELECT *, GREATEST(0, v_today - anchor_date - 1) AS missed_days
        FROM calculated
      ),
      inserted AS (
        INSERT INTO public.lhi_discipline_obligations(
          incident_id, staff_id, required_date,
          snapshot_last_lhi_created_at, snapshot_missed_days,
          snapshot_employment_status, snapshot_name, snapshot_role
        )
        SELECT v_incident, staff_id, v_today, last_lhi_created_at,
               missed_days, 'Aktif', nama, role
        FROM delinquent
        WHERE missed_days >= 10
        ON CONFLICT(incident_id, staff_id, required_date) DO NOTHING
        RETURNING obligation_id, incident_id, staff_id
      )
      INSERT INTO public.lhi_discipline_obligation_events(
        incident_id, obligation_id, staff_id, event_type,
        previous_status, new_status, event_at, actor_staff_id, actor_name, reason
      )
      SELECT incident_id, obligation_id, staff_id,
             'SNAPSHOT_CREATED', NULL, 'PENDING', v_now, 'SYSTEM', 'SYSTEM',
             'Petugas AKTIF mencapai hari ke-10 tanpa LHI sah; snapshot kewajiban dibuat.'
      FROM inserted;

      INSERT INTO public.audit_log(
        username, staff_id, action, report_id, keterangan,
        field_changed, old_value, new_value
      ) VALUES (
        'SYSTEM', 'SYSTEM', 'ACTIVATE_LHI_GLOBAL_BLOCK_DAY_10', NULL,
        'Mode Blok Aplikasi global diaktifkan karena minimal satu petugas AKTIF mencapai hari ke-10 tanpa LHI sah: ' ||
          COALESCE(v_trigger_names, '-') || '. Snapshot hanya memuat petugas yang mencapai hari ke-10.',
        'LHI_GLOBAL_BLOCK', 'NONAKTIF', 'AKTIF'
      );

      INSERT INTO public.lhi_discipline_notifications(event_key, recipient_staff_id, subject, message)
      SELECT 'INCIDENT:' || v_incident || ':GLOBAL_LOCK',
             s.staff_id, 'Mode Blok Aplikasi aktif',
             'Mode Blok Aplikasi aktif karena petugas berikut mencapai 10 hari kalender penuh tanpa LHI sah: ' ||
             COALESCE(v_trigger_names, '-') || '. Seluruh akses normal ditutup. Hanya KA IPSRS dapat melanjutkan melalui prosedur Reset.'
      FROM public.staff s
      WHERE s.status = 'Aktif'
      ON CONFLICT(event_key, recipient_staff_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'date_wib', v_today,
    'grace_incident_id', v_active_grace,
    'global_lock', COALESCE((SELECT value FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK'), 'UNKNOWN'),
    'day10_trigger_count', v_trigger_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_lhi_grace_status_v2()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH latest AS (
    SELECT *
    FROM public.lhi_discipline_incidents
    WHERE status IN ('LOCKED', 'EXPIRED', 'GRACE')
    ORDER BY incident_id DESC
    LIMIT 1
  ),
  members AS (
    SELECT
      o.staff_id,
      max(COALESCE(o.snapshot_name, s.nama)) AS nama,
      max(s.status) AS current_employment_status,
      max(o.snapshot_employment_status) AS employment_status_at_snapshot,
      max(o.snapshot_last_lhi_created_at) AS last_lhi_created_at_at_snapshot,
      max(o.snapshot_missed_days) AS missed_days_at_snapshot,
      CASE
        WHEN bool_or(
          o.excluded_at IS NULL
          AND s.status = 'Aktif'
          AND EXISTS (
            SELECT 1
            FROM public.reports r
            WHERE r.staff_id = o.staff_id
              AND r.deleted_at IS NULL
              AND r.created_at >= i.started_at
              AND r.created_at < i.deadline_at
          )
        ) THEN max(o.completed_at)
        ELSE NULL
      END AS completed_at,
      bool_or(
        o.excluded_at IS NULL
        AND s.status = 'Aktif'
        AND EXISTS (
          SELECT 1
          FROM public.reports r
          WHERE r.staff_id = o.staff_id
            AND r.deleted_at IS NULL
            AND r.created_at >= i.started_at
            AND r.created_at < i.deadline_at
        )
      ) AS has_valid_grace_report,
      bool_and(
        o.excluded_at IS NOT NULL
        OR s.status IS DISTINCT FROM 'Aktif'
      ) AS all_excluded
    FROM public.lhi_discipline_obligations o
    JOIN latest i ON i.incident_id = o.incident_id
    LEFT JOIN public.staff s ON s.staff_id = o.staff_id
    GROUP BY o.staff_id
  ),
  classified AS (
    SELECT *,
      CASE
        WHEN COALESCE(all_excluded, false) THEN 'EXCLUDED_INACTIVE'
        WHEN COALESCE(has_valid_grace_report, false) THEN 'COMPLETED'
        ELSE 'PENDING'
      END AS obligation_status
    FROM members
  )
  SELECT jsonb_build_object(
    'incident_id', (SELECT incident_id FROM latest),
    'status', (SELECT status FROM latest),
    'started_at', (SELECT started_at FROM latest),
    'deadline_at', (SELECT deadline_at FROM latest),
    'snapshot_total', (SELECT count(*) FROM classified),
    'completed', (SELECT count(*) FROM classified WHERE obligation_status = 'COMPLETED'),
    'pending', (SELECT count(*) FROM classified WHERE obligation_status = 'PENDING'),
    'excluded', (SELECT count(*) FROM classified WHERE obligation_status = 'EXCLUDED_INACTIVE'),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', staff_id,
        'nama', nama,
        'current_employment_status', current_employment_status,
        'employment_status_at_snapshot', employment_status_at_snapshot,
        'last_lhi_created_at_at_snapshot', last_lhi_created_at_at_snapshot,
        'missed_days_at_snapshot', missed_days_at_snapshot,
        'obligation_status', obligation_status,
        'completed_at', completed_at
      ) ORDER BY nama, staff_id)
      FROM classified
    ), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.open_lhi_global_grace_v2(p_recovery_session_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auth jsonb;
  v_session public.lhi_recovery_sessions%ROWTYPE;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_lock text;
  v_total integer := 0;
  v_unblocked integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  v_auth := public.validate_lhi_recovery_session(
    p_recovery_session_token_hash, 'apiStartLhiGrace'
  );
  IF COALESCE((v_auth->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RECOVERY_SESSION_INVALID');
  END IF;

  SELECT * INTO v_session
  FROM public.lhi_recovery_sessions
  WHERE session_token_hash = p_recovery_session_token_hash
  FOR UPDATE;
  IF NOT FOUND OR v_session.role <> 'KA_IPSRS' OR v_session.expires_at <= v_now
     OR v_session.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RECOVERY_SESSION_INVALID');
  END IF;

  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  SELECT * INTO v_incident
  FROM public.lhi_discipline_incidents
  WHERE incident_id = v_session.incident_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INCIDENT_NOT_FOUND');
  END IF;

  -- Idempotent retry: never move the first successful 120-hour deadline.
  IF v_lock = 'NONAKTIF' AND v_incident.status = 'GRACE' THEN
    SELECT count(DISTINCT staff_id) INTO v_total
    FROM public.lhi_discipline_obligations
    WHERE incident_id = v_incident.incident_id;
    RETURN jsonb_build_object(
      'ok', true, 'already_open', true,
      'incident_id', v_incident.incident_id,
      'status', v_incident.status,
      'started_at', v_incident.started_at,
      'deadline_at', v_incident.deadline_at,
      'snapshot_total', v_total,
      'individual_access_unblocked', 0
    );
  END IF;

  IF v_lock IS DISTINCT FROM 'AKTIF'
     OR v_incident.status NOT IN ('LOCKED', 'EXPIRED') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'GLOBAL_LOCK_NOT_READY');
  END IF;

  SELECT count(DISTINCT staff_id) INTO v_total
  FROM public.lhi_discipline_obligations
  WHERE incident_id = v_incident.incident_id;
  IF v_total < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'EMPTY_OBLIGATION_SNAPSHOT');
  END IF;

  -- Global lock and individual LHI access blocks are released atomically.
  UPDATE public.staff
  SET lhi_access_blocked_at = NULL,
      updated_at = v_now
  WHERE lhi_access_blocked_at IS NOT NULL;
  GET DIAGNOSTICS v_unblocked = ROW_COUNT;

  UPDATE public.lhi_discipline_incidents
  SET status = 'GRACE',
      started_at = v_now,
      deadline_at = v_now + interval '120 hours',
      started_by_staff_id = v_session.staff_id,
      started_by_name = v_session.staff_name,
      completed_at = NULL,
      reactivated_at = NULL
  WHERE incident_id = v_incident.incident_id;

  UPDATE public.access_settings
  SET value = 'NONAKTIF',
      updated_at = v_now,
      updated_by_staff_id = v_session.staff_id,
      updated_by_name = v_session.staff_name
  WHERE key = 'LHI_GLOBAL_BLOCK';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status blokir global gagal diperbarui; seluruh perubahan dibatalkan.';
  END IF;

  INSERT INTO public.audit_log(
    username, staff_id, action, report_id, keterangan,
    field_changed, old_value, new_value
  ) VALUES (
    v_session.staff_id, v_session.staff_id, 'OPEN_LHI_GLOBAL_GRACE_V2', NULL,
    'Sesi pemulihan terbatas KA IPSRS membuka blokir global dan seluruh blokir akses individual secara atomik serta memulai kelonggaran 120 jam.',
    'LHI_GLOBAL_BLOCK,lhi_access_blocked_at,lhi_discipline_incidents.status',
    'AKTIF / individual blocked / LOCKED|EXPIRED',
    'NONAKTIF / individual unblocked / GRACE'
  );

  -- Start each non-excluded snapshot obligation as PENDING for this new
  -- 120-hour window. Old completed_at values belong to the previous locked
  -- period and must never make a member look compliant before a new LHI exists.
  WITH prior AS MATERIALIZED (
    SELECT o.obligation_id, o.incident_id, o.staff_id, o.excluded_at, o.completed_at,
      CASE
        WHEN o.excluded_at IS NOT NULL THEN 'EXCLUDED_INACTIVE'
        WHEN o.completed_at IS NOT NULL THEN 'COMPLETED'
        ELSE 'PENDING'
      END AS previous_status
    FROM public.lhi_discipline_obligations o
    WHERE o.incident_id = v_incident.incident_id
  ),
  reset AS (
    UPDATE public.lhi_discipline_obligations o
    SET completed_at = NULL
    FROM prior p
    WHERE o.obligation_id = p.obligation_id
      AND p.excluded_at IS NULL
    RETURNING o.obligation_id
  )
  INSERT INTO public.lhi_discipline_obligation_events(
    incident_id, obligation_id, staff_id, event_type,
    previous_status, new_status, event_at, actor_staff_id, actor_name, reason
  )
  SELECT p.incident_id, p.obligation_id, p.staff_id,
         'RECOVERY_STARTED', p.previous_status,
         CASE WHEN p.excluded_at IS NOT NULL THEN 'EXCLUDED_INACTIVE' ELSE 'PENDING' END,
         v_now, v_session.staff_id, v_session.staff_name,
         'KA IPSRS memulai masa kelonggaran 120 jam. Status TERPENUHI periode sebelumnya direset; kewajiban hanya terpenuhi oleh LHI sah yang dibuat pada periode kelonggaran baru.'
  FROM prior p
  LEFT JOIN reset r ON r.obligation_id = p.obligation_id;

  RETURN jsonb_build_object(
    'ok', true, 'already_open', false,
    'incident_id', v_incident.incident_id,
    'status', 'GRACE',
    'started_at', v_now,
    'deadline_at', v_now + interval '120 hours',
    'snapshot_total', v_total,
    'individual_access_unblocked', v_unblocked
  );
END;
$function$;

-- Recovery endpoints use service_role only. The public legacy path must not be
-- callable directly by browser roles.
REVOKE ALL ON FUNCTION public.run_lhi_discipline_scheduler() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_lhi_discipline_scheduler() TO service_role;
REVOKE ALL ON FUNCTION public.track_lhi_employment_reactivation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exclude_lhi_obligations_on_deactivation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_lhi_employment_reactivation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_lhi_global_grace_v2(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lhi_global_grace_v2(text) TO service_role;
REVOKE ALL ON FUNCTION public.get_lhi_grace_status_v2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lhi_grace_status_v2() TO service_role;
REVOKE ALL ON FUNCTION public.open_lhi_global_grace(text, text) FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.staff.lhi_access_blocked_at IS
  'Timestamp when application access is individually blocked for LHI non-compliance; does not change employment status.';
COMMENT ON COLUMN public.staff.lhi_employment_activated_at IS
  'WIB-compliance baseline timestamp for the current active employment period.';
COMMENT ON COLUMN public.lhi_discipline_obligations.snapshot_last_lhi_created_at IS
  'Last valid LHI created_at captured when the global day-10 incident snapshot was created.';
COMMENT ON COLUMN public.lhi_discipline_obligations.snapshot_missed_days IS
  'Full calendar days without a valid LHI at the time the day-10 snapshot was created.';
