-- REVIEW DRAFT ONLY — NOT A DEPLOYABLE MIGRATION.
-- Atomic Reset -> 12-hour grace transaction for restricted KA IPSRS recovery.
-- Depends on:
--   1) docs/drafts/2026-11-03-lhi-restricted-recovery-challenges-review.sql (CLI-generated migration copy before deployment)
--   2) docs/drafts/2026-11-03-lhi-schema-v2-migration-review.sql
--   3) docs/drafts/2026-11-03-lhi-scheduler-v2-review.sql
-- Never execute in production. Validate only in a disposable/non-production
-- Supabase project after schema and Edge Function review.

BEGIN;

CREATE OR REPLACE FUNCTION public.open_lhi_global_grace_v2(
  p_recovery_session_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_validation jsonb;
  v_staff_id text;
  v_staff_name text;
  v_incident_id bigint;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_lock text;
  v_now timestamptz := clock_timestamp();
  v_snapshot_count integer := 0;
  v_unblocked_count integer := 0;
BEGIN
  -- Match scheduler lock ordering so recovery and cron cannot deadlock.
  PERFORM pg_advisory_xact_lock(hashtextextended('lhi_discipline_scheduler_v2', 0));

  IF p_recovery_session_token_hash IS NULL
     OR p_recovery_session_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Sesi pemulihan tidak valid.';
  END IF;

  -- Revalidate the opaque capability inside the same database transaction.
  -- This independently verifies KA_IPSRS identity, active employment,
  -- session expiry/revocation, incident binding and action allowlist.
  v_validation := public.validate_lhi_recovery_session(
    p_recovery_session_token_hash,
    'apiStartLhiGrace'
  );

  IF COALESCE((v_validation ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sesi pemulihan tidak valid atau tidak memiliki kewenangan.';
  END IF;

  v_staff_id := v_validation ->> 'staff_id';
  v_staff_name := v_validation ->> 'staff_name';
  v_incident_id := (v_validation ->> 'incident_id')::bigint;

  -- Stable lock order: global setting first, then the incident row.
  SELECT a.value INTO v_lock
  FROM public.access_settings a
  WHERE a.key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konfigurasi blokir global tidak ditemukan.';
  END IF;
  IF v_lock IS NULL OR v_lock NOT IN ('AKTIF', 'NONAKTIF') THEN
    RAISE EXCEPTION 'Status LHI_GLOBAL_BLOCK tidak valid; transaksi Reset dibatalkan.';
  END IF;

  SELECT i.* INTO v_incident
  FROM public.lhi_discipline_incidents i
  WHERE i.incident_id = v_incident_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insiden pemulihan tidak ditemukan.';
  END IF;

  -- Idempotency: a retry after a lost HTTP response returns the original
  -- grace start/deadline and never creates a second snapshot or shifts 12h.
  IF v_incident.status = 'GRACE' THEN
    IF v_lock <> 'NONAKTIF' THEN
      RAISE EXCEPTION 'Status insiden GRACE tidak konsisten dengan LHI_GLOBAL_BLOCK.';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'already_open', true,
      'incident_id', v_incident.incident_id,
      'status', v_incident.status,
      'started_at', v_incident.started_at,
      'deadline_at', v_incident.deadline_at,
      'snapshot_total', (
        SELECT count(*)::integer
        FROM public.lhi_discipline_snapshot_members m
        WHERE m.incident_id = v_incident.incident_id
          AND m.grace_cycle = v_incident.grace_cycle
      )
    );
  END IF;

  IF v_incident.status <> 'LOCKED' OR v_lock <> 'AKTIF' THEN
    RAISE EXCEPTION 'Reset hanya dapat dijalankan untuk insiden LOCKED dengan blokir global AKTIF.';
  END IF;

  -- Snapshot is created at Reset, atomically with opening grace.
  -- Legacy production LOCKED incidents already have a per-date obligation
  -- snapshot. Reuse its distinct pending staff members instead of inventing
  -- HR activation dates from staff.created_at. This is the safe bridge for
  -- the currently locked legacy incident and preserves its original duties.
  IF EXISTS (
    SELECT 1
    FROM public.lhi_discipline_obligations o
    WHERE o.incident_id = v_incident.incident_id
      AND o.completed_at IS NULL
  ) THEN
    INSERT INTO public.lhi_discipline_snapshot_members (
      incident_id, grace_cycle, staff_id, snapshot_created_at, anchor_input_at,
      missed_full_days_at_snapshot, employment_status_at_snapshot,
      obligation_status
    )
    SELECT
      v_incident.incident_id,
      v_incident.grace_cycle + 1,
      s.staff_id,
      v_now,
      NULL,
      count(DISTINCT o.required_date)::integer,
      s.status,
      'PENDING'
    FROM public.lhi_discipline_obligations o
    JOIN public.staff s ON s.staff_id = o.staff_id
    WHERE o.incident_id = v_incident.incident_id
      AND o.completed_at IS NULL
      AND s.status = 'Aktif'
    GROUP BY s.staff_id, s.status
    ON CONFLICT (incident_id, grace_cycle, staff_id) DO NOTHING;
    GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
  ELSE
    -- A new-format incident has no legacy obligations. It must use verified
    -- HR anchors and the single v2 evaluator; provisional account timestamps
    -- are never accepted as employment start dates.
    IF EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.status = 'Aktif'
        AND (s.lhi_active_since IS NULL OR s.lhi_active_since_verified_at IS NULL)
    ) THEN
      RAISE EXCEPTION 'Reset dibatalkan: pegawai Aktif memiliki anchor HR yang belum diverifikasi dan tidak tersedia snapshot kewajiban legacy.';
    END IF;

    INSERT INTO public.lhi_discipline_snapshot_members (
      incident_id, grace_cycle, staff_id, snapshot_created_at, anchor_input_at,
      missed_full_days_at_snapshot, employment_status_at_snapshot,
      obligation_status
    )
    SELECT
      v_incident.incident_id, v_incident.grace_cycle + 1, e.staff_id, v_now, e.anchor_at,
      e.missed_full_days, e.employment_status, 'PENDING'
    FROM public.lhi_discipline_evaluations_v2(v_now) e
    WHERE e.employment_status = 'Aktif'
      AND e.missed_full_days >= 9
    ON CONFLICT (incident_id, grace_cycle, staff_id) DO NOTHING;
    GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
  END IF;

  IF v_snapshot_count < 1 THEN
    RAISE EXCEPTION 'Snapshot petugas lalai tidak terbentuk. Blokir global tetap aktif.';
  END IF;

  INSERT INTO public.lhi_discipline_obligation_events (
    member_id, event_type, event_at, new_status, actor_staff_id, details
  )
  SELECT
    m.member_id, 'SNAPSHOT_CREATED', v_now, 'PENDING', v_staff_id,
    jsonb_build_object(
      'incident_id', v_incident.incident_id,
      'missed_full_days', m.missed_full_days_at_snapshot,
      'anchor_input_at', m.anchor_input_at,
      'snapshot_source', CASE
        WHEN m.anchor_input_at IS NULL THEN 'LEGACY_OBLIGATION_SNAPSHOT'
        ELSE 'KA_IPSRS_RESET'
      END
    )
  FROM public.lhi_discipline_snapshot_members m
  WHERE m.incident_id = v_incident.incident_id
    AND m.grace_cycle = v_incident.grace_cycle + 1
    AND m.snapshot_created_at = v_now;

  -- Clear LHI access blocks only. Never modify staff.status (employment).
  UPDATE public.staff s
  SET lhi_access_status = 'NORMAL',
      lhi_access_blocked_at = NULL,
      lhi_access_block_reason = NULL,
      lhi_manual_unblock_until = NULL,
      updated_at = v_now
  WHERE s.lhi_access_status = 'BLOCKED_LHI';

  GET DIAGNOSTICS v_unblocked_count = ROW_COUNT;

  UPDATE public.lhi_discipline_incidents
  SET status = 'GRACE',
      grace_cycle = v_incident.grace_cycle + 1,
      started_at = v_now,
      deadline_at = v_now + interval '12 hours',
      started_by_staff_id = v_staff_id,
      started_by_name = v_staff_name,
      completed_at = NULL,
      reactivated_at = NULL
  WHERE incident_id = v_incident.incident_id
    AND status = 'LOCKED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insiden gagal berpindah ke GRACE; seluruh perubahan dibatalkan.';
  END IF;

  UPDATE public.access_settings
  SET value = 'NONAKTIF',
      updated_at = v_now,
      updated_by_staff_id = v_staff_id,
      updated_by_name = v_staff_name
  WHERE key = 'LHI_GLOBAL_BLOCK';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blokir global gagal dinonaktifkan; seluruh perubahan dibatalkan.';
  END IF;

  -- Keep this narrowly scoped capability valid only through the current grace
  -- deadline, so a page refresh can re-authenticate KA and resume status checks.
  UPDATE private.lhi_recovery_sessions
  SET expires_at = v_now + interval '12 hours'
  WHERE token_hash = p_recovery_session_token_hash
    AND staff_id = v_staff_id
    AND incident_id = v_incident.incident_id::text
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi pemulihan gagal diperpanjang sampai tenggat grace; seluruh perubahan dibatalkan.';
  END IF;

  INSERT INTO public.audit_log (
    username, staff_id, action, report_id, keterangan,
    field_changed, old_value, new_value
  ) VALUES (
    v_staff_id, v_staff_id, 'OPEN_LHI_GLOBAL_GRACE_V2', NULL,
    'KA IPSRS terverifikasi menjalankan Reset melalui restricted recovery session. Snapshot dibuat atomik; blokir akses individual LHI dibuka tanpa mengubah status kepegawaian; grace 12 jam dimulai.',
    'LHI_GLOBAL_BLOCK,lhi_access_status,lhi_discipline_incidents.status',
    'AKTIF / LOCKED / BLOCKED_LHI',
    'NONAKTIF / GRACE / NORMAL'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_open', false,
    'incident_id', v_incident.incident_id,
    'status', 'GRACE',
    'started_at', v_now,
    'deadline_at', v_now + interval '12 hours',
    'snapshot_total', v_snapshot_count,
    'individual_access_unblocked', v_unblocked_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.open_lhi_global_grace_v2(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lhi_global_grace_v2(text)
  TO service_role;

COMMIT;

-- Required integration tests before use:
-- * valid KA_IPSRS recovery session + LOCKED incident -> exactly one GRACE and snapshot.
-- * retry while GRACE -> same started_at/deadline; no duplicate snapshot.
-- * expired/revoked session, wrong role, inactive staff, wrong incident -> rejected.
-- * individual access statuses clear, employment status values unchanged.
-- * snapshot only delinquent active staff; one member per staff/incident.
-- * any failure rolls back snapshot, unblocks, incident update and global setting.
-- * global lock remains AKTIF if snapshot is empty or any precondition fails.
