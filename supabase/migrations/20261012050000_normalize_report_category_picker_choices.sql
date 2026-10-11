-- Normalize detailed Form Input picker choices to one of the 12 canonical IPSRS categories.
-- The frontend/backend can still validate the selected detail (including replacement requirements)
-- before insert; the stored kategori column remains canonical.
CREATE OR REPLACE FUNCTION public.enforce_final_report_kategori()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  incoming_category text := upper(regexp_replace(trim(coalesce(NEW.kategori, '')), '\s+', ' ', 'g'));
  canonical_category text;
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
    canonical_category := CASE incoming_category
      WHEN 'PEMELIHARAAN RUTIN SESUAI JADWAL' THEN 'PEMELIHARAAN'
      WHEN 'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT' THEN 'PEMELIHARAAN'
      WHEN 'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL' THEN 'PEMELIHARAAN'
      WHEN 'PEMELIHARAAN DILUAR JADWAL RUTIN' THEN 'PEMELIHARAAN'
      WHEN 'PEMELIHARAAN DI LUAR JADWAL RUTIN' THEN 'PEMELIHARAAN'
      WHEN 'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT' THEN 'PEMELIHARAAN'
      WHEN 'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL' THEN 'PEMELIHARAAN'
      WHEN 'PERBAIKAN SAJA' THEN 'PERBAIKAN'
      WHEN 'PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT' THEN 'PERBAIKAN'
      WHEN 'PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL' THEN 'PERBAIKAN'
      WHEN 'PENGGANTIAN ATAU PEMASANGAN UNIT / ALAT' THEN 'PERBAIKAN'
      ELSE incoming_category
    END;
    IF canonical_category IS NULL OR NOT (canonical_category = ANY(allowed_categories)) THEN
      RAISE EXCEPTION 'Kategori laporan harus salah satu dari 12 kategori baku IPSRS.';
    END IF;
    NEW.kategori := canonical_category;
  END IF;
  RETURN NEW;
END;
$function$;
