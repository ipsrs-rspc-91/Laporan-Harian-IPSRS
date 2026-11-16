\set ON_ERROR_STOP on
-- Seed a KA IPSRS account, two active snapshot members, and one inactive member.
INSERT INTO public.staff(staff_id,nama,jabatan,role,status,auth_user_id,created_at)
VALUES
 ('KA','KA IPSRS','Kepala IPSRS','KA_IPSRS','Aktif','00000000-0000-0000-0000-000000000001',now()-interval '30 days'),
 ('A','Petugas A','Teknisi','PETUGAS','Aktif','00000000-0000-0000-0000-000000000002',now()-interval '30 days'),
 ('B','Petugas B','Teknisi','PETUGAS','Aktif','00000000-0000-0000-0000-000000000003',now()-interval '30 days'),
 ('C','Petugas C','Teknisi','PETUGAS','Nonaktif','00000000-0000-0000-0000-000000000004',now()-interval '30 days');

INSERT INTO public.access_settings(key,value) VALUES ('LHI_GLOBAL_BLOCK','AKTIF');
INSERT INTO public.lhi_discipline_incidents(started_at,deadline_at,status,started_by_staff_id,started_by_name)
VALUES (now()-interval '10 days',now()+interval '5 days','LOCKED','SYSTEM','SYSTEM');
INSERT INTO public.lhi_discipline_obligations(incident_id,staff_id,required_date,completed_at)
SELECT 1,staff_id,current_date,now()-interval '1 day' FROM public.staff WHERE staff_id IN ('A','B','C');
UPDATE public.staff SET lhi_access_blocked_at=now() WHERE staff_id IN ('A','B','KA');

INSERT INTO public.lhi_recovery_sessions(session_token_hash,auth_user_id,staff_id,staff_name,role,incident_id,expires_at)
VALUES (repeat('a',64),'00000000-0000-0000-0000-000000000001','KA','KA IPSRS','KA_IPSRS',1,now()+interval '10 minutes');

-- Recovery-session validation must return the incident metadata consumed by the recovery API.
DO $$
DECLARE v_validation jsonb;
BEGIN
  v_validation := public.validate_lhi_recovery_session(repeat('a',64), 'apiRecoveryStatus');
  IF COALESCE((v_validation->>'ok')::boolean,false) IS NOT TRUE
     OR v_validation->>'incident_status' <> 'LOCKED'
     OR NULLIF(v_validation->>'started_at','') IS NULL
     OR NULLIF(v_validation->>'deadline_at','') IS NULL THEN
    RAISE EXCEPTION 'FAIL: recovery validation omitted incident status/start/deadline metadata: %',v_validation;
  END IF;
END $$;

-- Recovery must atomically open global and individual access, start a new 120h window,
-- and clear old completion markers from the previous locked period.
SELECT public.open_lhi_global_grace_v2(repeat('a',64));
DO $$
BEGIN
  IF (SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK') <> 'NONAKTIF' THEN
    RAISE EXCEPTION 'FAIL: global lock did not open';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff WHERE lhi_access_blocked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: individual access locks were not cleared atomically';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lhi_discipline_obligations WHERE incident_id=1 AND completed_at IS NOT NULL AND excluded_at IS NULL) THEN
    RAISE EXCEPTION 'FAIL: old completed_at markers leaked into the new grace period';
  END IF;
  IF (SELECT deadline_at-started_at FROM public.lhi_discipline_incidents WHERE incident_id=1) <> interval '120 hours' THEN
    RAISE EXCEPTION 'FAIL: grace duration is not 120 hours';
  END IF;
END $$;

-- A valid report in the active window must appear COMPLETED even before scheduler refresh.
INSERT INTO public.reports(report_id,staff_id,created_at,role_snapshot,tanggal)
VALUES ('A-1','A',clock_timestamp(),'PETUGAS',current_date);
INSERT INTO public.reports(report_id,staff_id,created_at,role_snapshot,tanggal)
VALUES ('B-1','B',clock_timestamp(),'PETUGAS',current_date);

DO $$
DECLARE v_status jsonb;
BEGIN
  v_status := public.get_lhi_grace_status_v2();
  IF (v_status->>'completed')::int <> 2 OR (v_status->>'pending')::int <> 0
     OR (v_status->>'excluded')::int <> 1 THEN
    RAISE EXCEPTION 'FAIL: grace status does not reflect valid LHI and inactive exclusion: %',v_status;
  END IF;
END $$;

-- Scheduler must pause the daily discipline cycle while processing GRACE.
SELECT public.run_lhi_discipline_scheduler();
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := public.run_lhi_discipline_scheduler();
  IF COALESCE((v_result->>'discipline_cycle_skipped')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: scheduler fell through into the daily discipline cycle';
  END IF;
  IF (SELECT status FROM public.lhi_discipline_incidents WHERE incident_id=1) <> 'GRACE' THEN
    RAISE EXCEPTION 'FAIL: grace closed before its deadline';
  END IF;
END $$;

-- At the deadline, all active snapshot members are complete and the inactive member is excluded:
-- global access must stay open.
UPDATE public.lhi_discipline_incidents SET deadline_at=clock_timestamp() WHERE incident_id=1;
SELECT public.run_lhi_discipline_scheduler();
DO $$
BEGIN
  IF (SELECT status FROM public.lhi_discipline_incidents WHERE incident_id=1) <> 'COMPLETED' THEN
    RAISE EXCEPTION 'FAIL: fully completed grace was not finalized';
  END IF;
  IF (SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK') <> 'NONAKTIF' THEN
    RAISE EXCEPTION 'FAIL: global lock reactivated despite full compliance';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lhi_discipline_obligations WHERE incident_id=1 AND excluded_at IS NOT NULL AND staff_id='C') THEN
    RAISE EXCEPTION 'FAIL: inactive snapshot member was not excluded';
  END IF;
END $$;

-- Second incident: one member complies, one does not. A voided sole report reopens the obligation.
UPDATE public.access_settings SET value='AKTIF' WHERE key='LHI_GLOBAL_BLOCK';
INSERT INTO public.lhi_discipline_incidents(started_at,deadline_at,status,started_by_staff_id,started_by_name)
VALUES (now()-interval '10 days',now()+interval '5 days','LOCKED','SYSTEM','SYSTEM');
INSERT INTO public.lhi_discipline_obligations(incident_id,staff_id,required_date,completed_at)
SELECT 2,staff_id,current_date,now()-interval '1 day' FROM public.staff WHERE staff_id IN ('A','B','C');
INSERT INTO public.lhi_recovery_sessions(session_token_hash,auth_user_id,staff_id,staff_name,role,incident_id,expires_at)
VALUES (repeat('b',64),'00000000-0000-0000-0000-000000000001','KA','KA IPSRS','KA_IPSRS',2,now()+interval '10 minutes');

SELECT public.open_lhi_global_grace_v2(repeat('b',64));
CREATE TEMP TABLE grace_deadline AS
SELECT started_at,deadline_at FROM public.lhi_discipline_incidents WHERE incident_id=2;
-- Idempotent retry must not extend or restart the original 120-hour deadline.
SELECT public.open_lhi_global_grace_v2(repeat('b',64));
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM grace_deadline d JOIN public.lhi_discipline_incidents i ON i.incident_id=2
    WHERE d.started_at=i.started_at AND d.deadline_at=i.deadline_at
  ) THEN RAISE EXCEPTION 'FAIL: recovery retry moved the original deadline'; END IF;
END $$;

INSERT INTO public.reports(report_id,staff_id,created_at,role_snapshot,tanggal)
VALUES ('A-2','A',clock_timestamp(),'PETUGAS',current_date);
SELECT public.run_lhi_discipline_scheduler();
UPDATE public.reports SET deleted_at=now() WHERE report_id='A-2';
SELECT public.run_lhi_discipline_scheduler();

DO $$
DECLARE v_status jsonb;
BEGIN
  v_status := public.get_lhi_grace_status_v2();
  IF (v_status->>'pending')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: voiding the only grace LHI did not reopen its obligation: %',v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lhi_discipline_obligation_events WHERE incident_id=2 AND event_type='OBLIGATION_REOPENED_AFTER_REPORT_VOID') THEN
    RAISE EXCEPTION 'FAIL: report-void reopening event was not audited';
  END IF;
END $$;

UPDATE public.lhi_discipline_incidents SET deadline_at=clock_timestamp() WHERE incident_id=2;
SELECT public.run_lhi_discipline_scheduler();
DO $$
BEGIN
  IF (SELECT status FROM public.lhi_discipline_incidents WHERE incident_id=2) <> 'EXPIRED' THEN
    RAISE EXCEPTION 'FAIL: incomplete grace did not expire';
  END IF;
  IF (SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK') <> 'AKTIF' THEN
    RAISE EXCEPTION 'FAIL: global lock did not reactivate for pending active snapshot members';
  END IF;
END $$;

-- One-time challenge and reset-attempt rate limit are server-only and enforced.
SELECT public.create_lhi_recovery_challenge(repeat('c',64),repeat('d',64));
SELECT public.consume_lhi_recovery_challenge(repeat('c',64),'00000000-0000-0000-0000-000000000001',repeat('e',64));
DO $$
DECLARE v_second jsonb;
BEGIN
  v_second := public.consume_lhi_recovery_challenge(repeat('c',64),'00000000-0000-0000-0000-000000000001',repeat('f',64));
  IF COALESCE((v_second->>'ok')::boolean,false) THEN
    RAISE EXCEPTION 'FAIL: recovery challenge was reusable';
  END IF;
END $$;
SELECT public.register_lhi_reset_attempt(repeat('f',64));
SELECT public.register_lhi_reset_attempt(repeat('f',64));
SELECT public.register_lhi_reset_attempt(repeat('f',64));
SELECT public.register_lhi_reset_attempt(repeat('f',64));
DO $$
DECLARE v_rate jsonb;
BEGIN
  v_rate := public.register_lhi_reset_attempt(repeat('f',64));
  IF COALESCE((v_rate->>'allowed')::boolean,true) THEN
    RAISE EXCEPTION 'FAIL: reset rate limiter did not lock after repeated attempts';
  END IF;
END $$;

-- RLS: an individually blocked user and a globally blocked user cannot read or write reports.
UPDATE public.access_settings SET value='NONAKTIF' WHERE key='LHI_GLOBAL_BLOCK';
UPDATE public.staff SET lhi_access_blocked_at=now() WHERE staff_id='A';
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer; v_denied boolean:=false;
BEGIN
  SELECT count(*) INTO v_count FROM public.reports;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: individual block did not deny report reads'; END IF;
  BEGIN
    INSERT INTO public.reports(report_id,staff_id,created_at) VALUES ('RLS-INDIVIDUAL','A',now());
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: individual block did not deny report writes'; END IF;
END $$;
RESET ROLE;
COMMIT;

UPDATE public.staff SET lhi_access_blocked_at=NULL WHERE staff_id='A';
UPDATE public.access_settings SET value='AKTIF' WHERE key='LHI_GLOBAL_BLOCK';
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer; v_denied boolean:=false;
BEGIN
  SELECT count(*) INTO v_count FROM public.reports;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: global block did not deny report reads'; END IF;
  BEGIN
    INSERT INTO public.reports(report_id,staff_id,created_at) VALUES ('RLS-GLOBAL','A',now());
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: global block did not deny report writes'; END IF;
END $$;
RESET ROLE;
COMMIT;

-- Normal access is restored once both global and individual locks are cleared.
UPDATE public.access_settings SET value='NONAKTIF' WHERE key='LHI_GLOBAL_BLOCK';
UPDATE public.staff SET lhi_access_blocked_at=NULL WHERE staff_id='A';
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.reports;
  IF v_count < 1 THEN RAISE EXCEPTION 'FAIL: normal user could not read reports after both locks were cleared'; END IF;
  INSERT INTO public.reports(report_id,staff_id,created_at) VALUES ('RLS-NORMAL','A',now());
END $$;
RESET ROLE;
COMMIT;

-- KA IPSRS cannot bypass the server-owned global lock through Data API writes.
UPDATE public.access_settings SET value='AKTIF' WHERE key='LHI_GLOBAL_BLOCK';
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.access_settings SET value='NONAKTIF' WHERE key='LHI_GLOBAL_BLOCK';
RESET ROLE;
COMMIT;
DO $$
BEGIN
  IF (SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK') <> 'AKTIF' THEN
    RAISE EXCEPTION 'FAIL: authenticated KA changed the server-owned global lock';
  END IF;
END $$;

-- Threshold acceptance: 4/6/7-day warnings, individual block only after >7,
-- day 9 remains a waiting stage, and KA IPSRS is included in the day-10 trigger.
UPDATE public.access_settings SET value='NONAKTIF' WHERE key='LHI_GLOBAL_BLOCK';
UPDATE public.lhi_discipline_incidents SET status='COMPLETED' WHERE incident_id=2;
UPDATE public.staff
SET created_at=now()-interval '1 day',
    lhi_employment_activated_at=now()-interval '1 day',
    lhi_discipline_reset_at=NULL
WHERE staff_id='KA';

INSERT INTO public.staff(staff_id,nama,jabatan,role,status,created_at)
VALUES
 ('E','Petugas E','Teknisi','PETUGAS','Aktif',now()-interval '5 days'),
 ('F','Petugas F','Teknisi','PETUGAS','Aktif',now()-interval '7 days'),
 ('G','Petugas G','Teknisi','PETUGAS','Aktif',now()-interval '8 days'),
 ('H','Petugas H','Teknisi','PETUGAS','Aktif',now()-interval '9 days'),
 ('I','Petugas I','Teknisi','PETUGAS','Aktif',now()-interval '10 days');
UPDATE public.staff
SET lhi_employment_activated_at=created_at
WHERE staff_id IN ('E','F','G','H','I');

SELECT public.run_lhi_discipline_scheduler();
DO $$
BEGIN
  IF (SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK') <> 'NONAKTIF' THEN
    RAISE EXCEPTION 'FAIL: global block activated before any active member reached day 10';
  END IF;
  IF (SELECT lhi_access_blocked_at FROM public.staff WHERE staff_id='G') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: exactly 7 full days incorrectly triggered individual block';
  END IF;
  IF (SELECT lhi_access_blocked_at FROM public.staff WHERE staff_id='H') IS NULL
     OR (SELECT lhi_access_blocked_at FROM public.staff WHERE staff_id='I') IS NULL THEN
    RAISE EXCEPTION 'FAIL: day 8/day 9 individual access block was not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lhi_discipline_notifications WHERE event_key LIKE 'E:%:DAY_4') THEN
    RAISE EXCEPTION 'FAIL: day-4 warning was not created';
  END IF;
  IF (
    SELECT count(*) FROM public.lhi_discipline_notifications
    WHERE event_key LIKE 'E:%:DAY_4'
  ) <> (SELECT count(*) FROM public.staff WHERE status='Aktif') THEN
    RAISE EXCEPTION 'FAIL: day-4 warning was not delivered to every active staff member';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lhi_discipline_notifications
    WHERE event_key LIKE 'E:%:DAY_4' AND recipient_staff_id='C'
  ) THEN
    RAISE EXCEPTION 'FAIL: day-4 warning was sent to an inactive employee';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lhi_discipline_notifications
    WHERE event_key LIKE 'E:%:DAY_4'
      AND message LIKE '%Petugas E%'
      AND message LIKE '%4 hari kalender penuh berturut-turut%'
  ) THEN
    RAISE EXCEPTION 'FAIL: day-4 warning does not identify the delinquent staff member and exact stage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lhi_discipline_notifications WHERE event_key LIKE 'F:%:DAY_6') THEN
    RAISE EXCEPTION 'FAIL: day-6 warning was not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lhi_discipline_notifications WHERE event_key LIKE 'G:%:DAY_7') THEN
    RAISE EXCEPTION 'FAIL: day-7 warning was not created';
  END IF;
END $$;

-- Re-running the 5-minute scheduler must not duplicate the same day-4 stage.
SELECT public.run_lhi_discipline_scheduler();
DO $$
BEGIN
  IF (
    SELECT count(*) FROM public.lhi_discipline_notifications
    WHERE event_key LIKE 'E:%:DAY_4'
  ) <> (SELECT count(*) FROM public.staff WHERE status='Aktif') THEN
    RAISE EXCEPTION 'FAIL: repeated scheduler run duplicated or lost day-4 recipients';
  END IF;
END $$;

-- A petugas and KA IPSRS now reach day 10; one active member is enough to lock globally.
UPDATE public.staff
SET created_at=now()-interval '11 days',
    lhi_employment_activated_at=now()-interval '11 days'
WHERE staff_id='KA';
INSERT INTO public.staff(staff_id,nama,jabatan,role,status,created_at,lhi_employment_activated_at)
VALUES ('J','Petugas J','Teknisi','PETUGAS','Aktif',now()-interval '11 days',now()-interval '11 days');

DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := public.run_lhi_discipline_scheduler();
  IF (v_result->>'day10_trigger_count')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: day-10 trigger must include both KA IPSRS and Petugas J: %',v_result;
  END IF;
END $$;
DO $$
DECLARE v_incident bigint;
BEGIN
  IF (SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK') <> 'AKTIF' THEN
    RAISE EXCEPTION 'FAIL: day-10 global block was not activated';
  END IF;
  IF (SELECT status FROM public.staff WHERE staff_id='KA') <> 'Aktif'
     OR (SELECT lhi_access_blocked_at FROM public.staff WHERE staff_id='KA') IS NULL THEN
    RAISE EXCEPTION 'FAIL: KA IPSRS was not included in active-staff day-10 discipline';
  END IF;
  SELECT max(incident_id) INTO v_incident FROM public.lhi_discipline_incidents WHERE status='LOCKED';
  IF (SELECT count(DISTINCT staff_id) FROM public.lhi_discipline_obligations WHERE incident_id=v_incident) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.lhi_discipline_obligations WHERE incident_id=v_incident AND staff_id='KA')
     OR NOT EXISTS (SELECT 1 FROM public.lhi_discipline_obligations WHERE incident_id=v_incident AND staff_id='J') THEN
    RAISE EXCEPTION 'FAIL: day-10 snapshot must contain only the two triggering active staff';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lhi_discipline_obligations WHERE incident_id=v_incident AND staff_id IN ('G','H','I')) THEN
    RAISE EXCEPTION 'FAIL: day-8/day-9 members were incorrectly added to the day-10 snapshot';
  END IF;
END $$;

SELECT 'PASS: PostgreSQL LHI grace, reset, void/reopen, exclusion, idempotency, rate-limit, RLS and day-4/6/7/8/9/10 thresholds' AS result;
-- This acceptance suite is executed only against the disposable PostgreSQL CI service.
