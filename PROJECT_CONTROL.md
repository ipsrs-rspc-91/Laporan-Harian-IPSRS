# BUKU INDUK KONTROL PROYEK — Laporan-Harian-IPSRS

> **Dokumen pengendali utama proyek.** Dokumen ini mengatur perubahan, baseline, lock, regresi, deployment, migrasi, rollback, dan cara AI/engineer bekerja pada sistem IPSRS.
>
> **Prinsip utama:** Buku Induk yang lengkap tidak berarti seluruh sistem otomatis berstatus PASS. Bab harus terdokumentasi lengkap, sedangkan status teknis tetap mengikuti bukti audit nyata.

**Control Book Version:** 2.0.0  
**Tanggal penyelesaian struktur:** 2026-10-04  
**Repository:** ipsrs-rspc-91/Laporan-Harian-IPSRS  
**Branch utama:** main  
**HEAD yang diaudit saat penyusunan:** 3c5a86103cb945178ebc68f841cc4909b79fcae4  
**Target produksi:** Cloudflare  
**Backend aktif yang terdokumentasi:** Supabase Edge Function `ipsrs-api`  
**Database aktif yang terdokumentasi:** Supabase/Postgres  
**GitHub:** tetap dipertahankan sebagai source, backup, recovery dan CI/CD selama migrasi  
**Status Buku Induk:** **SELESAI — 40 bab terisi dan memiliki status kontrol**  
**Status proyek:** **BELUM BOLEH DIANGGAP MIGRASI TOTAL KE CLOUDFLARE/D1** sebelum bukti parity, database, security, backup dan production smoke lengkap.

---

# ATURAN MUTLAK

1. **LOCKED = tidak boleh diubah** tanpa permintaan eksplisit pengguna untuk modul tersebut.
2. Satu file dapat dipakai beberapa modul. Mengubah file bersama **tidak** berarti boleh mengubah semua perilaku di dalamnya.
3. Sebelum perubahan: baca Buku Induk → LOCK_REGISTER → BASELINE_REGISTER → REGRESSION_MATRIX.
4. Untuk modul LOCKED, alur wajib: **UNLOCK → CHANGE → TEST → DEPLOY VERIFY → NEW BASELINE → RE-LOCK**.
5. Tidak boleh menyebut audit sebagai “TOTAL” bila ada area wajib yang belum diperiksa.
6. Tidak boleh menyebut GitHub = Cloudflare hanya berdasarkan source code. Harus ada bukti asset/runtime/deployment.
7. Tidak boleh menghapus GitHub selama migrasi kecuali pengguna secara eksplisit memerintahkan setelah Cloudflare terbukti stabil.
8. Perubahan pada `frontend/app.js`, `index.html`, `style.css`, `static-data.js`, `kategori-modal.js`, Edge Function atau migration wajib dinilai sebagai **high-impact/shared change**.
9. Cache/version wajib diperiksa setiap perubahan asset frontend.
10. Regression terhadap modul LOCKED yang gagal = **BLOCKED**.
11. PASS harus mempunyai bukti: commit, test result, deployment result, atau observasi runtime yang jelas.
12. Jangan mengembalikan fitur lama hanya karena baseline lama lebih mudah; pertahankan fix yang sudah terbukti kecuali pengguna meminta rollback.
13. Data produksi tidak boleh diubah untuk keperluan test tanpa rencana, isolasi, dan rollback.
14. Secret/service-role key tidak boleh masuk source frontend, commit, log, atau dokumentasi.
15. Setelah perubahan selesai, Buku Induk, lock, baseline dan change log harus mencerminkan keadaan sebenarnya.

---

# 001 — IDENTITAS PROYEK DAN STATUS

**Nama:** Laporan-Harian-IPSRS  
**Fungsi:** pencatatan laporan harian IPSRS, dashboard, daftar laporan, rekap, monitoring petugas, master data, akses pengguna dan audit/history.

**Komponen utama saat ini:**
- Frontend static/PWA di `frontend/`
- Supabase Edge Function `ipsrs-api`
- Supabase/Postgres
- GitHub Actions
- Cloudflare Worker `laporan-harian-ipsrs`
- GitHub Pages sebagai source/backup/deployment selama transisi

**Status kontrol:** DOCUMENTED.  
**Bukti:** struktur repository dan file kontrol tersedia di HEAD 3c5a86103cb945178ebc68f841cc4909b79fcae4.

---

# 002 — ARSITEKTUR

## Arsitektur saat ini
```
GitHub repository
      |
      +--> GitHub Pages / source deployment
      |
      +--> Cloudflare Worker + assets
      |
      +--> Supabase Edge Function ipsrs-api
                  |
                  +--> Supabase/Postgres
```

## Target akhir
```
Cloudflare
├── Frontend / Assets
├── Worker / API
├── PWA
└── D1 / database Cloudflare
       |
GitHub = source + backup + recovery + control
```

**Catatan penting:** target D1 belum boleh dianggap selesai hanya karena Worker sudah menyajikan frontend.

**Status:** DOCUMENTED; migration completion = OPEN.

---

# 003 — PETA FILE PROYEK

## Root
- `.github/`
- `AUDIT/`
- `backups/`
- `frontend/`
- `scripts/`
- `supabase/`
- `tests/`
- `AI_AUDIT_PROTOCOL.md`
- `BASELINE_REGISTER.yaml`
- `LOCK_REGISTER.yaml`
- `REGRESSION_MATRIX.yaml`
- `PROJECT_CONTROL.md`
- `playwright.config.mjs`
- `wrangler.jsonc`

## Frontend utama
- `frontend/index.html`
- `frontend/app.js`
- `frontend/config.js`
- `frontend/sw.js`
- `frontend/manifest.json`
- `frontend/logo.png`
- `frontend/access-control.js`
- `frontend/access-policy-ui.js`
- `frontend/access-visibility-fix.js`
- `frontend/dashboard-loading-v2.js`
- `frontend/laporan-fast-v2.js`
- `frontend/laporan-loading-state.js`
- `frontend/login-fast.js`
- `frontend/required-fields-ui.js`

## Frontend pages
- `frontend/pages/Page_Login.html`
- `frontend/pages/Page_Dashboard.html`
- `frontend/pages/Page_Input.html`
- `frontend/pages/Page_Laporan.html`
- `frontend/pages/Page_Rekap.html`
- `frontend/pages/Page_Online.html`

## Frontend JS
- `frontend/js/static-data.js`
- `frontend/js/kategori-modal.js`

## CSS
- `frontend/css/style.css`

## Backend
- `supabase/functions/ipsrs-api/index.ts`
- `supabase/functions/ipsrs-api/deno.json`
- `supabase/config.toml`
- `supabase/migrations/*.sql`

## Test/control
- `tests/e2e/app-smoke.spec.mjs`
- `scripts/audit-total.mjs`
- `playwright.config.mjs`
- `.github/workflows/ipsrs-audit-gate.yml`
- `.github/workflows/deploy-production.yml`
- `AUDIT/AUTOMATED-AUDIT-GATE.md`
- `AUDIT/FULL-REGRESSION-GATE.md`

**Status:** DOCUMENTED for known production tree. New files must be added here or intentionally classified as auxiliary.

---

# 004 — FRONTEND SHELL

**Entry point:** `frontend/index.html`  
**Application core:** `frontend/app.js`  
**Styles:** `frontend/css/style.css`

**Aturan:**
- Asset URL/cache version harus berubah bila isi JS/CSS berubah.
- Script ordering dan deferred loading tidak boleh diubah tanpa performance/regression check.
- Shared `app.js` harus dianggap high-impact.

**Current evidence:** `index.html` references the application assets; current `app.js` source is approximately 195 KB and contains navigation, auth orchestration, dashboard, reports and master synchronization.

**Status:** DOCUMENTED; PERFORMANCE verification remains open.

---

# 005 — INPUT LAPORAN

**Page:** `Page_Input.html`  
**Core:** `app.js`, `required-fields-ui.js`, `kategori-modal.js`, backend validation.

**Core fields documented in backend mapping:**
Tanggal, Pelapor, Pukul, NoLK, Ruang, MasalahKegiatan, Tindakan, Status, Keterangan, Kategori, AreaKerja, Item, SparePartUnit, Type, Jumlah serta field pekerjaan/jadwal.

**Validation minimum backend:**
- Tanggal wajib.
- Item wajib.
- MasalahKegiatan atau RealisasiPekerjaan wajib.
- Kategori yang membutuhkan spare part/unit wajib mengisi field terkait.

**Status:** DOCUMENTED; full browser regression = pending.

---

# 006 — SISTEM KATEGORI

**Frontend:** `kategori-modal.js`, `app.js`, `Page_Input.html`, `required-fields-ui.js`  
**Backend:** `ipsrs-api/index.ts`

**Kategori bisnis yang dikendalikan saat ini harus mengikuti keputusan pengguna, bukan improvisasi AI:**
1. PEMELIHARAAN RUTIN SESUAI JADWAL
2. PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL
3. PEMELIHARAAN DILUAR JADWAL RUTIN
4. PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL
5. PERBAIKAN SAJA
6. PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL
7. PENGGANTIAN ATAU PEMASANGAN UNIT / ALAT
8. PERMINTAAN PELAYANAN ( DILUAR PEMELIHARAAN DAN PERBAIKAN)

**Field terpisah:**
- SPARE PART / MATERIAL
- UNIT

Untuk penggantian, modal wajib menjaga field:
- nama/jenis item sesuai pilihan
- tipe
- jumlah
- field wajib lain sesuai desain modal yang disetujui

**Larangan:** jangan menambahkan kategori baru seperti “LAINNYA”, “BARU”, atau istilah lain tanpa permintaan pengguna.

**Status:** STABLE_CANDIDATE; belum LOCKED sampai browser + production parity terbukti.

---

# 007 — AREA DAN ITEM

**Source saat ini:** master data Supabase melalui `apiGetMasterData`, dengan fallback/static data di frontend.

**Fungsi:** sinkronisasi area/item, pilihan area berdasarkan bidang, dan pengurutan master.

**KESLING yang sudah dikoreksi:**
- KESLING ( Umum )
- KESLING ( Sistem IPAL )
- KESLING (Sistem Air Bersih)
- KESLING (Sistem Limbah B3)

**Aturan:** master DB dan frontend harus direkonsiliasi. Perubahan nama/order tidak boleh dilakukan hanya di static fallback jika database menjadi source of truth.

**Status:** STABLE_CANDIDATE.

---

# 008 — DASHBOARD

**Page:** `Page_Dashboard.html`  
**Core:** `app.js`, `dashboard-loading-v2.js`, `laporan-fast-v2.js`, `access-visibility-fix.js`, CSS.

**Perilaku yang dilindungi:**
- KPI total/selesai/belum
- kartu “Belum Selesai” dapat drill-down
- tabel/statistik spare part dan unit
- chart status
- bar kategori/area/staf
- recent report card
- monitoring hari ini
- mobile table containment

**API utama:** `apiDashboardStats`.

**Cache:** dashboard menggunakan cache/inflight pendek di frontend untuk request identik.

**Status:** **LOCKED** melalui LOCK_REGISTER. Jangan ubah tanpa permintaan eksplisit pengguna.

---

# 009 — DAFTAR LAPORAN

**Page:** `Page_Laporan.html`  
**Core:** `laporan-fast-v2.js`, `laporan-loading-state.js`, `app.js`.

**Mode:**
- Laporan saya
- Daftar laporan yang boleh dilihat user
- Filter bulan/petugas/bidang/status dan drill-down dashboard

**Backend:** `apiGetReports`, `apiGetReportById`, lifecycle create/update/delete.

**Aturan:** visibility final harus ditentukan backend; frontend hanya menampilkan hasil dan kontrol UI.

**Status:** STABLE_CANDIDATE.

---

# 010 — REKAP BULANAN

**Page:** `Page_Rekap.html`  
**Backend action:** `apiGetMonthlyRecap`.

**Fungsi:** rekap per bulan dan petugas sesuai hak akses.

**Aturan:** month picker harus konsisten dengan timezone/format periode backend.

**Regression minimum:** monthly-recap, month-picker.

**Status:** STABLE_CANDIDATE.

---

# 011 — MONITORING STAF

**Page:** `Page_Online.html` dan area Monitoring Harian.  
**Backend:** `apiGetStaffMonitoring`, `apiGetStaffDailyStatus`.

**Data:** status aktif, laporan hari ini, kepatuhan bulan berjalan, transaksi bulanan.

**Aturan penting:** hanya staf Aktif yang menjadi kewajiban monitoring; filter harus konsisten dengan Dashboard.

**Status:** STABLE_CANDIDATE.

---

# 012 — LOGIN / SESSION

**Frontend:** `Page_Login.html`, `login-fast.js`, `app.js`, `config.js`.  
**Backend:** autentikasi/session resolution di Edge Function.

**Aturan saat ini yang terdokumentasi:** startup kembali ke login; jangan menganggap remembered username sebagai bukti authenticated session.

**Regression:** login, session, remembered credentials, logout.

**Status:** STABLE_CANDIDATE.

---

# 013 — ACCESS CONTROL / SECURITY

**Frontend:** `access-control.js`, `access-policy-ui.js`, `access-visibility-fix.js`.  
**Backend:** policy functions dalam `ipsrs-api/index.ts`.

**Role yang terdokumentasi:** KA_IPSRS, ADMINISTRASI, KASIE, STAF, PETUGAS_SHIFT.

**Prinsip:** UI permission bukan security boundary. Otorisasi final harus backend/database.

**Status:** STABLE_CANDIDATE; security verification belum lengkap.

---

# 014 — BACKEND API

**Edge Function:** `supabase/functions/ipsrs-api/index.ts`.

**Action yang telah ditemukan/terdokumentasi:**
- `apiGetReports`
- `apiGetReportById`
- `apiCreateReport`
- `apiUpdateReport`
- `apiDeleteReport`
- `apiGetReportHistory`
- `apiGetAuditLog`
- `apiDashboardStats`
- `apiGetStaffMonitoring`
- `apiGetStaffDailyStatus`
- `apiGetMonthlyRecap`
- `apiGetMasterData`
- `apiListStaff`
- `apiGetStaffReports`
- `apiGetStaffPerformance`
- serta action lain yang harus dianggap resmi hanya setelah ditemukan di source aktif.

**Current live Supabase function evidence:** `ipsrs-api` ACTIVE, version 70 pada saat audit.

**Status:** DOCUMENTED; source/live parity = OPEN.

---

# 015 — DATABASE SUPABASE

**Project ref:** `tcrmlhfsroyhaxdfwyll`.

**Objek yang jelas dipakai source:**
- `reports`
- `staff`
- `staff_dropdown`
- `master_data`
- `report_history`
- `audit_log`
- `access_settings`
- `edit_permissions`

**Field laporan yang dipetakan backend antara lain:**
report_id, staff_id, nama_snapshot, bidang_snapshot, role_snapshot, tanggal, pelapor, pukul, nolk, ruang, masalah_kegiatan, tindakan, status, keterangan, kategori, area_kerja, item, spare_part_unit_kind, spare_part_unit_status, spare_part_unit, type, jumlah, created_at, updated_at, created_by_*, updated_by_*, version, deleted_at.

**Konsep SPARE PART / MATERIAL / UNIT:** laporan baru menyimpan klasifikasi `SPARE PART / MATERIAL` atau `UNIT`, status `BARU/KANIBAL/LAINNYA`, nama, type dan jumlah. Rekap BARU tidak lagi bergantung pada nama kategori; kategori lama tetap didukung sebagai fallback kompatibilitas.\n\n**Status:** DOCUMENTED; full schema/RLS live certification = OPEN.

---

# 016 — RLS / AUTHORIZATION

Migration yang ada di repository mencakup:
- permanent report privacy hardening
- public API/index hardening
- anon default privileges closure
- report update RLS alignment
- staff data access/admin edit hardening
- soft delete reports
- admin edit RLS alignment

**Aturan bisnis penting yang terlihat di backend:**
- KA_IPSRS memiliki akses tertinggi untuk report lifecycle.
- Pemilik dapat mengelola laporannya sendiri sesuai policy.
- Administrasi hanya dapat edit laporan staf lain jika setting `ADMINISTRASI_EDIT` aktif.
- Permission target dapat dikendalikan melalui `edit_permissions`.
- Laporan KA IPSRS dilindungi dari edit pihak lain.

**Status:** DOCUMENTED; live RLS test = OPEN.

---

# 017 — AUDIT LOG / HISTORY

**Objek:** `audit_log`, `report_history`.

**Peristiwa yang terdokumentasi:** create, update, denied update, delete dan perubahan terkait report lifecycle.

**Aturan:** audit trail tidak boleh dihapus sebagai bagian dari normal report deletion.

**Akses:** API audit log dibatasi KA IPSRS / Administrasi.

**Status:** STABLE_CANDIDATE.

---

# 018 — MASTER DATA

**Source utama:** `master_data` Supabase melalui `apiGetMasterData`.

**Frontend:** static-data sebagai bootstrap/fallback, kemudian sinkronisasi master.

**Master yang dikendalikan:**
- area
- item
- kategori
- parent category bila berlaku

**Aturan:** jangan membuat dua sumber kebenaran yang tidak direkonsiliasi.

**Status:** STABLE_CANDIDATE.

---

# 019 — PWA / SERVICE WORKER

**Files:** `manifest.json`, `sw.js`, `index.html`.

**Manifest:** nama IPSRS, start_url ./, scope ./, standalone, portrait, logo.png.

**Service worker saat ini:** install/activate dan network-only fetch; tidak menyimpan API/data aplikasi sebagai cache.

**Catatan nyata:** `CACHE_NAME` masih menunjukkan versi `lhi-shell-v20261002-kategori-scroll5`; setiap perubahan strategi cache/versioning harus diverifikasi dan tidak boleh diasumsikan otomatis.

**Status:** STABLE_CANDIDATE; production PWA verification = OPEN.

---

# 020 — CACHE / VERSIONING

**Aturan:**
- Perubahan JS/CSS yang di-load melalui URL versi harus memperbarui cache-buster.
- Perubahan service worker harus mengubah versi cache bila cache digunakan.
- API cache TTL harus dicatat jika memengaruhi freshness.
- Cache invalidation harus dipicu setelah create/update/delete bila data yang terdampak ditampilkan kembali.

**Implementasi backend saat ini:** report cache TTL pendek; permission/owner-role cache lebih panjang sesuai source aktif.

**Frontend:** Dashboard memiliki response cache TTL sekitar 3 detik dan inflight deduplication.

**Status:** DOCUMENTED; numeric production measurement = OPEN.

---

# 021 — PERFORMANCE

**Known hotspots:**
- startup/index.html
- app.js besar dan shared
- Dashboard
- Daftar Laporan
- Monitoring
- backend query/report policy

**Known improvements yang tidak boleh di-rollback tanpa bukti:**
- dashboard response cache + inflight dedup
- selective payloads
- backend short-lived caches
- asset discovery/cache audit
- deferred Chart.js handling
- dashboard monitoring consolidation

**Aturan measurement:** gunakan p50/p95 untuk startup, Dashboard, Laporan, Monitoring bila tersedia; jangan memakai “terasa cepat” sebagai bukti.

**Status:** STABLE_CANDIDATE; numeric baseline belum certified.

---

# 022 — E2E / REGRESSION TESTING

**Framework:** Playwright melalui `playwright.config.mjs`.

**DASH tests yang sudah IMPLEMENTED:**
- dashboard-load
- unfinished-drilldown
- dashboard-spare-part-table
- dashboard-mobile

**Matrix lain masih harus mengikuti status IMPLEMENTED/PLANNED di `REGRESSION_MATRIX.yaml`.

**Gate:** static audit + browser regression + deployment verification.

**Status:** DOCUMENTED; coverage belum 100%.

---

# 023 — GITHUB

**Repository:** ipsrs-rspc-91/Laporan-Harian-IPSRS  
**Branch:** main  
**Current HEAD saat Buku Induk diselesaikan:** 3c5a86103cb945178ebc68f841cc4909b79fcae4.

**Peran:**
- source control
- history
- backup
- recovery
- control book
- CI/CD

**Branch protection:** saat audit branch main tercatat belum memiliki required status checks. Ini adalah risiko kontrol dan harus ditangani jika ingin GitHub menjadi gate formal.

**Status:** DOCUMENTED; governance hardening = OPEN.

---

# 024 — CLOUDFLARE

**Worker:** `laporan-harian-ipsrs`  
**URL:** https://laporan-harian-ipsrs.rspc.workers.dev/

**Config:** `wrangler.jsonc`, assets dari `./frontend`.

**Status migration:** Worker sudah ada dan assets telah dikonfigurasi, tetapi parity penuh GitHub→Cloudflare belum certified.

**Wajib sebelum menyatakan Cloudflare production equivalent:**
1. source asset list vs deployed asset list
2. asset hash/version comparison
3. index/script/CSS references
4. Worker deployment/version
5. HTTP smoke
6. login
7. report input
8. dashboard
9. report list
10. monitoring
11. PWA
12. backend connectivity

**Status:** STABLE_CANDIDATE.

---

# 025 — SUPABASE DEPLOYMENT

**Current evidence:** Edge Function `ipsrs-api` ACTIVE version 70.

**Repository source:** `supabase/functions/ipsrs-api/index.ts`.

**Migrations:** repository contains the security/privacy/RLS/soft-delete migration chain dated 2026-09-24 through 2026-09-28.

**Rule:** source commit ≠ proof live function equals source. Live version/hash must be compared when certification is required.

**Status:** DOCUMENTED; source/live parity = OPEN.

---

# 026 — CI/CD

**Workflows:**
- `.github/workflows/ipsrs-audit-gate.yml`
- `.github/workflows/deploy-production.yml`

**Audit gate stages:**
- audit-total
- browser-regression
- final audit gate result

**Deployment targets:** GitHub Pages / Cloudflare / Supabase according to workflow conditions and secrets.

**Known prior issue:** Cloudflare deployment previously failed because `CLOUDFLARE_API_TOKEN` was missing. Do not mark Cloudflare CI as PASS merely because workflow YAML exists.

**Status:** STABLE_CANDIDATE.

---

# 027 — BACKUP / ROLLBACK

**Repository backup:** `backups/2026-09-25/` exists.

**Minimum recovery layers:**
1. Git commit checkpoint
2. source export
3. Supabase migration history
4. Edge Function source/version
5. Cloudflare Worker deployment/version
6. database backup/data export
7. rollback smoke test

**Important limitation:** repository backup folder is evidence of a source backup, not proof of complete database disaster recovery.

**Status:** WARNING until restore drill is executed and evidenced.

---

# 028 — DATA INTEGRITY

**Rules:**
- report IDs must remain unique
- version increments on report update
- history captures before/after for edits
- soft delete uses `deleted_at`
- snapshots preserve staff identity/role context
- master data references must remain reconcilable
- no destructive test against production data

**Integrity checks required before major migration:**
- report count reconciliation
- active/deleted report reconciliation
- staff count/status reconciliation
- master_data count by type
- audit/history referential reconciliation

**Status:** DOCUMENTED; live reconciliation pending.

---

# 029 — UI/UX

**Locked/protected principles:**
- mobile-first report cards
- date dd/mm/yyyy
- Status “Selesai” top-right
- loading style and interaction must not be casually changed
- modal close X is sufficient; do not add redundant “Batalkan” if explicitly removed
- category selection must not jump so far upward that selected text disappears
- outer card border must follow approved thickness
- required fields use clear red border without excessive colors

**Rule:** visual change must be tested on desktop and mobile; screenshot/DOM evidence preferred.

**Status:** DOCUMENTED; only explicitly LOCKED modules have hard protection.

---

# 030 — MOBILE / RESPONSIVE

**Target:** Android/mobile browser and PWA.

**Protected dashboard behavior:** no horizontal overflow from tables.

**Required checks:**
- 360px
- 390px
- 412px or equivalent device width
- form modal scrolling
- report card wrapping
- table containment
- touch target visibility

**Status:** DASH mobile behavior LOCKED; overall mobile system remains STABLE_CANDIDATE.

---

# 031 — CROSS-MODULE INTEGRATION

High-risk shared dependencies:
- `app.js`
- `index.html`
- `style.css`
- `static-data.js`
- `config.js`
- `ipsrs-api/index.ts`

Examples:
- category change can affect input + filter + dashboard + report list + backend validation
- master-data change can affect input + filters + report display + dashboard grouping
- auth change can affect every page
- API schema change can affect every frontend page
- asset/cache change can affect every module

**Rule:** shared file change requires impact map before edit.

**Status:** DOCUMENTED.

---

# 032 — REGRESSION AUDIT

Regression is evaluated at four levels:

**L1 — Static:** syntax, expected functions, forbidden secrets, lock gate, asset/version references.  
**L2 — Unit/contract:** backend action contracts, permissions, validation, delete safety.  
**L3 — Browser/E2E:** page navigation and user behavior.  
**L4 — Production smoke:** deployed URL, asset versions, login and critical workflows.

**Gate:** a failure in a LOCKED module is release-blocking.

**Status:** DOCUMENTED; not all L1–L4 tests are implemented.

---

# 033 — DEPLOYMENT VERIFICATION

After every production deployment:
1. record commit SHA
2. record deployment/run ID
3. verify deployment job result
4. verify deployed asset/version
5. open production URL
6. smoke login
7. smoke one read path
8. smoke one write path where safe
9. smoke dashboard
10. smoke report list
11. smoke permission boundary where testable
12. record result in change log/baseline

**Do not equate “workflow succeeded” with “application works” without production smoke.**

**Status:** DOCUMENTED.

---

# 034 — FINAL PRODUCTION AUDIT

A release may be declared **PRODUCTION VERIFIED** only if all applicable gates are PASS:

| Gate | Required |
|---|---|
| Source | PASS |
| Lock gate | PASS |
| Static audit | PASS |
| Regression | PASS |
| Cache/version | PASS |
| Supabase/backend | PASS |
| Database/RLS | PASS |
| Cloudflare deployment | PASS |
| Production smoke | PASS |
| GitHub recovery checkpoint | PASS |
| Data integrity | PASS |
| Security | PASS |

If any item is missing evidence: **NOT CERTIFIED**.

**Current overall certification:** NOT CERTIFIED for complete Cloudflare/D1 migration.

---

# 035 — CHANGE LOG

Control-system history retained from prior revisions:
- `869ec51da37648f810e2d89f8c425cc8ec21765c3` — corrected audit lock/secret-scan regex escaping.
- `c34e9d1f96d0252f7015d27653e05768e3cd89c3` — corrected BASELINE_REGISTER structure.
- `373890d45bde872c901c2be8c06eca38407eca12` — added IMPLEMENTED/PLANNED regression status.
- `a676abb9f3910f38c2d055f472c43393376ae0b9` — implemented four DASH regression tests.
- `c35f7b83b33d3c80abe070e07ee03544693ec070` — repaired LOCK gate parser and synthetic self-test.
- `a354fd45d4f0a7c888cea1ced5981fe5af43dc67` — expanded protected files/modules.
- `3c5a86103cb945178ebc68f841cc4909b79fcae4` — removed stray baseline entry.
- **This revision:** completes all 40 chapters and converts the book from a skeleton into an operational control specification.

Future entries must contain:
**date → user request → impacted modules → files → old baseline → new baseline → tests → deployment → production evidence → lock status**.

---

# 036 — KNOWN ISSUES / OPEN GATES

Current known gates:
1. DASH is LOCKED, but a fresh successful browser regression run after the control revisions must be evidenced before calling the latest control state fully verified.
2. KAT, KESLING, AUTH, REPORT, MASTER, PWA, PERFORMANCE, SECURITY remain STABLE_CANDIDATE.
3. Cloudflare source/deployment parity is not certified.
4. Supabase live function/source parity is not certified.
5. Live DB/RLS reconciliation is not certified.
6. Full backup/restore drill is not certified.
7. Numeric performance baselines are not certified.
8. Main branch has no required status checks in the observed branch metadata.
9. D1 migration is not certified and therefore GitHub/Supabase dependencies remain active.

**Rule:** issues remain visible until evidence closes them.

---

# 037 — BASELINES / CHECKPOINTS

Source of truth: `BASELINE_REGISTER.yaml`.

Known checkpoints include:
- `BASE-2026-10-03-CATEGORY`
- `BASE-2026-10-04-CATEGORY-FIX`
- `BASE-2026-10-03-KESLING`
- `BASE-2026-10-04-CONTROL`
- `BASE-2026-10-04-CONTROL-AUDIT-GATE`
- `BASE-2026-10-04-AUDIT-GATE-SELFTEST`

**Rule:** baseline is not automatically production-certified. It becomes production-approved only after deployment and smoke evidence.

---

# 038 — CHANGE CONTROL

## SOP WAJIB — SETIAP INSTRUKSI PERUBAHAN HARUS OTOMATIS AUDIT + DEPLOY

Mulai berlaku sebagai aturan operasional proyek:

1. **Setiap instruksi pengguna yang menghasilkan perubahan pada source/config/control file wajib otomatis masuk pipeline AUDIT TOTAL.**
2. **Setiap perubahan yang lolos AUDIT TOTAL wajib otomatis diteruskan ke DEPLOY PRODUCTION** sesuai target yang terdampak.
3. **Tidak boleh menunggu instruksi kedua** seperti “audit”, “deploy”, atau “lanjutkan deploy” setelah perubahan dibuat.
4. Alur otomatis wajib:
   **CHANGE → AUDIT TOTAL → BROWSER/CROSS-MODULE REGRESSION → CACHE/VERSION CHECK → DEPLOY → PRODUCTION VERIFY/SMOKE → STATUS AKHIR.**
5. **Audit gagal = deployment diblokir.**
6. **Deployment gagal = status akhir bukan PASS/LIVE.**
7. **Production smoke/verification gagal = status akhir bukan PRODUCTION VERIFIED.**
8. Untuk perubahan frontend, target produksi Cloudflare wajib diverifikasi; GitHub Pages dijalankan sesuai workflow.
9. Untuk perubahan backend/database, target Supabase yang terdampak wajib diverifikasi sesuai workflow.
10. Setiap hasil wajib dilaporkan terpisah sebagai:
    - **CODE CHANGE**
    - **AUDIT TOTAL**
    - **DEPLOYMENT**
    - **PRODUCTION VERIFY**
    - **FINAL STATUS**
11. **Tidak boleh menyatakan “sudah deploy”, “sudah live”, atau “sudah selesai” tanpa bukti run/deployment/production yang sesuai.**
12. Instruksi yang hanya meminta informasi/status dan **tidak mengubah sistem** tidak memicu deployment; tetapi pemeriksaan status tetap harus menggunakan bukti aktual.
13. Perubahan kontrol/SOP sendiri mengikuti aturan yang sama dan wajib diaudit serta dideploy otomatis.
14. **SETIAP INSTRUKSI PERUBAHAN dari pengguna wajib diperlakukan sebagai satu siklus lengkap:** setelah kode diubah, **langsung cek Audit Total, lalu cek Deployment, lalu cek Production Verification** berdasarkan status GitHub Actions aktual. Tidak boleh hanya mengandalkan bahwa workflow “akan berjalan”.
15. **Sebelum menyatakan “sudah audit”, “sudah deploy”, atau “sudah live”, wajib ada bukti run aktual.** Status yang berbeda wajib disebutkan secara terpisah:
    - Audit SUCCESS ≠ Deployment SUCCESS.
    - Deployment SUCCESS ≠ Production Verification SUCCESS.
    - Jika salah satu gagal, status akhir wajib menyebut **FAILURE** dan alasan/fakta yang tersedia.
16. **Tidak ada instruksi lanjutan yang diperlukan dari pengguna** untuk memulai audit/deploy setelah perubahan kode dibuat. Pipeline harus berjalan otomatis sesuai workflow proyek.
17. Jika deployment otomatis gagal karena credential, secret, permission, atau konfigurasi environment, **jangan menganggap perubahan sudah live**; laporkan hambatan tersebut dan perlakukan sebagai kegagalan deployment sampai terbukti berhasil.

## Lifecycle wajib

```
USER INSTRUCTION
   ↓
IDENTIFY MODULE
   ↓
READ PROJECT_CONTROL
   ↓
READ LOCK_REGISTER
   ↓
READ BASELINE_REGISTER
   ↓
IMPACT / DEPENDENCY MAP
   ↓
CHECK LOCK
   ├─ LOCKED → require explicit request for that module
   └─ not locked → continue
   ↓
CHANGE MINIMUM SCOPE
   ↓
AUTO AUDIT TOTAL
   ↓
AUTO BROWSER / CROSS-MODULE REGRESSION
   ↓
AUTO CACHE / VERSION CHECK
   ↓
AUTO DEPLOY
   ↓
AUTO PRODUCTION VERIFY / SMOKE
   ↓
REPORT CODE + AUDIT + DEPLOY + VERIFY + FINAL STATUS
   ↓
UPDATE CHANGE LOG + BASELINE
   ↓
RE-LOCK
```

**No silent scope expansion. No manual deploy step after a completed code change.**

---

# 039 — AUDIT PROCEDURE

## AUDIT IPSRS — TOTAL
Must inspect:
- source tree
- control registers
- locked modules
- shared files
- frontend
- backend
- database/migrations
- RLS/security
- PWA/cache
- performance
- CI/CD
- Cloudflare
- Supabase
- tests
- production smoke
- backup/recovery
- data integrity

Output:
- PASS
- WARNING
- BLOCKED
- NOT CHECKED

**NOT CHECKED cannot be reported as PASS.**

## AUDIT IPSRS — MODULE
Inspect target module plus every dependency.

## UPDATE/REPAIR
Do not modify unrelated LOCKED modules.

---

# 040 — CARA MEMANGGIL BUKU INDUK

Pengguna tidak perlu menghafal nama file.

Perintah standar:

**Untuk audit total:**
> “AUDIT IPSRS — TOTAL. Gunakan Buku Induk Kontrol. Jangan anggap PASS tanpa bukti.”

**Untuk memperbaiki fitur:**
> “Panggil Buku Induk Kontrol. Audit dan perbaiki [nama fitur]. Jangan merusak modul LOCKED.”

**Untuk perubahan modul terkunci:**
> “UNLOCK [MODULE_ID], perbaiki [masalah], jalankan regresi, deploy verify, lalu RE-LOCK.”

**Untuk pemeriksaan migrasi:**
> “Audit parity GitHub → Cloudflare → Supabase berdasarkan Buku Induk. Jangan klaim migrasi selesai tanpa bukti.”

## Urutan dokumen yang wajib dibaca AI/engineer
1. `PROJECT_CONTROL.md`
2. `LOCK_REGISTER.yaml`
3. `BASELINE_REGISTER.yaml`
4. `REGRESSION_MATRIX.yaml`
5. `AI_AUDIT_PROTOCOL.md`
6. source/module yang diminta
7. dependency yang terdampak

---

# STATUS AKHIR BUKU INDUK

## Buku Induk
**STATUS: SELESAI**

Semua 40 bab 001–040 sekarang mempunyai isi, aturan, scope, dependency, atau prosedur yang jelas.

## Lock system
**STATUS: AKTIF**

File pengendali:
- `LOCK_REGISTER.yaml`
- `BASELINE_REGISTER.yaml`
- `REGRESSION_MATRIX.yaml`

## Audit system
**STATUS: AKTIF**

File/alat:
- `AI_AUDIT_PROTOCOL.md`
- `scripts/audit-total.mjs`
- GitHub Actions audit gate
- Playwright E2E

## Produksi
**STATUS: BELUM FULLY CERTIFIED**

Alasannya bukan karena Buku Induk belum jadi, tetapi karena bukti teknis yang memang belum lengkap:
- Cloudflare parity
- Supabase source/live parity
- DB/RLS live verification
- full backup/restore drill
- numeric performance baseline
- full regression coverage
- production smoke terbaru

**Artinya: Buku Induk sudah selesai sebagai sistem kontrol; audit proyek tetap berjalan mengikuti gate di dalam Buku Induk.**

---

# SATU ATURAN TERPENTING

> **Jangan ubah kode dulu. Panggil Buku Induk → tentukan modul → cek lock → cek baseline → petakan dampak → baru ubah → test → deploy → verify → re-lock.**

