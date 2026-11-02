# Desain Jalur Reset Terbatas KA IPSRS

Tanggal: 3 November 2026  
Status: desain teknis untuk implementasi dan pengujian; belum diaktifkan dan belum di-deploy.

## 1. Sasaran

Memenuhi README Form Blok Aplikasi: ketika blokir global aktif, semua pengguna melihat layar blokir; tautan Reset membuka modal kode; setelah kode valid, form login normal yang sama dipakai; autentikasi username/password tetap wajib; hanya role KA IPSRS yang boleh memperoleh sesi terbatas; sesi tersebut hanya dapat menjalankan pemulihan terpadu 12 jam.

Kode Reset tidak boleh disimpan dalam JavaScript, HTML, repository, log, atau response API. Nilai kode yang pernah dicantumkan di README bukan sumber validasi runtime. Validasi harus dilakukan di server terhadap secret yang disimpan sebagai konfigurasi rahasia.

## 2. Mengapa tidak boleh sekadar menambahkan pengecualian di staff()

Saat ini act() selalu menjalankan staff() sebelum memproses action. staff() menolak employment status selain Aktif dan lhi_access_status selain NORMAL. Karena itu KA IPSRS yang terkena blokir individual tidak bisa mencapai apiStartLhiGrace.

Menghapus pemeriksaan tersebut atau membuat pengecualian role KA IPSRS pada staff() tidak aman: itu akan membuka akses operasional kepada KA IPSRS yang sedang diblokir. Pemulihan harus memiliki jalur autentikasi terpisah dan scope yang sangat terbatas.

## 3. Alur protokol yang diusulkan

### Tahap A — Gate kode Reset (belum terautentikasi)

1. Browser hanya menampilkan layar blokir global dan tautan Reset.
2. Modal meminta kode Reset; browser mengirim kode melalui HTTPS ke endpoint khusus recovery-gate, bukan ke API operasional.
3. Endpoint khusus tidak memakai sesi user sebagai dasar otorisasi. Endpoint memvalidasi kode terhadap hash/secret server-side, dengan pembatasan percobaan, rate limit, respons generik, dan audit tanpa menyimpan kode mentah.
4. Jika benar, server membuat nonce acak kriptografis sekali pakai, berumur singkat, dan terikat pada incident LOCKED yang sedang aktif. Nonce disimpan server-side; browser hanya menerima opaque nonce.
5. Kode salah, incident tidak LOCKED, secret tidak tersedia, atau database gagal: tidak ada nonce dan layar tetap terkunci.

Catatan: fungsi gate harus merupakan Edge Function terpisah dengan konfigurasi verify_jwt=false secara eksplisit. Jangan menurunkan verifikasi JWT pada ipsrs-api yang melayani seluruh operasi aplikasi.

### Tahap B — Autentikasi dengan form login yang sama

1. Setelah nonce diterima, browser menampilkan kembali komponen form login normal yang sudah ada.
2. Pengguna tetap memasukkan username dan password melalui Supabase Auth.
3. Setelah Supabase Auth berhasil, browser mengirim access token dan nonce ke endpoint exchange khusus.
4. Server memverifikasi access token ke Supabase Auth, mencari staff berdasarkan auth_user_id, dan memeriksa role persis KA_IPSRS.
5. Server memeriksa nonce: masih berlaku, belum digunakan, terikat incident yang masih LOCKED, dan belum dipakai untuk identitas lain.
6. Nonce dikonsumsi secara atomik. Server mengeluarkan recovery capability singkat yang hanya memuat scope lhi.recovery dan incident_id; jangan menyimpan capability di localStorage atau sessionStorage.
7. Akun non-KA, pegawai Nonaktif, nonce kedaluwarsa, nonce replay, atau kegagalan validasi ditolak. Tidak boleh ada fallback ke sesi operasional.

### Tahap C — Sesi terbatas

1. Frontend masuk ke tampilan Hak Akses pemulihan saja.
2. Semua action operasional ditolak oleh server, termasuk dashboard, laporan, rekap, master data, pengaturan umum, heartbeat operasional, dan perubahan password.
3. Hanya dua action yang boleh diakses:
   - membaca status incident/grace dan snapshot;
   - memanggil pemulihan terpadu.
4. Sesi terbatas tidak boleh dianggap sebagai sesi login normal dan tidak boleh mengisi CURRENT_SESSION operasional.
5. Semua request recovery harus diverifikasi server-side berdasarkan signature, expiry, scope, incident_id, dan role KA yang masih valid.

### Tahap D — Pemulihan terpadu

Satu RPC transaksi database harus:
1. Mengunci access_settings LHI_GLOBAL_BLOCK dan incident LOCKED dengan FOR UPDATE.
2. Memverifikasi pemanggil adalah KA IPSRS melalui identitas server-side yang tidak dapat dipalsukan oleh payload.
3. Jika incident sudah GRACE, mengembalikan started_at/deadline_at yang sama tanpa menggeser tenggat.
4. Membuat satu snapshot member untuk setiap petugas lalai aktif, dengan UNIQUE(incident_id, staff_id).
5. Membuka seluruh lhi_access_status BLOCKED_LHI menjadi NORMAL tanpa mengubah staff.status.
6. Mengubah incident LOCKED menjadi GRACE, mengisi waktu mulai dan tenggat 12 jam.
7. Mengubah global lock menjadi NONAKTIF dan mencatat audit.
8. Mengembalikan sukses hanya setelah transaksi commit. Kegagalan pada satu langkah harus rollback seluruh perubahan.

## 4. Kontrol keamanan wajib

- Secret Reset disimpan sebagai environment secret di Edge Function; tidak ada nilai literal di frontend, repository, SQL migration, response, atau log.
- Hash/secret harus dapat dirotasi tanpa deploy frontend.
- Rate limit per IP dan per incident; jeda bertahap dan pencatatan percobaan gagal.
- Nonce minimal 256-bit acak, TTL singkat (misalnya 5 menit), single-use, incident-bound.
- Jangan mencatat kode Reset, password, access token, recovery capability, atau nonce mentah ke audit/log.
- CORS hanya origin aplikasi yang sah; jangan gunakan wildcard untuk endpoint gate.
- Recovery capability tidak boleh mengotorisasi endpoint ipsrs-api operasional.
- Tidak boleh ada bypass frontend-only atau role check dari payload.
- Semua fungsi RPC harus REVOKE EXECUTE dari PUBLIC/anon/authenticated kecuali jalur yang benar-benar diperlukan; grant minimum kepada service role/function owner.
- Endpoint exchange harus memverifikasi token ke Supabase Auth, bukan hanya decode JWT.
- Sediakan audit event untuk RESET_CODE_ACCEPTED, RESET_CODE_REJECTED, RECOVERY_SESSION_ISSUED, RECOVERY_SESSION_REJECTED, dan RECOVERY_TRANSACTION_COMPLETED/FAILED tanpa data rahasia.

## 5. Komponen yang perlu dibuat dan diuji

1. Edge Function recovery-gate (verify_jwt=false) untuk validasi secret dan penerbitan nonce.
2. Tabel nonce/recovery challenge dengan expiry, incident binding, single-use, dan unique nonce hash.
3. RPC atomik untuk consume nonce setelah identitas KA terverifikasi.
4. Edge Function recovery-exchange untuk verifikasi Auth user dan penerbitan recovery capability terbatas.
5. Endpoint recovery-only untuk status snapshot dan pemulihan.
6. Frontend state machine: GLOBAL_LOCKED -> RESET_CODE -> NORMAL_LOGIN_WITH_NONCE -> KA_RECOVERY_ONLY -> NORMAL_APP hanya setelah transaksi pemulihan sukses.
7. Tes negatif: kode salah, rate limit, nonce replay, nonce kedaluwarsa, petugas biasa, KA Nonaktif, KA individual-blocked, incident berubah sebelum exchange, global lock berubah, RPC rollback, response hilang lalu retry, recovery token dipakai ke action operasional.
8. Tes positif: KA Aktif dengan akses individual NORMAL maupun BLOCKED_LHI dapat masuk recovery-only; hanya pemulihan terpadu yang mengembalikan aplikasi normal.

## 6. Ketergantungan dan larangan deployment

Desain ini belum boleh diimplementasikan sebagai jalur produksi sebelum:
- tersedia project Supabase nonproduksi untuk menguji Auth, Edge Function, RPC, dan RLS;
- disepakati lokasi penyimpanan secret Reset dan mekanisme rotasinya;
- skema nonce dan recovery capability ditinjau;
- migration dan seluruh test negatif/positif lulus.

Jangan menambahkan kode Reset yang sudah ada di README ke source code. Jangan mengubah konfigurasi verify_jwt pada ipsrs-api. Jangan deploy Edge Function atau migration ke project produksi dalam tahap ini.

## 7. Kriteria penerimaan

- Kode Reset saja tidak pernah menghasilkan sesi aplikasi.
- Username/password dan role KA IPSRS tetap diverifikasi server-side.
- KA IPSRS yang individual-blocked dapat mencapai recovery-only, tetapi tidak dapat membuka menu operasional.
- Akun petugas biasa tetap ditolak walaupun kode Reset diketahui.
- Sesi terbatas hanya dapat membaca status pemulihan dan menjalankan RPC pemulihan.
- Retry tidak menggandakan snapshot atau menggeser deadline.
- Kegagalan transaksi tidak mengubah blokir global maupun individual.


## 8. Hasil inspeksi kode frontend/backend saat ini

Inspeksi branch perbaikan terhadap frontend/app.js dan ipsrs-api/index.ts menemukan:

1. performLogin() melakukan Supabase Auth lalu langsung memanggil apiWhoAmI sebelum membaca IPSRS_LHI_RESET_AUTH_MODE. Dengan global lock aktif, apiWhoAmI ditolak lebih dahulu sehingga flag reset tidak pernah dapat membuka jalur KA.
2. IPSRS_LHI_RESET_AUTH_MODE hanya disimpan/dibaca di sessionStorage dan pemeriksaan role di frontend. Flag ini bukan bukti server-side dan tidak memberi sesi terbatas.
3. Setelah whoAmI sukses, performLogin() selalu menjalankan setSession(), afterAuthReady(), hideLoginScreen(), lalu goPage('input'). Belum ada mode recovery-only yang mencegah masuk ke halaman operasional.
4. Backend staff() memblokir lhi_access_status selain NORMAL sebelum act() memproses action. Ini termasuk KA IPSRS yang perlu menjalankan recovery.
5. apiStartLhiGrace saat ini hanya dapat dicapai melalui sesi normal dan memanggil RPC lama. Tidak ada recovery capability khusus.
6. Pada frontend/index.html yang diperiksa, loginScreen adalah container kosong yang diisi oleh app.js. Belum ditemukan komponen form blokir/reset yang terhubung dengan gate server-side; komponen render login dinamis perlu ditelusuri sebelum mengubah UI agar tidak membuat form login kedua.

Kesimpulan: jangan menganggap flag sessionStorage yang ada sebagai implementasi Reset. Jangan sekadar memindahkan pemeriksaan role ke bagian sebelum apiWhoAmI; backend harus terlebih dahulu menyediakan endpoint gate, exchange, capability terbatas, dan RPC atomik. Implementasi UI dilakukan setelah kontrak server siap.
