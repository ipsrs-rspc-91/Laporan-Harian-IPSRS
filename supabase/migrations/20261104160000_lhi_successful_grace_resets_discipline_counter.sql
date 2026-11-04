-- Start a fresh LHI discipline counter after a fully completed recovery grace.
-- This preserves the active incident snapshot and does not alter its obligations.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS lhi_discipline_reset_at timestamptz;

DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
    INTO v_definition;

  v_old := 'select staff_id,nama,role,status,lhi_manual_unblock_until';
  v_new := 'select staff_id,nama,role,status,lhi_manual_unblock_until,lhi_discipline_reset_at,created_at';
  IF position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'LHI reset patch failed: scheduler staff projection not found.';
  END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'and r.tanggal=(v_today-v_stage)';
  v_new := 'and (r.created_at at time zone ''Asia/Jakarta'')::date=(v_today-v_stage) and r.created_at >= coalesce(v_staff.lhi_discipline_reset_at,v_staff.created_at)';
  IF position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'LHI reset patch failed: consecutive-day report predicate not found.';
  END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := E'    if now() >= v_deadline and v_pending = 0 then\n      update public.lhi_discipline_incidents';
  v_new := E'    if now() >= v_deadline and v_pending = 0 then\n      update public.staff s\n      set lhi_discipline_reset_at = now()\n      where s.status = ''Aktif''\n        and exists (select 1 from public.lhi_discipline_obligations o\n          where o.incident_id = v_active_grace and o.staff_id = s.staff_id\n            and o.excluded_at is null);\n      update public.lhi_discipline_incidents';
  IF position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'LHI reset patch failed: primary successful-completion branch not found.';
  END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'if v_days>=9 then';
  v_new := 'if v_days>=10 then';
  IF position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'LHI reset patch failed: global threshold not found.';
  END IF;
  v_definition := replace(v_definition,v_old,v_new);

  EXECUTE v_definition;
END;
$migration$;

COMMENT ON COLUMN public.staff.lhi_discipline_reset_at IS
  'Baseline timestamp for LHI discipline streak counting after successful global recovery; reports created before this timestamp do not carry forward.';
