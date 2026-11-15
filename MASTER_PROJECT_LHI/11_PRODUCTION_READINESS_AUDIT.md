# PRODUCTION READINESS AUDIT — LHI

## 1. Tujuan dan batas audit

Dokumen ini mencatat hasil pemeriksaan read-only terhadap source repository `main` dan project Supabase aktif pada 15 November 2026 sekitar 12:18 UTC. Pemeriksaan mencakup inventaris migration, tabel, RLS/policy, grants, view, fungsi SECURITY DEFINER, dan Supabase Advisors.

Tidak ada SQL DDL/DML, perubahan Auth settings, perubahan migration history, deployment, atau perubahan produksi yang dilakukan dalam audit ini.

Project: `tcrmlhfsroyhaxdfwyll`  
Repository main SHA: `de77a78a99e566a97d9be320786e47d6675ae94a`

## 2. Ringkasan hasil

| Area | Hasil snapshot | Penilaian |
|---|---|---|
| Public tables | 24 tabel | Terinventaris |
| RLS | 24/24 tabel public mengaktifkan RLS | Baik sebagai baseline; policy/grant tetap harus ditinjau |
| RLS tanpa policy | 17 tabel | Advisor INFO; grant menunjukkan objek tersebut tidak diberikan ke anon/authenticated dan dibatasi service_role |
| Public views | 1 view: `staff_dropdown` | `security_invoker=true`; anon SELECT tidak diberikan; authenticated SELECT diberikan |
| SECURITY DEFINER public functions | 11 fungsi | Tidak ditemukan EXECUTE untuk PUBLIC, anon, atau authenticated pada snapshot; 9 service_role-only, 2 tidak memiliki grant role tersebut (trigger use perlu dikonfirmasi) |
| Security Advisor | 17 INFO RLS-no-policy; 1 WARN leaked-password protection disabled | Perlu tindak lanjut |
| Performance Advisor | 27 INFO no-primary-key; 10 INFO unused-index | Perlu klasifikasi; jangan hapus otomatis |
| Health Advisor | Tidak ada lint | Tidak ada temuan pada kategori health saat pemeriksaan |
| Migration history | 75 remote vs 35 file migration pada repository main | **P0 — parity belum tercapai** |
| Edge Functions | 8 active di Supabase vs 5 tracked pada main; 3 runtime-only | **P1 — source parity gap; source sync PR #80 pending** |

## 3. P0 — Migration history tidak sinkron

Perbandingan read-only menunjukkan:
- Migration yang tercatat pada database Supabase: **75 versi**.
- File SQL pada `supabase/migrations/` di repository main: **35 file**.
- Versi yang cocok persis antara keduanya: **15**.
- Versi remote yang tidak memiliki file dengan timestamp sama di repository: **60**.
- File lokal yang timestamp-nya tidak ditemukan pada migration history remote: **20**.

Perbedaan nama/timestamp tidak otomatis berarti migration hilang atau belum diterapkan; bisa terdapat perubahan nama, penggantian, squash, atau migration yang dibuat langsung pada platform. Namun, perbedaan sebesar ini membuat status source-to-database migration tidak dapat dianggap sinkron tanpa rekonsiliasi SQL dan schema.

### Risiko

Workflow production saat ini menjalankan `supabase migration list` lalu `supabase db push --yes` bila commit menyentuh backend/migration. Dengan histori yang belum direkonsiliasi, penerapan file lokal yang belum tercatat remote dapat menyebabkan migration yang tidak sesuai, duplikasi perubahan, konflik schema, atau deployment berhenti.

### Keputusan keselamatan

**Jangan menjalankan `supabase db push`, `migration repair`, menghapus migration history, atau membuat ulang migration produksi sampai rekonsiliasi selesai dan disetujui.** Ini adalah deployment blocker untuk perubahan database, bukan alasan untuk mengubah data secara langsung.

### Rencana rekonsiliasi wajib

1. Ekspor daftar 75 versi remote dan 35 file lokal sebagai artefak yang dapat ditinjau.
2. Cocokkan setiap versi remote dengan file SQL dari repository, riwayat commit, backup, atau catatan perubahan.
3. Untuk 60 versi remote-only, klasifikasikan: source hilang, migration eksternal, file diganti nama, atau baseline/squash.
4. Untuk 20 file local-only, tinjau SQL satu per satu dan tentukan apakah ekuivalen dengan migration remote, benar-benar pending, superseded, atau tidak boleh dijalankan.
5. Bandingkan schema aktual (DDL, constraint, index, function, trigger, RLS, grants) dengan hasil migration yang seharusnya.
6. Buat manifest rekonsiliasi dengan bukti, keputusan, owner, dan status tiap versi.
7. Uji rencana pada database branch/staging terisolasi dengan snapshot yang aman.
8. Baru setelah review dan persetujuan, tentukan repair/baseline strategy dan deployment gate.
9. Jalankan migration production hanya melalui SOP resmi, dengan backup, checkpoint, monitoring, dan rollback/forward-fix plan.

## 4. RLS, policy, dan grants

Semua 24 tabel pada schema public memiliki RLS aktif pada snapshot. Tujuh belas tabel yang mendapat advisor INFO karena tidak memiliki policy meliputi:
- tabel internal disiplin LHI dan recovery;
- tabel backup/checkpoint;
- `staff`;
- `master_item_review_queue`;
- snapshot laporan.

Pemeriksaan grants menunjukkan objek tanpa policy tersebut tidak diberikan kepada `anon` atau `authenticated`; akses tercatat dibatasi ke `service_role`. Dengan demikian, ketiadaan policy pada objek service-role-only tampak disengaja sebagai deny-by-default, bukan otomatis kerentanan. Tetap wajib diuji agar tidak ada grant tidak langsung melalui view, function, schema, atau role inheritance.

Policy yang ditemukan pada tabel transaksi dan referensi mencakup:
- `reports`: insert own, select authorized, update authorized;
- `access_settings`: operasi KA IPSRS dengan pengecualian hash reset;
- `edit_permissions`: operasi KA IPSRS;
- `audit_log`: select terbatas berdasarkan role dan visibilitas laporan;
- `report_history`: select terbatas untuk role yang berwenang;
- `master_data`: authenticated read untuk data aktif;
- `migration_errors`: read untuk admin.

Pemeriksaan metadata belum membuktikan bahwa seluruh policy benar terhadap seluruh skenario bisnis. Negative test per role, objek, dan operasi tetap diperlukan.

## 5. View dan fungsi SECURITY DEFINER

### 5.1 View
`public.staff_dropdown` menggunakan `security_invoker=true`. Anon tidak memiliki SELECT; authenticated memiliki SELECT pada view. Tabel dasar `staff` tidak memberi SELECT kepada authenticated dan memiliki RLS tanpa policy. Perilaku akses langsung view harus diuji untuk memastikan tidak terjadi error atau eksposur data; API server-side tetap menjadi jalur yang diharapkan.

### 5.2 SECURITY DEFINER
Sebelas fungsi SECURITY DEFINER ditemukan di schema public. Pada snapshot grants:
- tidak ada EXECUTE kepada PUBLIC;
- tidak ada EXECUTE kepada anon;
- tidak ada EXECUTE kepada authenticated;
- sembilan fungsi memiliki EXECUTE service_role;
- dua fungsi trigger tidak memiliki EXECUTE kepada role tersebut.

Ini mengurangi risiko pemanggilan langsung oleh client, tetapi audit harus tetap meninjau isi fungsi, search_path, owner, trigger binding, dan semua jalur pemanggilan. SECURITY DEFINER tetap dianggap komponen berisiko tinggi.

## 6. Temuan Auth

Supabase Security Advisor melaporkan `auth_leaked_password_protection` pada level WARN: perlindungan terhadap password yang diketahui bocor belum aktif.

Supabase mendokumentasikan fitur Leaked Password Protection sebagai fitur yang tersedia pada paket Pro dan di atasnya. Status paket project harus diverifikasi; jangan mengasumsikan fitur dapat diaktifkan pada semua paket.

Tindak lanjut:
1. Verifikasi paket Supabase project dan kelayakan fitur.
2. Product Owner dan administrator Auth menilai dampak kebijakan terhadap reset dan penggantian password.
3. Jika tersedia pada paket, aktifkan melalui pengaturan Auth yang berwenang setelah konfirmasi administrator.
4. Jika belum tersedia, catat gap dan mitigasi sementara; jangan mengklaim perlindungan telah aktif.
5. Uji alur set/reset password dan pesan error.
6. Catat tanggal, approver, dan bukti konfigurasi.

Audit ini tidak mengubah pengaturan Auth karena koneksi yang digunakan hanya menyediakan pembacaan Advisor/database, bukan kontrol konfigurasi Auth.

## 7. Temuan performance

Advisor melaporkan 27 tabel tanpa primary key dan 10 index yang belum digunakan. Banyak temuan no-primary-key berasal dari backup/snapshot/rollback schemas yang sengaja menyimpan salinan. Tidak boleh menambahkan PK atau menghapus index secara massal hanya untuk menghilangkan Advisor.

Tindakan:
- pisahkan tabel transaksi aktif dari backup/snapshot;
- ukur pemakaian index pada periode beban representatif;
- review query plan dan workload sebelum menghapus index;
- tentukan retensi dan lifecycle tabel backup;
- tambahkan primary key hanya bila dibutuhkan untuk integritas, updateability, atau operasional.

## 8. Prioritas tindakan

| ID | Prioritas | Tindakan | Status |
|---|---|---|---|
| DB-01 | P0 | Rekonsiliasi 75 remote migrations vs 35 local files | OPEN — deployment blocker |
| DB-02 | P1 | Evaluasi dan aktifkan leaked password protection | OPEN — admin Auth |
| DB-03 | P1 | Uji negative authorization dan RLS per role/object | OPEN |
| DB-04 | P1 | Verifikasi view `staff_dropdown` pada akses authenticated | OPEN |
| DB-05 | P1 | Review SECURITY DEFINER function body, grants, search_path, trigger | OPEN |
| DB-06 | P2 | Klasifikasi 27 no-primary-key findings | OPEN |
| DB-07 | P2 | Evaluasi 10 unused indexes berdasarkan workload | OPEN |
| DB-08 | P2 | Tetapkan lifecycle dan retensi backup/snapshot schemas | OPEN |

## 9. Kesimpulan audit

RLS aktif pada seluruh 24 tabel public yang terinventaris dan grants pada tabel internal menunjukkan pembatasan service_role-only untuk banyak objek sensitif. Tidak ditemukan temuan Health Advisor pada snapshot. Namun, terdapat satu warning konfigurasi Auth dan satu masalah tata kelola yang sangat penting: migration history remote dan repository belum sinkron.

**Status kesiapan database untuk perubahan schema produksi: NO-GO sampai DB-01 selesai direkonsiliasi.** Tidak ada migration yang dijalankan dalam audit ini.

## 10. Edge Function source parity

Pemeriksaan read-only terhadap Supabase menunjukkan **8 Edge Functions ACTIVE**. Repository main pada snapshot audit hanya melacak 5 folder function. Tiga function aktif tidak ditemukan pada main:
- `lhi-block-status` — runtime version 3;
- `lhi-recovery-exchange` — runtime version 1;
- `lhi-recovery-action` — runtime version 1.

Source aktif ketiga function diambil read-only dari Supabase dan dibandingkan dengan file pada branch koreksi. Exact content match = TRUE untuk ketiganya. Source tersebut diajukan untuk ditambahkan ke repository melalui PR #80. PR tersebut belum merge dan tidak melakukan deployment.

Dampak:
- Repository main belum sepenuhnya merepresentasikan seluruh function yang aktif di Supabase.
- Perubahan berikutnya harus membedakan source yang ada di main, source pada PR, dan source runtime.
- Jangan menghapus atau mengganti function runtime berdasarkan source main yang belum lengkap.
- Sinkronisasi source tidak sama dengan persetujuan deployment; semua perubahan backend tetap menunggu migration parity dan deployment gate.

## 11. Privacy, data residency, dan regulasi Indonesia

Project Supabase yang diperiksa memiliki region `ap-southeast-1`. Karena Aplikasi LHI menyimpan identitas petugas dan metadata aktivitas, data yang diproses perlu dipetakan sebagai data pribadi. Penempatan region di luar Indonesia memerlukan legal/privacy assessment terhadap transfer lintas negara dan peran vendor/subprocessor sesuai UU PDP; audit ini tidak menyimpulkan bahwa penggunaan region tersebut otomatis melanggar hukum.

Pemetaan regulasi:
- UU 27/2022 tentang Pelindungan Data Pribadi: berlaku; identifikasi controller/processor, tujuan/dasar pemrosesan, hak subjek data, retensi, keamanan, DPIA bila berisiko tinggi, dan transfer lintas negara.
- PP 71/2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik: berlaku; evaluasi keandalan, keamanan, tanggung jawab, dan ketersediaan sistem elektronik.
- Permenkes 24/2022 tentang Rekam Medis: berlaku; hanya diterapkan pada bagian LHI yang benar-benar memproses data rekam medis. LHI pemeliharaan sarana tidak otomatis menjadi sistem rekam medis.
- PP 33/2026 tentang peraturan pelaksanaan UU PDP: telah ditetapkan; masa berlaku ditentukan enam bulan setelah pengundangan. Fungsi hukum/privasi harus memastikan tanggal efektif dan menyiapkan pemenuhan sebelum berlaku.

Tindakan:
1. Tetapkan klasifikasi data LHI dan larangan memasukkan identitas pasien/diagnosis/nomor rekam medis ke laporan pemeliharaan.
2. Verifikasi kontrak, lokasi pemrosesan, subprocessor, transfer data, retensi, penghapusan, dan respons insiden vendor.
3. Lakukan DPIA bila kriteria risiko tinggi terpenuhi.
4. Dapatkan keputusan tertulis dari fungsi hukum/privasi rumah sakit atas lokasi Supabase dan layanan Cloudflare.
5. Catat dasar pemrosesan, owner, dan masa retensi setiap kategori data.

Rujukan resmi awal:
- UU 27/2022: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022-10
- PP 71/2019: https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019
- Permenkes 24/2022: https://jdih.kemkes.go.id/documents/peraturan-menteri-kesehatan-nomor-24-tahun-2022
- PP 33/2026: https://pemerintahdigital.id/assets/resources/PP33_2026-PeraturanPelaksanaanUU27_2022_PerlindunganDataPribadi.pdf

## 12. Status runtime Form Blok dan recovery LHI

**Recheck schema read-only 15 November 2026 sekitar 13:34 UTC:** inventory terbaru menunjukkan 24 tabel pada schema public. Tabel `public.lhi_reset_attempts` sudah tersedia (5 rows; kolom `ip_hash`, `window_started_at`, `attempt_count`, `updated_at`). Dengan demikian, catatan snapshot awal yang menyebut tabel tersebut belum ada telah dikoreksi pada Migration Reconciliation Manifest. Recheck masih menemukan gap: tabel `lhi_discipline_obligation_events), kolom `staff.lhi_access_blocked_at`, `staff.lhi_employment_activated_at`, `lhi_discipline_obligations.snapshot_last_lhi_created_at`, dan `snapshot_missed_days` belum tersedia. Keberadaan `lhi_reset_attempts` saja tidak membuktikan recovery flow lengkap atau lulus.

Pemeriksaan read-only pada snapshot database menunjukkan:
- `LHI_GLOBAL_BLOCK = NONAKTIF`;
- incident: 1 berstatus GRACE dan 2 berstatus COMPLETED;
- total obligation snapshot: 370;
- recovery challenge tercatat: 8;
- recovery session: 0 aktif dan 0 total pada saat query.

Fungsi database `open_lhi_global_grace_v2` berstatus SECURITY DEFINER, menggunakan `search_path=public, pg_temp`, dan hanya dapat dieksekusi service_role. Namun isi fungsi saat pemeriksaan selalu mengembalikan:
- `ok=false`;
- `reason=SAFE_CUTOVER_REQUIRED`;
- pesan bahwa pembukaan blokir ditahan sampai snapshot v2 dan prosedur recovery produksi tervalidasi.

Implikasi:
1. Recovery exchange dapat membuat sesi hanya setelah challenge, Supabase access token, role KA IPSRS aktif, incident yang sesuai, dan global lock aktif diverifikasi.
2. Tetapi tindakan untuk membuka global grace melalui `open_lhi_global_grace_v2` saat ini sengaja ditahan oleh database function.
3. Karena itu, jangan menyatakan seluruh recovery flow sudah operasional atau sudah lulus.
4. Jangan mengubah function tersebut menjadi selalu sukses atau menghapus SAFE_CUTOVER_REQUIRED tanpa rekonsiliasi snapshot/obligation, spesifikasi state transition, regression test, backup, dan persetujuan.
5. Status global lock saat query adalah NONAKTIF; audit ini tidak mengubah lock, incident, obligation, challenge, atau session.

| ID | Prioritas | Tindakan | Status |
|---|---|---|---|
| LHI-REC-01 | P0 | Definisikan dan verifikasi safe cutover snapshot v2 dan obligation reconciliation | OPEN |
| LHI-REC-02 | P0 | Implementasikan/validasi state transition open global grace dengan test positif/negatif | BLOCKED oleh SAFE_CUTOVER_REQUIRED |
| LHI-REC-03 | P1 | Uji end-to-end challenge, exchange, capability expiry/revoke, recovery status, dan failure path | OPEN |
| LHI-REC-04 | P1 | Verifikasi UI dan API menampilkan status yang sama dengan database | OPEN |

## 13. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Audit read-only database, RLS, grants, functions, advisors, dan migration parity |
