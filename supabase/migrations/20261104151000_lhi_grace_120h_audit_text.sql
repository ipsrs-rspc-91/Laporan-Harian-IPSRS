-- Remove the final stale 12-hour phrase from the scheduler's global-lock audit entry.
DO $migration$
DECLARE
  v_definition text;
  v_old text := 'Snapshot kewajiban dibuat dengan tenggat kelonggaran 12 jam.';
  v_new text := 'Snapshot kewajiban dibuat dengan tenggat kelonggaran 5 hari (120 jam).';
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
    INTO v_definition;
  IF position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'Scheduler audit text patch failed: old 12-hour text not found.';
  END IF;
  v_definition := replace(v_definition,v_old,v_new);
  EXECUTE v_definition;
END;
$migration$;