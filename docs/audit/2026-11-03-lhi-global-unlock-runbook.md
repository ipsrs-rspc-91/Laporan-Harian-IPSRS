# Runbook pembukaan Form Blok Aplikasi LHI — produksi

Tanggal audit: 3 November 2026  
Target: insiden legacy `incident_id=1`, `LHI_GLOBAL_BLOCK=AKTIF`  
Branch implementasi: `repair/lhi-status-separation-20261103`  
Status dokumen: rencana eksekusi; belum dijalankan pada produksi.

## 1. Penyebab langsung yang sudah dibuktikan

Frontend produksi di `main` hanya memvalidasi kode Reset 6 digit lalu mengembalikan pengguna ke form login. Tidak ada pemanggilan `apiStartLhiGrace` atau `apiGetLhiGraceStatus`. Edge Function produksi `lhi-reset-verify` masih versi 1 dan tidak membuat recovery challenge (`create_lhi_recovery_challenge` tidak ada di source); responsnya hanya `valid: true/false`. Karena itu, kode Reset belum pernah menjalankan transaksi yang mengubah insiden `LOCKED` menjadi `GRACE` dan `LHI_GLOBAL_BLOCK` menjadi `NONAKTIF`.

Backend lama mempunyai RPC `open_lhi_global_grace(text,text)`, tetapi jalur lama mengubah `staff.status` menjadi `Aktif` sebagai efek samping pemulihan dan tidak menyediakan sesi recovery-only. Jangan gunakan jalur lama sebagai hotfix.

## 2. Kondisi produksi yang diperiksa secara read-only

- `LHI_GLOBAL_BLOCK=AKTIF`.
- Insiden 1 berstatus `LOCKED`; deadline legacy sudah lewat.
- Cron `lhi-discipline-scheduler-every-5-minutes` aktif, cadence `*/5 * * * *`, command lama `run_lhi_discipline_scheduler()`.
- Terdapat 156 baris kewajiban legacy untuk 21 petugas unik; 156 baris masih pending.
- Status petugas yang terhubung ke snapshot legacy: 20 `Aktif` dan 1 `Nonaktif_LHI_HARI_8`. Migrasi hanya menormalkan status legacy tersebut bila audit log membuktikan transisi yang dibuat scheduler LHI.
- Tidak ada perubahan database produksi pada saat audit.

## 3. Persiapan wajib

1. Ambil backup database produksi yang dapat dipulihkan dan verifikasi prosedur restore. Backup tabel pilihan yang sudah ada bukan pengganti backup database yang dapat dipulihkan.
2. Rollback target Cloudflare Worker produksi sudah teridentifikasi secara read-only: Worker `laporan-harian-ipsrs`, deployment `d320da6d-8441-4c0d-a29e-100287ee992e`, version `e585e341-eed1-4097-8b08-6db92f5cbabe`, aktif 3 Nov 2026 02:22:08 UTC. Simpan metadata ini pada change record dan verifikasi prosedur rollback sebelum deploy; jangan membuat deployment baru saat checkpoint.
3. Migration aktif sudah dibuat oleh `supabase migration new` melalui GitHub Actions pada branch ini, dengan urutan timestamp yang diverifikasi: `20261103041836_lhi_schema_v2.sql`, `20261103041839_lhi_restricted_recovery_challenges.sql`, `20261103041842_lhi_scheduler_v2.sql`, `20261103041845_lhi_atomic_reset_grace_v2.sql`. Keempat file aktif telah dibandingkan byte-for-byte dengan draft sumber dan cocok. Riwayat migration produksi yang diperiksa secara read-only berisi 64 versi dengan versi terakhir `20261102114305`; empat migration baru berada sesudah versi tersebut. Sebelum rilis, jalankan `supabase migration list --linked` dan `supabase db push --dry-run`; lanjut hanya bila tepat empat migration LHI baru yang pending dan tidak ada migration lama lain yang tertinggal. Jangan membuat salinan migration kedua.
4. Set secret Edge Function sebelum deploy:
   ```sh
   supabase secrets set --project-ref tcrmlhfsroyhaxdfwyll \
     LHI_ALLOWED_ORIGINS="https://laporan-harian-ipsrs.rspc.workers.dev" \
     LHI_RATE_LIMIT_SALT="$(openssl rand -hex 32)"
   ```
   Jangan mencetak, menyimpan di repository, atau mengirim nilai `LHI_RATE_LIMIT_SALT` ke chat/log. Origin produksi diperiksa dari subdomain Worker Cloudflare `rspc`; preview Worker tidak dimasukkan ke allowlist produksi.
5. Header `cf-connecting-ip` sudah terlihat pada log produksi Supabase Edge Function: 14 request ke `lhi-reset-verify` selama 24 jam terakhir semuanya memiliki header tersebut. Tetap verifikasi lagi setelah deploy versi baru; endpoint harus fail-closed jika header hilang. Jangan menggunakan `x-forwarded-for` sebagai fallback yang dapat dimanipulasi klien.

## 4. Urutan cutover

1. Jalankan dan verifikasi backup/checkpoint.
2. Jalankan `docs/drafts/2026-11-03-lhi-cron-pause-v2-review.sql`. Script memeriksa tepat satu job, tidak ada run berstatus `running`, lalu mem-pause job yang sama. Jangan menghapus atau membuat job cron baru.
3. Terapkan schema-v2 melalui migration CLI yang sudah diuji.
4. Terapkan migration restricted recovery challenge/session.
5. Terapkan scheduler-v2 dan atomic Reset-v2.
6. Deploy Edge Functions: `lhi-reset-verify`, `lhi-recovery-exchange`, `lhi-recovery-action`, `lhi-block-status`, dan versi `ipsrs-api` yang sesuai branch.
7. Deploy frontend Worker dari commit branch yang sama dan verifikasi build/commit production.
8. Jalankan `docs/drafts/2026-11-03-lhi-cron-switch-v2-review.sql`. Script hanya mengaktifkan kembali job yang sama, dengan cadence lima menit dan command scheduler v2; verifikasi tidak ada scheduler aktif ganda.
9. Verifikasi endpoint block-status masih melaporkan global lock AKTIF sebelum Reset KA dilakukan.

## 5. Prosedur Reset KA IPSRS

1. Buka halaman aplikasi dan pilih Reset.
2. Kode Reset hanya menerbitkan challenge satu kali; kode tidak memberikan sesi login.
3. Login menggunakan username/password akun KA IPSRS yang sudah diverifikasi Supabase Auth.
4. Backend memeriksa role persis `KA_IPSRS`, status kepegawaian `Aktif`, challenge belum dipakai, belum kedaluwarsa, dan terikat ke insiden aktif.
5. KA masuk ke layar recovery-only. Dashboard, input laporan, rekap, dan tindakan operasional tidak boleh tersedia.
6. KA menekan tombol mulai Reset. Server membuat snapshot baru dari kewajiban legacy pending, satu baris per petugas unik, membuka status akses individual LHI, mengubah insiden menjadi `GRACE`, dan mengubah global lock menjadi `NONAKTIF` dalam satu transaksi.
7. Untuk insiden legacy saat ini, snapshot diambil dari 156 kewajiban lama yang masih pending dan diringkas menjadi 21 petugas unik. Tanggal aktivasi HR tidak direka dari `staff.created_at`.
8. Catat `started_at` dan `deadline_at`; grace harus tepat 12 jam. Retry setelah respons hilang harus mengembalikan waktu yang sama, tidak membuat snapshot kedua.

## 6. Verifikasi setelah Reset

- `LHI_GLOBAL_BLOCK=NONAKTIF`.
- Insiden 1 berstatus `GRACE`, satu snapshot cycle baru terbentuk, dan jumlah anggota sesuai jumlah petugas unik yang masih aktif pada snapshot.
- Status kepegawaian tetap tidak berubah oleh Reset; hanya status akses LHI yang dibuka.
- Sesi KA hanya dapat membaca status recovery dan memulai Reset; tidak dapat membuka dashboard/operasional.
- Laporan sah harus disimpan dalam rentang `[started_at, deadline_at)`; laporan yang dibatalkan tidak memenuhi kewajiban bila tidak ada pengganti yang sah.
- Pada deadline 12 jam, global lock hanya aktif kembali jika masih ada anggota snapshot berstatus aktif dengan kewajiban pending.
- Bila semua kewajiban selesai atau dikecualikan, insiden ditutup dan global lock tetap NONAKTIF.
- Setelah insiden legacy selesai, scheduler mengembalikan mode `ANCHOR_RECONCILIATION_REQUIRED` sampai HR memverifikasi tanggal aktivasi/reaktivasi. Siklus disiplin baru tidak boleh memakai `staff.created_at` sebagai pengganti data HR.

## 7. Batas perubahan dan persetujuan

- Jangan mengubah `access_settings.value` secara manual untuk mematikan global lock.
- Jangan menjalankan SQL draft di produksi sebelum migration CLI, pengujian nonproduksi, backup, dan rollback tervalidasi.
- Jangan menggabungkan PR atau menerbitkan Worker/Edge Function produksi sebelum seluruh preflight lulus dan persetujuan rilis produksi diberikan.
- Bila salah satu precondition gagal, hentikan cutover; global lock tetap AKTIF dan data insiden dipertahankan.
