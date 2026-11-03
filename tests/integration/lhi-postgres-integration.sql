-- End-to-end PostgreSQL integration for the LHI v2 SQL drafts.
-- Runs only against the disposable GitHub Actions PostgreSQL service.
DO $test$
DECLARE
  v_result jsonb;
  v_retry jsonb;
  v_status text;
  v_access text;
  v_anchor_before timestamptz;
  v_anchor_after timestamptz;
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
  v_mutation_rejected boolean := false;
  v_anchor_result jsonb;
  v_anchor_staff record;
BEGIN
  SELECT status, lhi_access_status, lhi_active_since
    INTO v_status, v_access, v_anchor_before
  FROM public.staff WHERE staff_id = 'LEGACY-TEST';
  IF v_status IS DISTINCT FROM 'Aktif'
     OR v_access IS DISTINCT FROM 'BLOCKED_LHI' THEN
    RAISE EXCEPTION 'Legacy LHI marker was not normalized to Aktif while retaining BLOCKED_LHI.';
  END IF;

  UPDATE public.staff SET status = 'Nonaktif' WHERE staff_id = 'LEGACY-TEST';
  SELECT lhi_access_status INTO v_access
  FROM public.staff WHERE staff_id = 'LEGACY-TEST';
  IF v_access IS DISTINCT FROM 'BLOCKED_LHI' THEN
    RAISE EXCEPTION 'Changing employment to Nonaktif must not silently clear the LHI block.';
  END IF;

  UPDATE public.staff SET status = 'Aktif' WHERE staff_id = 'LEGACY-TEST';
  SELECT lhi_access_status, lhi_active_since
    INTO v_access, v_anchor_after
  FROM public.staff WHERE staff_id = 'LEGACY-TEST';
  IF v_access IS DISTINCT FROM 'NORMAL'
     OR v_anchor_after IS NULL
     OR v_anchor_after <= v_anchor_before THEN
    RAISE EXCEPTION 'Employment reactivation did not reset active_since and clear only the LHI access block.';
  END IF;

  -- Only authenticated KA IPSRS may verify an active-since anchor.
  v_failed := false;
  BEGIN
    PERFORM public.verify_lhi_active_since_v2(
      'STAFF-TEST',
      (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date - 10,
      'TEST-UNAUTHORIZED-HR-REF',
      '00000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Non-KA account was allowed to verify an HR activation anchor.';
  END IF;

  -- Test-only HR reconciliation uses the fixture's known activation dates,
  -- but routes every verification through the same audited KA-only RPC.
  FOR v_anchor_staff IN
    SELECT staff_id, (lhi_active_since AT TIME ZONE 'Asia/Jakarta')::date AS active_date
    FROM public.staff
    WHERE status = 'Aktif'
    ORDER BY staff_id
  LOOP
    SELECT public.verify_lhi_active_since_v2(
      v_anchor_staff.staff_id,
      v_anchor_staff.active_date,
      'TEST-HR-MASTER-' || v_anchor_staff.staff_id,
      v_ka
    ) INTO v_anchor_result;
    IF COALESCE((v_anchor_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'KA HR anchor verification failed for %: %',
        v_anchor_staff.staff_id, v_anchor_result;
    END IF;
  END LOOP;

  -- A future-dated report must not reset the discipline anchor before it exists.
  INSERT INTO public.reports (report_id, staff_id, tanggal, created_at)
  VALUES ('REPORT-FUTURE-INPUT', 'WARN-4',
          (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,
          clock_timestamp() + interval '2 days');

  IF NOT EXISTS (
    SELECT 1 FROM public.lhi_discipline_evaluations_v2(clock_timestamp())
    WHERE staff_id = 'WARN-4'
      AND missed_full_days >= 3
      AND stage = 'WARNING_1'
  ) THEN
    RAISE EXCEPTION 'Future-dated report incorrectly reset the discipline anchor for WARN-4.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_active_since_verifications;
  IF v_count <> (SELECT count(*) FROM public.staff WHERE status = 'Aktif') THEN
    RAISE EXCEPTION 'Every active test employee must have one append-only HR anchor verification record.';
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

  -- Warning broadcasts reach every active staff member, including the
  -- delinquent recipients; day-8 block notice excludes users already blocked.
  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_notifications
  WHERE event_key LIKE '%:WARNING_1:TEAM'
    AND message LIKE '%Petugas Hari 4%';
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Day-4 warning was not broadcast to all six active staff; got %.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_notifications
  WHERE event_key LIKE '%:WARNING_2:TEAM'
    AND message LIKE '%Petugas Hari 6%';
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Day-6 warning was not broadcast to all six active staff; got %.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_notifications
  WHERE event_key LIKE '%:WARNING_3:TEAM'
    AND message LIKE '%Petugas Hari 7%';
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Day-7 warning was not broadcast to all six active staff; got %.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_notifications
  WHERE event_key LIKE '%:BLOCK_INDIVIDUAL:TEAM';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Day-8 block notice should reach only the four unblocked active staff; got %.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_notifications n
  JOIN public.staff s ON s.staff_id = n.recipient_staff_id
  WHERE n.event_key LIKE '%:BLOCK_INDIVIDUAL:TEAM'
    AND s.lhi_access_status = 'BLOCKED_LHI';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Day-8 block notice was sent to a staff member already blocked.';
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
  SET created_at = clock_timestamp() - interval '2 seconds',
      expires_at = clock_timestamp() - interval '1 second'
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

  -- The append-only audit must retain the exact qualification and relock
  -- transitions, including the qualifying report ID and system actor.
  IF NOT EXISTS (
    SELECT 1
    FROM public.lhi_discipline_obligation_events e
    JOIN public.lhi_discipline_snapshot_members m ON m.member_id = e.member_id
    WHERE m.incident_id = v_incident_id
      AND m.grace_cycle = 1
      AND m.staff_id = 'KA-TEST'
      AND e.event_type = 'REPORT_QUALIFIED'
      AND e.old_status = 'PENDING'
      AND e.new_status = 'COMPLETED'
      AND e.report_id = 'REPORT-KA-GRACE-1'
      AND e.actor_staff_id = 'SYSTEM'
  ) THEN
    RAISE EXCEPTION 'Missing exact REPORT_QUALIFIED transition audit.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lhi_discipline_obligation_events e
    JOIN public.lhi_discipline_snapshot_members m ON m.member_id = e.member_id
    WHERE m.incident_id = v_incident_id
      AND m.grace_cycle = 1
      AND m.staff_id = 'STAFF-TEST'
      AND e.event_type = 'GLOBAL_RELOCKED'
      AND e.old_status = 'PENDING'
      AND e.new_status = 'PENDING'
      AND e.actor_staff_id = 'SYSTEM'
  ) THEN
    RAISE EXCEPTION 'Missing exact GLOBAL_RELOCKED audit for the remaining pending member.';
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
  SET created_at = clock_timestamp() - interval '2 seconds',
      expires_at = clock_timestamp() - interval '1 second'
  WHERE token_hash = v_token_2;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GRACE_COMPLETED' THEN
    RAISE EXCEPTION 'All completed snapshot obligations did not complete grace: %', v_result;
  END IF;

  SELECT value INTO v_lock FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_lock IS DISTINCT FROM 'NONAKTIF' THEN
    RAISE EXCEPTION 'Global lock remains active after successful grace completion.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lhi_discipline_obligation_events e
    JOIN public.lhi_discipline_snapshot_members m ON m.member_id = e.member_id
    WHERE m.incident_id = v_incident_id
      AND m.grace_cycle = 2
      AND m.staff_id = 'STAFF-TEST'
      AND e.event_type = 'GRACE_COMPLETED'
      AND e.old_status = 'COMPLETED'
      AND e.new_status = 'COMPLETED'
      AND e.actor_staff_id = 'SYSTEM'
      AND e.details ->> 'detected_by' = 'LHI_SCHEDULER_V2'
  ) THEN
    RAISE EXCEPTION 'Missing GRACE_COMPLETED deadline-evaluation audit.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_snapshot_members
  WHERE incident_id = v_incident_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected immutable snapshot history of 2 members in cycle 1 plus 1 in cycle 2; got %.', v_count;
  END IF;

  -- The event log is append-only even for privileged database execution:
  -- UPDATE and DELETE must fail at the database trigger boundary.
  v_mutation_rejected := false;
  BEGIN
    UPDATE public.lhi_discipline_obligation_events
    SET details = details || jsonb_build_object('tampered', true)
    WHERE event_id = (SELECT min(event_id) FROM public.lhi_discipline_obligation_events);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Riwayat kewajiban LHI bersifat append-only.' THEN
      v_mutation_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_mutation_rejected THEN
    RAISE EXCEPTION 'LHI obligation event UPDATE was not rejected.';
  END IF;

  v_mutation_rejected := false;
  BEGIN
    DELETE FROM public.lhi_discipline_obligation_events
    WHERE event_id = (SELECT min(event_id) FROM public.lhi_discipline_obligation_events);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Riwayat kewajiban LHI bersifat append-only.' THEN
      v_mutation_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_mutation_rejected THEN
    RAISE EXCEPTION 'LHI obligation event DELETE was not rejected.';
  END IF;

  v_mutation_rejected := false;
  BEGIN
    TRUNCATE public.lhi_discipline_obligation_events;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Riwayat kewajiban LHI bersifat append-only.' THEN
      v_mutation_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_mutation_rejected THEN
    RAISE EXCEPTION 'LHI obligation event TRUNCATE was not rejected.';
  END IF;

  IF has_function_privilege('anon', 'public.run_lhi_discipline_scheduler_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute the LHI scheduler RPC.';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.validate_lhi_recovery_session(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute the restricted recovery validator.';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.get_lhi_grace_status_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute the restricted grace-status projection.';
  END IF;
  IF has_function_privilege('anon', 'public.get_lhi_grace_status_v2()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_lhi_grace_status_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not execute the grace-status projection.';
  END IF;

  IF has_function_privilege('anon', 'public.create_lhi_recovery_challenge(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.consume_lhi_recovery_challenge(text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.validate_lhi_recovery_session(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not execute restricted recovery RPCs directly.';
  END IF;

  IF has_table_privilege('anon', 'public.lhi_discipline_snapshot_members', 'SELECT')
     OR has_table_privilege('authenticated', 'public.lhi_discipline_obligation_events', 'SELECT')
     OR has_table_privilege('service_role', 'private.lhi_recovery_sessions', 'SELECT')
     OR has_table_privilege('service_role', 'public.lhi_discipline_snapshot_members', 'SELECT')
     OR has_table_privilege('anon', 'private.lhi_recovery_challenges', 'SELECT') THEN
    RAISE EXCEPTION 'Direct table access to LHI snapshot/recovery internals must be denied.';
  END IF;

  IF NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lhi_discipline_snapshot_members'::regclass
  ) OR NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lhi_discipline_obligation_events'::regclass
  ) OR NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'private.lhi_recovery_sessions'::regclass
  ) OR NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'private.lhi_recovery_challenges'::regclass
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on snapshot and recovery internals.';
  END IF;

  RAISE NOTICE 'LHI PostgreSQL integration passed: day-10 lock, KA recovery, idempotent Reset, 12h grace, relock, second snapshot cycle, and completion.';
END;
$test$;

-- Verify the service-role-only SECURITY DEFINER projection can read the
-- protected snapshot even though service_role has no direct table SELECT.
SET ROLE service_role;
SELECT public.get_lhi_grace_status_v2();
RESET ROLE;

DO $grace_status_projection_check$
DECLARE
  v_status jsonb;
BEGIN
  v_status := public.get_lhi_grace_status_v2();
  IF v_status ->> 'status' IS DISTINCT FROM 'COMPLETED'
     OR (v_status ->> 'total')::integer <> 1
     OR (v_status ->> 'completed')::integer <> 1
     OR (v_status ->> 'pending')::integer <> 0
     OR (v_status ->> 'snapshot_total')::integer <> 1
     OR jsonb_array_length(COALESCE(v_status -> 'members', '[]'::jsonb)) <> 1
     OR v_status #>> '{members,0,staff_id}' IS DISTINCT FROM 'STAFF-TEST'
     OR v_status #>> '{members,0,obligation_status}' IS DISTINCT FROM 'COMPLETED' THEN
    RAISE EXCEPTION 'Grace status projection returned incorrect counts or member-level obligation data: %', v_status;
  END IF;
END;
$grace_status_projection_check$;

-- Legacy production recovery bridge: an existing LOCKED incident has a
-- per-date obligation snapshot but no HR-verified active_since values.
-- Reset must reuse the existing snapshot rather than guessing from created_at.
DO $legacy_reset_test$
DECLARE
  v_incident bigint;
  v_result jsonb;
  v_status text;
  v_nonce text := repeat('7', 64);
  v_token text := repeat('8', 64);
  v_ip text := repeat('6', 64);
  v_anchor_a timestamptz := clock_timestamp() - interval '10 days';
  v_count integer;
  v_event_count integer;
  v_snapshot_created_at timestamptz;
BEGIN
  UPDATE public.access_settings
  SET value = 'AKTIF', updated_at = clock_timestamp()
  WHERE key = 'LHI_GLOBAL_BLOCK';

  INSERT INTO public.lhi_discipline_incidents (
    started_at, deadline_at, status, started_by_staff_id, started_by_name
  ) VALUES (
    clock_timestamp() - interval '3 days',
    clock_timestamp() - interval '2 days',
    'LOCKED', 'LEGACY_GLOBAL_LOCK', 'Legacy production lock'
  )
  RETURNING incident_id INTO v_incident;

  INSERT INTO public.lhi_discipline_obligations (incident_id, staff_id, required_date)
  SELECT v_incident, s.staff_id, d.required_date::date
  FROM public.staff s
  CROSS JOIN generate_series(
    (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date - 9,
    (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date - 1,
    interval '1 day'
  ) AS d(required_date)
  WHERE s.staff_id IN ('LEGACY-TEST', 'STAFF-TEST')
    AND s.status = 'Aktif';

  UPDATE public.staff
  SET lhi_active_since_verified_at = NULL
  WHERE staff_id IN ('LEGACY-TEST', 'STAFF-TEST');

  -- Remove the earlier grace-test report from the historical evidence set so
  -- STAFF-TEST intentionally has no valid LHI timestamp in this legacy case.
  UPDATE public.reports
  SET deleted_at = clock_timestamp()
  WHERE staff_id = 'STAFF-TEST' AND deleted_at IS NULL;

  -- Legacy snapshot must use actual valid LHI created_at values, not the
  -- number of old required_date rows. STAFF-TEST deliberately has no report,
  -- so its unavailable input anchor and missed-day count remain NULL.
  INSERT INTO public.reports (report_id, staff_id, tanggal, created_at, deleted_at)
  VALUES ('REPORT-LEGACY-ANCHOR-A', 'LEGACY-TEST',
    (v_anchor_a AT TIME ZONE 'Asia/Jakarta')::date, v_anchor_a, NULL);

  SELECT public.create_lhi_recovery_challenge(v_nonce, v_ip) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Legacy Reset challenge creation failed: %', v_result;
  END IF;

  SELECT public.consume_lhi_recovery_challenge(v_nonce, '00000000-0000-0000-0000-000000000001', v_token)
    INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Legacy Reset KA exchange failed: %', v_result;
  END IF;

  SELECT public.open_lhi_global_grace_v2(v_token) INTO v_result;
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE
     OR (v_result ->> 'snapshot_total')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Legacy Reset did not reuse the two-staff obligation snapshot: %', v_result;
  END IF;

  SELECT snapshot_created_at INTO v_snapshot_created_at
  FROM public.lhi_discipline_snapshot_members
  WHERE incident_id = v_incident
    AND grace_cycle = 1
    AND staff_id = 'LEGACY-TEST';

  SELECT count(*) INTO v_count
  FROM public.lhi_discipline_snapshot_members
  WHERE incident_id = v_incident
    AND grace_cycle = 1
    AND obligation_status = 'PENDING'
    AND (
      (staff_id = 'LEGACY-TEST'
        AND anchor_input_at = v_anchor_a
        AND missed_full_days_at_snapshot = GREATEST(
          0,
          (v_snapshot_created_at AT TIME ZONE 'Asia/Jakarta')::date
            - (v_anchor_a AT TIME ZONE 'Asia/Jakarta')::date - 1
        ))
      OR
      (staff_id = 'STAFF-TEST'
        AND anchor_input_at IS NULL
        AND missed_full_days_at_snapshot IS NULL)
    );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Legacy snapshot did not use real latest LHI input timestamps or preserve unknown anchors as NULL.';
  END IF;

  SELECT value INTO v_status
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_status IS DISTINCT FROM 'NONAKTIF' THEN
    RAISE EXCEPTION 'Legacy Reset failed to deactivate global lock.';
  END IF;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GRACE'
     OR COALESCE((v_result ->> 'deadline_reached')::boolean, true) IS NOT FALSE THEN
    RAISE EXCEPTION 'Scheduler did not continue an existing GRACE incident with provisional HR anchors: %', v_result;
  END IF;

  -- Once every legacy snapshot member submits one valid LHI during the
  -- 12-hour window, the deadline evaluation completes the incident. The next
  -- cycle must pause cleanly until HR verifies all active_since anchors.
  UPDATE public.lhi_discipline_incidents
  SET started_at = clock_timestamp() - interval '13 hours',
      deadline_at = clock_timestamp() - interval '1 hour'
  WHERE incident_id = v_incident;

  INSERT INTO public.reports (report_id, staff_id, tanggal, created_at)
  VALUES
    ('REPORT-LEGACY-GRACE-A', 'LEGACY-TEST',
      (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date, clock_timestamp() - interval '12 hours'),
    ('REPORT-LEGACY-GRACE-B', 'STAFF-TEST',
      (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date, clock_timestamp() - interval '12 hours');

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GRACE_COMPLETED' THEN
    RAISE EXCEPTION 'Legacy grace did not complete after all snapshot members submitted LHI: %', v_result;
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.lhi_discipline_obligation_events e
  JOIN public.lhi_discipline_snapshot_members m ON m.member_id = e.member_id
  WHERE m.incident_id = v_incident
    AND m.grace_cycle = 1
    AND e.event_type = 'GRACE_COMPLETED'
    AND e.actor_staff_id = 'SYSTEM'
    AND e.old_status = e.new_status
    AND e.details ? 'deadline_at';
  IF v_event_count <> 2 THEN
    RAISE EXCEPTION 'Grace deadline evaluation did not append one SYSTEM completion event per snapshot member.';
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.lhi_discipline_obligation_events e
  JOIN public.lhi_discipline_snapshot_members m ON m.member_id = e.member_id
  WHERE m.incident_id = v_incident
    AND m.grace_cycle = 1
    AND e.event_type = 'REPORT_QUALIFIED'
    AND e.actor_staff_id = 'SYSTEM'
    AND e.report_id IN ('REPORT-LEGACY-GRACE-A', 'REPORT-LEGACY-GRACE-B');
  IF v_event_count <> 2 THEN
    RAISE EXCEPTION 'Valid grace reports were not recorded with report IDs and SYSTEM actor.';
  END IF;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'ANCHOR_RECONCILIATION_REQUIRED' THEN
    RAISE EXCEPTION 'New discipline cycle did not pause cleanly pending HR anchors: %', v_result;
  END IF;

  SELECT value INTO v_status FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_status IS DISTINCT FROM 'NONAKTIF' THEN
    RAISE EXCEPTION 'Global lock was reactivated while the next cycle was waiting for HR anchor reconciliation.';
  END IF;
END;
$legacy_reset_test$;


-- README acceptance: cancelling the only grace-period LHI before deadline
-- must reverse COMPLETED to PENDING and relock the global application.
DO $cancelled_grace_report_test$
DECLARE
  v_incident bigint;
  v_member bigint;
  v_result jsonb;
  v_lock text;
BEGIN
  INSERT INTO public.staff (staff_id, nama, role, status)
  VALUES ('CANCEL-TEST', 'Petugas Uji Pembatalan', 'STAFF', 'Aktif');

  UPDATE public.access_settings
  SET value = 'NONAKTIF'
  WHERE key = 'LHI_GLOBAL_BLOCK';

  INSERT INTO public.lhi_discipline_incidents
    (started_at, deadline_at, status, started_by_staff_id, started_by_name, grace_cycle)
  VALUES
    (clock_timestamp() - interval '1 hour',
     clock_timestamp() + interval '1 hour',
     'GRACE', 'KA-TEST', 'KA IPSRS Test', 1)
  RETURNING incident_id INTO v_incident;

  INSERT INTO public.lhi_discipline_snapshot_members
    (incident_id, grace_cycle, staff_id, snapshot_created_at,
     anchor_input_at, missed_full_days_at_snapshot,
     employment_status_at_snapshot, obligation_status)
  VALUES
    (v_incident, 1, 'CANCEL-TEST', clock_timestamp() - interval '1 hour',
     NULL, 9, 'Aktif', 'PENDING')
  RETURNING member_id INTO v_member;

  INSERT INTO public.reports (report_id, staff_id, tanggal, created_at)
  VALUES ('REPORT-CANCEL-GRACE', 'CANCEL-TEST',
          (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,
          clock_timestamp() - interval '30 minutes');

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GRACE'
     OR COALESCE((v_result ->> 'deadline_reached')::boolean, true) IS NOT FALSE THEN
    RAISE EXCEPTION 'Valid grace-period report did not remain in GRACE before deadline: %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lhi_discipline_snapshot_members
    WHERE member_id = v_member
      AND obligation_status = 'COMPLETED'
      AND qualifying_report_id = 'REPORT-CANCEL-GRACE'
  ) THEN
    RAISE EXCEPTION 'Valid grace-period report did not complete its snapshot obligation.';
  END IF;

  UPDATE public.reports
  SET deleted_at = clock_timestamp()
  WHERE report_id = 'REPORT-CANCEL-GRACE';

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GRACE'
     OR COALESCE((v_result ->> 'deadline_reached')::boolean, true) IS NOT FALSE THEN
    RAISE EXCEPTION 'Cancellation should reopen the obligation while grace remains active: %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lhi_discipline_snapshot_members
    WHERE member_id = v_member
      AND obligation_status = 'PENDING'
      AND qualifying_report_id IS NULL
      AND completed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cancelled sole grace report did not reopen the snapshot obligation.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lhi_discipline_obligation_events
    WHERE member_id = v_member
      AND event_type = 'REPORT_CANCELLED'
      AND report_id = 'REPORT-CANCEL-GRACE'
      AND old_status = 'COMPLETED'
      AND new_status = 'PENDING'
      AND actor_staff_id = 'SYSTEM'
  ) THEN
    RAISE EXCEPTION 'Cancellation did not append the exact REPORT_CANCELLED transition.';
  END IF;

  UPDATE public.lhi_discipline_incidents
  SET started_at = clock_timestamp() - interval '13 hours',
      deadline_at = clock_timestamp() - interval '1 hour'
  WHERE incident_id = v_incident;

  SELECT public.run_lhi_discipline_scheduler_v2() INTO v_result;
  IF v_result ->> 'mode' IS DISTINCT FROM 'GLOBAL_RELOCKED'
     OR COALESCE((v_result ->> 'pending')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'Cancelled sole LHI did not cause global relock at the deadline: %', v_result;
  END IF;

  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK';
  IF v_lock IS DISTINCT FROM 'AKTIF' THEN
    RAISE EXCEPTION 'Global block was not reactivated after cancelled sole grace report.';
  END IF;
END;
$cancelled_grace_report_test$;
