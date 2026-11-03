-- REVIEW DRAFT ONLY — NOT A DEPLOYABLE MIGRATION.
-- LHI scheduler v2. Depends on schema-v2 draft:
-- docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql
-- Do not run in production. Validate on a disposable/non-production Supabase
-- project after schema reconciliation, integration tests, and security review.
--
-- Contract:
-- * Use reports.created_at in Asia/Jakarta, never reports.tanggal.
-- * Exclude current WIB calendar day from completed missed-day count.
-- * Warn at missed_full_days 3/5/6 (days 4/6/7).
-- * Block individual access at missed_full_days >= 7 (day 8).
-- * Day 9 (missed_full_days = 8) is WAITING only.
-- * Global block at missed_full_days >= 9 (day 10).
-- * All roles included; BLOCKED_LHI staff remain evaluated.
-- * Snapshot is created atomically by the Reset RPC, one row per delinquent staff/incident.
-- * Grace evaluated only at/after its exact 12-hour deadline.

BEGIN;

CREATE OR REPLACE FUNCTION public.lhi_discipline_evaluations_v2(p_now timestamptz)
RETURNS TABLE (
  staff_id text,
  nama text,
  role text,
  employment_status text,
  lhi_access_status text,
  anchor_at timestamptz,
  anchor_wib_date date,
  today_wib_date date,
  missed_full_days integer,
  stage text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  WITH active_staff AS (
    SELECT s.staff_id, s.nama, s.role, s.status,
           s.lhi_access_status, s.lhi_active_since
    FROM public.staff s
    WHERE s.status = 'Aktif'
  ),
  anchors AS (
    SELECT s.*,
      COALESCE(last_valid.created_at, s.lhi_active_since) AS anchor_at
    FROM active_staff s
    LEFT JOIN LATERAL (
      SELECT max(r.created_at) AS created_at
      FROM public.reports r
      WHERE r.staff_id = s.staff_id
        AND r.deleted_at IS NULL
        AND r.created_at >= s.lhi_active_since
    ) last_valid ON TRUE
  ),
  dated AS (
    SELECT a.*,
      (p_now AT TIME ZONE 'Asia/Jakarta')::date AS today_wib_date,
      (a.anchor_at AT TIME ZONE 'Asia/Jakarta')::date AS anchor_wib_date
    FROM anchors a
  ),
  evaluated AS (
    SELECT d.*,
      GREATEST(0, d.today_wib_date - d.anchor_wib_date - 1)::integer
        AS missed_full_days
    FROM dated d
  )
  SELECT
    e.staff_id, e.nama, e.role, e.status, e.lhi_access_status,
    e.anchor_at, e.anchor_wib_date, e.today_wib_date, e.missed_full_days,
    CASE
      WHEN e.missed_full_days >= 9 THEN 'GLOBAL_BLOCK'
      WHEN e.missed_full_days = 8 THEN 'WAITING'
      WHEN e.missed_full_days >= 7 THEN 'BLOCK_INDIVIDUAL_ACCESS'
      WHEN e.missed_full_days = 6 THEN 'WARNING_3'
      WHEN e.missed_full_days = 5 THEN 'WARNING_2'
      WHEN e.missed_full_days = 3 THEN 'WARNING_1'
      ELSE 'MONITOR'
    END
  FROM evaluated e;
$function$;

CREATE OR REPLACE FUNCTION public.run_lhi_discipline_scheduler_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_today_wib date := (v_now AT TIME ZONE 'Asia/Jakarta')::date;
  v_lock text;
  v_grace public.lhi_discipline_incidents%ROWTYPE;
  v_incident_id bigint;
  v_pending integer := 0;
  v_completed integer := 0;
  v_stage record;
  v_names text;
  v_fingerprint text;
  v_message text;
  v_rows integer := 0;
  v_blocked integer := 0;
BEGIN
  -- Serialize cron/manual invocations; transaction lock releases automatically.
  PERFORM pg_advisory_xact_lock(hashtextextended('lhi_discipline_scheduler_v2', 0));

  -- Fail closed on incomplete staff migration; never invent an anchor.
  IF EXISTS (
    SELECT 1 FROM public.staff
    WHERE status = 'Aktif' AND lhi_active_since IS NULL
  ) THEN
    RAISE EXCEPTION 'Scheduler LHI v2 dihentikan: terdapat pegawai Aktif tanpa lhi_active_since.';
  END IF;

  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konfigurasi LHI_GLOBAL_BLOCK tidak ditemukan; scheduler dihentikan.';
  END IF;

  -- There may be only one active incident at a time. Multiple LOCKED/GRACE
  -- rows indicate inconsistent legacy state and must never be guessed around.
  IF (
    SELECT count(*)
    FROM public.lhi_discipline_incidents
    WHERE status IN ('LOCKED', 'GRACE')
  ) > 1 THEN
    RAISE EXCEPTION 'Lebih dari satu insiden LHI aktif ditemukan; scheduler dihentikan untuk rekonsiliasi.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lhi_discipline_incidents WHERE status = 'LOCKED') THEN
    IF v_lock <> 'AKTIF' THEN
      RAISE EXCEPTION 'Insiden LOCKED ditemukan tetapi LHI_GLOBAL_BLOCK tidak AKTIF; perlu rekonsiliasi manual.';
    END IF;
    RETURN jsonb_build_object('ok', true, 'mode', 'GLOBAL_LOCKED');
  END IF;

  -- A GRACE incident suspends normal discipline evaluation. Evaluate only its
  -- immutable snapshot and only at/after the 12-hour deadline.
  SELECT * INTO v_grace
  FROM public.lhi_discipline_incidents
  WHERE status = 'GRACE'
  ORDER BY incident_id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_lock <> 'NONAKTIF' THEN
      RAISE EXCEPTION 'Incident GRACE ditemukan tetapi LHI_GLOBAL_BLOCK bukan NONAKTIF; evaluasi dihentikan.';
    END IF;

    -- Employment becoming NONAKTIF permanently excludes the old snapshot row.
    UPDATE public.lhi_discipline_snapshot_members m
    SET obligation_status = 'EXCLUDED_INACTIVE',
        excluded_at = v_now,
        exclusion_reason = 'EMPLOYMENT_NONACTIVE_DURING_GRACE'
    FROM public.staff s
    WHERE s.staff_id = m.staff_id
      AND m.incident_id = v_grace.incident_id
      AND m.grace_cycle = v_grace.grace_cycle
      AND m.obligation_status IN ('PENDING', 'COMPLETED')
      AND s.status <> 'Aktif';

    INSERT INTO public.lhi_discipline_obligation_events
      (member_id, event_type, event_at, old_status, new_status, details)
    SELECT m.member_id, 'EXCLUDED_INACTIVE', v_now, 'PENDING_OR_COMPLETED',
           'EXCLUDED_INACTIVE',
           jsonb_build_object('reason', m.exclusion_reason)
    FROM public.lhi_discipline_snapshot_members m
    WHERE m.incident_id = v_grace.incident_id
    AND m.grace_cycle = v_grace.grace_cycle
      AND m.obligation_status = 'EXCLUDED_INACTIVE'
      AND m.excluded_at = v_now;

    -- Recompute completion from current non-deleted reports. This reverses a
    -- completion if its only qualifying report was deleted/cancelled.
    WITH current_state AS MATERIALIZED (
      SELECT m.member_id, m.obligation_status AS old_status,
             q.report_id, q.created_at
      FROM public.lhi_discipline_snapshot_members m
      JOIN public.staff s ON s.staff_id = m.staff_id
      LEFT JOIN LATERAL (
        SELECT r.report_id, r.created_at
        FROM public.reports r
        WHERE r.staff_id = s.staff_id
          AND r.deleted_at IS NULL
          AND r.created_at >= v_grace.started_at
          AND r.created_at < v_grace.deadline_at
        ORDER BY r.created_at DESC, r.report_id DESC
        LIMIT 1
      ) q ON TRUE
      WHERE m.incident_id = v_grace.incident_id
      AND m.grace_cycle = v_grace.grace_cycle
        AND s.status = 'Aktif'
        AND m.obligation_status IN ('PENDING', 'COMPLETED')
      FOR UPDATE OF m
    ),
    changed AS (
      UPDATE public.lhi_discipline_snapshot_members m
      SET obligation_status = CASE WHEN c.report_id IS NULL THEN 'PENDING' ELSE 'COMPLETED' END,
          completed_at = CASE WHEN c.report_id IS NULL THEN NULL ELSE c.created_at END,
          qualifying_report_id = c.report_id
      FROM current_state c
      WHERE m.member_id = c.member_id
        AND (
          m.obligation_status IS DISTINCT FROM
            CASE WHEN c.report_id IS NULL THEN 'PENDING' ELSE 'COMPLETED' END
          OR m.qualifying_report_id IS DISTINCT FROM c.report_id
        )
      RETURNING m.member_id, c.old_status, m.obligation_status AS new_status,
                c.report_id
    )
    INSERT INTO public.lhi_discipline_obligation_events
      (member_id, event_type, event_at, report_id, old_status, new_status, details)
    SELECT c.member_id,
      CASE
        WHEN c.new_status = 'COMPLETED' THEN 'REPORT_QUALIFIED'
        WHEN c.old_status = 'COMPLETED' THEN 'REPORT_CANCELLED'
        ELSE 'OBLIGATION_REOPENED'
      END,
      v_now, c.report_id, c.old_status, c.new_status,
      jsonb_build_object('incident_id', v_grace.incident_id)
    FROM changed c;

    IF v_now < v_grace.deadline_at THEN
      RETURN jsonb_build_object(
        'ok', true, 'mode', 'GRACE', 'deadline_reached', false,
        'incident_id', v_grace.incident_id, 'deadline_at', v_grace.deadline_at
      );
    END IF;

    SELECT count(*)::integer INTO v_pending
    FROM public.lhi_discipline_snapshot_members m
    JOIN public.staff s ON s.staff_id = m.staff_id
    WHERE m.incident_id = v_grace.incident_id
    AND m.grace_cycle = v_grace.grace_cycle
      AND m.obligation_status = 'PENDING'
      AND s.status = 'Aktif';

    IF v_pending > 0 THEN
      UPDATE public.lhi_discipline_incidents
      SET status = 'LOCKED', locked_at = v_now, reactivated_at = v_now
      WHERE incident_id = v_grace.incident_id AND status = 'GRACE';

      UPDATE public.access_settings
      SET value = 'AKTIF', updated_at = v_now,
          updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
      WHERE key = 'LHI_GLOBAL_BLOCK';

      INSERT INTO public.audit_log
        (username, staff_id, action, keterangan, field_changed, old_value, new_value)
      VALUES
        ('SYSTEM', 'SYSTEM', 'REACTIVATE_LHI_GLOBAL_BLOCK_TIMEOUT',
         'Tenggat grace 12 jam berakhir dan masih ada kewajiban petugas Aktif yang belum dipenuhi.',
         'LHI_GLOBAL_BLOCK', 'NONAKTIF', 'AKTIF');

      INSERT INTO public.lhi_discipline_obligation_events
        (member_id, event_type, event_at, old_status, new_status, details)
      SELECT m.member_id, 'GLOBAL_RELOCKED', v_now, 'PENDING', 'PENDING',
             jsonb_build_object('incident_id', v_grace.incident_id)
      FROM public.lhi_discipline_snapshot_members m
      JOIN public.staff s ON s.staff_id = m.staff_id
      WHERE m.incident_id = v_grace.incident_id
      AND m.grace_cycle = v_grace.grace_cycle
        AND m.obligation_status = 'PENDING'
        AND s.status = 'Aktif';

      RETURN jsonb_build_object(
        'ok', true, 'mode', 'GLOBAL_RELOCKED',
        'incident_id', v_grace.incident_id, 'pending', v_pending
      );
    END IF;

    UPDATE public.lhi_discipline_incidents
    SET status = 'COMPLETED', completed_at = v_now
    WHERE incident_id = v_grace.incident_id AND status = 'GRACE';

    UPDATE public.access_settings
    SET value = 'NONAKTIF', updated_at = v_now,
        updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
    WHERE key = 'LHI_GLOBAL_BLOCK';

    INSERT INTO public.audit_log
      (username, staff_id, action, keterangan, field_changed, old_value, new_value)
    VALUES
      ('SYSTEM', 'SYSTEM', 'LHI_GLOBAL_BLOCK_COMPLETED',
       'Seluruh kewajiban snapshot petugas Aktif telah dipenuhi atau dikecualikan karena NONAKTIF setelah tenggat 12 jam.',
       'LHI_GLOBAL_BLOCK', 'AKTIF', 'NONAKTIF');

    RETURN jsonb_build_object(
      'ok', true, 'mode', 'GRACE_COMPLETED',
      'incident_id', v_grace.incident_id, 'pending', 0
    );
  END IF;

  -- If a global incident is LOCKED, do not mutate its snapshot or create
  -- duplicate incidents. Recovery is the only path to a GRACE window.
  IF v_lock = 'AKTIF' THEN
    RAISE EXCEPTION 'LHI_GLOBAL_BLOCK AKTIF tetapi incident LOCKED tidak ditemukan; perlu rekonsiliasi sebelum scheduler melanjutkan.';
  END IF;

  -- Warning broadcast per stage/date, containing all staff names for that stage.
  FOR v_stage IN
    SELECT x.stage, x.missed_full_days,
      string_agg(x.nama, ', ' ORDER BY x.nama) AS names,
      md5(string_agg(x.staff_id, ',' ORDER BY x.staff_id)) AS fingerprint
    FROM public.lhi_discipline_evaluations_v2(v_now) x
    WHERE x.stage IN ('WARNING_1', 'WARNING_2', 'WARNING_3')
    GROUP BY x.stage, x.missed_full_days
  LOOP
    v_names := v_stage.names;
    v_message := CASE v_stage.stage
      WHEN 'WARNING_1' THEN 'Peringatan 1 LHI: ' || v_names ||
        ' belum mengisi LHI selama 4 hari kalender penuh.'
      WHEN 'WARNING_2' THEN 'Peringatan 2 LHI: ' || v_names ||
        ' belum mengisi LHI selama 6 hari kalender penuh.'
      ELSE 'Peringatan 3 LHI: ' || v_names ||
        ' belum mengisi LHI selama 7 hari kalender penuh. Blokir akses individual berlaku pada hari ke-8 jika belum ada LHI sah.'
    END;

    INSERT INTO public.lhi_discipline_notifications
      (event_key, recipient_staff_id, subject, message)
    SELECT 'LHI:' || v_today_wib::text || ':' || v_stage.stage || ':TEAM:' || v_stage.fingerprint,
           s.staff_id, 'Ringkasan ' || v_stage.stage || ' LHI', v_message
    FROM public.staff s
    WHERE s.status = 'Aktif'
    ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;

    -- The team broadcast already includes every active staff member, including
    -- the delinquent staff. Do not create a second duplicate warning for them.
  END LOOP;

  -- Day 8: change access state only. Never change staff.status.
  UPDATE public.staff s
  SET lhi_access_status = 'BLOCKED_LHI',
      lhi_access_blocked_at = COALESCE(s.lhi_access_blocked_at, v_now),
      lhi_access_block_reason = 'LHI_NONCOMPLIANCE',
      updated_at = v_now
  WHERE s.status = 'Aktif'
    AND s.lhi_access_status <> 'BLOCKED_LHI'
    AND EXISTS (
      SELECT 1 FROM public.lhi_discipline_evaluations_v2(v_now) e
      WHERE e.staff_id = s.staff_id
        AND e.missed_full_days >= 7
    );
  GET DIAGNOSTICS v_blocked = ROW_COUNT;

  IF v_blocked > 0 THEN
    INSERT INTO public.audit_log
      (username, staff_id, action, keterangan, field_changed, old_value, new_value)
    SELECT 'SYSTEM', s.staff_id, 'BLOCK_LHI_INDIVIDUAL_DAY_8',
      'Hak akses aplikasi diblokir karena mencapai ambang hari ke-8 tanpa LHI sah.',
      'lhi_access_status', 'NORMAL', 'BLOCKED_LHI'
    FROM public.staff s
    WHERE s.lhi_access_status = 'BLOCKED_LHI'
      AND s.lhi_access_blocked_at = v_now;

    SELECT string_agg(s.nama, ', ' ORDER BY s.nama),
           md5(string_agg(s.staff_id, ',' ORDER BY s.staff_id))
      INTO v_names, v_fingerprint
    FROM public.staff s
    JOIN public.lhi_discipline_evaluations_v2(v_now) e ON e.staff_id = s.staff_id
    WHERE e.missed_full_days >= 7
      AND s.lhi_access_status = 'BLOCKED_LHI';

    INSERT INTO public.lhi_discipline_notifications
      (event_key, recipient_staff_id, subject, message)
    SELECT 'LHI:' || v_today_wib::text || ':INDIVIDUAL_BLOCK:TEAM:' || v_fingerprint,
      s.staff_id, 'Blokir akses LHI individual',
      'Hak akses LHI diblokir untuk: ' || v_names ||
      '. Status kepegawaian tidak berubah; akses dipisahkan dari status pegawai.'
    FROM public.staff s
    WHERE s.status = 'Aktif'
      AND COALESCE(s.lhi_access_status, 'NORMAL') <> 'BLOCKED_LHI'
    ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;
  END IF;

  -- Day 10: one global incident, one snapshot row per delinquent active staff.
  IF EXISTS (
    SELECT 1 FROM public.lhi_discipline_evaluations_v2(v_now)
    WHERE missed_full_days >= 9
  ) THEN
    UPDATE public.access_settings
    SET value = 'AKTIF', updated_at = v_now,
        updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
    WHERE key = 'LHI_GLOBAL_BLOCK';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gagal mengaktifkan LHI_GLOBAL_BLOCK; seluruh transaksi dibatalkan.';
    END IF;

    -- The LOCKED incident is only a gate. README requires the delinquent
    -- staff snapshot to be created atomically with KA IPSRS Reset, not here.
    INSERT INTO public.lhi_discipline_incidents
      (started_at, deadline_at, locked_at, status, started_by_staff_id, started_by_name)
    VALUES
      (v_now, v_now, v_now, 'LOCKED', 'SYSTEM', 'SYSTEM')
    RETURNING incident_id INTO v_incident_id;

    INSERT INTO public.audit_log
      (username, staff_id, action, keterangan, field_changed, old_value, new_value)
    VALUES
      ('SYSTEM', 'SYSTEM', 'ACTIVATE_LHI_GLOBAL_BLOCK_DAY_10',
       'Mode Blok Aplikasi aktif pada hari ke-10. Snapshot kewajiban akan dibuat atomik saat KA IPSRS menjalankan Reset.',
       'LHI_GLOBAL_BLOCK', 'NONAKTIF', 'AKTIF');

    INSERT INTO public.lhi_discipline_notifications
      (event_key, recipient_staff_id, subject, message)
    SELECT 'LHI:GLOBAL_LOCK:' || v_incident_id, s.staff_id,
      'Mode Blok Aplikasi aktif',
      'Mode Blok Aplikasi aktif karena terdapat petugas yang belum mengisi LHI selama 10 hari kalender penuh. Reset hanya dapat dilakukan melalui prosedur pemulihan KA IPSRS.'
    FROM public.staff s
    WHERE s.status = 'Aktif'
    ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'mode', CASE WHEN v_incident_id IS NULL THEN 'NORMAL' ELSE 'GLOBAL_LOCKED' END,
    'date_wib', v_today_wib, 'individual_blocks_created', v_blocked,
    'incident_id', v_incident_id
  );
END;
$function$;

-- Keep execution server-side only. Cron owner/superuser invokes the function.
REVOKE ALL ON FUNCTION public.lhi_discipline_evaluations_v2(timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.run_lhi_discipline_scheduler_v2()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

-- Before any deployment:
-- 1) Add a unique constraint to snapshot_members is already defined by schema v2.
-- 2) Confirm every active staff row has a verified lhi_active_since.
-- 3) Confirm all staff.status values are only legitimate employment statuses.
-- 4) Run SQL lint/parse and integration tests in non-production.
-- 5) Replace cron command only after recovery RPC and frontend flow are complete.
-- 6) Keep the existing five-minute cron cadence; do not add another cron.
