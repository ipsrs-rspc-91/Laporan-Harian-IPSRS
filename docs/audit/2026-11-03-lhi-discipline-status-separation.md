# Audit dan Rencana Perbaikan Form Blok Aplikasi LHI
Tanggal audit: 2026-11-03
Repository: ipsrs-rspc-91/Laporan-Harian-IPSRS
Target kerja: branch `repair/lhi-status-separation-20261103`
Status: audit terverifikasi; belum ada perubahan database produksi atau deployment.

## 1. Temuan terverifikasi pada Supabase produksi

### 1.1 Status pegawai bercampur dengan status blokir akses
Tabel `public.staff` hanya memiliki kolom `status` untuk status pegawai dan status blokir disiplin. Nilai yang ditemukan:
- `Aktif`: 21 baris
- `Nonaktif`: 18 baris
- `Nonaktif_LHI_HARI_8`: 1 baris

Scheduler mengubah `staff.status` menjadi `Nonaktif_LHI_HARI_8` pada hari ke-8. Backend login juga menulis `DIBLOKIR_LHI_7_HARI` pada kolom yang sama. Ini melanggar README: blokir hak akses tidak boleh mengubah status kepegawaian.

### 1.2 Login masih memiliki gate disiplin terpisah
Fungsi `staff()` pada `supabase/functions/ipsrs-api/index.ts` memeriksa tujuh tanggal sebelumnya menggunakan `reports.tanggal`, kemudian mengubah `staff.status` menjadi `DIBLOKIR_LHI_7_HARI`. Gate ini berjalan terpisah dari scheduler dan tidak menggunakan `created_at` WIB. Akibatnya, aturan frontend/backend/scheduler dapat berbeda.

### 1.3 Scheduler memakai tanggal pekerjaan, bukan tanggal input
Fungsi produksi `public.run_lhi_discipline_scheduler()` menggunakan `reports.tanggal` untuk menghitung hari tanpa input. README mewajibkan `reports.created_at` yang dikonversi ke `Asia/Jakarta`, dengan tanggal input terakhir sebagai acuan. Hari kalender tanpa input adalah tanggal WIB hari ini dikurangi tanggal WIB input sah terakhir dikurangi satu hari.

### 1.4 Pemicu blokir global salah hari
Scheduler saat ini menggunakan kondisi `v_days >= 9` dan mencatat event `ACTIVATE_LHI_GLOBAL_BLOCK_DAY_9`. README mewajibkan hari ke-10, dengan satu petugas berstatus kepegawaian AKTIF sudah cukup menjadi pemicu. Hari ke-9 hanya masa tunggu.

### 1.5 Trigger database ikut mengubah status pegawai
Fungsi `reactivate_lhi_staff_after_report()` mengubah `staff.status` menjadi `Aktif` ketika laporan baru masuk. Fungsi `protect_lhi_manual_unblock_status()` juga melindungi perubahan pada kolom status yang sama. Keduanya harus diselaraskan dengan pemisahan status kepegawaian dan status akses.

### 1.6 Pemulihan 12 jam belum sepenuhnya selaras dengan model status
Migrasi `20261102093643_lhi_grace_atomic_open_and_staff_completion.sql` membuka blokir individual dengan mengubah `staff.status` menjadi `Aktif`. Pada model yang benar, pemulihan hanya mengubah status akses aplikasi dan tidak mengaktifkan pegawai yang status kepegawaiannya memang NONAKTIF.

## 2. Rencana perbaikan bertahap

1. **Model status terpisah**: pertahankan `staff.status` sebagai status kepegawaian (`Aktif`/`Nonaktif`); tambahkan kolom status akses LHI yang terpisah. Migrasikan nilai legacy secara konservatif: `Nonaktif_LHI_HARI_8` dipetakan menjadi pegawai `Aktif` dengan akses diblokir, bukan pegawai nonaktif.
2. **Titik awal kepatuhan**: simpan waktu aktivasi/reaktivasi kepegawaian. Untuk pegawai aktif tanpa LHI sah, gunakan tanggal aktivasi; setelah ada LHI sah, gunakan tanggal `created_at` WIB terakhir.
3. **Satu mesin hitung server**: hitung hari kalender penuh tanpa LHI sah dari `created_at` WIB; laporan dibatalkan tidak dihitung. Hapus perhitungan paralel dari jalur login.
4. **Tahapan disiplin**: peringatan hari 4, 6, 7; blokir akses individu hari 8; hari 9 masa tunggu; blokir global pada hari 10.
5. **Snapshot dan kelonggaran**: hanya petugas lalai yang tercantum dalam snapshot; satu LHI sah selama jendela 12 jam memenuhi kewajiban; status NONAKTIF mengecualikan kewajiban sesuai README tanpa menghapus riwayat.
6. **Audit append-only dan notifikasi**: catat perubahan status kewajiban dan pastikan notifikasi tiap tahap tidak duplikat serta mencantumkan nama petugas.
7. **Uji regresi**: uji seluruh skenario penerimaan README, termasuk reset gagal, retry setelah respons hilang, pembatalan laporan, pegawai nonaktif/reaktivasi, dan sesi pemulihan KA IPSRS.

## 3. Pengaman implementasi
- Branch ini dibuat dari commit `8c93f1361ff212c439a027fd6412537eb01db8df`.
- Tidak ada perubahan pada branch utama.
- Tidak ada SQL perubahan yang dijalankan pada database produksi.
- Tidak ada deployment.
- Migrasi database belum dibuat karena Supabase CLI tidak tersedia pada lingkungan kerja untuk menjalankan prosedur `supabase migration new`. Jangan menaruh migrasi manual ke direktori migrasi aktif sebelum file dibuat melalui CLI dan diuji pada lingkungan nonproduksi.
- Backup tabel disiplin yang sudah ada tetap dipertahankan; jangan menghapus atau menimpa snapshot audit.

## 4. Status
Audit produksi: selesai untuk temuan di atas.
Perbaikan kode/database: belum diterapkan.
Produksi: tidak berubah.
