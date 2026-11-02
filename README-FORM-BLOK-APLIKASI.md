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
| Hari ke-7 | Peringatan 3 kepada petugas yang lalai dan seluruh petugas. Sampaikan bahwa jika besok belum mengisi, statusnya akan dinonaktifkan. Notifikasi kepada seluruh petugas wajib mencantumkan nama petugas yang lalai agar rekan kerja dapat mengingatkan orang yang bersangkutan secara langsung. |
| Hari ke-8 | Status akun setiap petugas yang belum mengisi dinonaktifkan. Pada saat penonaktifan dilakukan, sistem mengirim notifikasi kepada **seluruh petugas lainnya** dengan mencantumkan nama petugas yang dinonaktifkan dan informasi penonaktifan. Petugas yang akunnya dinonaktifkan menerima pemberitahuan **ketika mencoba login**: setelah identitas akunnya dikenali dan status nonaktif dikonfirmasi oleh server, aplikasi menampilkan pesan bahwa akunnya dinonaktifkan karena belum mengisi LHI selama 8 hari. |
| Hari ke-9 | Masa tunggu setelah penonaktifan individu. Mode Blok Aplikasi global belum diaktifkan pada hari ini. |
| Hari ke-10 | Status petugas yang dinonaktifkan diaktifkan kembali sesuai konsep, tetapi Mode Blok Aplikasi global diaktifkan. |

Hari ke-4, ke-6, dan seterusnya berarti jumlah hari kalender berturut-turut tanpa LHI yang sah.

## 4. Cakupan notifikasi

Peringatan 1, 2, dan 3 dikirim kepada:
1. Petugas yang belum mengisi LHI.
2. Seluruh petugas lainnya.

**Ketentuan wajib untuk notifikasi kepada seluruh petugas:**
- Notifikasi harus mencantumkan **nama petugas yang belum mengisi LHI**, bukan hanya menyebutkan bahwa terdapat petugas yang lalai.
- Jika terdapat lebih dari satu petugas yang belum mengisi, cantumkan seluruh nama petugas yang memenuhi kondisi peringatan pada tahap tersebut.
- Nama harus disertai tahap peringatan dan jumlah hari tanpa LHI agar rekan kerja mengetahui siapa yang perlu diingatkan dan dapat menghubungi orang tersebut secara langsung.
- Pada Peringatan 3 (hari ke-7), pesan kepada seluruh petugas wajib menyebutkan bahwa nama-nama yang tercantum berisiko dinonaktifkan pada hari ke-8 apabila belum melengkapi LHI.
- Notifikasi penonaktifan hari ke-8 disampaikan kepada seluruh petugas lainnya dengan mencantumkan nama petugas yang dinonaktifkan. Petugas yang dinonaktifkan diberi tahu secara langsung saat mencoba login; sistem menampilkan pemberitahuan status nonaktif setelah server memverifikasi akun dan alasan penonaktifannya.

Tujuannya agar rekan kerja/tim dapat mengingatkan petugas yang bersangkutan secara langsung. Notifikasi harus menyebut nama petugas, tahap peringatan, jumlah hari tanpa LHI, dan tindakan yang harus dilakukan. Notifikasi setiap tahap tidak boleh terkirim berulang kali untuk kejadian/tahap yang sama.

## 5. Mode Blok Aplikasi global

Pada hari ke-10:
- Mode Blok Aplikasi menjadi **AKTIF**.
- Tampilan awal aplikasi secara otomatis berubah menjadi **Form Blok Aplikasi**.
- Form login normal disembunyikan sepenuhnya dan tidak ditampilkan selama Mode Blok Aplikasi aktif.
- Form Blok Aplikasi menggantikan tampilan form login untuk seluruh pengguna.
- Form Blok Aplikasi menampilkan keterangan bahwa aplikasi sedang diblokir secara global dan menyediakan tautan **Reset**.
- Semua petugas tidak dapat mengakses aplikasi melalui form login normal, termasuk petugas yang sudah memenuhi kewajiban LHI.
- Hanya KA IPSRS yang dapat melanjutkan melalui prosedur Reset dan autentikasi akun KA IPSRS.

Mode ini bersifat global, bukan hanya memblokir petugas yang terlambat mengisi.

## 6. Prosedur Reset
1. Saat Mode Blok Aplikasi aktif, seluruh pengguna melihat **Form Blok Aplikasi**, bukan form login normal.
2. KA IPSRS menekan tautan **Reset** pada Form Blok Aplikasi.
3. Sistem menampilkan modal untuk memasukkan angka reset.
4. Angka reset sesuai konsep adalah **192645**.
5. Jika angka salah, sistem tidak membuka form autentikasi dan akses tetap diblokir.
6. Jika angka benar dan pengguna menekan **OK**, sistem menampilkan form autentikasi/login khusus untuk melanjutkan proses masuk KA IPSRS.
7. Pengguna tetap wajib memasukkan kredensial akun. Hanya akun dengan peran KA IPSRS yang boleh berhasil login; akun petugas lainnya tetap ditolak.
8. Keberhasilan memasukkan angka reset saja tidak boleh membuka aplikasi atau memberikan akses kepada pengguna.

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
- Pengaktifan kembali status petugas pada hari ke-10 tidak berarti seluruh sistem dibuka.

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
1. Empat hari kalender tanpa LHI: Peringatan 1 diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama petugas yang lalai.
2. Enam hari tanpa LHI: Peringatan 2 diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama petugas yang lalai.
3. Tujuh hari tanpa LHI: Peringatan 3 dan ancaman penonaktifan hari berikutnya diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama setiap petugas yang lalai agar dapat diingatkan langsung.
4. Delapan hari tanpa LHI: status akun petugas yang bersangkutan dinonaktifkan. Seluruh petugas lainnya menerima notifikasi yang mencantumkan nama petugas tersebut dan informasi penonaktifan. Ketika petugas yang dinonaktifkan mencoba login, aplikasi menampilkan pemberitahuan bahwa akunnya dinonaktifkan karena belum mengisi LHI selama 8 hari.
5. Hari ke-9: masa tunggu setelah penonaktifan individu; Mode Blok global belum aktif.
6. Hari ke-10: status petugas tersebut diaktifkan kembali sesuai konsep dan Mode Blok global aktif.
7. Saat Mode Blok aktif, tampilan awal aplikasi berubah menjadi Form Blok Aplikasi; form login normal tidak ditampilkan kepada seluruh pengguna.
8. Form Blok Aplikasi menampilkan keterangan blokir global dan tautan Reset.
9. Reset salah tidak membuka form autentikasi maupun akses aplikasi.
10. Reset benar hanya menampilkan form autentikasi untuk melanjutkan login; hanya akun KA IPSRS yang berhasil masuk dan akun petugas biasa tetap ditolak.
11. KA membuka kelonggaran 12 jam; waktu mulai dan tenggat tercatat.
12. Semua petugas dalam daftar kewajiban melengkapi LHI sebelum tenggat: Mode Blok menjadi nonaktif.
13. Masih ada satu petugas belum melengkapi kewajiban saat 12 jam habis: Mode Blok aktif kembali.
14. Sabtu, Minggu, dan hari libur tetap dihitung.
15. Setiap tahap peringatan hanya dikirim sekali per petugas per kejadian/tahap, dan notifikasi ke seluruh tim mencantumkan nama petugas yang benar-benar memenuhi kondisi tahap tersebut.

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
**Prinsip utama:** peringatan bertahap kepada individu dan seluruh tim dengan mencantumkan nama petugas yang lalai; penonaktifan individual pada hari ke-8 yang diberitahukan kepada seluruh petugas lainnya, sedangkan petugas yang dinonaktifkan menerima pesan status nonaktif saat mencoba login; masa tunggu hari ke-9; Mode Blok global pada hari ke-10; pemulihan global hanya setelah semua petugas dalam daftar kewajiban melengkapi LHI.
