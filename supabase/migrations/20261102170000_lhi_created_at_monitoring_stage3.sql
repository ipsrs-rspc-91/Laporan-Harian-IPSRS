-- Stage 3: LHI monitoring based on server-created input time (WIB).
-- Prepared on a feature branch only. This migration is NOT applied to production.
-- Employment status remains staff.status ('Aktif'/'Nonaktif'); LHI blocking is stored separately.

ALTER TABLE public.lhi_discipline_obligations
  ADD COLUMN IF NOT EXISTS obligation_status text NOT NULL DEFAULT 'PENDING';

UPDATE public.lhi_discipline_obligations
SET obligation_status = CASE
  WHEN completed_at IS NOT NULL THEN 'FULFILLED'
  ELSE 'PENDING'
END
WHERE obligation_status IS NULL
   OR obligation_status NOT IN ('PENDING','FULFILLED','EXCLUDED_NONACTIVE');

ALTER TABLE public.lhi_discipline_obligations
  DROP CONSTRAINT IF EXISTS lhi_discipline_obligations_obligation_status_check;
ALTER TABLE public.lhi_discipline_obligations
  ADD CONSTRAINT lhi_discipline_obligations_obligation_status_check
  CHECK (obligation_status IN ('PENDING','FULFILLED','EXCLUDED_NONACTIVE'));

CREATE TABLE IF NOT EXISTS public.lhi_staff_monitoring_state (
  staff_id text PRIMARY KEY REFERENCES public.staff(staff_id) ON DELETE CASCADE,
  active_since timestamptz,
  baseline_source text NOT NULL DEFAULT 'STATUS_HISTORY',
  last_valid_input_at timestamptz,
  individual_blocked_at timestamptz,
  last_calculated_days integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.lhi_staff_monitoring_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.lhi_staff_monitoring_state
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lhi_staff_monitoring_state TO service_role;

CREATE TABLE IF NOT EXISTS public.staff_employment_status_history (
  history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id uuid,
  change_source text NOT NULL,
  is_legacy_baseline boolean NOT NULL DEFAULT false
);

ALTER TABLE public.staff_employment_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.staff_employment_status_history
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.staff_employment_status_history TO service_role;

CREATE TABLE IF NOT EXISTS public.lhi_obligation_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  obligation_id bigint NOT NULL,
  incident_id bigint NOT NULL,
  staff_id text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cause text NOT NULL,
  actor_user_id uuid
);

ALTER TABLE public.lhi_obligation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.lhi_obligation_audit
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.lhi_obligation_audit TO service_role;

-- Existing active staff have no historical activation log. Use staff.created_at
-- as a clearly-labelled legacy fallback; every future reactivation is timestamped.
INSERT INTO public.lhi_staff_monitoring_state(
  staff_id, active_since, baseline_source, last_valid_input_at, updated_at
)
SELECT
  s.staff_id,
  CASE WHEN s.status = 'Aktif' THEN s.created_at ELSE NULL END,
  CASE WHEN s.status = 'Aktif' THEN 'LEGACY_CREATED_AT_FALLBACK' ELSE 'INACTIVE' END,
  (
    SELECT max(r.created_at)
    FROM public.reports r
    WHERE r.staff_id = s.staff_id
      AND r.deleted_at IS NULL
      AND s.status = 'Aktif'
      AND r.created_at >= s.created_at
  ),
  clock_timestamp()
FROM public.staff s
ON CONFLICT (staff_id) DO NOTHING;

INSERT INTO public.staff_employment_status_history(
  staff_id, old_status, new_status, changed_at, actor_user_id,
  change_source, is_legacy_baseline
)
SELECT s.staff_id, NULL, s.status, s.created_at, NULL,
       'LEGACY_BASELINE_FROM_EXISTING_STAFF_ROW', true
FROM public.staff s
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff_employment_status_history h
  WHERE h.staff_id = s.staff_id
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.capture_staff_employment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_changed boolean;
  v_active_since timestamptz;
BEGIN
  v_changed := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;

  IF v_changed THEN
    INSERT INTO public.staff_employment_status_history(
      staff_id, old_status, new_status, changed_at, actor_user_id, change_source
    ) VALUES (
      NEW.staff_id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      clock_timestamp(),
      auth.uid(),
      CASE WHEN auth.uid() IS NULL THEN 'SYSTEM_OR_SERVICE_ROLE' ELSE 'AUTHENTICATED_USER' END
    );
  END IF;

  IF NEW.status = 'Aktif' THEN
    IF TG_OP = 'INSERT' THEN
      v_active_since := COALESCE(NEW.created_at, clock_timestamp());
    ELSIF OLD.status IS DISTINCT FROM 'Aktif' THEN
      v_active_since := clock_timestamp();
    ELSE
      v_active_since := NULL;
    END IF;

    INSERT INTO public.lhi_staff_monitoring_state(
      staff_id, active_since, baseline_source, updated_at
    ) VALUES (
      NEW.staff_id,
      COALESCE(v_active_since, NEW.created_at),
      CASE WHEN TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Aktif'
        THEN 'STATUS_ACTIVATED_AT'
        ELSE 'STATUS_HISTORY'
      END,
      clock_timestamp()
    )
    ON CONFLICT (staff_id) DO UPDATE
    SET active_since = CASE
          WHEN v_active_since IS NOT NULL THEN v_active_since
          WHEN public.lhi_staff_monitoring_state.active_since IS NULL
            THEN COALESCE(NEW.created_at, clock_timestamp())
          ELSE public.lhi_staff_monitoring_state.active_since
        END,
        baseline_source = CASE
          WHEN v_active_since IS NOT NULL THEN 'STATUS_ACTIVATED_AT'
          ELSE public.lhi_staff_monitoring_state.baseline_source
        END,
        updated_at = clock_timestamp();
  ELSIF NEW.status = 'Nonaktif' THEN
    INSERT INTO public.lhi_staff_monitoring_state(
      staff_id, active_since, baseline_source, individual_blocked_at, updated_at
    ) VALUES (NEW.staff_id, NULL, 'INACTIVE', NULL, clock_timestamp())
    ON CONFLICT (staff_id) DO UPDATE
    SET active_since = NULL,
        baseline_source = 'INACTIVE',
        individual_blocked_at = NULL,
        updated_at = clock_timestamp();

    UPDATE public.lhi_discipline_obligations o
    SET obligation_status = 'EXCLUDED_NONACTIVE',
        completed_at = COALESCE(o.completed_at, clock_timestamp())
    FROM public.lhi_discipline_incidents i
    WHERE i.incident_id = o.incident_id
      AND i.status = 'GRACE'
      AND o.staff_id = NEW.staff_id
      AND o.obligation_status IN ('PENDING','FULFILLED');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_capture_staff_employment_status_change ON public.staff;
CREATE TRIGGER trg_capture_staff_employment_status_change
AFTER INSERT OR UPDATE OF status ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.capture_staff_employment_status_change();

CREATE OR REPLACE FUNCTION public.audit_lhi_obligation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_cause text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lhi_obligation_audit(
      obligation_id, incident_id, staff_id, old_status, new_status,
      cause, actor_user_id
    ) VALUES (
      NEW.obligation_id, NEW.incident_id, NEW.staff_id, NULL,
      NEW.obligation_status, 'SNAPSHOT_CREATED', auth.uid()
    );
    RETURN NEW;
  END IF;

  IF NEW.obligation_status IS DISTINCT FROM OLD.obligation_status THEN
    v_cause := CASE
      WHEN NEW.obligation_status = 'FULFILLED' THEN 'VALID_LHI_INPUT'
      WHEN NEW.obligation_status = 'PENDING' AND OLD.obligation_status = 'FULFILLED'
        THEN 'LHI_CANCELLED_OR_INVALIDATED'
      WHEN NEW.obligation_status = 'EXCLUDED_NONACTIVE' THEN 'EMPLOYMENT_STATUS_NONACTIVE'
      ELSE 'OBLIGATION_STATUS_CHANGED'
    END;

    INSERT INTO public.lhi_obligation_audit(
      obligation_id, incident_id, staff_id, old_status, new_status,
      cause, actor_user_id
    ) VALUES (
      NEW.obligation_id, NEW.incident_id, NEW.staff_id,
      OLD.obligation_status, NEW.obligation_status, v_cause, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_lhi_obligation_status_change
  ON public.lhi_discipline_obligations;
CREATE TRIGGER trg_audit_lhi_obligation_status_change
AFTER INSERT OR UPDATE OF obligation_status
ON public.lhi_discipline_obligations
FOR EACH ROW EXECUTE FUNCTION public.audit_lhi_obligation_status_change();

CREATE OR REPLACE FUNCTION public.refresh_lhi_staff_last_valid_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_staff_id text;
  v_active_since timestamptz;
  v_latest timestamptz;
BEGIN
  v_staff_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.staff_id ELSE NEW.staff_id END;

  SELECT st.active_since INTO v_active_since
  FROM public.lhi_staff_monitoring_state st
  WHERE st.staff_id = v_staff_id;

  IF NOT FOUND THEN
    SELECT CASE WHEN s.status = 'Aktif' THEN s.created_at ELSE NULL END
    INTO v_active_since
    FROM public.staff s
    WHERE s.staff_id = v_staff_id;
  END IF;

  SELECT max(r.created_at) INTO v_latest
  FROM public.reports r
  WHERE r.staff_id = v_staff_id
    AND r.deleted_at IS NULL
    AND (v_active_since IS NULL OR r.created_at >= v_active_since);

  INSERT INTO public.lhi_staff_monitoring_state(
    staff_id, active_since, baseline_source, last_valid_input_at, updated_at
  )
  SELECT s.staff_id, v_active_since, 'REPORT_TRIGGER', v_latest, clock_timestamp()
  FROM public.staff s
  WHERE s.staff_id = v_staff_id
  ON CONFLICT (staff_id) DO UPDATE
  SET last_valid_input_at = EXCLUDED.last_valid_input_at,
      individual_blocked_at = CASE
        WHEN EXCLUDED.last_valid_input_at IS NOT NULL
         AND public.lhi_staff_monitoring_state.individual_blocked_at IS NOT NULL
         AND EXCLUDED.last_valid_input_at > public.lhi_staff_monitoring_state.individual_blocked_at
          THEN NULL
        ELSE public.lhi_staff_monitoring_state.individual_blocked_at
      END,
      updated_at = clock_timestamp();

  -- A cancellation can itself create an eighth missed calendar day.
  -- Re-run the lightweight 22-staff calculation immediately; it exits during
  -- global lock or the 12-hour grace window.
  IF TG_OP = 'UPDATE'
     AND OLD.deleted_at IS NULL
     AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.run_lhi_daily_monitoring();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_lhi_staff_last_valid_input ON public.reports;
CREATE TRIGGER trg_refresh_lhi_staff_last_valid_input
AFTER INSERT OR UPDATE OF deleted_at OR DELETE
ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.refresh_lhi_staff_last_valid_input();

CREATE OR REPLACE FUNCTION public.clear_lhi_individual_blocks_when_grace_opens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM 'GRACE' AND NEW.status = 'GRACE' THEN
    UPDATE public.lhi_staff_monitoring_state
    SET individual_blocked_at = NULL,
        updated_at = clock_timestamp()
    WHERE individual_blocked_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clear_lhi_individual_blocks_when_grace_opens
  ON public.lhi_discipline_incidents;
CREATE TRIGGER trg_clear_lhi_individual_blocks_when_grace_opens
AFTER UPDATE OF status ON public.lhi_discipline_incidents
FOR EACH ROW EXECUTE FUNCTION public.clear_lhi_individual_blocks_when_grace_opens();

CREATE OR REPLACE FUNCTION public.run_lhi_daily_monitoring()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date;
  v_mode text;
  v_staff record;
  v_manual_unblock_until timestamptz;
  v_active_since timestamptz;
  v_last_valid timestamptz;
  v_baseline_date date;
  v_days integer;
  v_blocked_at timestamptz;
  v_global_trigger boolean := false;
  v_trigger_staff_id text;
  v_trigger_staff_name text;
  v_incident_id bigint;
  v_count integer := 0;
  v_threshold integer;
  v_event_key text;
  v_message text;
BEGIN
  SELECT a.value INTO v_mode
  FROM public.access_settings a
  WHERE a.key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  IF v_mode IS DISTINCT FROM 'NONAKTIF' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'GLOBAL_BLOCK_ACTIVE_OR_UNAVAILABLE');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lhi_discipline_incidents i
    WHERE i.status = 'GRACE'
      AND i.deadline_at > clock_timestamp()
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'GRACE_WINDOW_ACTIVE');
  END IF;

  FOR v_staff IN
    SELECT s.staff_id, s.nama, s.created_at, s.lhi_manual_unblock_until
    FROM public.staff s
    WHERE s.status = 'Aktif'
    ORDER BY s.staff_id
  LOOP
    INSERT INTO public.lhi_staff_monitoring_state(
      staff_id, active_since, baseline_source, updated_at
    ) VALUES (
      v_staff.staff_id, v_staff.created_at, 'LEGACY_CREATED_AT_FALLBACK', clock_timestamp()
    )
    ON CONFLICT (staff_id) DO NOTHING;

    SELECT st.active_since, st.individual_blocked_at
    INTO v_active_since, v_blocked_at
    FROM public.lhi_staff_monitoring_state st
    WHERE st.staff_id = v_staff.staff_id
    FOR UPDATE;

    v_manual_unblock_until := v_staff.lhi_manual_unblock_until;
    IF v_active_since IS NULL THEN
      v_active_since := v_staff.created_at;
      UPDATE public.lhi_staff_monitoring_state
      SET active_since = v_active_since,
          baseline_source = 'LEGACY_CREATED_AT_FALLBACK',
          updated_at = clock_timestamp()
      WHERE staff_id = v_staff.staff_id;
    END IF;

    SELECT max(r.created_at) INTO v_last_valid
    FROM public.reports r
    WHERE r.staff_id = v_staff.staff_id
      AND r.deleted_at IS NULL
      AND r.created_at >= v_active_since;

    v_baseline_date := GREATEST(
      (v_active_since AT TIME ZONE 'Asia/Jakarta')::date,
      COALESCE((v_last_valid AT TIME ZONE 'Asia/Jakarta')::date,
               (v_active_since AT TIME ZONE 'Asia/Jakarta')::date)
    );
    v_days := GREATEST(0, v_today - v_baseline_date);

    UPDATE public.lhi_staff_monitoring_state
    SET last_valid_input_at = v_last_valid,
        last_calculated_days = v_days,
        individual_blocked_at = CASE
          WHEN v_last_valid IS NOT NULL
           AND individual_blocked_at IS NOT NULL
           AND v_last_valid > individual_blocked_at
            THEN NULL
          ELSE individual_blocked_at
        END,
        updated_at = clock_timestamp()
    WHERE staff_id = v_staff.staff_id;

    FOREACH v_threshold IN ARRAY ARRAY[4,6,7] LOOP
      IF v_days >= v_threshold THEN
        v_event_key := v_staff.staff_id || ':' || v_baseline_date::text || ':DAY_' || v_threshold;
        v_message := CASE v_threshold
          WHEN 4 THEN v_staff.nama || ' belum mengisi LHI selama 4 hari kalender berturut-turut.'
          WHEN 6 THEN v_staff.nama || ' belum mengisi LHI selama 6 hari kalender berturut-turut.'
          ELSE v_staff.nama || ' belum mengisi LHI selama 7 hari kalender berturut-turut. Hari berikutnya akan dikenai blokir individual.'
        END;

        INSERT INTO public.lhi_discipline_notifications(
          event_key, recipient_staff_id, subject, message
        )
        SELECT v_event_key, s.staff_id,
               'Peringatan LHI Hari ke-' || v_threshold, v_message
        FROM public.staff s
        WHERE s.status = 'Aktif'
        ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;
      END IF;
    END LOOP;

    IF v_days >= 8 AND v_blocked_at IS NULL
       AND (v_manual_unblock_until IS NULL OR v_manual_unblock_until <= clock_timestamp()) THEN
      UPDATE public.lhi_staff_monitoring_state
      SET individual_blocked_at = clock_timestamp(),
          updated_at = clock_timestamp()
      WHERE staff_id = v_staff.staff_id
        AND individual_blocked_at IS NULL;

      v_event_key := v_staff.staff_id || ':' || v_baseline_date::text || ':DAY_8';
      INSERT INTO public.lhi_discipline_notifications(
        event_key, recipient_staff_id, subject, message
      )
      SELECT v_event_key, s.staff_id,
             'Petugas diblokir karena tidak mengisi LHI',
             v_staff.nama || ' mencapai hari ke-8 tanpa LHI valid dan telah diblokir secara individual.'
      FROM public.staff s
      WHERE s.status = 'Aktif'
        AND s.staff_id <> v_staff.staff_id
      ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;
    END IF;

    IF v_days >= 10 AND NOT v_global_trigger THEN
      v_global_trigger := true;
      v_trigger_staff_id := v_staff.staff_id;
      v_trigger_staff_name := v_staff.nama;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_global_trigger THEN
    SELECT a.value INTO v_mode
    FROM public.access_settings a
    WHERE a.key = 'LHI_GLOBAL_BLOCK'
    FOR UPDATE;

    IF v_mode = 'NONAKTIF'
       AND NOT EXISTS (
         SELECT 1 FROM public.lhi_discipline_incidents i
         WHERE i.status IN ('LOCKED','GRACE')
       ) THEN
      INSERT INTO public.lhi_discipline_incidents(
        started_at, deadline_at, status, started_by_staff_id, started_by_name
      ) VALUES (
        clock_timestamp(), clock_timestamp() + interval '12 hours',
        'LOCKED', 'SYSTEM', 'SYSTEM'
      )
      RETURNING incident_id INTO v_incident_id;

      INSERT INTO public.lhi_discipline_obligations(
        incident_id, staff_id, required_date, obligation_status
      )
      SELECT v_incident_id, s.staff_id, v_today, 'PENDING'
      FROM public.staff s
      JOIN public.lhi_staff_monitoring_state st ON st.staff_id = s.staff_id
      WHERE s.status = 'Aktif'
        AND v_today - GREATEST(
          (st.active_since AT TIME ZONE 'Asia/Jakarta')::date,
          COALESCE((st.last_valid_input_at AT TIME ZONE 'Asia/Jakarta')::date,
                   (st.active_since AT TIME ZONE 'Asia/Jakarta')::date)
        ) >= 10
      ON CONFLICT (incident_id, staff_id, required_date) DO NOTHING;

      UPDATE public.access_settings
      SET value = 'AKTIF',
          updated_at = clock_timestamp(),
          updated_by_staff_id = 'SYSTEM',
          updated_by_name = 'SYSTEM'
      WHERE key = 'LHI_GLOBAL_BLOCK';

      INSERT INTO public.audit_log(
        username, staff_id, action, report_id, keterangan,
        field_changed, old_value, new_value
      ) VALUES (
        'SYSTEM', v_trigger_staff_id, 'ACTIVATE_LHI_GLOBAL_BLOCK_DAY_10', NULL,
        'Mode Blok Aplikasi global diaktifkan karena ' || v_trigger_staff_name ||
        ' mencapai 10 hari kalender tanpa LHI valid berdasarkan created_at WIB.',
        'LHI_GLOBAL_BLOCK', 'NONAKTIF', 'AKTIF'
      );

      INSERT INTO public.lhi_discipline_notifications(
        event_key, recipient_staff_id, subject, message
      )
      SELECT 'INCIDENT:' || v_incident_id || ':GLOBAL_LOCK',
             s.staff_id, 'Mode Blok Aplikasi aktif',
             'Mode Blok Aplikasi aktif karena ' || v_trigger_staff_name ||
             ' mencapai 10 hari kalender tanpa LHI valid. Hanya KA IPSRS yang dapat memulai pemulihan.'
      FROM public.staff s
      WHERE s.status = 'Aktif'
      ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'date_wib', v_today,
    'processed_active_staff', v_count,
    'global_block_triggered', v_global_trigger
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_lhi_discipline_scheduler()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_mode text;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_pending integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT a.value INTO v_mode
  FROM public.access_settings a
  WHERE a.key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  SELECT i.* INTO v_incident
  FROM public.lhi_discipline_incidents i
  WHERE i.status = 'GRACE'
  ORDER BY i.incident_id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'grace_active', false);
  END IF;

  -- A staff member who becomes NONAKTIF during grace is permanently excluded
  -- from this incident; the original snapshot row remains for audit.
  UPDATE public.lhi_discipline_obligations o
  SET obligation_status = 'EXCLUDED_NONACTIVE',
      completed_at = COALESCE(o.completed_at, v_now)
  FROM public.staff s
  WHERE s.staff_id = o.staff_id
    AND o.incident_id = v_incident.incident_id
    AND s.status = 'Nonaktif'
    AND o.obligation_status IN ('PENDING','FULFILLED');

  -- Validity is based on successful input time (created_at), not work date.
  -- Recalculate every cycle so cancellation can return FULFILLED to PENDING.
  UPDATE public.lhi_discipline_obligations o
  SET obligation_status = CASE WHEN EXISTS (
        SELECT 1
        FROM public.reports r
        WHERE r.staff_id = o.staff_id
          AND r.deleted_at IS NULL
          AND r.created_at >= v_incident.started_at
          AND r.created_at < v_incident.deadline_at
      ) THEN 'FULFILLED' ELSE 'PENDING' END,
      completed_at = CASE WHEN EXISTS (
        SELECT 1
        FROM public.reports r
        WHERE r.staff_id = o.staff_id
          AND r.deleted_at IS NULL
          AND r.created_at >= v_incident.started_at
          AND r.created_at < v_incident.deadline_at
      ) THEN COALESCE(o.completed_at, v_now) ELSE NULL END
  WHERE o.incident_id = v_incident.incident_id
    AND o.obligation_status IN ('PENDING','FULFILLED');

  IF v_now < v_incident.deadline_at THEN
    RETURN jsonb_build_object(
      'ok', true, 'grace_active', true,
      'incident_id', v_incident.incident_id,
      'deadline_at', v_incident.deadline_at
    );
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.lhi_discipline_obligations o
  WHERE o.incident_id = v_incident.incident_id
    AND o.obligation_status = 'PENDING';

  IF v_pending = 0 THEN
    UPDATE public.lhi_discipline_incidents
    SET status = 'COMPLETED', completed_at = v_now
    WHERE incident_id = v_incident.incident_id
      AND status = 'GRACE';

    UPDATE public.access_settings
    SET value = 'NONAKTIF',
        updated_at = v_now,
        updated_by_staff_id = 'SYSTEM',
        updated_by_name = 'SYSTEM'
    WHERE key = 'LHI_GLOBAL_BLOCK';

    INSERT INTO public.audit_log(
      username, staff_id, action, report_id, keterangan,
      field_changed, old_value, new_value
    ) VALUES (
      'SYSTEM', 'SYSTEM', 'LHI_GLOBAL_BLOCK_COMPLETED', NULL,
      'Seluruh petugas dalam snapshot telah memenuhi kewajiban atau dikecualikan karena status NONAKTIF sebelum tenggat.',
      'LHI_GLOBAL_BLOCK', 'AKTIF', 'NONAKTIF'
    );
  ELSE
    UPDATE public.lhi_discipline_incidents
    SET status = 'EXPIRED', reactivated_at = v_now
    WHERE incident_id = v_incident.incident_id
      AND status = 'GRACE';

    UPDATE public.access_settings
    SET value = 'AKTIF',
        updated_at = v_now,
        updated_by_staff_id = 'SYSTEM',
        updated_by_name = 'SYSTEM'
    WHERE key = 'LHI_GLOBAL_BLOCK';

    INSERT INTO public.audit_log(
      username, staff_id, action, report_id, keterangan,
      field_changed, old_value, new_value
    ) VALUES (
      'SYSTEM', 'SYSTEM', 'REACTIVATE_LHI_GLOBAL_BLOCK_TIMEOUT', NULL,
      'Masa kelonggaran 12 jam berakhir dan masih terdapat ' || v_pending ||
      ' kewajiban LHI yang belum dipenuhi.',
      'LHI_GLOBAL_BLOCK', 'NONAKTIF', 'AKTIF'
    );

    INSERT INTO public.lhi_discipline_notifications(
      event_key, recipient_staff_id, subject, message
    )
    SELECT 'INCIDENT:' || v_incident.incident_id || ':GRACE_EXPIRED',
           s.staff_id, 'Mode Blok Aplikasi diaktifkan kembali',
           'Masa kelonggaran 12 jam berakhir. Masih ada ' || v_pending ||
           ' kewajiban LHI yang belum dipenuhi. Mode Blok Aplikasi kembali AKTIF.'
    FROM public.staff s
    WHERE s.status = 'Aktif'
    ON CONFLICT (event_key, recipient_staff_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'grace_active', false,
    'incident_id', v_incident.incident_id,
    'pending', v_pending,
    'final_status', CASE WHEN v_pending = 0 THEN 'COMPLETED' ELSE 'EXPIRED' END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.run_lhi_daily_monitoring() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_lhi_discipline_scheduler() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_lhi_daily_monitoring() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_lhi_discipline_scheduler() TO service_role;

-- Keep the existing five-minute cron only for the 12-hour grace deadline.
-- Run the heavier streak calculation once daily at 00:05 WIB (17:05 UTC).
DO $block$
DECLARE
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'lhi-daily-monitoring-wib'
  ) THEN
    PERFORM cron.schedule(
      'lhi-daily-monitoring-wib',
      '0 17 * * *',
      'select public.run_lhi_daily_monitoring();'
    );
  END IF;
END;
$block$;

COMMENT ON TABLE public.lhi_staff_monitoring_state IS
  'State pemantauan LHI per petugas. Baseline aktif lama memakai staff.created_at sebagai fallback yang ditandai LEGACY_CREATED_AT_FALLBACK.';
COMMENT ON TABLE public.staff_employment_status_history IS
  'Riwayat append-only perubahan status kepegawaian Aktif/Nonaktif; terpisah dari blokir LHI.';
COMMENT ON TABLE public.lhi_obligation_audit IS
  'Audit append-only perubahan kewajiban snapshot kelonggaran LHI.';
