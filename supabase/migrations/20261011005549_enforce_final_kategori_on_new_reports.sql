-- Synced from the already-applied production migration on 2026-10-11.
-- New reports must use one of the 12 standard IPSRS categories.
-- Existing reports can retain historical categories when kategori is not changed.
CREATE OR REPLACE FUNCTION public.enforce_final_report_kategori()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  allowed_categories text[] := ARRAY[
    'PEMELIHARAAN',
    'PERBAIKAN',
    'PEMERIKSAAN / INSPEKSI',
    'PERMINTAAN LAYANAN',
    'PERTEMUAN / KOORDINASI',
    'ADMINISTRASI / MANAJEMEN',
    'MONITORING',
    'KUNJUNGAN',
    'PENGUJIAN / ANALISA',
    'PELATIHAN',
    'PROYEK / RENOVASI',
    'LAINNYA'
  ];
BEGIN
  IF TG_OP = 'INSERT' OR NEW.kategori IS DISTINCT FROM OLD.kategori THEN
    IF NEW.kategori IS NULL OR NOT (NEW.kategori = ANY(allowed_categories)) THEN
      RAISE EXCEPTION 'Kategori laporan harus salah satu dari 12 kategori baku IPSRS.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_final_report_kategori ON public.reports;
CREATE TRIGGER trg_enforce_final_report_kategori
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_final_report_kategori();
