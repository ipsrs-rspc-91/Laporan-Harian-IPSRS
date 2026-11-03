# Audit Form Blok LHI — 3 November 2026

## Ruang lingkup
Audit read-only terhadap repository `ipsrs-rspc-91/Laporan-Harian-IPSRS` branch `main`, README `README-FORM-BLOK-APLIKASI.md`, Supabase project `tcrmlhfsroyhaxdfwyll`, Edge Functions aktif, schema, scheduler, dan data status ringkas. Tidak ada perubahan database atau deployment produksi dalam audit ini.

## Checkpoint
- Main sebelum pekerjaan: `3f63d19f3c2ac7e03787257b4db37963873ae34e`
- Backup branch: `backup/pre-form-blok-audit-20261103`
- Work branch: `fix/form-blok-readme-compliance-20261103`
- Supabase region: `ap-southeast-1`
- Edge Function `ipsrs-api`: v109
- Edge Function `lhi-block-status`: v2
- Edge Function `lhi-reset-verify`: v1

## Kondisi produksi saat audit
- `LHI_GLOBAL_BLOCK = AKTIF`.
- Terdapat 1 insiden `LOCKED`, dimulai 31 Oktober 2026 19:52:59 UTC dengan tenggat awal 1 November 2026 07:52:59 UTC.
- Snapshot berisi 156 baris kewajiban dan 0 baris tercatat selesai.
- Status petugas: 21 `Aktif`, 18 `Nonaktif`, 1 `Nonaktif_LHI_HARI_8`.
- Scheduler aktif setiap 5 menit: `select public.run_lhi_discipline_scheduler();`.

## Temuan ketidaksesuaian kritis
1. **Sumber tanggal salah di jalur login lama.** Fungsi `staff()` dalam `ipsrs-api v109` memeriksa `reports.tanggal` pada 7 hari sebelumnya, bukan tanggal WIB dari `reports.created_at`. Fungsi ini juga dapat mengubah `staff.status` menjadi `DIBLOKIR_LHI_7_HARI`.
2. **Status kepegawaian tercampur dengan blokir aplikasi.** Scheduler mengubah status menjadi `Nonaktif_LHI_HARI_8` pada hari ke-8. README mengharuskan status kepegawaian tetap aktif dan blokir disimpan sebagai status hak akses terpisah.
3. **Penghitungan hari scheduler tidak sesuai kalender penuh.** Fungsi scheduler menggunakan `reports.tanggal`, menghitung mulai tanggal berjalan, dan mengaktifkan blokir global pada kondisi `v_days >= 9`. README menetapkan jumlah tanggal kalender penuh setelah tanggal input WIB terakhir, mengecualikan tanggal berjalan, hari ke-8 untuk blokir akses individual, hari ke-9 masa tunggu, dan hari ke-10 pemicu blokir global.
4. **Reset belum menghasilkan sesi pemulihan server.** `lhi-reset-verify v1` hanya mengembalikan boolean `valid`. Frontend menyimpan `KA_ONLY` di `sessionStorage`. Pembatasan role pada alur tersebut berada di frontend; belum ada bukti token/sesi terbatas yang diterbitkan dan diverifikasi backend.
5. **API tidak menerapkan pengunci global di server.** Handler `ipsrs-api` memanggil `staff()` lalu mendispatch action; pemeriksaan `LHI_GLOBAL_BLOCK` tidak terlihat sebagai gate server untuk seluruh action. Tampilan blokir saat ini terutama diterapkan pada startup frontend melalui `lhi-block-status`.
6. **Sesi pemulihan belum dibatasi pada menu Hak Akses.** Setelah login, frontend memproses `apiWhoAmI` dan alur aplikasi normal. Flag reset di browser bukan kontrol otorisasi server.
7. **Snapshot belum memenuhi bukti audit append-only.** Tabel kewajiban menggunakan `completed_at` yang dapat diubah menjadi NULL atau timestamp. Belum ditemukan tabel riwayat peristiwa kewajiban append-only dalam schema yang diperiksa.
8. **Pengecualian NONAKTIF belum terbukti.** Struktur kewajiban yang diperiksa belum menunjukkan status `DIKECUALIKAN — STATUS NONAKTIF` dan histori perubahan status kewajiban sesuai README.
9. **Pesan notifikasi tidak konsisten.** Scheduler menyebut petugas akan dinonaktifkan pada hari ke-7 dan menggunakan pesan dinonaktifkan pada hari ke-8, bukan pemblokiran hak akses aplikasi dengan status kepegawaian tetap aktif.

## Rencana perbaikan di work branch
1. Buat model data hak akses LHI terpisah dari status kepegawaian; tambahkan periode aktif dan histori perubahan status yang diperlukan.
2. Ganti perhitungan kepatuhan dengan satu fungsi server-side berbasis `created_at` WIB, status kepegawaian aktif, tanggal aktivasi, tanggal input terakhir yang sah, dan kalender penuh.
3. Ganti scheduler agar peringatan hari 4/6/7, blokir akses individual hari 8, masa tunggu hari 9, dan blokir global hari 10 tepat sesuai README; pastikan idempotensi notifikasi.
4. Terapkan pemeriksaan blokir global dan blokir individual pada backend untuk semua action; jangan mengandalkan frontend.
5. Rancang challenge Reset sekali pakai dan sesi pemulihan terbatas yang diterbitkan serta diverifikasi server. Hanya fungsi Hak Akses pemulihan yang boleh dipanggil sampai transaksi pemulihan berhasil.
6. Perbarui transaksi pemulihan 12 jam: snapshot hanya petugas yang wajib, satu LHI sah cukup per petugas, perubahan status NONAKTIF mengecualikan kewajiban tanpa menghapus snapshot, pembatalan LHI dapat membatalkan pemenuhan, dan retry tidak menggeser tenggat.
7. Tambahkan tabel peristiwa kewajiban append-only dan audit seluruh transisi.
8. Perbaiki UI Form Blok, notifikasi, sesi terbatas KA IPSRS, dan alur login yang menggunakan komponen login yang sama.
9. Tambahkan pengujian untuk seluruh 32 skenario penerimaan, jalankan pemeriksaan statis dan E2E, lalu lakukan review perubahan.
10. Setelah seluruh uji nonproduksi lulus, minta satu persetujuan eksplisit sebelum perubahan database/deployment produksi.

## Batasan keselamatan
- Jangan mengubah `LHI_GLOBAL_BLOCK` atau status petugas saat ini selama perbaikan nonproduksi.
- Jangan menjalankan Reset, membuka blokir, memulai kelonggaran 12 jam, mengubah scheduler produksi, atau deploy Edge Function produksi selama audit/perbaikan branch.
- Jangan menganggap commit, migrasi, atau status Edge Function sebagai bukti bahwa seluruh skenario penerimaan telah berjalan benar.
- Backup branch dibuat dari commit main yang tercatat di atas agar dapat dipulihkan secara terpisah.
