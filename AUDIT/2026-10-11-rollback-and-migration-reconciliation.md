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


## Temuan lanjutan — audit baca-saja (11 Oktober 2026, 12:57 UTC)

### Rekonsiliasi migrasi dan jalur pemulihan
- Supabase project berstatus `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.166.
- Skema `rollback_20260926_1816` memang ada dan berisi delapan tabel historis. Ini adalah snapshot skema/data historis, bukan bukti backup penuh terkini: estimasi statistik menunjukkan `reports` sekitar 461 baris dan `master_data` sekitar 772 baris, sementara tabel produksi saat ini masing-masing 1.093 dan 715 baris. Angka historis tersebut hanya estimasi PostgreSQL, bukan hitungan eksak.
- Tidak ditemukan grant tabel eksplisit ke `anon`, `authenticated`, atau `PUBLIC` pada skema rollback tersebut. Namun RLS juga tidak aktif di tabel-tabelnya; jangan menambah grant atau memulihkannya tanpa audit hak akses skema.
- Catatan migrasi Supabase memuat `20260926112505_create_rollback_snapshot_20260926_1816`, tetapi file SQL dengan path/nama yang diperkirakan tidak ditemukan di `main`. Ini menambah bukti migration drift dan perlu dicari/diarsipkan dari sumber aslinya, bukan direkonstruksi lalu dijalankan ulang.
- Branch database development Supabase yang terdaftar: tidak ada. Tidak ada lingkungan branch Supabase untuk menguji migrasi saat audit ini.

### Hasil Supabase Security Advisor
- **ERROR:** dua tabel snapshot publik tanpa RLS: `public.master_data_sipil_backup_20261010` dan `public.report_reclass_snapshot_20261011`.
- **WARN:** tiga fungsi memiliki `search_path` yang dapat berubah: `prevent_duplicate_master_item`, `prevent_kategori_master_mutation`, dan `enforce_final_report_kategori`.
- **WARN:** proteksi kata sandi bocor Supabase Auth nonaktif.
- **INFO:** tabel `public.staff` RLS aktif tetapi tidak ada policy terdeteksi. Perlu memverifikasi jalur akses aplikasi/service-role sebelum menambah policy; jangan membuat policy tebakan.
- Performance Advisor juga melaporkan 10 tabel tanpa primary key di skema snapshot historis dan dua tabel snapshot publik. Tidak ada indeks yang dihapus atau diubah.

### Keputusan aman saat ini
Tidak ada SQL produksi yang dijalankan dalam audit lanjutan ini. Mitigasi privilege untuk dua snapshot publik tetap kandidat dan belum diterapkan. Sebelum memperbaiki keamanan, perlu memastikan tidak ada akses aplikasi yang bergantung pada tabel snapshot, lalu membuat perubahan sempit yang dapat dibalikkan serta menguji grant efektif setelahnya. Jangan aktifkan RLS tanpa memastikan kebutuhan akses pemulihan karena itu dapat mengunci akses ke snapshot.


## Verifikasi integritas data terbaru (baca-saja)

Pemeriksaan ulang langsung terhadap produksi:
- Master aktif: 12 kategori, 46 area, 639 item. Total baris `master_data` 715 (termasuk 7 area nonaktif dan 11 item nonaktif).
- Snapshot frontend `frontend/js/static-data.js` di `main` bertanda 11 Oktober 2026 dan menyatakan 12 kategori, 46 area, 639 item. Item penting `Manifold Gas N2O` dan `Cek List Meteran Air Deep Well` ada pada master aktif.
- `reports`: 1.093 total, 1.086 aktif, 7 soft-deleted; tanggal laporan terlama 2026-09-12 dan terbaru 2026-10-11. Tidak ada kategori kosong dan tidak ada kategori laporan yang tidak terdapat di master kategori aktif.
- Validasi master aktif: 0 item tanpa area aktif, 0 nama area aktif duplikat, 0 item aktif duplikat pada area yang sama.
- Trigger validasi kategori baku, pencegah item master duplikat, pembatas identitas laporan, dan penetapan timestamp server terlihat aktif.
- Policy RLS `staff` tidak terdeteksi; Security Advisor juga melaporkannya. Akses aplikasi harus diuji sebelum policy dibuat agar login/fitur yang berjalan melalui service role tidak rusak.

Kesimpulan data: hitungan master aktif di Supabase konsisten dengan snapshot frontend terbaru yang tersimpan di `main`; audit baca-saja tidak menemukan anomali integritas pada tiga pemeriksaan master di atas. Ini bukan alasan untuk menghapus atau menulis ulang data yang sudah ada.
