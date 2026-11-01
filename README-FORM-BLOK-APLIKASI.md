# README — FORM BLOK APLIKASI LHI

**Status:** Dokumen konsep/acuan kebutuhan. Belum merupakan persetujuan untuk mengubah script, database, konfigurasi, atau melakukan deployment.

## 1. Tujuan
Menerapkan pengingat bertahap atas keterlambatan pengisian Laporan Harian IPSRS (LHI), mendorong saling mengingatkan antarpetugas, dan menerapkan Mode Blok Aplikasi jika kewajiban LHI tidak dipenuhi.

## 2. Aturan penghitungan
- Sumber acuan pengisian adalah waktu data LHI benar-benar disimpan, yaitu kolom **`created_at`**, bukan tanggal pekerjaan/tanggal yang dipilih pada formulir.
- Semua waktu `created_at` wajib dikonversi ke zona waktu operasional **WIB (`Asia/Jakarta`)** sebelum menentukan tanggal input.
- Penghitungan menggunakan **hari kalender penuh yang telah terlewati** sejak tanggal input LHI terakhir. Secara konsep: `hari_tidak_mengisi = tanggal_WIB_hari_ini - tanggal_WIB_input_terakhir`, dengan hari berjalan yang belum berakhir tidak dimasukkan sebagai satu hari tambahan.
- Hari berjalan **tidak dihitung sebelum pukul 00.00 WIB pada hari berikutnya**. Dengan demikian, angka bertambah ketika satu tanggal kalender penuh telah terlewati; bukan berdasarkan pembulatan durasi jam atau kelipatan 24 jam dari jam input.
- Contoh: input terakhir 22 Oktober 2026 pukul 08.37 WIB menghasilkan 9 hari tidak mengisi pada 1 November 2026 sepanjang tanggal 1 November masih berjalan. Jika belum ada input sampai pergantian ke 2 November 2026 pukul 00.00 WIB, hitungan menjadi 10 hari.
- **Sabtu, Minggu, dan hari libur tetap dihitung** sebagai hari kalender.
- Streak petugas terputus/reset setelah petugas menginput LHI baru yang sah. Penghitungan berikutnya dimulai dari tanggal input terbaru tersebut.
- Perhitungan harus konsisten di backend/server untuk seluruh petugas, notifikasi, rekap kedisiplinan, penonaktifan individual, dan Mode Blok Aplikasi. Frontend hanya menampilkan angka hasil perhitungan server dan tidak menghitung ulang dengan aturan berbeda.
- Notifikasi setiap tahap tidak boleh terkirim berulang kali untuk kejadian/tahap yang sama.

## 3. Tahapan peringatan dan tindakan

| Hari tanpa LHI | Tindakan |
|---|---|
| Hari 1–3 | Pemantauan, belum ada peringatan. |
| Hari ke-4 (>3 hari) | Peringatan 1 kepada petugas yang lalai dan seluruh petugas. |
| Hari ke-6 (>5 hari) | Peringatan 2 kepada petugas yang lalai dan seluruh petugas. |
| Hari ke-7 | Peringatan 3 kepada petugas yang lalai dan seluruh petugas. Sampaikan bahwa jika besok belum mengisi, statusnya akan dinonaktifkan. |
| Hari ke-8 | Status petugas yang belum mengisi dinonaktifkan. Seluruh petugas diberi notifikasi beserta nama petugas tersebut. |
| Hari ke-9 | Status petugas yang dinonaktifkan diaktifkan kembali sesuai konsep, tetapi Mode Blok Aplikasi global diaktifkan. |

Hari ke-4, ke-6, dan seterusnya berarti jumlah hari kalender berturut-turut tanpa LHI yang sah.

## 4. Cakupan notifikasi
Peringatan 1, 2, dan 3 dikirim kepada:
1. Petugas yang belum mengisi LHI.
2. Seluruh petugas lainnya.

Tujuannya agar rekan kerja/tim ikut mengingatkan petugas yang bersangkutan. Notifikasi harus menyebut nama petugas, tahap peringatan, jumlah hari tanpa LHI, dan tindakan yang harus dilakukan. Notifikasi penonaktifan hari ke-8 juga disampaikan kepada seluruh petugas.

## 5. Mode Blok Aplikasi global
Pada hari ke-9:
- Mode Blok Aplikasi menjadi **AKTIF**.
- Semua petugas tidak dapat login, termasuk petugas yang sudah mengisi LHI.
- Hanya KA IPSRS yang dapat masuk melalui prosedur reset.
- Halaman blokir menampilkan keterangan Mode Blok Aplikasi aktif dan tautan **Reset**.

Mode ini bersifat global, bukan hanya memblokir petugas yang terlambat mengisi.

## 6. Prosedur Reset
1. Pengguna menekan tautan **Reset** pada layar blokir.
2. Sistem menampilkan modal untuk memasukkan angka reset.
3. Angka reset sesuai konsep adalah **192645**.
4. Jika angka benar dan pengguna menekan **OK**, sistem menampilkan form login.
5. Hanya akun dengan peran KA IPSRS yang boleh berhasil login. Akun petugas lainnya tetap ditolak.

**Catatan keamanan:** angka reset tidak boleh menjadi jalan pintas untuk melewati autentikasi. Sebelum implementasi, mekanisme harus ditinjau agar angka tidak tertanam terbuka di frontend; autentikasi akun KA IPSRS tetap wajib.

## 7. Kewenangan KA IPSRS dan kelonggaran 12 jam
Setelah login, KA IPSRS membuka menu **Hak Akses** dan menonaktifkan sementara Mode Blok Aplikasi selama **12 jam**.

Selama kelonggaran:
- Petugas dapat login kembali untuk melengkapi LHI.
- Sistem memantau semua petugas yang masih memiliki kewajiban LHI dalam kejadian blokir tersebut.
- Mode Blok hanya menjadi **NONAKTIF** jika **semua petugas yang wajib melengkapi LHI sudah menyelesaikan kewajibannya**.
- Jika masih ada setidaknya satu petugas belum melengkapi LHI saat 12 jam berakhir, Mode Blok Aplikasi kembali **AKTIF**.
- Jika semua kewajiban dipenuhi sebelum 12 jam berakhir, Mode Blok Aplikasi menjadi **NONAKTIF** dan sistem kembali normal.

KA IPSRS perlu melihat waktu mulai, tenggat 12 jam, daftar petugas yang belum melengkapi LHI, dan status pemenuhan masing-masing.

## 8. Definisi semua petugas wajib mengisi
Syarat pemulihan global adalah **semua petugas dalam daftar kewajiban LHI pada kejadian blokir harus melengkapi LHI**. Satu petugas yang belum menyelesaikan kewajibannya menyebabkan Mode Blok tetap/menjadi aktif kembali setelah masa kelonggaran.

Rekomendasi teknis: saat blokir dimulai, simpan daftar petugas dan tanggal LHI yang wajib dilengkapi sebagai snapshot. Dengan demikian syarat pemulihan tidak berubah karena pergantian hari. Cakupan tanggal kewajiban (tunggakan saja atau termasuk LHI hari berjalan) harus ditetapkan sebelum implementasi.

## 9. Pengecualian dan kewenangan
- KA IPSRS dikecualikan dari penonaktifan individual karena tidak mengisi LHI, kecuali kebijakan organisasi menentukan lain.
- Mode Blok global tetap membatasi semua akun selain KA IPSRS.
- Hanya KA IPSRS yang boleh membuka kelonggaran melalui menu Hak Akses.
- Pengaktifan kembali status petugas pada hari ke-9 tidak berarti seluruh sistem dibuka.

## 10. Data dan audit
Sistem perlu mencatat:
- Identitas petugas dan tanggal LHI terakhir yang sah.
- Jumlah hari kalender berturut-turut tanpa LHI.
- Tahap peringatan dan waktu pengiriman.
- Perubahan status aktif/nonaktif, waktu, dan alasan.
- Aktivasi Mode Blok global.
- Identitas KA IPSRS yang melakukan reset/membuka kelonggaran.
- Waktu mulai dan akhir kelonggaran 12 jam.
- Snapshot daftar kewajiban LHI serta status penyelesaiannya.
- Aktivasi ulang Mode Blok jika tenggat habis dan masih ada kewajiban yang belum dipenuhi.

Riwayat audit tidak boleh dihapus atau ditimpa.

## 11. Skenario penerimaan minimum
1. Empat hari kalender tanpa LHI: peringatan 1 diterima petugas terkait dan seluruh tim.
2. Enam hari tanpa LHI: peringatan 2 diterima petugas terkait dan seluruh tim.
3. Tujuh hari tanpa LHI: peringatan 3 dan ancaman penonaktifan hari berikutnya diterima petugas terkait dan seluruh tim.
4. Delapan hari tanpa LHI: status petugas nonaktif dan seluruh tim diberi notifikasi.
5. Hari ke-9: status petugas tersebut diaktifkan kembali sesuai konsep dan Mode Blok global aktif.
6. Saat Mode Blok aktif, semua petugas ditolak login; hanya KA IPSRS dapat masuk setelah reset benar dan autentikasi KA berhasil.
7. Reset salah tidak membuka akses login.
8. KA membuka kelonggaran 12 jam; waktu mulai dan tenggat tercatat.
9. Semua petugas dalam daftar kewajiban melengkapi LHI sebelum tenggat: Mode Blok menjadi nonaktif.
10. Masih ada satu petugas belum melengkapi kewajiban saat 12 jam habis: Mode Blok aktif kembali.
11. Sabtu, Minggu, dan hari libur tetap dihitung.
12. Setiap tahap peringatan hanya dikirim sekali per petugas per kejadian/tahap.

## 12. Tata kelola implementasi
Dokumen ini hanya acuan konsep. **Jangan mengubah script, database, konfigurasi, atau melakukan deployment sebelum audit dan persetujuan.**

Sebelum implementasi:
1. Audit script dan skema database produksi yang benar-benar berjalan.
2. Petakan alur login, status petugas, notifikasi, dan Hak Akses yang sudah ada.
3. Pastikan fitur lama, termasuk mekanisme pembukaan blokir manual, tidak rusak.
4. Buat backup dan checkpoint yang dapat dipulihkan.
5. Siapkan perubahan terpisah dan uji di lingkungan nonproduksi.
6. Minta persetujuan sebelum perubahan produksi.
7. Uji seluruh skenario penerimaan dan verifikasi log sebelum menyatakan selesai.

---
**Prinsip utama:** peringatan bertahap kepada individu dan seluruh tim; penonaktifan individual pada hari ke-8; Mode Blok global pada hari ke-9; pemulihan global hanya setelah semua petugas dalam daftar kewajiban melengkapi LHI.
