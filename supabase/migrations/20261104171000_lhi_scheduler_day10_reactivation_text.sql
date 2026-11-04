DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
    INTO v_definition;
  IF position('sesuai tahapan hari ke-9; blokir global mengambil alih.' IN v_definition)=0 THEN
    RAISE EXCEPTION 'Stale day-9 staff reactivation text not found';
  END IF;
  v_definition := replace(
    v_definition,
    'sesuai tahapan hari ke-9; blokir global mengambil alih.',
    'sesuai tahapan hari ke-10; blokir global mengambil alih.'
  );
  EXECUTE v_definition;
END;
$migration$;