# README — FORM BLOK APLIKASI LHI

**Status:** Dokumen konsep/acuan kebutuhan. Belum merupakan persetujuan untuk mengubah script, database, konfigurasi, atau melakukan deployment.

## 1. Tujuan
Menerapkan pengingat bertahap atas keterlambatan pengisian Laporan Harian IPSRS (LHI), mendorong saling mengingatkan antarpetugas, dan menerapkan Mode Blok Aplikasi jika kewajiban LHI tidak dipenuhi.

## 2. Aturan penghitungan
- **Dasar kepatuhan adalah tanggal input LHI**, yaitu tanggal dan waktu ketika data LHI benar-benar berhasil disimpan ke sistem pada kolom **`created_at`**. Bukan tanggal kejadian pekerjaan atau tanggal kejadian yang dipilih pada formulir.
- Semua waktu `created_at` wajib dikonversi ke zona waktu operasional **WIB (`Asia/Jakarta`)** sebelum menentukan tanggal input.
- **Tanggal kejadian pekerjaan dan tanggal input LHI adalah dua informasi berbeda.** Tanggal kejadian hanya menjelaskan kapan pekerjaan berlangsung dan tidak digunakan untuk menghitung kepatuhan. Tanggal input menunjukkan kapan petugas benar-benar mengirim/menyimpan laporan dan menjadi dasar penghitungan aktivitas serta hari tanpa input.
- Jika beberapa pekerjaan memiliki tanggal kejadian yang sama tetapi LHI-nya disimpan pada tanggal input yang berbeda, setiap tanggal penyimpanan tersebut tetap dihitung sebagai hari aktif input. Contohnya, tujuh pekerjaan dengan tanggal kejadian 22 Oktober yang diinput masing-masing pada 22, 23, 24, 25, 26, 27, dan 28 Oktober menunjukkan aktivitas input pada tujuh tanggal kalender.
- Jika petugas menyimpan beberapa LHI pada tanggal kalender yang sama, tanggal tersebut dihitung **satu hari aktif input**, bukan sebanyak jumlah LHI yang disimpan. Jumlah laporan tidak menggandakan jumlah hari kepatuhan.
- Penghitungan menggunakan **jumlah tanggal kalender penuh tanpa input setelah tanggal input terakhir**. Secara konsep: `hari_tidak_mengisi = max(0, tanggal_WIB_hari_ini - tanggal_WIB_input_terakhir - 1 hari)`. Hari tanggal input terakhir tidak dihitung sebagai hari tanpa input, dan tanggal berjalan yang belum selesai juga tidak dihitung.
- Hari tanpa input bertambah pada pukul **00.00 WIB** setelah satu tanggal kalender tanpa input selesai terlewati. Penghitungan bukan berdasarkan pembulatan durasi jam atau kelipatan 24 jam dari jam input.
- Contoh: input terakhir 22 Oktober 2026 pukul 08.37 WIB. Pada 1 November 2026, jumlah hari kalender penuh tanpa input adalah 9 hari (23–31 Oktober). Jika belum ada input sampai pergantian ke 2 November 2026 pukul 00.00 WIB, jumlahnya menjadi 10 hari (23 Oktober–1 November).
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
| Hari ke-8 | Status akun petugas yang belum mengisi dinonaktifkan. Petugas yang akunnya dinonaktifkan menerima peringatan ketika mencoba login dan menekan tombol **Masuk**; setelah server memverifikasi status nonaktif, aplikasi menampilkan alasan penonaktifan. **Petugas lain yang akunnya tetap aktif juga menerima notifikasi di dalam aplikasi** setelah berhasil login/ketika sudah berada di aplikasi, yang menyebutkan nama petugas yang dinonaktifkan. |
| Hari ke-9 | Masa tunggu setelah penonaktifan individu. Mode Blok Aplikasi global belum diaktifkan pada hari ini. |
| Hari ke-10 | Mode Blok Aplikasi global diaktifkan. Status blokir individual yang sudah terjadi pada hari ke-8 tetap tercatat dan baru dibuka bersamaan dengan blokir global ketika KA IPSRS berhasil melakukan Reset dan memulai kelonggaran 12 jam. |

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
- Pada hari ke-8 terdapat dua tampilan pemberitahuan yang berbeda: (a) petugas yang dinonaktifkan melihat peringatan saat mencoba login dan menekan tombol **Masuk**, setelah server memverifikasi status akun; (b) petugas lain yang akunnya tetap aktif menerima notifikasi di dalam aplikasi setelah berhasil login atau ketika sudah berada di aplikasi. Notifikasi untuk petugas aktif wajib mencantumkan nama petugas yang dinonaktifkan dan informasi bahwa akun tersebut telah dinonaktifkan. Notifikasi ini bukan pemberitahuan kepada akun yang sedang diblokir.

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
5. Jika angka salah, sistem tidak membuka form login dan akses tetap diblokir.
6. Jika angka benar dan pengguna menekan **OK**, sistem menampilkan **form login yang sama dengan form login normal**. Sistem menggunakan kembali komponen/form login yang sudah ada; **tidak membuat form autentikasi atau form login baru**.
7. Pada alur login setelah Reset, pengguna tetap wajib memasukkan username dan password melalui form login yang sama. Alur ini hanya mengizinkan akun dengan role **KA IPSRS** untuk berhasil masuk.
8. **Validasi role KA IPSRS wajib dilakukan di server/backend** berdasarkan identitas dan role akun yang terautentikasi. Pembatasan di frontend saja tidak cukup dan tidak boleh menjadi dasar pemberian akses.
9. Jika akun yang terautentikasi bukan KA IPSRS, server harus menolak akses dan aplikasi tetap dalam kondisi blokir. Petugas biasa tetap ditolak meskipun mengetahui angka Reset dan berhasil memasukkannya dengan benar.
10. Angka Reset yang benar hanya mengizinkan form login yang sama ditampilkan untuk proses autentikasi KA IPSRS; angka tersebut **tidak** membuktikan identitas, tidak memberikan sesi login, tidak membuka aplikasi, dan tidak melewati pemeriksaan kredensial maupun role.

**Ketentuan keamanan:** angka Reset tidak boleh menjadi jalan pintas untuk melewati autentikasi. Sebelum implementasi, mekanisme penyimpanan dan validasinya harus diaudit agar angka tidak tertanam terbuka di frontend. Keputusan menampilkan form login setelah Reset tidak mengubah kewajiban autentikasi username/password dan validasi role KA IPSRS di server.

## 7. Kewenangan KA IPSRS dan kelonggaran 12 jam
Setelah berhasil melewati prosedur Reset dan autentikasi role KA IPSRS, KA IPSRS membuka menu **Hak Akses** dan menjalankan perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**. Perintah ini merupakan satu tindakan pemulihan terpadu: sistem membuka Mode Blok Aplikasi global **sekaligus mengaktifkan kembali seluruh akun yang berstatus diblokir individual karena ketidakpatuhan LHI**. Kedua jenis blokir harus dibuka dalam satu proses yang sama; tidak boleh hanya blokir global yang dibuka sementara blokir individual masih menghalangi petugas masuk.

Saat perintah tersebut berhasil dijalankan, sistem mencatat waktu mulai dan tenggat 12 jam serta membuat snapshot kewajiban LHI sebagaimana dijelaskan pada Bagian 8.

Selama kelonggaran 12 jam:
- Semua petugas dapat login, termasuk petugas yang sebelumnya dinonaktifkan secara individual pada hari ke-8.
- Seluruh petugas mendapat kesempatan melengkapi kewajiban LHI yang tercantum dalam snapshot.
- Sistem memantau pemenuhan kewajiban setiap petugas dalam snapshot.
- Pembukaan blokir individual tidak menghapus riwayat pelanggaran maupun kewajiban LHI yang masih tertunggak.

Ketika 12 jam berakhir:
- Jika seluruh kewajiban dalam snapshot telah dipenuhi, Mode Blok global tetap **NONAKTIF** dan aplikasi beroperasi normal.
- Jika masih ada setidaknya satu kewajiban dalam snapshot yang belum dipenuhi, Mode Blok Aplikasi global kembali **AKTIF** dan seluruh pengguna kembali tidak dapat mengakses aplikasi normal.
- Jika blokir global aktif kembali, blokir individual tidak perlu diterapkan kembali satu per satu. Blokir global menjadi pengunci akses bagi seluruh petugas sampai KA IPSRS melakukan prosedur Reset dan pemulihan terpadu berikutnya.

KA IPSRS harus dapat melihat waktu mulai, tenggat 12 jam, daftar petugas dan kewajiban dalam snapshot, serta status pemenuhan masing-masing.

## 8. Definisi kewajiban petugas dan snapshot berdasarkan input LHI
Syarat pemulihan global adalah **setiap petugas yang tercatat belum memenuhi kewajiban input LHI pada saat kelonggaran dimulai harus melakukan input LHI yang sah selama periode kelonggaran 12 jam**. Kewajiban ini dinilai berdasarkan aktivitas input LHI ke sistem, bukan berdasarkan tanggal kejadian pekerjaan, tanggal yang dipilih pada formulir, atau jumlah laporan untuk tanggal kejadian tertentu.

Pada saat KA IPSRS menjalankan perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**, sistem menyimpan snapshot tetap yang berisi:
- Identitas setiap petugas yang pada saat itu masih memenuhi kondisi tidak patuh berdasarkan perhitungan tanggal input LHI (`created_at`) dalam WIB.
- Waktu/tanggal input LHI terakhir yang sah milik masing-masing petugas pada saat snapshot dibuat.
- Jumlah hari kalender tanpa input LHI yang telah tercapai pada saat snapshot dibuat.
- Status pemenuhan kewajiban masing-masing petugas selama masa kelonggaran.

**Snapshot tidak berisi daftar tanggal kejadian pekerjaan atau daftar laporan yang harus dilengkapi satu per satu.** Tanggal kejadian pada formulir tidak digunakan untuk menentukan kewajiban maupun keberhasilan pemenuhan.

**Setiap petugas pelanggar yang tercantum dalam snapshot wajib menginput minimal 1 (satu) laporan LHI yang sah selama periode kelonggaran 12 jam. Satu laporan yang berhasil disimpan sudah cukup untuk memenuhi kewajiban pemulihan petugas tersebut.** Petugas tidak diwajibkan menginput sebanyak jumlah hari ia tidak aktif, sebanyak jumlah hari keterlambatan, atau sebanyak jumlah pekerjaan yang pernah dilakukan. Keberhasilan input dibuktikan oleh `created_at` yang tercatat selama periode kelonggaran. Tanggal kejadian pekerjaan pada laporan tidak memengaruhi penilaian ini.

LHI untuk hari berjalan tidak menjadi kewajiban tambahan yang terpisah. Namun, setiap input LHI yang sah selama masa kelonggaran tetap dicatat sebagai aktivitas input sesuai tanggal `created_at` dalam WIB.

Daftar petugas dalam snapshot dikunci saat kelonggaran dimulai. Pergantian tanggal selama 12 jam tidak menambah petugas atau kewajiban baru ke dalam snapshot. Snapshot tetap menjadi acuan evaluasi ketika masa kelonggaran berakhir, termasuk jika Mode Blok Aplikasi harus diaktifkan kembali.

## 9. Pengecualian dan kewenangan
- **Petugas yang cuti, sakit, izin, atau tidak masuk kerja tidak memiliki status pengecualian khusus dalam penghitungan kepatuhan LHI.** Kondisi tersebut tidak otomatis menghentikan, menunda, atau mengatur ulang hitungan hari tanpa input.
- Selama petugas belum mencapai tahapan pelanggaran dan akun tidak sedang diblokir, status akun tetap **NORMAL** dan petugas dapat menggunakan aplikasi seperti biasa. Tidak ada pemblokiran hanya karena petugas berstatus cuti, sakit, izin, atau tidak masuk kerja.
- Jika setelah itu petugas tetap tidak memiliki input LHI yang sah selama tujuh hari kalender berturut-turut, tahapan peringatan dan pemblokiran berjalan sesuai Bagian 2 dan 3: peringatan ketiga pada hari ke-7, penonaktifan akun individual pada hari ke-8, masa tunggu pada hari ke-9, dan Mode Blok global pada hari ke-10.
- Penormalan akun yang sudah diblokir tetap mengikuti prosedur pemulihan terpadu sebelumnya: Reset oleh KA IPSRS, autentikasi role KA IPSRS di server, lalu perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**. Tidak ada jalur normalisasi khusus hanya karena alasan cuti, sakit, izin, atau tidak masuk kerja.
- KA IPSRS dikecualikan dari penonaktifan individual karena tidak mengisi LHI, kecuali kebijakan organisasi menentukan lain.
- Mode Blok global tetap membatasi semua akun selain KA IPSRS.
- Hanya KA IPSRS yang boleh membuka kelonggaran melalui menu Hak Akses.
- Pembukaan blokir individual akibat ketidakpatuhan LHI hanya dilakukan bersamaan dengan pembukaan blokir global oleh KA IPSRS melalui perintah pemulihan terpadu. Tidak ada pembukaan blokir individual otomatis pada hari ke-10 sebelum KA IPSRS melakukan Reset dan memulai kelonggaran.

## 10. Data dan audit
Sistem perlu mencatat:
- Identitas petugas, waktu input LHI terakhir yang sah (`created_at`), serta tanggal input hasil konversi WIB. Tanggal kejadian pekerjaan dicatat sebagai data laporan, tetapi tidak digunakan sebagai dasar hitung kepatuhan.
- Jumlah hari kalender berturut-turut tanpa LHI.
- Tahap peringatan dan waktu pengiriman.
- Perubahan status aktif/nonaktif, waktu, dan alasan.
- Aktivasi Mode Blok global.
- Identitas KA IPSRS yang melakukan reset/membuka kelonggaran.
- Waktu mulai dan akhir kelonggaran 12 jam.
- Snapshot kepatuhan berdasarkan input LHI: identitas petugas, waktu input LHI terakhir (`created_at`), jumlah hari tanpa input saat snapshot dibuat, dan status apakah petugas telah melakukan input LHI sah selama kelonggaran.
- Aktivasi ulang Mode Blok jika tenggat habis dan masih ada kewajiban yang belum dipenuhi.

Riwayat audit tidak boleh dihapus atau ditimpa.

## 11. Skenario penerimaan minimum
1. Empat hari kalender tanpa LHI: Peringatan 1 diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama petugas yang lalai.
2. Enam hari tanpa LHI: Peringatan 2 diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama petugas yang lalai.
3. Tujuh hari tanpa LHI: Peringatan 3 dan ancaman penonaktifan hari berikutnya diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama setiap petugas yang lalai agar dapat diingatkan langsung.
4. Delapan hari tanpa LHI: status akun petugas yang bersangkutan dinonaktifkan. Ketika petugas tersebut mencoba login dan menekan tombol **Masuk**, aplikasi menampilkan peringatan bahwa akunnya dinonaktifkan karena belum mengisi LHI selama 8 hari. Petugas lain yang akunnya tetap aktif menerima notifikasi di dalam aplikasi setelah berhasil login atau ketika sudah berada di aplikasi, dengan mencantumkan nama petugas yang dinonaktifkan.
5. Hari ke-9: masa tunggu setelah penonaktifan individu; Mode Blok global belum aktif.
6. Hari ke-10: Mode Blok Aplikasi global aktif; akun yang sebelumnya diblokir individual masih berstatus diblokir sampai KA IPSRS berhasil melakukan Reset dan menjalankan perintah pemulihan terpadu.
7. Saat Mode Blok aktif, tampilan awal aplikasi berubah menjadi Form Blok Aplikasi; form login normal tidak ditampilkan kepada seluruh pengguna.
8. Form Blok Aplikasi menampilkan keterangan blokir global dan tautan Reset.
9. Reset salah tidak membuka form autentikasi maupun akses aplikasi.
10. Reset benar menampilkan kembali form login normal yang sama (tanpa membuat form autentikasi baru); pengguna tetap memasukkan username dan password, server memvalidasi role KA IPSRS, hanya akun KA IPSRS yang berhasil masuk, dan akun petugas biasa tetap ditolak meskipun mengetahui angka Reset.
11. Setelah Reset dan autentikasi role KA IPSRS, KA menjalankan perintah pemulihan terpadu. Sistem membuka blokir global dan seluruh blokir individual akibat ketidakpatuhan LHI secara bersamaan, lalu mencatat waktu mulai serta tenggat kelonggaran 12 jam.
12. Petugas yang sebelumnya diblokir individual dapat login selama kelonggaran 12 jam dan melakukan input LHI yang sah; riwayat pelanggarannya tetap tersimpan.
13. Setiap petugas pelanggar dalam snapshot wajib menginput minimal 1 (satu) laporan LHI yang sah selama kelonggaran 12 jam. Satu laporan saja sudah cukup; petugas tidak diwajibkan mengganti seluruh hari tanpa input atau menginput sebanyak jumlah pekerjaan/tunggakannya.
14. Semua petugas dalam snapshot telah melakukan input LHI sah sebelum tenggat: blokir global tetap nonaktif dan aplikasi kembali normal.
15. Masih ada satu petugas dalam snapshot yang belum melakukan input LHI sah saat 12 jam habis: blokir global aktif kembali untuk seluruh pengguna; blokir individual tidak diterapkan ulang satu per satu.
16. Petugas yang cuti, sakit, izin, atau tidak masuk kerja tetap berstatus normal selama belum mencapai tahapan pelanggaran dan akun belum diblokir; kondisi tersebut tidak menghentikan hitungan hari tanpa input. Jika mencapai tujuh hari berturut-turut tanpa input, tahapan peringatan dan pemblokiran mengikuti ketentuan yang sama.
17. Sabtu, Minggu, dan hari libur tetap dihitung.
18. Setiap tahap peringatan hanya dikirim sekali per petugas per kejadian/tahap, dan notifikasi ke seluruh tim mencantumkan nama petugas yang benar-benar memenuhi kondisi tahap tersebut.
19. Tujuh LHI dengan tanggal kejadian pekerjaan yang sama, tetapi disimpan pada tujuh tanggal input berbeda, dihitung sebagai aktivitas input pada tujuh hari tersebut. Beberapa LHI yang disimpan pada satu tanggal input yang sama hanya dihitung sebagai satu hari aktif input.

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
**Prinsip utama:** kepatuhan dihitung dari tanggal input LHI (`created_at`) dalam WIB, bukan tanggal kejadian pekerjaan; beberapa LHI dengan tanggal kejadian sama tetap dihitung menurut tanggal input masing-masing, sedangkan beberapa LHI pada tanggal input yang sama dihitung sebagai satu hari aktif; peringatan bertahap pada hari ke-4, ke-6, dan ke-7 disampaikan kepada petugas yang lalai dan seluruh tim dengan mencantumkan nama petugas; pada hari ke-8 petugas yang dinonaktifkan menerima peringatan saat mencoba login dan menekan tombol Masuk, sedangkan petugas lain yang akunnya tetap aktif menerima notifikasi di dalam aplikasi setelah berhasil login atau ketika sudah berada di aplikasi, dengan mencantumkan nama petugas yang dinonaktifkan; hari ke-9 merupakan masa tunggu; pada hari ke-10 Mode Blok global aktif; setelah KA IPSRS berhasil melakukan Reset, satu perintah pemulihan terpadu membuka blokir global dan seluruh blokir individual akibat ketidakpatuhan LHI sekaligus serta memulai kelonggaran 12 jam; jika seluruh kewajiban snapshot dipenuhi aplikasi tetap normal, sedangkan jika masih ada kewajiban yang belum dipenuhi blokir global aktif kembali untuk seluruh pengguna.
