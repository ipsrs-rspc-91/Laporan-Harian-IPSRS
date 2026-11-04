-- Ubah durasi kelonggaran pemulihan LHI menjadi 120 jam untuk insiden baru.
-- Tidak mengubah insiden yang sudah berjalan atau kedaluwarsa.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.open_lhi_global_grace(text,text)'::regprocedure)
  INTO v_definition;

  IF position('interval ''120 hours''' in v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('interval ''12 hours''' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Durasi kelonggaran lama tidak ditemukan; migrasi dibatalkan.';
  END IF;

  v_definition := replace(v_definition, 'interval ''12 hours''', 'interval ''120 hours''');
  v_definition := replace(v_definition, 'kelonggaran 12 jam', 'kelonggaran 120 jam');
  EXECUTE v_definition;
END;
$$;
