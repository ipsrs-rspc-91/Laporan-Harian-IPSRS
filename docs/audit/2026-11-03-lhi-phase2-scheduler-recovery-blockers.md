# Audit Tahap 2 — Scheduler, Snapshot, dan Jalur Pemulihan LHI

Tanggal audit: 3 November 2026  
Branch: `repair/lhi-status-separation-20261103`  
Lingkup: pemeriksaan kode scheduler dan fungsi pemulihan yang sedang berjalan di Supabase produksi, dibandingkan dengan `README-FORM-BLOK-APLIKASI.md`.

## Status keselamatan

- Pemeriksaan database hanya menggunakan SELECT / pembacaan definisi fungsi.
- Tidak ada DDL, DML, perubahan konfigurasi, atau pemanggilan scheduler di produksi.
- Tidak ada deployment.
- Dokumen ini bukan persetujuan untuk mengubah produksi.
- Branch perbaikan tetap belum layak deploy sampai seluruh ketergantungan skema dan jalur pemulihan selesai.

## Temuan terverifikasi pada `public.run_lhi_discipline_scheduler()`

| ID | Kondisi kode produksi saat audit | Ketentuan README | Risiko |
|---|---|---|---|
| S-01 | Menghitung hari tanpa input dari `reports.tanggal` | Harus memakai tanggal WIB dari `reports.created_at` | Tanggal pekerjaan bisa berbeda dari tanggal penyimpanan; hitungan salah. |
| S-02 | Loop menghitung tanggal kosong mulai hari ini (`v_today`) | Hari berjalan tidak dihitung; rumusnya selisih tanggal WIB hari ini dengan tanggal input terakhir dikurangi satu | Hari tanpa input bertambah terlalu cepat satu hari. |
| S-03 | Hari ke-8 mengubah `staff.status` menjadi `Nonaktif_LHI_HARI_8` | Status kepegawaian harus tetap AKTIF; hanya hak akses aplikasi yang diblokir | Data kepegawaian tercemar dan petugas keluar dari pemantauan. |
| S-04 | Hari ke-9 mengaktifkan kembali `staff.status` lalu memicu global lock | Hari ke-9 hanya masa tunggu; global lock dipicu hari ke-10 | Blokir global terjadi satu hari terlalu cepat. |
| S-05 | Pemrosesan mengecualikan role `KA_IPSRS` | Semua petugas aktif, termasuk KA IPSRS, wajib dipantau dan dapat menjadi pemicu hari ke-10 | KA IPSRS tidak pernah menjadi pemicu peringatan/blokir sesuai ketentuan. |
| S-06 | Snapshot awal dibuat untuk semua petugas non-KA pada rentang tanggal bergulir dan per tanggal | Snapshot hanya berisi petugas lalai yang menjadi kewajiban pemulihan; satu LHI sah selama grace cukup untuk memenuhi kewajiban | Snapshot membengkak dan membebani petugas yang tidak lalai. |
| S-07 | Snapshot dan evaluasi menggunakan `reports.tanggal` pada saat pembuatan, lalu `created_at` saat grace | Seluruh keputusan harus konsisten memakai LHI sah berdasarkan `created_at` WIB; laporan dibatalkan tidak dihitung | Hasil snapshot dan penyelesaian grace tidak konsisten. |
| S-08 | Kewajiban snapshot hanya punya `completed_at`; tidak ada status DIKECUALIKAN atau riwayat peristiwa append-only | Perubahan BELUM TERPENUHI / TERPENUHI / DIKECUALIKAN harus tercatat sebagai peristiwa audit yang tidak ditimpa | Tidak dapat mengevaluasi perubahan status pegawai dan pembatalan secara dapat diaudit. |
| S-09 | Evaluasi grace menghitung semua kewajiban pending tanpa memeriksa status kepegawaian terkini | Petugas snapshot yang menjadi NONAKTIF harus dikecualikan dari evaluasi akhir | Petugas nonaktif dapat mengaktifkan kembali blokir global. |
| S-10 | Ada dua blok evaluasi grace yang tumpang tindih; satu dapat menyelesaikan lebih awal tanpa menunggu tenggat | Grace 12 jam harus dievaluasi pada tenggat; retry tidak boleh menggeser waktu mulai/tenggat | Potensi perbedaan perilaku antarjalur evaluasi. |
| S-11 | Fungsi pemulihan mengubah `staff.status` menjadi `Aktif` untuk membuka blokir | Pemulihan mengubah status hak akses, bukan status kepegawaian | Mengubah data kepegawaian sebagai efek samping pemulihan. |
| S-12 | Snapshot awal tidak menyimpan satu kewajiban per petugas dengan semantik minimal satu LHI | Hanya petugas yang lalai dalam snapshot wajib memasukkan minimal satu LHI sah selama 12 jam | Logika kewajiban belum sesuai acceptance criteria. |

## Temuan skema dan alur aplikasi

1. Kolom `staff.lhi_access_status` yang dipakai branch belum tersedia di database produksi. Branch API tidak boleh di-deploy sebelum skema disiapkan dan diuji.
2. Belum tersedia bukti skema untuk menyimpan tanggal mulai aktif dan setiap peristiwa NONAKTIF → AKTIF. Tanpa riwayat tersebut, reset titik awal pemantauan dan pembukaan blokir khusus saat reaktivasi tidak dapat dilakukan secara andal.
3. Trigger `trg_reactivate_lhi_staff_after_report` yang ditemukan sebelumnya mengubah `staff.status` menjadi Aktif ketika laporan disimpan. Trigger ini dapat melewati mekanisme pemulihan dan harus dirancang ulang agar tidak mengubah status kepegawaian.
4. Trigger `trg_protect_lhi_manual_unblock_status` masih melindungi nilai status kepegawaian lama, bukan kolom akses yang terpisah.
5. Fungsi backend `staff()` memverifikasi status akses sebelum semua action dijalankan. Akibatnya, KA IPSRS yang akses individunya diblokir tidak dapat mencapai `apiStartLhiGrace` melalui jalur normal.
6. Frontend `showLoginScreen()` dan `performLogin()` yang diperiksa belum memiliki alur Form Blok Aplikasi → Reset → autentikasi akun KA IPSRS → sesi terbatas pemulihan. Karena itu, hanya melonggarkan pemeriksaan backend akan membuka risiko akses normal yang tidak semestinya.
7. Fungsi `open_lhi_global_grace(text,text)` saat ini mengasumsikan pemanggil telah diotorisasi oleh backend. Ia sendiri tidak membuktikan sesi terbatas pemulihan, sehingga tidak boleh dipanggil melalui jalur publik atau sesi biasa tanpa otorisasi server yang benar.

## Urutan perbaikan yang wajib

### Tahap 2A — Fondasi data (belum diterapkan)
- Rancang kolom status akses terpisah dari status kepegawaian.
- Rancang tanggal mulai aktif dan riwayat perubahan status kepegawaian yang dapat menjadi sumber kebenaran untuk reset periode aktif.
- Rancang status kewajiban snapshot: BELUM TERPENUHI, TERPENUHI, DIKECUALIKAN_STATUS_NONAKTIF.
- Rancang tabel peristiwa kewajiban append-only dengan identitas pemicu, waktu, status sebelum/sesudah, dan referensi laporan/perubahan pegawai.
- Tentukan indeks dan constraint unik untuk mencegah notifikasi serta kewajiban duplikat.
- Buat migration melalui Supabase CLI resmi setelah CLI tersedia; jangan membuat file migration aktif secara manual dan jangan menerapkan DDL ke produksi tanpa persetujuan.

### Tahap 2B — Mesin hitung tunggal
- Gunakan `created_at AT TIME ZONE 'Asia/Jakarta'` untuk tanggal input WIB.
- Hanya laporan yang tidak dibatalkan yang dihitung.
- Hitung satu hari aktif per petugas per tanggal WIB, tanpa menggandakan beberapa laporan pada hari yang sama.
- Hitung hari penuh tanpa input: `max(0, tanggal_wib_hari_ini - tanggal_input_terakhir_wib - 1)`.
- Bila belum pernah ada LHI sah, gunakan tanggal mulai aktif; bila pegawai NONAKTIF lalu AKTIF, gunakan tanggal aktivasi terbaru.
- Perubahan status akses individual tidak boleh mengeluarkan pegawai AKTIF dari pemantauan.

### Tahap 2C — Tahapan dan notifikasi
- Hari 4, 6, 7: satu notifikasi per petugas/peristiwa/per tahap; notifikasi tim harus menyebut semua nama petugas yang memenuhi tahap.
- Hari 8: ubah hanya status akses menjadi diblokir.
- Hari 9: masa tunggu, tidak mengaktifkan blokir global.
- Hari 10: satu saja pegawai AKTIF yang mencapai 10 hari memicu blokir global.
- KA IPSRS termasuk dalam pemantauan yang sama.

### Tahap 2D — Pemulihan dan grace
- Selesaikan alur frontend Reset dan autentikasi melalui form login yang sama.
- Validasi role KA IPSRS di backend; angka Reset tidak boleh menjadi autentikasi atau pemberian sesi.
- Buat sesi terbatas yang hanya dapat menjalankan fungsi Hak Akses untuk pemulihan.
- Fungsi pemulihan harus membuka blokir global dan semua blokir individual dalam satu transaksi, tanpa mengubah status kepegawaian.
- Snapshot hanya berisi petugas lalai dan satu kewajiban per petugas; satu LHI sah yang disimpan dalam rentang grace memenuhi kewajiban.
- Pembatalan LHI selama grace harus mengembalikan kewajiban ke BELUM TERPENUHI jika tidak ada LHI sah pengganti.
- Perubahan pegawai menjadi NONAKTIF mengecualikan kewajibannya, mempertahankan snapshot historis, dan tidak menghidupkan kembali kewajiban jika pegawai diaktifkan lagi.
- Grace dimulai satu kali; retry mengembalikan insiden yang sama dan tidak menggeser tenggat.
- Evaluasi akhir dilakukan pada tenggat 12 jam. Blokir global hanya aktif kembali jika masih ada kewajiban aktif yang belum dipenuhi.

## Uji penerimaan minimum sebelum persetujuan produksi

- Uji tanggal input lintas tengah malam WIB dan tanggal kejadian pekerjaan yang berbeda.
- Uji beberapa laporan dalam satu hari dan laporan yang dibatalkan.
- Uji pegawai tanpa riwayat LHI, aktivasi ulang, dan masa NONAKTIF.
- Uji hari 4/6/7/8/9/10 dengan tanggal simulasi tetap.
- Uji KA IPSRS sebagai pemicu dan sebagai pemulih saat akses individunya diblokir.
- Uji snapshot hanya untuk petugas lalai, satu LHI cukup, pembatalan LHI, dan pengecualian NONAKTIF.
- Uji transaksi pemulihan gagal di setiap tahap dan retry setelah respons terputus.
- Uji notifikasi duplikat, audit append-only, dan scheduler berulang setiap 5 menit.
- Uji seluruhnya di lingkungan nonproduksi sebelum deployment.

## Kesimpulan

Perubahan API pada branch sebelumnya baru memisahkan sebagian pemeriksaan login. Itu belum menyelesaikan mesin disiplin LHI. Scheduler produksi, fungsi pemulihan, trigger, skema, dan frontend masih saling bergantung dan bertentangan dengan README. Jangan deploy branch ini sebelum Tahap 2A–2D selesai dan seluruh uji penerimaan lulus.
