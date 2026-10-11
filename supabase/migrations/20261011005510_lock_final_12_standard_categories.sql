-- Synced from the already-applied production migration on 2026-10-11.
-- The 12 standard categories are fixed; only non-category master data remains mutable.
CREATE OR REPLACE FUNCTION public.prevent_kategori_master_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.data_type = 'KATEGORI' THEN
    RAISE EXCEPTION 'Kategori baku dikunci: penambahan kategori tidak diizinkan.';
  ELSIF TG_OP = 'UPDATE' AND (OLD.data_type = 'KATEGORI' OR NEW.data_type = 'KATEGORI') THEN
    RAISE EXCEPTION 'Kategori baku dikunci: perubahan kategori tidak diizinkan.';
  ELSIF TG_OP = 'DELETE' AND OLD.data_type = 'KATEGORI' THEN
    RAISE EXCEPTION 'Kategori baku dikunci: penghapusan kategori tidak diizinkan.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lock_kategori_master ON public.master_data;
CREATE TRIGGER trg_lock_kategori_master
BEFORE INSERT OR UPDATE OR DELETE ON public.master_data
FOR EACH ROW EXECUTE FUNCTION public.prevent_kategori_master_mutation();
