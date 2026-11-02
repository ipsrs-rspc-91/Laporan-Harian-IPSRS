-- Stage 2: server-issued, short-lived, one-time recovery token.
-- This migration is staged on a feature branch; it is not applied to production.
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
REVOKE ALL ON TABLE private.lhi_recovery_tokens FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.issue_lhi_recovery_token(
  p_token_hash text,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$'
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
  p_token_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM private.lhi_recovery_tokens t
    WHERE t.token_hash = p_token_hash
      AND t.consumed_at IS NULL
      AND t.expires_at > clock_timestamp()
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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_token
  FROM private.lhi_recovery_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_token.consumed_at IS NOT NULL
     OR v_token.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'recovery_token_invalid_or_expired';
  END IF;

  SELECT role INTO v_role
  FROM public.staff
  WHERE staff_id = p_staff_id
  LIMIT 1;

  IF v_role IS DISTINCT FROM 'KA_IPSRS' THEN
    RAISE EXCEPTION 'recovery_role_not_authorized';
  END IF;

  -- Existing atomic grace RPC performs the actual unblock and starts the
  -- original fixed 12-hour window. Any error rolls back token consumption too.
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

REVOKE ALL ON FUNCTION public.issue_lhi_recovery_token(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_lhi_recovery_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_lhi_recovery_token_and_open_grace(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_lhi_recovery_token(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_lhi_recovery_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_lhi_recovery_token_and_open_grace(text, text, text) TO service_role;
