-- End-to-end PostgreSQL integration for the LHI v2 SQL drafts.
-- Runs only against the disposable GitHub Actions PostgreSQL service.
DO $test$
DECLARE
  v_result jsonb;
  v_retry jsonb;
  v_status text;
  v_lock text;
  v_incident_id bigint;
  v_first_started timestamptz;
  v_first_deadline timestamptz;
  v_second_started timestamptz;
  v_second_deadline timestamptz;
  v_count integer;
  v_failed boolean;
  v_nonce_bad text := repeat('f', 64);
  v_token_bad text := repeat('9', 64);
  v_ka uuid := '00000000-0000-0000-0000-000000000001';
  v_ip text := repeat('b', 64);
  v_nonce_1 text := repeat('a', 64);
  v_token_1 text := repeat('c', 64);
  v_nonce_2 text := repeat('d', 64);
  v_token_2 text := repeat('e', 64);
BEGIN
  SELECT lhi_access_status INTO v_status
  FROM public.staff WHERE staff_id = 'LEGACY-TEST';
  IF v_status IS DISTINCT FROM 'BLOCKED_LHI' THEN
    RAISE EXCEPTION 'Legacy LHI access state was not mapped to BLOCKED_LHI.';
  END IF;

  UPDATE public.staff SET status = 'Aktif' WHERE staff_id = 'LEGACY-TEST';
  SELECT lhi_access_status INTO v_status
  FROM public.staff WHERE staff_id = 'LEGACY-TEST';
  IF v_status IS DISTINCT FROM 'NORMAL' THEN
    RAISE EXCEPTION 'Employment reactivation did not clear only the LHI access block.';
  END IF;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GLOBAL_LOCKED' THEN
    RAISE EXCEPTION 'Day-10 scheduler did not activate global lock: %', v_result;
  END IF;

  SELECT value INTO v_lock FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_lock IS DISTINCT FROM 'AKTIF' THEN
    RAISE EXCEPTION 'Global lock setting is not AKTIF after day-10 threshold.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.staff
  WHERE staff_id IN ('KA-TEST', 'STAFF-TEST')
    AND lhi_access_status = 'BLOCKED_LHI';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected two individual LHI blocks at day 8; got %.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_incidents
  WHERE status = 'LOCKED';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one LOCKED incident; got %.', v_count;
  END IF;

  SELECT public.create_lhi_recovery_challenge(v_nonce_1, v_ip) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Recovery challenge creation failed: %', v_result;
  END IF;

  SELECT public.consume_lhi_recovery_challenge(v_nonce_1, v_ka, v_token_1) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'KA challenge exchange failed: %', v_result;
  END IF;

  SELECT public.open_lhi_global_grace_v2(v_token_1) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE
     OR (v_result ->> 'snapshot_total')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Atomic Reset did not create the two-member snapshot: %', v_result;
  END IF;

  v_first_started := (v_result ->> 'started_at')::timestamptz;
  v_first_deadline := (v_result ->> 'deadline_at')::timestamptz;
  v_incident_id := (v_result ->> 'incident_id')::bigint;
  IF v_first_deadline - v_first_started IS DISTINCT FROM interval '12 hours' THEN
    RAISE EXCEPTION 'Grace duration is not exactly 12 hours.';
  END IF;

  SELECT public.open_lhi_global_grace_v2(v_token_1) INTO v_retry;
  IF COALESCE((v_retry ->> 'already_open')::boolean, false) IS NOT TRUE
     OR (v_retry ->> 'started_at')::timestamptz IS DISTINCT FROM v_first_started
     OR (v_retry ->> 'deadline_at')::timestamptz IS DISTINCT FROM v_first_deadline THEN
    RAISE EXCEPTION 'Reset retry shifted the original grace window: %', v_retry;
  END IF;

  -- Null/unknown lock state must fail closed across challenge, exchange,
  -- session validation, atomic Reset, and scheduler paths.
  SELECT public.create_lhi_recovery_challenge(v_nonce_bad, v_ip) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Could not prepare negative-test challenge: %', v_result;
  END IF;

  UPDATE public.access_settings SET value = NULL WHERE key = 'LHI_GLOBAL_BLOCK';

  SELECT public.create_lhi_recovery_challenge(v_nonce_2, v_ip) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'Challenge gate accepted a null global lock state.';
  END IF;

  SELECT public.consume_lhi_recovery_challenge(v_nonce_bad, v_ka, v_token_bad) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'Challenge exchange accepted a null global lock state.';
  END IF;

  SELECT public.validate_lhi_recovery_session(v_token_1, 'apiRecoveryStatus') INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'Recovery validator accepted a null global lock state.';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.open_lhi_global_grace_v2(v_token_1);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Atomic Reset did not fail closed on a null global lock state.';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.run_lhi_discipline_scheduler_v2();
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scheduler did not fail closed on a null global lock state.';
  END IF;

  UPDATE public.access_settings SET value = 'NONAKTIF' WHERE key = 'LHI_GLOBAL_BLOCK';

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_snapshot_members
  WHERE incident_id = v_incident_id AND grace_cycle = 1;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'First Reset snapshot is not exactly one row per delinquent staff.';
  END IF;

  SELECT value INTO v_lock FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_lock IS DISTINCT FROM 'NONAKTIF' THEN
    RAISE EXCEPTION 'Atomic Reset did not clear global lock.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.staff
  WHERE staff_id IN ('KA-TEST', 'STAFF-TEST')
    AND lhi_access_status = 'NORMAL';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Atomic Reset did not clear individual LHI access blocks.';
  END IF;

  -- Simulate the 12-hour deadline without waiting in CI. Only KA submits a
  -- valid report in the first grace window; the other active snapshot member
  -- remains pending and must cause a global relock.
  UPDATE public.lhi_discipline_incidents
  SET started_at = clock_timestamp() - interval '13 hours',
      deadline_at = clock_timestamp() - interval '1 hour'
  WHERE incident_id = v_incident_id;

  INSERT INTO public.reports (report_id, staff_id, tanggal, created_at)
  VALUES ('REPORT-KA-GRACE-1', 'KA-TEST', (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,
          clock_timestamp() - interval '12 hours');

  UPDATE private.lhi_recovery_sessions
  SET expires_at = clock_timestamp() - interval '1 second'
  WHERE token_hash = v_token_1;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GLOBAL_RELOCKED'
     OR (v_result ->> 'pending')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Pending snapshot obligation did not relock global access: %', v_result;
  END IF;

  SELECT value INTO v_lock FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_lock IS DISTINCT FROM 'AKTIF' THEN
    RAISE EXCEPTION 'Global lock was not reactivated after grace timeout.';
  END IF;

  -- Second Reset must create cycle 2 without colliding with immutable cycle 1.
  SELECT public.create_lhi_recovery_challenge(v_nonce_2, v_ip) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Second recovery challenge creation failed: %', v_result;
  END IF;
  SELECT public.consume_lhi_recovery_challenge(v_nonce_2, v_ka, v_token_2) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Second KA challenge exchange failed: %', v_result;
  END IF;

  SELECT public.open_lhi_global_grace_v2(v_token_2) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE
     OR (v_result ->> 'snapshot_total')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Second Reset should snapshot only the remaining delinquent staff: %', v_result;
  END IF;

  v_second_started := (v_result ->> 'started_at')::timestamptz;
  v_second_deadline := (v_result ->> 'deadline_at')::timestamptz;
  IF v_second_deadline - v_second_started IS DISTINCT FROM interval '12 hours' THEN
    RAISE EXCEPTION 'Second grace duration is not exactly 12 hours.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_snapshot_members
  WHERE incident_id = v_incident_id AND grace_cycle = 2;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Second Reset did not create a separate one-member cycle.';
  END IF;

  -- Remaining staff submits one valid report during cycle 2; the next
  -- scheduler evaluation must complete the incident and leave global access open.
  UPDATE public.lhi_discipline_incidents
  SET started_at = clock_timestamp() - interval '13 hours',
      deadline_at = clock_timestamp() - interval '1 hour'
  WHERE incident_id = v_incident_id;

  INSERT INTO public.reports (report_id, staff_id, tanggal, created_at)
  VALUES ('REPORT-STAFF-GRACE-2', 'STAFF-TEST', (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,
          clock_timestamp() - interval '12 hours');

  UPDATE private.lhi_recovery_sessions
  SET expires_at = clock_timestamp() - interval '1 second'
  WHERE token_hash = v_token_2;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GRACE_COMPLETED' THEN
    RAISE EXCEPTION 'All completed snapshot obligations did not complete grace: %', v_result;
  END IF;

  SELECT value INTO v_lock FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_lock IS DISTINCT FROM 'NONAKTIF' THEN
    RAISE EXCEPTION 'Global lock remains active after successful grace completion.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_snapshot_members
  WHERE incident_id = v_incident_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected immutable snapshot history of 2 members in cycle 1 plus 1 in cycle 2; got %.', v_count;
  END IF;

  IF has_function_privilege('anon', 'public.run_lhi_discipline_scheduler_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute the LHI scheduler RPC.';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.validate_lhi_recovery_session(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute the restricted recovery validator.';
  END IF;

  RAISE NOTICE 'LHI PostgreSQL integration passed: day-10 lock, KA recovery, idempotent Reset, 12h grace, relock, second snapshot cycle, and completion.';
END;
$test$;
