# AS-BUILT AND OPERATIONS — APLIKASI LHI

## 1. Tujuan dan batas klaim

Dokumen ini memisahkan inventaris repository dari kondisi runtime yang benar-benar diverifikasi. Informasi pada tabel "teridentifikasi dari source" bukan bukti bahwa konfigurasi tersebut sedang aktif di produksi. Setiap pembaruan as-built wajib menyebut tanggal, environment, sumber bukti, commit/config version, dan pemeriksa.

## 2. Arsitektur platform yang tercatat

| Komponen | Peran yang terdokumentasi | Bukti/runtime yang masih diperlukan |
|---|---|---|
| GitHub repository | Source code utama | Branch protection, permission, commit SHA |
| GitHub Actions | Audit dan deployment workflow | Run ID, jobs, artifact, approval |
| Cloudflare Worker | Penyajian frontend | Worker version, routes, traffic %, asset parity |
| Supabase Edge Functions | Backend/API | Function version/deploy status, config, logs |
| Supabase PostgreSQL | Database aktif | schema/migration state, RLS, backup, restore |
| GitHub Pages | Redirect pendukung | Redirect behavior dan status |

## 3. Source inventory snapshot

Inventaris path utama yang teridentifikasi:
- `.github/workflows/`
- `frontend/`
- `frontend/pages/`
- `frontend/js/`
- `frontend/css/`
- `supabase/functions/`
- `supabase/migrations/`
- `scripts/`
- `tests/e2e/`
- `wrangler.jsonc`

File inti `frontend/app.js` dan `supabase/functions/ipsrs-api/index.ts` merupakan shared/centralized code yang perlu dependency mapping sebelum refactor.

## 4. Prosedur health check

Checklist operasional:
- Frontend domain merespons HTTPS dan asset utama termuat.
- Worker route dan versi aktif sesuai release record.
- Backend endpoint health/smoke sesuai desain dan tidak membocorkan informasi.
- Database dapat diakses melalui jalur aplikasi yang sah.
- Error rate, latency, dan log kritis diperiksa.
- Tidak ada secret atau data sensitif pada log.
- Source/deployment SHA parity diverifikasi.
- Fungsi kritis diuji dengan akun/role uji yang diotorisasi.

Hasil dicatat dengan timestamp, environment, tester, bukti, dan defect.

## 5. Backup dan recovery runbook

### 5.1 Inventaris backup
Catat untuk masing-masing:
- jenis data/source/config;
- sumber dan target backup;
- jadwal dan trigger;
- enkripsi dan akses;
- retensi;
- owner;
- bukti job terakhir;
- checksum/integrity check;
- lokasi restore dan prosedur.

### 5.2 Restore drill
1. Dapatkan persetujuan dan tentukan environment restore.
2. Verifikasi backup source dan timestamp.
3. Restore ke lingkungan terisolasi.
4. Jalankan integrity check dan reconciliation.
5. Ukur waktu pemulihan dan data loss aktual.
6. Jalankan smoke/regression test.
7. Catat hasil, gap, dan corrective action.

Jangan menyatakan backup dapat dipulihkan sebelum restore drill lulus. RPO/RTO harus disahkan terpisah.

## 6. Incident response

1. Terima dan catat laporan.
2. Klasifikasikan severity dan dampak.
3. Tetapkan incident owner/commander.
4. Contain dampak dan lindungi bukti.
5. Komunikasikan status melalui jalur resmi.
6. Pulihkan layanan melalui prosedur yang disetujui.
7. Verifikasi data, akses, dan fungsi.
8. Buat post-incident review dan tindakan pencegahan.

Perubahan darurat harus dicatat dan direkonsiliasi ke Project Control Book.

## 7. Release dan rollback runbook

Sebelum release: change approval, checkpoint, test, review, SHA, migration plan, backup/restore plan, owner, dan rollback readiness.

Setelah release: verifikasi deployment version, smoke test, parity, logs, critical flows, dan monitoring. Jika gate gagal, hentikan promosi dan jalankan rollback sesuai jenis perubahan. Rollback database tidak selalu identik dengan rollback aplikasi; migration harus memiliki strategi spesifik.

## 8. Access dan secret operations

- Least privilege untuk manusia dan service accounts.
- Secret disimpan di platform secret management.
- Rotasi saat ada dugaan kompromi atau perubahan owner.
- Offboarding mencabut akses, token, key, dan integrasi yang tidak diperlukan.
- Review akses berkala dan audit hasilnya.
- Tidak menyimpan secret pada repository, frontend, log, atau screenshot.

## 9. Monitoring dan alert

Setiap alert memiliki metric, threshold yang disetujui, severity, owner, channel, runbook, dan kondisi penutupan. Baseline awal mencakup availability, API error rate, latency, database resource, login failure, failed report submission, backup age, deployment failure, dan security finding. Nilai threshold ditetapkan setelah baseline.

## 10. Operational acceptance checklist

| Item | Bukti | Status awal |
|---|---|---|
| Owner operasional | Penetapan owner | OPEN |
| Health check | Hasil test environment/production | NOT VERIFIED |
| Monitoring dan alert | Dashboard, rule, alert drill | NOT VERIFIED |
| Backup schedule | Konfigurasi dan job evidence | NOT VERIFIED |
| Restore drill | Laporan restore | NOT VERIFIED |
| RPO/RTO | Persetujuan dan hasil ukur | NOT DEFINED |
| Incident runbook | Simulasi/tabletop | NOT VERIFIED |
| Release/rollback | Release record dan drill | NOT VERIFIED |
| Access review | Daftar akses dan approval | NOT VERIFIED |
| Source/runtime parity | SHA/version evidence | NOT VERIFIED |

## 11. Source-level finding log — 16 November 2026

Temuan berikut berasal dari pembacaan source repository `main`; ini bukan pemeriksaan live notification rows, database catalog, log production, atau bukti bahwa seluruh pengguna mengalami dampak yang sama.

| File / blob SHA | Observasi | Status bukti |
|---|---|---|
| `supabase/functions/ipsrs-api/index.ts` / `2409a55950cf822423eaa59f2eac7a8a7f65e01f` | `apiGetDisciplineWarning` hanya mengembalikan `staff_id,nama`; login gate menggunakan `reports.tanggal` untuk 7 tanggal sebelumnya | Source verified |
| `frontend/login-fast.js` / `36fa8016e6b329808d42fb9c75a4a5fe5a83042a` | Filter peringatan mensyaratkan `missed_days >= 9`, padahal response action tidak menyediakan field tersebut | Source verified |
| `frontend/lhi-discipline-notifications.js` / `da042578e00afeedda8c6d86187cf1c83bc7d287` | Memanggil `apiGetLhiNotifications` dan `apiMarkLhiNotificationRead` | Source verified |
| `frontend/app.js` / `fc061c5a8a1d28f8e776006c180685091cf1ae58` | Login path memanggil `showServerDisciplineWarning_` setelah autentikasi berhasil | Source verified |

Database production memiliki `lhi_discipline_notifications` dan cron aktif `lhi-discipline-scheduler-every-5-minutes`. Pemeriksaan menemukan 521 row `DAY_4` dari 18 event. Namun Edge Function production `ipsrs-api` v114 tidak memiliki `apiGetLhiNotifications`/`apiMarkLhiNotificationRead`; frontend memanggil keduanya melalui `authRun`, sehingga inbox tidak dapat membaca dan menandai row tersebut. `apiGetDisciplineWarning` lama juga mengembalikan hanya `staff_id,nama`, sementara modal legacy mengharapkan `missed_days >= 9`.

PR #77 menambahkan dua action API dengan filter penerima berdasarkan staff sesi, limit 50, dan penandaan baca idempotent; transport `frontend/app.js` diperbarui dan cache key app.js diganti. Status keseluruhan: **DAY_4 SCHEDULER/PERSISTENCE VERIFIED; PRODUCTION INBOX API GAP VERIFIED; FIX COMMITTED TO NON-PRODUCTION PR, NOT DEPLOYED**.

Pada commit PR `0f303f2d46fb83095f82865ba64442a76af344c8`, static audit PASS, browser regression **19 tests passed** termasuk dua test baru untuk inbox notifikasi hari ke-4 dan guard sesi, serta Deployment Gate CI PASS ([run 43804612562](https://github.com/ipsrs-rspc-91/Laporan-Harian-IPSRS/actions/runs/43804612562)). Dua test baru menggunakan mock API dan data sintetis; belum membuktikan integrasi live Supabase atau isolasi penerima pada runtime. PR #77 tetap OPEN/DRAFT dan belum merge/deploy. Status keseluruhan: **SOURCE FIX + MOCKED UI REGRESSION PASS; LIVE API INTEGRATION / SECURITY TEST AND PRODUCTION RELEASE STILL PENDING**.

Tidak ada script, database, konfigurasi, atau deployment produksi yang diubah sebagai bagian pencatatan temuan ini.

## 12. Form Blok/Recovery operational state — 16 November 2026

### 12.1 Production runtime (read-only verification)

- LHI_GLOBAL_BLOCK saat recheck: NONAKTIF.
- Terdapat satu incident GRACE aktif; dimulai 14 November 2026 pukul 18.17 WIB dan deadline 19 November 2026 pukul 18.17 WIB.
- Saat query terdapat 22 petugas Aktif, 18 Nonaktif, dan 42 baris obligation pending (baris, bukan distinct staff).
- Function production open_lhi_global_grace_v2 masih fail-closed dengan reason SAFE_CUTOVER_REQUIRED. Karena itu, Reset/recovery belum dapat dinyatakan operasional end-to-end di production.
- Schema production belum memiliki lhi_access_blocked_at, lhi_employment_activated_at, snapshot_last_lhi_created_at, snapshot_missed_days, dan lhi_discipline_obligation_events.

### 12.2 Branch PR #76 (non-production)

PR #76 head eafb67ed0a39432ead7610ac56c6ecd8b60fc61b lulus workflow 43835446297: static audit PASS, Deno type-check PASS, PostgreSQL LHI regression PASS, browser 20/20 PASS, deployment-gate audit PASS. Branch mencakup alignment migration, recovery source, block-status snapshot display, dan regression test.

PR masih OPEN/DRAFT. Hasil CI bukan production deployment. Tidak ada migration, function, global lock, incident, atau obligation production yang diubah selama pekerjaan ini.

### 12.3 Operasional cutover

1. Jangan mengubah incident GRACE aktif atau deadline 19 November 2026 pukul 18.17 WIB selama cutover tanpa rencana dan persetujuan eksplisit.
2. Selesaikan migration reconciliation sebelum db push; migration branch tidak boleh dianggap sudah diterapkan.
3. Lakukan backup/checkpoint dan uji migration chain lengkap pada staging yang mewakili schema production.
4. Deploy migration dan Edge Functions hanya melalui workflow release yang telah lulus audit dan approval.
5. Setelah deployment, verifikasi schema, function source/version, status incident, deadline grace, login gate, Reset, dan smoke test production.
6. Jika recovery status atau snapshot tidak dapat diverifikasi, sistem harus tetap fail-closed dan tidak boleh membuka login normal.

## 13. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | As-built dan operations baseline awal |
