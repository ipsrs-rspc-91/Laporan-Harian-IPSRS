-- Keep Administrasi IPSRS item ordering reproducible in production.
-- Idempotent data migration: match by area and item name, never by generated IDs.
DO $$
DECLARE
  admin_area_id bigint;
  matched_items integer;
BEGIN
  SELECT id INTO admin_area_id
  FROM public.master_data
  WHERE data_type = 'AREA'
    AND name = 'Administrasi IPSRS'
    AND is_active = true
  ORDER BY id
  LIMIT 1;

  IF admin_area_id IS NULL THEN
    RAISE EXCEPTION 'Active area "Administrasi IPSRS" was not found';
  END IF;

  SELECT count(*) INTO matched_items
  FROM public.master_data m
  JOIN (VALUES
    ('Rekap Laporan Kerusakan'),
    ('Rekap LPB'),
    ('Absensi'),
    ('SP3'),
    ('Permintaan Barang Teknik'),
    ('Surat-Menyurat'),
    ('Rekap Indikator Mutu IPSRS'),
    ('Penerimaan Laporan Kerusakan'),
    ('Koordinasi Laporan Kerusakan'),
    ('Koordinasi Lapangan'),
    ('Distribusi Informasi Kerusakan'),
    ('Monitoring dan Verifikasi Pekerjaan'),
    ('Pengecekan Stok Barang'),
    ('Rekap Keluar-Masuk Suku Cadang'),
    ('Penomoran Barang Baru'),
    ('Pendataan Investasi'),
    ('Pendataan Aset IPSRS'),
    ('Rekap Anggaran dan Realisasi Biaya'),
    ('Rekap Logbook Shift'),
    ('Laporan dan Evaluasi Bulanan'),
    ('Rekap Kinerja IPSRS'),
    ('Rekap SPK Vendor'),
    ('Dokumentasi dan Evaluasi Pekerjaan Vendor'),
    ('Pengarsipan Dokumen'),
    ('Data Manual Book dan Dokumen Teknis'),
    ('Rekap Jadwal Pemeliharaan Berkala'),
    ('Rekap Pelatihan, Sertifikasi dan Perizinan')
  ) AS expected(name) ON expected.name = m.name
  WHERE m.data_type = 'ITEM'
    AND m.parent_id = admin_area_id
    AND m.is_active = true;

  IF matched_items <> 27 THEN
    RAISE EXCEPTION 'Expected 27 active Administrasi IPSRS items; found %; aborting reorder', matched_items;
  END IF;

  -- Move current values out of the target range first to avoid transient
  -- collisions if (parent_id, sort_order) has a uniqueness constraint.
  UPDATE public.master_data
  SET sort_order = sort_order + 1000
  WHERE data_type = 'ITEM'
    AND parent_id = admin_area_id
    AND is_active = true;

  UPDATE public.master_data AS m
  SET sort_order = v.new_order
  FROM (VALUES
    ('Rekap Laporan Kerusakan', 1),
    ('Rekap LPB', 2),
    ('Absensi', 3),
    ('SP3', 4),
    ('Permintaan Barang Teknik', 5),
    ('Surat-Menyurat', 6),
    ('Rekap Indikator Mutu IPSRS', 7),
    ('Penerimaan Laporan Kerusakan', 8),
    ('Koordinasi Laporan Kerusakan', 9),
    ('Koordinasi Lapangan', 10),
    ('Distribusi Informasi Kerusakan', 11),
    ('Monitoring dan Verifikasi Pekerjaan', 12),
    ('Pengecekan Stok Barang', 13),
    ('Rekap Keluar-Masuk Suku Cadang', 14),
    ('Penomoran Barang Baru', 15),
    ('Pendataan Investasi', 16),
    ('Pendataan Aset IPSRS', 17),
    ('Rekap Anggaran dan Realisasi Biaya', 18),
    ('Rekap Logbook Shift', 19),
    ('Laporan dan Evaluasi Bulanan', 20),
    ('Rekap Kinerja IPSRS', 21),
    ('Rekap SPK Vendor', 22),
    ('Dokumentasi dan Evaluasi Pekerjaan Vendor', 23),
    ('Pengarsipan Dokumen', 24),
    ('Data Manual Book dan Dokumen Teknis', 25),
    ('Rekap Jadwal Pemeliharaan Berkala', 26),
    ('Rekap Pelatihan, Sertifikasi dan Perizinan', 27)
  ) AS v(name, new_order) ON v.name = m.name
  WHERE m.data_type = 'ITEM'
    AND m.parent_id = admin_area_id
    AND m.is_active = true;

  IF (SELECT count(*) FROM public.master_data
      WHERE data_type = 'ITEM'
        AND parent_id = admin_area_id
        AND is_active = true
        AND sort_order BETWEEN 1 AND 27) <> 27 THEN
    RAISE EXCEPTION 'Post-update ordering verification failed';
  END IF;
END $$;
