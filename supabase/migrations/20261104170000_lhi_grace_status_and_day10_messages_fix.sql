-- Correct grace member aggregation and align scheduler audit/notification text with its live day-10 threshold.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
    INTO v_definition;

  v_old := 'REACTIVATE_LHI_STAFF_DAY_9';
  v_new := 'REACTIVATE_LHI_STAFF_DAY_10';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Expected day-9 reactivation audit action not found'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'ACTIVATE_LHI_GLOBAL_BLOCK_DAY_9';
  v_new := 'ACTIVATE_LHI_GLOBAL_BLOCK_DAY_10';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Expected day-9 global audit action not found'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'mencapai 9 hari kalender tanpa LHI';
  v_new := 'mencapai 10 hari kalender tanpa LHI';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Expected day-9 audit message not found'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'tidak mengisi LHI selama 9 hari kalender berturut-turut';
  v_new := 'tidak mengisi LHI selama 10 hari kalender berturut-turut';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Expected day-9 notification message not found'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'generate_series(v_today-8,v_today,interval ''1 day'')';
  v_new := 'generate_series(v_today-9,v_today,interval ''1 day'')';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Expected 9-day snapshot window not found'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'rolling 9-day incident window';
  v_new := 'rolling 10-day incident window';
  IF position(v_old IN v_definition)>0 THEN
    v_definition := replace(v_definition,v_old,v_new);
  END IF;

  EXECUTE v_definition;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.get_lhi_grace_status_v2()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH latest AS (
    SELECT *
    FROM public.lhi_discipline_incidents
    WHERE status IN ('LOCKED','EXPIRED','GRACE')
    ORDER BY incident_id DESC
    LIMIT 1
  ),
  members AS (
    SELECT
      o.staff_id,
      max(s.nama) AS nama,
      max(s.status) AS employment_status,
      max(o.completed_at) FILTER (WHERE o.completed_at IS NOT NULL) AS completed_at,
      bool_or(
        o.completed_at IS NULL
        AND o.excluded_at IS NULL
        AND s.status = 'Aktif'
      ) AS has_pending,
      bool_and(
        o.excluded_at IS NOT NULL
        OR s.status IS DISTINCT FROM 'Aktif'
      ) AS all_excluded
    FROM public.lhi_discipline_obligations o
    JOIN latest i ON i.incident_id=o.incident_id
    LEFT JOIN public.staff s ON s.staff_id=o.staff_id
    GROUP BY o.staff_id
  ),
  classified AS (
    SELECT *,
      CASE
        WHEN coalesce(all_excluded,false) THEN 'EXCLUDED_INACTIVE'
        WHEN coalesce(has_pending,false) THEN 'PENDING'
        ELSE 'COMPLETED'
      END AS obligation_status
    FROM members
  )
  SELECT jsonb_build_object(
    'incident_id',(SELECT incident_id FROM latest),
    'snapshot_total',(SELECT count(*) FROM classified),
    'completed',(SELECT count(*) FROM classified WHERE obligation_status='COMPLETED'),
    'pending',(SELECT count(*) FROM classified WHERE obligation_status='PENDING'),
    'excluded',(SELECT count(*) FROM classified WHERE obligation_status='EXCLUDED_INACTIVE'),
    'members',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id',staff_id,
        'nama',nama,
        'current_employment_status',employment_status,
        'employment_status_at_snapshot',employment_status,
        'obligation_status',obligation_status,
        'completed_at',completed_at
      ) ORDER BY nama,staff_id)
      FROM classified
    ),'[]'::jsonb)
  );
$function$;
