# Catatan Patch Backend LHI — 3 November 2026

Status: PATCH BERTAHAP DI BRANCH — BELUM SIAP DEPLOY.

Branch: `repair/lhi-status-separation-20261103`

## Perubahan yang sudah dibuat

File `supabase/functions/ipsrs-api/index.ts`:

1. Fungsi `staff()` tidak lagi menghitung 7 hari dari `reports.tanggal` pada setiap login.
2. Status kepegawaian `staff.status` hanya dipakai untuk memutuskan apakah petugas masih aktif.
3. Hak akses disiplin dibaca dari kolom terpisah `staff.lhi_access_status`:
   - `NORMAL`: akses normal.
   - `BLOCKED_LHI`: akses diblokir karena ketidakpatuhan LHI.
4. `apiGetDisciplineWarning` membaca `lhi_access_status='BLOCKED_LHI'` dan hanya menampilkan petugas dengan status kepegawaian `Aktif`.
5. `apiAdminUnblockLhi` tidak lagi mengubah `staff.status` atau membuat bypass manual. Pemulihan harus melalui prosedur terpadu KA IPSRS.

## Ketergantungan skema yang belum dipasang

Patch ini membutuhkan kolom `staff.lhi_access_status`. Kolom tersebut belum ada di database produksi pada saat audit. Karena itu:

- Jangan deploy Edge Function ini sebelum migrasi skema dibuat, direview, diuji, dan diterapkan.
- Jangan jalankan SQL draft langsung di produksi.
- Jangan menganggap branch ini sudah siap dipakai aplikasi.

## Rancangan perubahan skema berikutnya

Migrasi resmi melalui Supabase CLI perlu mencakup sekurang-kurangnya:

1. Tambah `staff.lhi_access_status text not null default 'NORMAL'`.
2. Tambah tanggal acuan periode aktif, misalnya `staff.lhi_active_since timestamptz`, dengan backfill yang direview terlebih dahulu.
3. Migrasikan nilai legacy `Nonaktif_LHI_HARI_8` dan `DIBLOKIR_LHI_7_HARI` menjadi status kepegawaian `Aktif` (hanya jika data kepegawaian membuktikan aktif) dan `lhi_access_status='BLOCKED_LHI'`. Jangan mengubah pegawai yang benar-benar `Nonaktif`.
4. Ubah trigger laporan `reactivate_lhi_staff_after_report`: laporan baru tidak boleh otomatis mengubah status kepegawaian atau membuka blokir individual.
5. Ubah trigger perlindungan status manual agar melindungi `lhi_access_status`, bukan mencampuradukkan kolom status kepegawaian.
6. Saat perubahan kepegawaian `Nonaktif` menjadi `Aktif`, set ulang `lhi_active_since` ke waktu aktivasi. Jika sebelumnya akses individual diblokir LHI dan pegawai sempat menjadi Nonaktif, buka hanya blokir individual sesuai README; jangan menyentuh blokir global.
7. Revisi `open_lhi_global_grace` agar mengubah `lhi_access_status`, bukan `staff.status`, dan tetap satu transaksi atomik.
8. Revisi scheduler agar perhitungan berdasarkan tanggal WIB dari `reports.created_at`, memperhitungkan laporan batal, status kepegawaian aktif, tanggal aktivasi, peringatan hari 4/6/7, blokir individual hari 8, masa tunggu hari 9, dan blokir global hari 10.
9. Ubah snapshot agar berisi hanya petugas lalai, satu kewajiban per petugas (minimal satu LHI sah selama kelonggaran), bukan kewajiban per tanggal.
10. Tambah riwayat peristiwa append-only untuk perubahan kewajiban snapshot, termasuk pembatalan laporan dan pengecualian ketika status kepegawaian berubah menjadi Nonaktif.

## Pemeriksaan keamanan yang wajib

- Sesi pemulihan terbatas KA IPSRS harus tetap bisa dipakai ketika akses LHI KA IPSRS sendiri diblokir, tetapi hanya untuk menu Hak Akses pemulihan.
- Reset code tidak boleh dianggap sebagai autentikasi atau otorisasi.
- Validasi role KA IPSRS harus di server.
- Pemulihan global dan individual, snapshot, waktu mulai, tenggat 12 jam, dan audit harus satu transaksi.
- Percobaan ulang setelah respons hilang tidak boleh menggeser tenggat.
- Semua view/RLS/grant yang terpengaruh harus diperiksa dan Supabase advisors dijalankan setelah migrasi.

## Status verifikasi

- Patch string pada branch berhasil disimpan.
- Perubahan belum diuji dengan Deno/TypeScript compiler.
- Kolom baru belum ada di database; branch ini belum deployable.
- Scheduler, triggers, migration, reset recovery session, snapshot, dan append-only audit masih menunggu tahap berikutnya.
