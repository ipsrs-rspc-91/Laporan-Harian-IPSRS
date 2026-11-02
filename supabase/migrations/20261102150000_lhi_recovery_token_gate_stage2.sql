-- Stage 2: server-issued, short-lived, one-time recovery token.
-- Staged on a feature branch; not applied to production.
CREATE TABLE IF NOT EXISTS private.lhi_recovery_tokens (
  recovery_token_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_staff_id text,
  CHECK (expires_at > issued_at)
);

ALTER TABLE private.lhi_recovery_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE private.lhi_recovery_tokens
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.issue_lhi_recovery_token(
  p_token_hash text,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at <= clock_timestamp()
     OR p_expires_at > clock_timestamp() + interval '15 minutes' THEN
    RAISE EXCEPTION 'invalid_recovery_token_parameters';
  END IF;

  DELETE FROM private.lhi_recovery_tokens
  WHERE expires_at < clock_timestamp() - interval '1 day'
     OR consumed_at < clock_timestamp() - interval '1 day';

  INSERT INTO private.lhi_recovery_tokens(token_hash, expires_at)
  VALUES (p_token_hash, p_expires_at);
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_lhi_recovery_token(
  p_token_hash text,
  p_staff_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_staff_id, '') = '' THEN
    RETURN false;
  END IF;

  -- A token may be validated while unused and unexpired. After consumption,
  -- the same KA may validate it only while that exact recovery is still GRACE,
  -- allowing a lost-response retry without creating a new grace window.
  RETURN EXISTS (
    SELECT 1
    FROM private.lhi_recovery_tokens t
    WHERE t.token_hash = p_token_hash
      AND t.consumed_at IS NULL
      AND t.expires_at > clock_timestamp()
  ) OR EXISTS (
    SELECT 1
    FROM private.lhi_recovery_tokens t
    JOIN public.lhi_discipline_incidents i
      ON i.status = 'GRACE'
    WHERE t.token_hash = p_token_hash
      AND t.consumed_by_staff_id = p_staff_id
      AND t.consumed_at IS NOT NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_lhi_recovery_token_and_open_grace(
  p_token_hash text,
  p_staff_id text,
  p_staff_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_token private.lhi_recovery_tokens%ROWTYPE;
  v_role text;
  v_result jsonb;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_total integer := 0;
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_token
  FROM private.lhi_recovery_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recovery_token_invalid_or_expired';
  END IF;

  SELECT role INTO v_role
  FROM public.staff
  WHERE staff_id = p_staff_id
  LIMIT 1;

  IF v_role IS DISTINCT FROM 'KA_IPSRS' THEN
    RAISE EXCEPTION 'recovery_role_not_authorized';
  END IF;

  -- Idempotent retry: return the original grace window if the first database
  -- transaction committed but its HTTP response was lost. Never extend it.
  IF v_token.consumed_at IS NOT NULL THEN
    IF v_token.consumed_by_staff_id IS DISTINCT FROM p_staff_id THEN
      RAISE EXCEPTION 'recovery_token_already_consumed';
    END IF;

    SELECT * INTO v_incident
    FROM public.lhi_discipline_incidents
    WHERE status = 'GRACE'
    ORDER BY incident_id DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'recovery_token_already_consumed';
    END IF;

    SELECT count(DISTINCT staff_id) INTO v_total
    FROM public.lhi_discipline_obligations
    WHERE incident_id = v_incident.incident_id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_open', true,
      'incident_id', v_incident.incident_id,
      'status', v_incident.status,
      'started_at', v_incident.started_at,
      'deadline_at', v_incident.deadline_at,
      'total', v_total
    );
  END IF;

  IF v_token.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'recovery_token_invalid_or_expired';
  END IF;

  -- This existing RPC performs the unblock + grace start atomically.
  -- If it fails, this function's transaction also rolls back token use.
  v_result := public.open_lhi_global_grace(p_staff_id, p_staff_name);
  IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'grace_recovery_failed';
  END IF;

  UPDATE private.lhi_recovery_tokens
  SET consumed_at = clock_timestamp(),
      consumed_by_staff_id = p_staff_id
  WHERE recovery_token_id = v_token.recovery_token_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_lhi_recovery_token(text, timestamptz)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_lhi_recovery_token(text, text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_lhi_recovery_token_and_open_grace(text, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_lhi_recovery_token(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_lhi_recovery_token(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_lhi_recovery_token_and_open_grace(text, text, text) TO service_role;

-- Database-level operational lock: direct Data API requests must obey the
-- same global block as ipsrs-api. The function returns only a boolean.
CREATE OR REPLACE FUNCTION public.lhi_operational_access_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE((
       SELECT upper(value) = 'NONAKTIF'
       FROM public.access_settings
       WHERE key = 'LHI_GLOBAL_BLOCK'
       LIMIT 1
     ), false);
$function$;

REVOKE ALL ON FUNCTION public.lhi_operational_access_allowed()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lhi_operational_access_allowed()
TO authenticated;

-- Access settings: KA may manage ordinary settings only while the application
-- is unlocked. Security/reset control keys remain server-owned at all times.
DROP POLICY IF EXISTS access_settings_read_ka ON public.access_settings;
CREATE POLICY access_settings_read_ka
ON public.access_settings
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key NOT IN ('LHI_RESET_CODE_HASH', 'LHI_GLOBAL_BLOCK', 'LHI_RESET_LAST_ATTEMPT')
);

DROP POLICY IF EXISTS access_settings_insert_ka ON public.access_settings;
CREATE POLICY access_settings_insert_ka
ON public.access_settings
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key NOT IN ('LHI_RESET_CODE_HASH', 'LHI_GLOBAL_BLOCK', 'LHI_RESET_LAST_ATTEMPT')
);

DROP POLICY IF EXISTS access_settings_update_ka ON public.access_settings;
CREATE POLICY access_settings_update_ka
ON public.access_settings
FOR UPDATE TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key NOT IN ('LHI_RESET_CODE_HASH', 'LHI_GLOBAL_BLOCK', 'LHI_RESET_LAST_ATTEMPT')
)
WITH CHECK (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key NOT IN ('LHI_RESET_CODE_HASH', 'LHI_GLOBAL_BLOCK', 'LHI_RESET_LAST_ATTEMPT')
);

DROP POLICY IF EXISTS access_settings_delete_ka ON public.access_settings;
CREATE POLICY access_settings_delete_ka
ON public.access_settings
FOR DELETE TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key NOT IN ('LHI_RESET_CODE_HASH', 'LHI_GLOBAL_BLOCK', 'LHI_RESET_LAST_ATTEMPT')
);

-- Reports and report history: prevent direct PostgREST reads/writes during the
-- global block, even if a caller bypasses the frontend and calls Data API.
DROP POLICY IF EXISTS reports_select_authorized ON public.reports;
CREATE POLICY reports_select_authorized
ON public.reports
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND deleted_at IS NULL
  AND (SELECT private.can_view_report(reports.staff_id, reports.role_snapshot))
);

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own
ON public.reports
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.lhi_operational_access_allowed())
  AND staff_id = (SELECT private.current_staff_id())
);

DROP POLICY IF EXISTS reports_update_authorized ON public.reports;
CREATE POLICY reports_update_authorized
ON public.reports
FOR UPDATE TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND deleted_at IS NULL
  AND (SELECT private.can_edit_report(reports.staff_id, reports.role_snapshot))
)
WITH CHECK (
  (SELECT public.lhi_operational_access_allowed())
  AND deleted_at IS NULL
  AND (SELECT private.can_edit_report(reports.staff_id, reports.role_snapshot))
);

DROP POLICY IF EXISTS report_history_select_authorized ON public.report_history;
CREATE POLICY report_history_select_authorized
ON public.report_history
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = ANY (ARRAY['KA_IPSRS', 'ADMINISTRASI'])
  AND EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.report_id = report_history.report_id
      AND (SELECT private.can_view_report(r.staff_id, r.role_snapshot))
  )
);

-- Other operational/admin data is also hidden from authenticated Data API
-- callers while the global block is active.
DROP POLICY IF EXISTS audit_log_select_authorized ON public.audit_log;
CREATE POLICY audit_log_select_authorized
ON public.audit_log
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (
    (SELECT private.current_staff_role()) = 'KA_IPSRS'
    OR (
      (SELECT private.current_staff_role()) = 'ADMINISTRASI'
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

DROP POLICY IF EXISTS edit_permissions_read_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_read_ka
ON public.edit_permissions
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
);

DROP POLICY IF EXISTS edit_permissions_insert_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_insert_ka
ON public.edit_permissions
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
);

DROP POLICY IF EXISTS edit_permissions_update_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_update_ka
ON public.edit_permissions
FOR UPDATE TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
)
WITH CHECK (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
);

DROP POLICY IF EXISTS edit_permissions_delete_ka ON public.edit_permissions;
CREATE POLICY edit_permissions_delete_ka
ON public.edit_permissions
FOR DELETE TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = 'KA_IPSRS'
);

DROP POLICY IF EXISTS authenticated_read_master_data ON public.master_data;
CREATE POLICY authenticated_read_master_data
ON public.master_data
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND is_active = true
);

DROP POLICY IF EXISTS migration_errors_read_admins ON public.migration_errors;
CREATE POLICY migration_errors_read_admins
ON public.migration_errors
FOR SELECT TO authenticated
USING (
  (SELECT public.lhi_operational_access_allowed())
  AND (SELECT private.current_staff_role()) = ANY (ARRAY['KA_IPSRS', 'ADMINISTRASI'])
);

-- These SECURITY DEFINER trigger functions are callable only as triggers;
-- revoke direct RPC execution from client roles.
REVOKE ALL ON FUNCTION public.protect_lhi_manual_unblock_status()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reactivate_lhi_staff_after_report()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_lhi_manual_unblock_status()
TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_lhi_staff_after_report()
TO service_role;
