# Audit Rekonsiliasi dan Rollback — 11 Oktober 2026

## Status keselamatan
- Pemeriksaan ini tidak menjalankan migrasi, tidak mengubah tabel laporan, dan tidak melakukan rollback produksi.
- GitHub Pages untuk commit `bafe65c4b6345f44a242b831012a1f0e4c673592` telah lulus deployment dan smoke check.
- Audit otomatis dan browser regression pada run `38139258809` lulus.
- Supabase Edge Function `ipsrs-api` tetap versi 83; workflow deployment backend dan Cloudflare pada run `38139329706` berstatus skipped.

## Titik pemulihan kode
1. Baseline sebelum rangkaian aksi terbaru: `75fb9a2bffa49c334411d946ff47907079f2c60c`.
   Branch: `rollback/baseline-before-actions-20261010`.
2. Versi frontend yang saat ini telah dipublikasikan: `bafe65c4b6345f44a242b831012a1f0e4c673592`.
   Branch: `rollback/checkpoint-20261011-master-sync-guard2`.

Untuk rollback frontend, verifikasi dahulu target SHA, lalu gunakan revert commit secara terkontrol dan jalankan ulang audit/deploy. Jangan force-push branch `main`. Rollback frontend tidak otomatis membalikkan perubahan database.

## Hasil rekonsiliasi
- History Supabase berisi 40 entri migrasi; repository saat ini hanya berisi 16 file migrasi. Ini adalah drift dokumentasi/riwayat yang perlu dipetakan satu per satu, bukan alasan untuk menjalankan ulang migrasi.
- Skema produksi saat ini memiliki kolom soft-delete pada `reports`, kolom SPMU dual-side, trigger penguncian 12 kategori, trigger pencegah item duplikat, dan trigger identitas laporan. Keberadaan objek membuktikan fitur aktif pada skema, tetapi tidak membuktikan file migrasi aslinya masih ada di repository.
- Area `Administrasi IPSRS` memiliki 27 item aktif dengan urutan 1–27. Karena target urutan sudah terpenuhi, migrasi `20261011190000_reorder_administrasi_ipsrs_items.sql` tidak perlu dijalankan.
- Jumlah data saat pemeriksaan baca-saja: `reports` = 1.093 baris; `master_data` = 715 baris.
- Tabel snapshot `master_data_sipil_backup_20261010` dan `report_reclass_snapshot_20261011` ada, tetapi RLS tidak aktif. Estimasi PostgreSQL masing-masing sekitar 110 dan 165 baris (estimasi statistik, bukan hitungan eksak).

## Temuan prioritas keamanan
Kedua tabel snapshot tidak mengaktifkan RLS dan memiliki grant tabel ke role `authenticated` untuk SELECT serta hak tulis lain. Ini berpotensi membuka snapshot internal kepada pengguna yang terautentikasi. Belum ada perubahan produksi yang dilakukan.

Kandidat mitigasi disiapkan sebagai migrasi terpisah. Sebelum diterapkan, verifikasi bahwa aplikasi tidak menggunakan akses langsung ke kedua tabel tersebut. Setelah mitigasi, verifikasi akses service-role/admin dan uji aplikasi.

## Kandidat langkah mitigasi (belum diterapkan)
- Cabut seluruh privilege `anon`, `authenticated`, dan `public` dari dua tabel snapshot.
- Pertahankan akses pemulihan hanya untuk role administratif/service-role yang memang diperlukan.
- Uji grant efektif sesudah perubahan.
- Jangan menghapus tabel snapshot sebelum ekspor/backup terverifikasi.

## Batas rollback database
Branch GitHub bukan backup data Supabase. Belum ada dump database eksternal yang dibuat dalam audit ini. Snapshot di atas hanya mencakup subset data, bukan backup lengkap database. Sebelum perubahan skema/data produksi berikutnya, pastikan backup Supabase/PITR atau ekspor yang dapat dipulihkan tersedia dan diverifikasi.

## Larangan sampai audit selesai
- Jangan menjalankan `supabase db push` atau menerapkan ulang file migrasi lama secara massal.
- Jangan memulihkan snapshot parsial ke `master_data` atau `reports` tanpa pemetaan ID, timestamp, dan dampak laporan yang dibuat sesudah snapshot.
- Jangan mengubah/menonaktifkan trigger RLS atau kategori baku hanya untuk menyamakan riwayat migrasi.
