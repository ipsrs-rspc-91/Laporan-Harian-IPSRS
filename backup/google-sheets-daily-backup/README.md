# Backup harian Supabase IPSRS ke Google Sheets

## Fungsi
- Membuat satu spreadsheet snapshot per hari: `IPSRS_DB_BACKUP_YYYY-MM-DD`.
- Mengekspor 11 tabel produksi dan snapshot historis yang telah diperiksa pada 2026-10-16, termasuk laporan, riwayat edit, audit log, master data, staf operasional, pengaturan, izin edit, dan snapshot historis.
- Pagination 500 baris, sheet per tabel, ringkasan jumlah baris, status COMPLETED/FAILED.
- Aman terhadap trigger ganda: memakai lock; backup COMPLETED hari itu tidak ditimpa. Backup gagal dapat dijalankan ulang pada file yang sama.
- Tidak mengubah data Supabase dan tidak terhubung ke alur deployment aplikasi.

## Peringatan keamanan
Spreadsheet berisi data operasional dan audit IPSRS. Buat folder Google Drive khusus dengan akses terbatas hanya untuk petugas berwenang. Jangan bagikan sebagai "Anyone with the link".
Script Properties berisi service-role key yang dapat melewati RLS. Jangan menaruh nilai rahasia di kode, file ini, GitHub Secrets yang tidak dibutuhkan, atau chat. Batasi editor proyek Apps Script dan rotasi key jika pernah terekspos.
Kolom `staff.last_login_device` sengaja tidak diekspor. Kolom `staff.auth_user_id` tetap disertakan untuk pemetaan akun operasional sehingga spreadsheet harus diperlakukan sebagai data sensitif.

Google Sheets adalah salinan sekunder, bukan backup native PostgreSQL yang bisa langsung dipulihkan sebagai database. Untuk pemulihan, skema/constraint/RLS/functions perlu dipulihkan dari migrasi dan diuji terpisah.

## Instalasi
1. Buat folder Google Drive privat khusus backup.
2. Buat proyek di https://script.google.com menggunakan akun organisasi yang berwenang.
3. Salin seluruh isi `Code.gs` ke file `Code.gs` di Apps Script.
4. Buka **Project Settings → Script properties** dan tambahkan:
   - `SUPABASE_URL` = `https://tcrmlhfsroyhaxdfwyll.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = service-role/secret key Supabase untuk proyek ini (jangan gunakan publishable/anon key)
   - `BACKUP_FOLDER_ID` = ID folder Google Drive privat yang dibuat pada langkah 1
5. Di **Project Settings**, set **Time zone** ke `Asia/Jakarta`.
6. Jalankan `runDailyBackup` sekali secara manual dan berikan izin Apps Script yang diperlukan.
7. Buka spreadsheet hasilnya dan periksa `BACKUP_META` berstatus `COMPLETED`, `TABLE_SUMMARY`, serta jumlah baris pada sheet `reports`.
8. Setelah pemeriksaan manual berhasil, jalankan `installDailyTrigger` sekali untuk membuat trigger harian sekitar pukul 02.00 WIB.
9. Pastikan folder tetap privat dan uji restore hanya pada proyek/database uji, bukan produksi.

## Verifikasi berkala
- Periksa email/notifikasi eksekusi Apps Script dan status `BACKUP_META`.
- Cocokkan jumlah baris `reports` dengan Supabase secara berkala.
- Unduh salah satu snapshot sebagai XLSX/CSV tambahan jika perlu salinan terpisah.
- Uji restore pada lingkungan terpisah sebelum menyatakan pemulihan bencana berhasil.
