-- Align LHI grace scheduler with the approved 5-day (120-hour) recovery policy.
-- Inactive snapshot members are permanently excluded from this incident's final evaluation.
ALTER TABLE public.lhi_discipline_obligations
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz;

DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
    INTO v_definition;

  v_old := '-- Resolve an existing 12-hour grace window first.';
  v_new := '-- Resolve an existing 120-hour (5-day) grace window first.';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: old grace-window header not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := E'  if v_active_grace is not null then\n    update public.lhi_discipline_obligations o';
  v_new := E'  if v_active_grace is not null then\n    -- Permanently exclude snapshot members who become inactive during grace.\n    update public.lhi_discipline_obligations o\n    set excluded_at = now()\n    from public.staff s\n    where o.incident_id = v_active_grace and s.staff_id = o.staff_id\n      and s.status IS DISTINCT FROM ''Aktif'' and o.excluded_at IS NULL;\n\n    update public.lhi_discipline_obligations o';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: grace reconciliation point not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := E'    where o.incident_id = v_active_grace\n      and o.completed_at is not null\n      and not exists (';
  v_new := E'    where o.incident_id = v_active_grace\n      and o.excluded_at IS NULL\n      and o.completed_at is not null\n      and not exists (';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: canceled-report reset condition not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := E'    where o.incident_id = v_active_grace\n      and o.completed_at is null\n      and exists (';
  v_new := E'    where o.incident_id = v_active_grace\n      and o.excluded_at IS NULL\n      and o.completed_at is null\n      and exists (';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: completion condition not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := E'    select count(*) into v_pending\n    from public.lhi_discipline_obligations\n    where incident_id = v_active_grace and completed_at is null;';
  v_new := E'    select count(*) into v_pending\n    from public.lhi_discipline_obligations o\n    join public.staff s on s.staff_id = o.staff_id\n    where o.incident_id = v_active_grace and o.completed_at is null\n      and o.excluded_at is null and s.status = ''Aktif'';';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: primary pending count not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'if v_pending=0 then';
  v_new := 'if now() >= v_deadline and v_pending=0 then';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: premature completion condition not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'now()+interval ''12 hours'',''LOCKED''';
  v_new := 'now()+interval ''120 hours'',''LOCKED''';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: incident 12-hour interval not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := 'Masa kelonggaran 12 jam berakhir';
  v_new := 'Masa kelonggaran 5 hari (120 jam) berakhir';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Scheduler patch failed: expiry audit text not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);

  EXECUTE v_definition;
END;
$migration$;

DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.get_lhi_grace_status_v2()'::regprocedure) INTO v_definition;
  v_old := 'CASE WHEN max(s.status) IS DISTINCT FROM ''Aktif'' THEN ''EXCLUDED_INACTIVE''';
  v_new := 'CASE WHEN bool_or(o.excluded_at IS NOT NULL) OR max(s.status) IS DISTINCT FROM ''Aktif'' THEN ''EXCLUDED_INACTIVE''';
  IF position(v_old IN v_definition)=0 THEN RAISE EXCEPTION 'Grace status patch failed: exclusion expression not found.'; END IF;
  v_definition := replace(v_definition,v_old,v_new);
  EXECUTE v_definition;
END;
$migration$;
