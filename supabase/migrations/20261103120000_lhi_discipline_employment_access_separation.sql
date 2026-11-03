-- LHI discipline model v2: separate employment status from application access.
-- This migration is staged on a non-production branch; do not apply to production
-- until the full reset/recovery path and acceptance suite are approved.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS lhi_access_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lhi_monitoring_since timestamptz,
  ADD COLUMN IF NOT EXISTS lhi_access_blocked_at timestamptz;

UPDATE public.staff
SET lhi_monitoring_since = COALESCE(lhi_monitoring_since, created_at, now())
WHERE lhi_monitoring_since IS NULL;

-- Legacy LHI discipline status was incorrectly stored in the employment-status column.
-- Preserve its access restriction in the new column, then restore employment status.
UPDATE public.staff
SET lhi_access_blocked = true,
    lhi_access_blocked_at = COALESCE(lhi_access_blocked_at, updated_at, now()),
    status = 'Aktif'
WHERE status IN ('Nonaktif_LHI_HARI_8', 'DIBLOKIR_LHI_7_HARI');

ALTER TABLE public.staff
  ALTER COLUMN lhi_monitoring_since SET DEFAULT now(),
  ALTER COLUMN lhi_monitoring_since SET NOT NULL;

ALTER TABLE public.lhi_discipline_obligations
  ADD COLUMN IF NOT EXISTS obligation_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluded_reason text;

ALTER TABLE public.lhi_discipline_obligations
  DROP CONSTRAINT IF EXISTS lhi_discipline_obligations_status_check;
ALTER TABLE public.lhi_discipline_obligations
  ADD CONSTRAINT lhi_discipline_obligations_status_check
  CHECK (obligation_status IN ('PENDING','COMPLETED','EXCLUDED'));

CREATE TABLE IF NOT EXISTS public.lhi_discipline_events (
  event_id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  staff_id text,
  incident_id bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lhi_discipline_events_staff_created
  ON public.lhi_discipline_events(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lhi_discipline_events_incident_created
  ON public.lhi_discipline_events(incident_id, created_at DESC);

ALTER TABLE public.lhi_discipline_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lhi_discipline_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.lhi_discipline_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.lhi_discipline_events_event_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.reject_lhi_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Riwayat peristiwa disiplin LHI bersifat append-only.';
END;
$$;

DROP TRIGGER IF EXISTS trg_lhi_discipline_events_immutable ON public.lhi_discipline_events;
CREATE TRIGGER trg_lhi_discipline_events_immutable
BEFORE UPDATE OR DELETE ON public.lhi_discipline_events
FOR EACH ROW EXECUTE FUNCTION public.reject_lhi_event_mutation();

CREATE OR REPLACE FUNCTION public.lhi_days_without_valid_report(
  p_staff_id text,
  p_as_of timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff public.staff%ROWTYPE;
  v_today date;
  v_anchor date;
  v_last_input date;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE staff_id = p_staff_id;
  IF NOT FOUND OR v_staff.status <> 'Aktif' THEN
    RETURN NULL;
  END IF;

  v_today := (p_as_of AT TIME ZONE 'Asia/Jakarta')::date;
  v_anchor := (v_staff.lhi_monitoring_since AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT max((r.created_at AT TIME ZONE 'Asia/Jakarta')::date)
  INTO v_last_input
  FROM public.reports r
  WHERE r.staff_id = p_staff_id
    AND r.deleted_at IS NULL
    AND r.created_at >= v_staff.lhi_monitoring_since;

  v_anchor := GREATEST(v_anchor, COALESCE(v_last_input, v_anchor));
  RETURN GREATEST(0, v_today - v_anchor - 1);
END;
$$;

REVOKE ALL ON FUNCTION public.lhi_days_without_valid_report(text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lhi_days_without_valid_report(text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.track_lhi_staff_employment_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lhi_monitoring_since IS NULL THEN
      NEW.lhi_monitoring_since := COALESCE(NEW.created_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status <> 'Aktif' AND NEW.status = 'Aktif' THEN
      NEW.lhi_monitoring_since := now();
      -- Reactivation resets the individual LHI application restriction.
      NEW.lhi_access_blocked := false;
      NEW.lhi_access_blocked_at := NULL;
    ELSIF OLD.status = 'Aktif' AND NEW.status <> 'Aktif' THEN
      -- Employment deactivation is not an LHI application-block action.
      NEW.lhi_access_blocked := false;
      NEW.lhi_access_blocked_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_lhi_staff_employment_transition ON public.staff;
CREATE TRIGGER trg_track_lhi_staff_employment_transition
BEFORE INSERT OR UPDATE OF status ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.track_lhi_staff_employment_transition();

CREATE OR REPLACE FUNCTION public.log_lhi_staff_employment_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.lhi_discipline_events(event_type,staff_id,details)
    VALUES (
      'EMPLOYMENT_STATUS_CHANGED',
      NEW.staff_id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'monitoring_since', NEW.lhi_monitoring_since,
        'individual_access_unblocked', OLD.lhi_access_blocked AND NOT NEW.lhi_access_blocked
      )
    );

    IF OLD.status = 'Aktif' AND NEW.status <> 'Aktif' THEN
      UPDATE public.lhi_discipline_obligations
      SET obligation_status = 'EXCLUDED',
          excluded_at = now(),
          excluded_reason = 'DIKECUALIKAN — STATUS NONAKTIF'
      WHERE staff_id = NEW.staff_id
        AND obligation_status <> 'EXCLUDED'
        AND incident_id IN (
          SELECT incident_id FROM public.lhi_discipline_incidents WHERE status = 'GRACE'
        );
    END IF;
  END IF;

  IF OLD.lhi_access_blocked IS DISTINCT FROM NEW.lhi_access_blocked THEN
    INSERT INTO public.lhi_discipline_events(event_type,staff_id,details)
    VALUES (
      CASE WHEN NEW.lhi_access_blocked THEN 'INDIVIDUAL_ACCESS_BLOCKED' ELSE 'INDIVIDUAL_ACCESS_UNBLOCKED' END,
      NEW.staff_id,
      jsonb_build_object('old_value',OLD.lhi_access_blocked,'new_value',NEW.lhi_access_blocked)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lhi_staff_employment_transition ON public.staff;
CREATE TRIGGER trg_log_lhi_staff_employment_transition
AFTER UPDATE OF status, lhi_access_blocked ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.log_lhi_staff_employment_transition();

CREATE OR REPLACE FUNCTION public.run_lhi_discipline_scheduler()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_staff record;
  v_days integer;
  v_stage integer;
  v_anchor_date date;
  v_event text;
  v_message text;
  v_recipient record;
  v_incident bigint;
  v_deadline timestamptz;
  v_pending integer;
  v_completed integer;
  v_excluded integer;
  v_notifications integer := 0;
  v_blocked integer := 0;
  v_global_activated boolean := false;
  v_grace bigint;
BEGIN
  -- During a grace window, excluded staff remain in the original snapshot for audit,
  -- but their obligations no longer count toward the global recovery decision.
  SELECT incident_id, deadline_at INTO v_grace, v_deadline
  FROM public.lhi_discipline_incidents
  WHERE status = 'GRACE'
  ORDER BY incident_id DESC LIMIT 1
  FOR UPDATE;

  IF v_grace IS NOT NULL THEN
    UPDATE public.lhi_discipline_obligations o
    SET obligation_status = 'EXCLUDED',
        excluded_at = COALESCE(excluded_at, now()),
        excluded_reason = COALESCE(excluded_reason, 'DIKECUALIKAN — STATUS NONAKTIF')
    FROM public.staff s
    WHERE o.incident_id = v_grace
      AND o.staff_id = s.staff_id
      AND s.status <> 'Aktif'
      AND o.obligation_status <> 'EXCLUDED';

    UPDATE public.lhi_discipline_obligations o
    SET obligation_status = 'PENDING',
        completed_at = NULL
    WHERE o.incident_id = v_grace
      AND o.obligation_status = 'COMPLETED'
      AND NOT EXISTS (
        SELECT 1
        FROM public.lhi_discipline_incidents i
        JOIN public.reports r ON r.staff_id = o.staff_id
        WHERE i.incident_id = o.incident_id
          AND i.status = 'GRACE'
          AND r.deleted_at IS NULL
          AND r.created_at >= i.started_at
          AND r.created_at < i.deadline_at
      );

    UPDATE public.lhi_discipline_obligations o
    SET obligation_status = 'COMPLETED',
        completed_at = now()
    WHERE o.incident_id = v_grace
      AND o.obligation_status = 'PENDING'
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.staff_id = o.staff_id AND s.status = 'Aktif'
      )
      AND EXISTS (
        SELECT 1
        FROM public.lhi_discipline_incidents i
        JOIN public.reports r ON r.staff_id = o.staff_id
        WHERE i.incident_id = o.incident_id
          AND i.status = 'GRACE'
          AND r.deleted_at IS NULL
          AND r.created_at >= i.started_at
          AND r.created_at < i.deadline_at
      );

    SELECT count(*) FILTER (WHERE obligation_status = 'PENDING'),
           count(*) FILTER (WHERE obligation_status = 'COMPLETED'),
           count(*) FILTER (WHERE obligation_status = 'EXCLUDED')
    INTO v_pending, v_completed, v_excluded
    FROM public.lhi_discipline_obligations
    WHERE incident_id = v_grace;

    IF now() >= v_deadline THEN
      IF v_pending = 0 THEN
        UPDATE public.lhi_discipline_incidents
        SET status = 'COMPLETED', completed_at = now()
        WHERE incident_id = v_grace AND status = 'GRACE';

        UPDATE public.access_settings
        SET value = 'NONAKTIF', updated_at = now(),
            updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
        WHERE key = 'LHI_GLOBAL_BLOCK';

        INSERT INTO public.lhi_discipline_events(event_type,incident_id,details)
        VALUES ('GLOBAL_BLOCK_RECOVERY_COMPLETED',v_grace,
          jsonb_build_object('completed',v_completed,'excluded',v_excluded,'pending',v_pending));
      ELSE
        UPDATE public.lhi_discipline_incidents
        SET status = 'EXPIRED', reactivated_at = now()
        WHERE incident_id = v_grace AND status = 'GRACE';

        UPDATE public.access_settings
        SET value = 'AKTIF', updated_at = now(),
            updated_by_staff_id = 'SYSTEM', updated_by_name = 'SYSTEM'
        WHERE key = 'LHI_GLOBAL_BLOCK';

        INSERT INTO public.lhi_discipline_events(event_type,incident_id,details)
        VALUES ('GLOBAL_BLOCK_REACTIVATED_TIMEOUT',v_grace,
          jsonb_build_object('completed',v_completed,'excluded',v_excluded,'pending',v_pending));

        INSERT INTO public.lhi_discipline_notifications(event_key,recipient_staff_id,subject,message)
        SELECT 'INCIDENT:'||v_grace||':GRACE_EXPIRED',s.staff_id,
          'Mode Blok Aplikasi diaktifkan kembali',
          'Masa kelonggaran 12 jam berakhir. Masih ada '||v_pending||
          ' kewajiban LHI dari petugas yang masih aktif dan belum dikecualikan.'
        FROM public.staff s
        WHERE s.status = 'Aktif' OR s.role = 'KA_IPSRS'
        ON CONFLICT(event_key,recipient_staff_id) DO NOTHING;
      END IF;
    END IF;

    RETURN jsonb_build_object('ok',true,'date_wib',v_today,'grace_incident',v_grace,
      'pending',v_pending,'completed',v_completed,'excluded',v_excluded,
      'notifications',0,'individual_blocks',0,'global_activated',false);
  END IF;

  -- Individual compliance: only employment-active staff are monitored.
  -- The latest valid created_at (WIB) after the current active-period start is the anchor.
  FOR v_staff IN
    SELECT staff_id,nama,role,status,lhi_access_blocked,lhi_monitoring_since
    FROM public.staff
    WHERE status = 'Aktif'
      AND COALESCE(role,'') <> 'KA_IPSRS'
    ORDER BY nama
  LOOP
    v_days := public.lhi_days_without_valid_report(v_staff.staff_id,now());
    IF v_days IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(
      max((r.created_at AT TIME ZONE 'Asia/Jakarta')::date),
      (v_staff.lhi_monitoring_since AT TIME ZONE 'Asia/Jakarta')::date
    ) INTO v_anchor_date
    FROM public.reports r
    WHERE r.staff_id = v_staff.staff_id
      AND r.deleted_at IS NULL
      AND r.created_at >= v_staff.lhi_monitoring_since;

    IF v_days IN (4,6,7) THEN
      v_stage := v_days;
      v_event := v_staff.staff_id||':'||v_anchor_date::text||':DAY_'||v_stage;

      v_message := CASE v_stage
        WHEN 4 THEN 'Peringatan 1: '||v_staff.nama||
          ' belum mengisi LHI selama 4 hari kalender penuh. Mohon segera mengingatkan dan melengkapi LHI.'
        WHEN 6 THEN 'Peringatan 2: '||v_staff.nama||
          ' belum mengisi LHI selama 6 hari kalender penuh. Mohon segera mengingatkan dan melengkapi LHI.'
        ELSE 'Peringatan 3: '||v_staff.nama||
          ' belum mengisi LHI selama 7 hari kalender penuh. Jika besok belum mengisi, hak akses aplikasinya akan diblokir.'
      END;

      INSERT INTO public.lhi_discipline_notifications(event_key,recipient_staff_id,subject,message)
      SELECT v_event,s.staff_id,'Peringatan LHI Hari ke-'||v_stage,v_message
      FROM public.staff s
      WHERE s.status = 'Aktif' OR s.staff_id = v_staff.staff_id
      ON CONFLICT(event_key,recipient_staff_id) DO NOTHING;
      GET DIAGNOSTICS v_notifications = ROW_COUNT;

      IF v_notifications > 0 THEN
        INSERT INTO public.lhi_discipline_events(event_type,staff_id,details)
        VALUES ('WARNING_DAY_'||v_stage,v_staff.staff_id,
          jsonb_build_object('days_without_lhi',v_days,'anchor_date',v_anchor_date,
            'event_key',v_event));
      END IF;
    END IF;

    IF v_days >= 8 AND NOT v_staff.lhi_access_blocked THEN
      UPDATE public.staff
      SET lhi_access_blocked = true,
          lhi_access_blocked_at = now()
      WHERE staff_id = v_staff.staff_id
        AND status = 'Aktif'
        AND lhi_access_blocked = false;
      GET DIAGNOSTICS v_blocked = ROW_COUNT;

      IF v_blocked > 0 THEN
        v_event := v_staff.staff_id||':'||v_anchor_date::text||':DAY_8';
        INSERT INTO public.lhi_discipline_notifications(event_key,recipient_staff_id,subject,message)
        SELECT v_event,s.staff_id,'Hak akses aplikasi petugas diblokir',
          'Hak akses aplikasi '||v_staff.nama||
          ' telah diblokir pada hari ke-8 karena belum mengisi LHI selama 7 hari kalender penuh.'
        FROM public.staff s
        WHERE s.status = 'Aktif' AND s.staff_id <> v_staff.staff_id
        ON CONFLICT(event_key,recipient_staff_id) DO NOTHING;

        INSERT INTO public.lhi_discipline_events(event_type,staff_id,details)
        VALUES ('INDIVIDUAL_ACCESS_BLOCKED_DAY_8',v_staff.staff_id,
          jsonb_build_object('days_without_lhi',v_days,'blocked_at',now()));
      END IF;
    END IF;

    IF v_days >= 10
       AND COALESCE((SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK'),'NONAKTIF') <> 'AKTIF'
       AND NOT EXISTS (SELECT 1 FROM public.lhi_discipline_incidents WHERE status IN ('LOCKED','GRACE')) THEN

      INSERT INTO public.access_settings(key,value,updated_at,updated_by_staff_id,updated_by_name)
      VALUES('LHI_GLOBAL_BLOCK','AKTIF',now(),'SYSTEM','SYSTEM')
      ON CONFLICT(key) DO UPDATE SET value='AKTIF',updated_at=excluded.updated_at,
        updated_by_staff_id='SYSTEM',updated_by_name='SYSTEM';

      INSERT INTO public.lhi_discipline_incidents(started_at,deadline_at,status,started_by_staff_id,started_by_name)
      VALUES(now(),now()+interval '12 hours','LOCKED','SYSTEM','SYSTEM')
      RETURNING incident_id INTO v_incident;

      -- One obligation per delinquent active employee, not one obligation per missed day.
      INSERT INTO public.lhi_discipline_obligations(incident_id,staff_id,required_date,obligation_status)
      SELECT v_incident,s.staff_id,v_today,'PENDING'
      FROM public.staff s
      WHERE s.status = 'Aktif'
        AND COALESCE(s.role,'') <> 'KA_IPSRS'
        AND (
          s.lhi_access_blocked = true
          OR public.lhi_days_without_valid_report(s.staff_id,now()) >= 8
        )
      ON CONFLICT(incident_id,staff_id,required_date) DO NOTHING;

      INSERT INTO public.lhi_discipline_events(event_type,staff_id,incident_id,details)
      VALUES ('GLOBAL_BLOCK_ACTIVATED_DAY_10',v_staff.staff_id,v_incident,
        jsonb_build_object('trigger_staff_id',v_staff.staff_id,'trigger_staff_name',v_staff.nama,
          'days_without_lhi',v_days,'snapshot_created_at',now()));

      INSERT INTO public.lhi_discipline_notifications(event_key,recipient_staff_id,subject,message)
      SELECT 'INCIDENT:'||v_incident||':GLOBAL_LOCK',s.staff_id,
        'Mode Blok Aplikasi aktif',
        'Mode Blok Aplikasi aktif secara global karena '||v_staff.nama||
        ' mencapai hari ke-10 tanpa LHI sah. Hanya KA IPSRS dapat melanjutkan melalui prosedur Reset.'
      FROM public.staff s
      WHERE s.status = 'Aktif' OR s.role = 'KA_IPSRS'
      ON CONFLICT(event_key,recipient_staff_id) DO NOTHING;

      v_global_activated := true;
      EXIT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'date_wib',v_today,'processed',true,
    'notifications',v_notifications,'individual_blocks',v_blocked,
    'global_activated',v_global_activated);
END;
$$;

REVOKE ALL ON FUNCTION public.run_lhi_discipline_scheduler() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_lhi_discipline_scheduler() TO service_role;

-- Recovery transaction: restore only application access flags; never rewrite employment status.
CREATE OR REPLACE FUNCTION public.open_lhi_global_grace(
  p_staff_id text,
  p_staff_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock text;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_total integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  IF v_lock = 'NONAKTIF' THEN
    SELECT * INTO v_incident
    FROM public.lhi_discipline_incidents
    WHERE status = 'GRACE'
    ORDER BY incident_id DESC LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      SELECT count(*) INTO v_total
      FROM public.lhi_discipline_obligations
      WHERE incident_id = v_incident.incident_id;
      RETURN jsonb_build_object('ok',true,'already_open',true,
        'incident_id',v_incident.incident_id,'status',v_incident.status,
        'started_at',v_incident.started_at,'deadline_at',v_incident.deadline_at,
        'total',v_total);
    END IF;
  END IF;

  IF v_lock IS DISTINCT FROM 'AKTIF' THEN
    RAISE EXCEPTION 'Mode Blok Aplikasi tidak dalam kondisi terkunci.';
  END IF;

  SELECT * INTO v_incident
  FROM public.lhi_discipline_incidents
  WHERE status = 'LOCKED'
  ORDER BY incident_id DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insiden blokir global tidak ditemukan. Tidak ada status akses yang diubah.';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.lhi_discipline_obligations
  WHERE incident_id = v_incident.incident_id
    AND obligation_status = 'PENDING';

  IF v_total < 1 THEN
    RAISE EXCEPTION 'Snapshot kewajiban aktif tidak ditemukan. Blokir tetap aktif.';
  END IF;

  UPDATE public.staff
  SET lhi_access_blocked = false,
      lhi_access_blocked_at = NULL
  WHERE lhi_access_blocked = true;

  UPDATE public.lhi_discipline_incidents
  SET status = 'GRACE',
      started_at = v_now,
      deadline_at = v_now + interval '12 hours',
      started_by_staff_id = p_staff_id,
      started_by_name = p_staff_name,
      completed_at = NULL,
      reactivated_at = NULL
  WHERE incident_id = v_incident.incident_id;

  UPDATE public.access_settings
  SET value = 'NONAKTIF', updated_at = v_now,
      updated_by_staff_id = p_staff_id, updated_by_name = p_staff_name
  WHERE key = 'LHI_GLOBAL_BLOCK';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status blokir global gagal diperbarui.';
  END IF;

  INSERT INTO public.lhi_discipline_events(event_type,staff_id,incident_id,details)
  VALUES ('GLOBAL_BLOCK_RECOVERY_STARTED',p_staff_id,v_incident.incident_id,
    jsonb_build_object('started_at',v_now,'deadline_at',v_now+interval '12 hours',
      'snapshot_obligations',v_total));

  INSERT INTO public.audit_log(username,staff_id,action,report_id,keterangan,field_changed,old_value,new_value)
  VALUES(p_staff_id,p_staff_id,'OPEN_LHI_GLOBAL_GRACE',NULL,
    'KA IPSRS membuka blokir aplikasi global dan seluruh blokir akses individual; status kepegawaian tidak diubah.',
    'LHI_GLOBAL_BLOCK,lhi_access_blocked','AKTIF / true','NONAKTIF / false');

  RETURN jsonb_build_object('ok',true,'already_open',false,
    'incident_id',v_incident.incident_id,'status','GRACE',
    'started_at',v_now,'deadline_at',v_now+interval '12 hours','total',v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.open_lhi_global_grace(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lhi_global_grace(text,text) TO service_role;
