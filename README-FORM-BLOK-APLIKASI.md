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
- **LHI yang kemudian dibatalkan tidak dihitung sebagai aktivitas kepatuhan.** Tanggal `created_at` dari laporan yang dibatalkan diperlakukan seolah-olah tidak ada input LHI pada tanggal tersebut. Jika pada tanggal yang sama masih ada setidaknya satu LHI lain yang sah dan tidak dibatalkan, tanggal tersebut tetap dihitung sebagai satu hari aktif input; jika seluruh LHI pada tanggal itu dibatalkan, tanggal tersebut dihitung sebagai hari tanpa input.
- Jika pembatalan menyebabkan tanggal input terakhir yang sah bergeser ke tanggal sebelumnya, penghitungan hari tanpa input dilanjutkan berdasarkan tanggal input sah terakhir yang tersisa. Dengan demikian, jika setelah pembatalan petugas mencapai hari ke-8 berturut-turut tanpa LHI sah, akun petugas langsung mengikuti ketentuan penonaktifan individual hari ke-8. Pembatalan tidak mengulang hitungan dari nol dan tidak memberi masa tenggang baru.
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
| Hari ke-10 | **Jika minimal satu petugas mencapai hari ke-10 tanpa LHI sah, Mode Blok Aplikasi global langsung diaktifkan untuk seluruh pengguna.** Tidak perlu menunggu petugas lain mencapai hari ke-10. Status blokir individual yang sudah terjadi pada hari ke-8 tetap tercatat dan baru dibuka bersamaan dengan blokir global ketika KA IPSRS berhasil melakukan Reset dan memulai kelonggaran 12 jam. |

Hari ke-4, ke-6, dan seterusnya berarti jumlah hari kalender berturut-turut tanpa LHI yang sah. **Pemicu blokir global hari ke-10 bersifat individual sebagai pemicu dan global sebagai dampak: cukup satu petugas yang mencapai hari ke-10 tanpa LHI sah untuk mengaktifkan blokir aplikasi bagi seluruh pengguna.**

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
- Jika **minimal satu petugas** mencapai hari ke-10 tanpa LHI sah, Mode Blok Aplikasi menjadi **AKTIF untuk seluruh pengguna**. Sistem tidak menunggu seluruh petugas yang lalai mencapai hari ke-10.
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
10. **Jika akun KA IPSRS sendiri sedang berstatus diblokir individual karena tidak mengisi LHI, KA IPSRS tetap diperbolehkan melewati jalur autentikasi khusus Reset untuk masuk ke fungsi pemulihan.** Ketentuan ini bukan pembatalan atau penghapusan status blokir individual KA IPSRS.
11. Setelah kredensial dan role KA IPSRS diverifikasi oleh server melalui jalur Reset, server hanya boleh memberikan **sesi terbatas khusus pemulihan**. Sesi tersebut hanya dapat membuka menu/fungsi **Hak Akses** yang diperlukan untuk menjalankan perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**.
12. Selama sesi terbatas tersebut, KA IPSRS **tidak boleh** mengakses dashboard, laporan LHI, rekap, atau menu operasional lainnya. Akses operasional baru dipulihkan setelah perintah pemulihan terpadu berhasil dijalankan sesuai Bagian 7.
13. Jika autentikasi gagal, role bukan KA IPSRS, atau server tidak dapat memastikan identitas dan role, akses pemulihan ditolak dan seluruh status blokir tetap berlaku.
14. Angka Reset yang benar hanya mengizinkan form login yang sama ditampilkan untuk proses autentikasi KA IPSRS; angka tersebut **tidak** membuktikan identitas, tidak memberikan sesi login, tidak membuka aplikasi, dan tidak melewati pemeriksaan kredensial maupun role.

**Ketentuan keamanan:** angka Reset tidak boleh menjadi jalan pintas untuk melewati autentikasi. Sebelum implementasi, mekanisme penyimpanan dan validasinya harus diaudit agar angka tidak tertanam terbuka di frontend. Keputusan menampilkan form login setelah Reset tidak mengubah kewajiban autentikasi username/password dan validasi role KA IPSRS di server.

## 7. Kewenangan KA IPSRS dan kelonggaran 12 jam
Setelah berhasil melewati prosedur Reset dan autentikasi role KA IPSRS, KA IPSRS masuk melalui sesi terbatas khusus pemulihan dan hanya dapat membuka menu **Hak Akses** yang diperlukan untuk menjalankan perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**. Ketentuan ini tetap berlaku apabila akun KA IPSRS sedang berstatus diblokir individual: jalur Reset mengizinkan KA masuk hanya untuk pemulihan, bukan untuk mengakses aplikasi secara normal. Perintah ini merupakan satu tindakan pemulihan terpadu: sistem membuka Mode Blok Aplikasi global **sekaligus mengaktifkan kembali seluruh akun yang berstatus diblokir individual karena ketidakpatuhan LHI**. Kedua jenis blokir harus dibuka dalam satu proses yang sama; tidak boleh hanya blokir global yang dibuka sementara blokir individual masih menghalangi petugas masuk.

Saat perintah tersebut berhasil dijalankan, sistem mencatat waktu mulai dan tenggat 12 jam serta membuat snapshot kewajiban LHI sebagaimana dijelaskan pada Bagian 8.

**Jika perintah pemulihan gagal dijalankan:** tidak boleh ada perubahan sebagian. Mode Blok Aplikasi global tetap **AKTIF**, status blokir individual tetap seperti sebelum perintah dijalankan, dan kelonggaran 12 jam **belum dimulai**. Sistem harus menampilkan informasi bahwa pembukaan blokir gagal dan KA IPSRS dapat mencoba kembali. Seluruh perubahan pembukaan blokir, perubahan status insiden, pencatatan waktu mulai/tenggat, dan pembuatan snapshot harus berhasil sebagai satu transaksi; jika salah satu gagal, seluruh perubahan transaksi dibatalkan. Keberhasilan hanya boleh ditampilkan setelah server memastikan transaksi berhasil.

Jika transaksi sebenarnya sudah berhasil tetapi respons kepada aplikasi terputus atau tidak diterima, percobaan ulang harus mengenali bahwa kelonggaran sudah berjalan. Percobaan ulang tersebut **tidak boleh membuka sesi kelonggaran baru atau menggeser waktu mulai dan tenggat 12 jam**. Waktu mulai dan tenggat hanya ditetapkan oleh keberhasilan transaksi pertama.

Selama kelonggaran 12 jam:
- Semua petugas dapat login, termasuk petugas yang sebelumnya dinonaktifkan secara individual pada hari ke-8.
- **Hanya petugas yang lalai dan tercantum dalam snapshot** yang wajib melengkapi LHI untuk memenuhi syarat pembukaan blokir. Petugas lain yang tidak tercantum dalam snapshot tidak dibebani kewajiban tambahan untuk menggugurkan blokir.
- Sistem memantau pemenuhan kewajiban setiap petugas dalam snapshot.
- Pembukaan blokir individual tidak menghapus riwayat pelanggaran maupun kewajiban LHI yang masih tertunggak.

Ketika 12 jam berakhir:
- Jika seluruh kewajiban dalam snapshot telah dipenuhi, Mode Blok global tetap **NONAKTIF** dan aplikasi beroperasi normal.
- Jika masih ada setidaknya satu kewajiban dalam snapshot yang belum dipenuhi, Mode Blok Aplikasi global kembali **AKTIF** dan seluruh pengguna kembali tidak dapat mengakses aplikasi normal.
- Jika blokir global aktif kembali, blokir individual tidak perlu diterapkan kembali satu per satu. Blokir global menjadi pengunci akses bagi seluruh petugas sampai KA IPSRS melakukan prosedur Reset dan pemulihan terpadu berikutnya.
- **Jika seluruh kewajiban snapshot telah dipenuhi dan kelonggaran 12 jam berakhir dengan sukses, pemulihan dinyatakan selesai dan aplikasi kembali ke kondisi NORMAL secara permanen (sampai terjadi pelanggaran baru).** Seluruh status blokir akibat kejadian sebelumnya dinyatakan selesai; tidak ada sisa hitungan hari pelanggaran lama yang dibawa atau langsung memicu blokir kembali.
- Setelah kembali normal, pemantauan kepatuhan berjalan seperti biasa untuk seluruh petugas. Bagi setiap petugas, hitungan hari tanpa input berikutnya didasarkan pada tanggal `created_at` dari LHI sah terakhir miliknya, termasuk LHI sah yang diinput selama masa kelonggaran. Hari kalender setelah tanggal input sah terakhir dihitung kembali dengan aturan yang sama pada Bagian 2. Jika kemudian petugas kembali tidak menginput selama tujuh hari kalender berturut-turut, tahapan peringatan dan pemblokiran baru berjalan lagi sesuai Bagian 3. Selama tidak ada pelanggaran baru, aplikasi tetap normal.

KA IPSRS harus dapat melihat waktu mulai, tenggat 12 jam, daftar petugas dan kewajiban dalam snapshot, serta status pemenuhan masing-masing.

## 8. Definisi kewajiban petugas dan snapshot berdasarkan input LHI
Syarat pemulihan global adalah **hanya petugas yang lalai dan tercantum dalam snapshot yang wajib melakukan input minimal satu LHI sah selama periode kelonggaran 12 jam**. Petugas lain yang tidak tercantum dalam snapshot tidak diwajibkan menginput LHI tambahan sebagai syarat untuk menggugurkan blokir global. Kewajiban ini dinilai berdasarkan aktivitas input LHI ke sistem, bukan berdasarkan tanggal kejadian pekerjaan, tanggal yang dipilih pada formulir, atau jumlah laporan untuk tanggal kejadian tertentu.

Pada saat KA IPSRS menjalankan perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**, sistem menyimpan snapshot tetap yang berisi:
- Identitas **hanya petugas yang lalai/tidak memenuhi kewajiban LHI dan menjadi dasar kejadian blokir** berdasarkan perhitungan tanggal input LHI (`created_at`) dalam WIB. Petugas yang tidak lalai tidak dimasukkan ke dalam daftar kewajiban snapshot.
- Waktu/tanggal input LHI terakhir yang sah milik masing-masing petugas pada saat snapshot dibuat.
- Jumlah hari kalender tanpa input LHI yang telah tercapai pada saat snapshot dibuat.
- Status pemenuhan kewajiban masing-masing petugas selama masa kelonggaran.

**Snapshot tidak berisi daftar tanggal kejadian pekerjaan atau daftar laporan yang harus dilengkapi satu per satu.** Tanggal kejadian pada formulir tidak digunakan untuk menentukan kewajiban maupun keberhasilan pemenuhan.

**Setiap petugas lalai yang tercantum dalam snapshot wajib menginput minimal 1 (satu) laporan LHI yang sah selama periode kelonggaran 12 jam. Satu laporan yang berhasil disimpan sudah cukup untuk memenuhi kewajiban pemulihan petugas tersebut. Petugas yang tidak tercantum dalam snapshot tidak wajib menginput LHI tambahan untuk membuka blokir global.** Petugas tidak diwajibkan menginput sebanyak jumlah hari ia tidak aktif, sebanyak jumlah hari keterlambatan, atau sebanyak jumlah pekerjaan yang pernah dilakukan. Keberhasilan input dibuktikan oleh `created_at` yang tercatat selama periode kelonggaran. Tanggal kejadian pekerjaan pada laporan tidak memengaruhi penilaian ini.

LHI untuk hari berjalan tidak menjadi kewajiban tambahan yang terpisah. Namun, setiap input LHI yang sah selama masa kelonggaran tetap dicatat sebagai aktivitas input sesuai tanggal `created_at` dalam WIB.

Daftar petugas dalam snapshot dikunci saat kelonggaran dimulai. Pergantian tanggal selama 12 jam tidak menambah petugas atau kewajiban baru ke dalam snapshot. Snapshot tetap menjadi acuan evaluasi ketika masa kelonggaran berakhir, termasuk jika Mode Blok Aplikasi harus diaktifkan kembali.

## 9. Pengecualian dan kewenangan
- **Petugas yang cuti, sakit, izin, atau tidak masuk kerja tidak memiliki status pengecualian khusus dalam penghitungan kepatuhan LHI.** Kondisi tersebut tidak otomatis menghentikan, menunda, atau mengatur ulang hitungan hari tanpa input.
- Selama petugas belum mencapai tahapan pelanggaran dan akun tidak sedang diblokir, status akun tetap **NORMAL** dan petugas dapat menggunakan aplikasi seperti biasa. Tidak ada pemblokiran hanya karena petugas berstatus cuti, sakit, izin, atau tidak masuk kerja.
- Jika setelah itu petugas tetap tidak memiliki input LHI yang sah selama tujuh hari kalender berturut-turut, tahapan peringatan dan pemblokiran berjalan sesuai Bagian 2 dan 3: peringatan ketiga pada hari ke-7, penonaktifan akun individual pada hari ke-8, masa tunggu pada hari ke-9, dan Mode Blok global pada hari ke-10.
- Penormalan akun yang sudah diblokir tetap mengikuti prosedur pemulihan terpadu sebelumnya: Reset oleh KA IPSRS, autentikasi role KA IPSRS di server, lalu perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam**. Tidak ada jalur normalisasi khusus hanya karena alasan cuti, sakit, izin, atau tidak masuk kerja.
- **Tidak ada pengecualian berdasarkan jabatan. Seluruh petugas aktif, termasuk KA IPSRS, wajib mengisi LHI dan mengikuti tahapan peringatan serta pemblokiran individual yang sama.** Jika petugas mana pun tidak memiliki LHI sah selama tujuh hari kalender berturut-turut, petugas tersebut dinonaktifkan pada hari ke-8.
- Jika petugas mana pun, termasuk KA IPSRS, tetap tidak memiliki LHI sah hingga hari ke-10, kondisi tersebut menjadi pemicu aktivasi Mode Blok Aplikasi global untuk seluruh pengguna. Saat blokir global aktif, hanya KA IPSRS yang berwenang menjalankan prosedur Reset dan pemulihan; kewenangan pemulihan ini **bukan pengecualian dari kewajiban LHI atau pemblokiran individual**.
- Hanya KA IPSRS yang boleh membuka kelonggaran melalui menu Hak Akses.
- Pembukaan blokir individual akibat ketidakpatuhan LHI hanya dilakukan bersamaan dengan pembukaan blokir global oleh KA IPSRS melalui perintah pemulihan terpadu. Tidak ada pembukaan blokir individual otomatis pada hari ke-10 sebelum KA IPSRS melakukan Reset dan memulai kelonggaran.

## 10. Data dan audit
Sistem perlu mencatat:
- Identitas petugas, waktu input LHI terakhir yang sah (`created_at`), serta tanggal input hasil konversi WIB. Tanggal kejadian pekerjaan dicatat sebagai data laporan, tetapi tidak digunakan sebagai dasar hitung kepatuhan.
- Status LHI (sah/aktif atau dibatalkan), waktu dan alasan pembatalan, serta dampak pembatalan terhadap tanggal aktivitas input dan penghitungan hari tanpa input. Laporan yang dibatalkan tetap tercatat dalam audit, tetapi tidak dihitung sebagai aktivitas kepatuhan.
- Jumlah hari kalender berturut-turut tanpa LHI.
- Tahap peringatan dan waktu pengiriman.
- Perubahan status aktif/nonaktif, waktu, dan alasan.
- Aktivasi Mode Blok global.
- Identitas KA IPSRS yang melakukan reset/membuka kelonggaran.
- Waktu mulai dan akhir kelonggaran 12 jam.
- Snapshot kepatuhan berdasarkan input LHI yang hanya memuat petugas lalai: identitas petugas, waktu input LHI terakhir (`created_at`), jumlah hari tanpa input saat snapshot dibuat, dan status apakah petugas tersebut telah melakukan input LHI sah selama kelonggaran.
- Aktivasi ulang Mode Blok jika tenggat habis dan masih ada kewajiban yang belum dipenuhi.
- Hasil setiap perintah pemulihan KA IPSRS, termasuk keberhasilan atau kegagalan, waktu percobaan, dan identitas pelaksana.
- Jika perintah pemulihan gagal, catat kegagalan tanpa mengubah status blokir, snapshot, atau waktu kelonggaran yang sedang berlaku.

Riwayat audit tidak boleh dihapus atau ditimpa.

## 11. Skenario penerimaan minimum
1. Empat hari kalender tanpa LHI: Peringatan 1 diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama petugas yang lalai.
2. Enam hari tanpa LHI: Peringatan 2 diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama petugas yang lalai.
3. Tujuh hari tanpa LHI: Peringatan 3 dan ancaman penonaktifan hari berikutnya diterima petugas terkait dan seluruh tim; notifikasi seluruh tim mencantumkan nama setiap petugas yang lalai agar dapat diingatkan langsung.
4. Delapan hari tanpa LHI: status akun petugas yang bersangkutan dinonaktifkan. Ketika petugas tersebut mencoba login dan menekan tombol **Masuk**, aplikasi menampilkan peringatan bahwa akunnya dinonaktifkan karena belum mengisi LHI selama 8 hari. Petugas lain yang akunnya tetap aktif menerima notifikasi di dalam aplikasi setelah berhasil login atau ketika sudah berada di aplikasi, dengan mencantumkan nama petugas yang dinonaktifkan.
5. Hari ke-9: masa tunggu setelah penonaktifan individu; Mode Blok global belum aktif.
6. Hari ke-10: ketika minimal satu petugas mencapai hari ke-10 tanpa LHI sah, Mode Blok Aplikasi global aktif untuk seluruh pengguna; tidak perlu menunggu petugas lain mencapai hari ke-10. Akun yang sebelumnya diblokir individual masih berstatus diblokir sampai KA IPSRS berhasil melakukan Reset dan menjalankan perintah pemulihan terpadu.
7. Saat Mode Blok aktif, tampilan awal aplikasi berubah menjadi Form Blok Aplikasi; form login normal tidak ditampilkan kepada seluruh pengguna.
8. Form Blok Aplikasi menampilkan keterangan blokir global dan tautan Reset.
9. Reset salah tidak membuka form autentikasi maupun akses aplikasi.
10. Reset benar menampilkan kembali form login normal yang sama (tanpa membuat form autentikasi baru); pengguna tetap memasukkan username dan password, server memvalidasi role KA IPSRS, hanya akun KA IPSRS yang berhasil masuk, dan akun petugas biasa tetap ditolak meskipun mengetahui angka Reset.
11. Jika akun KA IPSRS sedang diblokir individual, KA tetap dapat melewati jalur autentikasi khusus Reset setelah kredensial dan role diverifikasi server, tetapi hanya memperoleh sesi terbatas untuk menu/fungsi Hak Akses pemulihan; dashboard, laporan, rekap, dan menu operasional lain tetap tidak dapat diakses.
12. Setelah Reset dan autentikasi role KA IPSRS, KA menjalankan perintah pemulihan terpadu. Sistem membuka blokir global dan seluruh blokir individual akibat ketidakpatuhan LHI secara bersamaan, lalu mencatat waktu mulai serta tenggat kelonggaran 12 jam.
13. Petugas yang sebelumnya diblokir individual dapat login selama kelonggaran 12 jam dan melakukan input LHI yang sah; riwayat pelanggarannya tetap tersimpan.
14. Hanya petugas lalai yang tercantum dalam snapshot wajib menginput minimal 1 (satu) laporan LHI yang sah selama kelonggaran 12 jam. Satu laporan saja sudah cukup; petugas lain yang tidak tercantum dalam snapshot tidak wajib menginput LHI tambahan untuk menggugurkan blokir. Petugas yang lalai juga tidak diwajibkan mengganti seluruh hari tanpa input atau menginput sebanyak jumlah pekerjaan/tunggakannya.
15. Semua petugas dalam snapshot telah melakukan input LHI sah sebelum tenggat: blokir global tetap nonaktif dan aplikasi kembali normal.
16. Masih ada satu petugas dalam snapshot yang belum melakukan input LHI sah saat 12 jam habis: blokir global aktif kembali untuk seluruh pengguna; blokir individual tidak diterapkan ulang satu per satu.
17. Petugas yang cuti, sakit, izin, atau tidak masuk kerja tetap berstatus normal selama belum mencapai tahapan pelanggaran dan akun belum diblokir; kondisi tersebut tidak menghentikan hitungan hari tanpa input. Jika mencapai tujuh hari berturut-turut tanpa input, tahapan peringatan dan pemblokiran mengikuti ketentuan yang sama.
18. Sabtu, Minggu, dan hari libur tetap dihitung.
19. Setiap tahap peringatan hanya dikirim sekali per petugas per kejadian/tahap, dan notifikasi ke seluruh tim mencantumkan nama petugas yang benar-benar memenuhi kondisi tahap tersebut.
20. Tujuh LHI dengan tanggal kejadian pekerjaan yang sama, tetapi disimpan pada tujuh tanggal input berbeda, dihitung sebagai aktivitas input pada tujuh hari tersebut. Beberapa LHI yang disimpan pada satu tanggal input yang sama hanya dihitung sebagai satu hari aktif input.
21. LHI yang dibatalkan tidak dihitung sebagai aktivitas input pada tanggal `created_at`-nya. Jika seluruh LHI pada suatu tanggal dibatalkan, tanggal tersebut dihitung sebagai hari tanpa input; jika masih ada LHI sah lain pada tanggal yang sama, tanggal tersebut tetap menjadi satu hari aktif input.
22. Jika pembatalan membuat jumlah hari tanpa input mencapai hari ke-8, akun petugas dinonaktifkan sesuai tahapan hari ke-8 tanpa mengulang hitungan atau memberikan masa tenggang baru.
23. Jika seluruh kewajiban snapshot dipenuhi dalam 12 jam, setelah tenggat berakhir blokir global tetap nonaktif, seluruh akun kembali normal, dan hitungan pelanggaran lama tidak dibawa ke periode berikutnya.
24. Setelah pemulihan berhasil, sistem memantau kembali seluruh petugas berdasarkan tanggal input LHI sah terakhir masing-masing. Jika kemudian ada petugas yang tidak menginput selama tujuh hari kalender berturut-turut, tahapan peringatan dan pemblokiran baru berjalan sesuai ketentuan yang sama; tanpa pelanggaran baru aplikasi tetap normal.
25. Jika perintah **Buka Blokir dan Mulai Kelonggaran 12 Jam** gagal pada salah satu tahap, tidak ada pembukaan blokir sebagian, Mode Blok global tetap aktif, status blokir individual tidak berubah, dan waktu kelonggaran tidak dimulai. KA IPSRS menerima informasi kegagalan dan dapat mencoba kembali.
26. Jika perintah pemulihan sudah berhasil di server tetapi responsnya hilang, percobaan ulang tidak mengulang atau memperpanjang kelonggaran; sistem tetap menggunakan waktu mulai dan tenggat dari transaksi pertama yang berhasil.

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
**Prinsip utama:** kepatuhan dihitung dari tanggal input LHI (`created_at`) dalam WIB, bukan tanggal kejadian pekerjaan; beberapa LHI dengan tanggal kejadian sama tetap dihitung menurut tanggal input masing-masing, sedangkan beberapa LHI pada tanggal input yang sama dihitung sebagai satu hari aktif; LHI yang dibatalkan tidak dihitung sebagai aktivitas kepatuhan dan tanggalnya menjadi hari tanpa input jika tidak ada LHI sah lain pada tanggal tersebut; peringatan bertahap pada hari ke-4, ke-6, dan ke-7 disampaikan kepada petugas yang lalai dan seluruh tim dengan mencantumkan nama petugas; pada hari ke-8 petugas yang dinonaktifkan menerima peringatan saat mencoba login dan menekan tombol Masuk, sedangkan petugas lain yang akunnya tetap aktif menerima notifikasi di dalam aplikasi setelah berhasil login atau ketika sudah berada di aplikasi, dengan mencantumkan nama petugas yang dinonaktifkan; hari ke-9 merupakan masa tunggu; pada hari ke-10, cukup satu petugas mencapai hari ke-10 tanpa LHI sah untuk mengaktifkan Mode Blok global bagi seluruh pengguna; setelah KA IPSRS berhasil melakukan Reset, satu perintah pemulihan terpadu membuka blokir global dan seluruh blokir individual akibat ketidakpatuhan LHI sekaligus serta memulai kelonggaran 12 jam; jika perintah gagal, tidak ada perubahan sebagian, blokir tetap seperti semula dan kelonggaran tidak dimulai; jika transaksi berhasil tetapi respons hilang, percobaan ulang tidak boleh mengulang waktu kelonggaran; jika seluruh kewajiban snapshot dipenuhi aplikasi kembali normal dan pemantauan dimulai lagi berdasarkan tanggal input LHI sah terakhir masing-masing petugas tanpa membawa hitungan pelanggaran lama; jika kemudian terjadi pelanggaran baru, tahapan yang sama berlaku kembali; sedangkan jika masih ada kewajiban yang belum dipenuhi blokir global aktif kembali untuk seluruh pengguna.
