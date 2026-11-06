# MASTER PROJECT LHI — Laporan Harian IPSRS

> Dokumen navigasi dan arsitektur tingkat proyek. Dokumen ini melengkapi, bukan menggantikan, `PROJECT_CONTROL.md` yang tetap menjadi Buku Induk Kontrol Proyek dan sumber aturan perubahan resmi.

**Repository:** `ipsrs-rspc-91/Laporan-Harian-IPSRS`  
**Branch referensi:** `main`  
**Snapshot audit sumber:** `7460da098bcfc6eed5e29b3e0e277c8bd7508bc6`  
**Tanggal snapshot:** 6 November 2026  
**Status dokumen:** Baseline dokumentasi awal — perlu dilengkapi dengan audit fungsi dan dependensi per file  
**Ruang lingkup perubahan ini:** Dokumentasi saja; tidak mengubah kode aplikasi, database, workflow, maupun konfigurasi hosting.

---

## 0. Cara menggunakan dokumen ini

Dokumen ini adalah peta untuk menemukan bagian sistem dan menentukan dokumen mana yang harus dibaca sebelum bekerja.

Urutan membaca sebelum perubahan:
1. Dokumen ini untuk memahami peta sistem.
2. `../PROJECT_CONTROL.md` untuk aturan dan tata kelola proyek.
3. `../LOCK_REGISTER.yaml` untuk status modul dan batas perubahan.
4. `../BASELINE_REGISTER.yaml` untuk titik acuan dan pemulihan.
5. `../REGRESSION_MATRIX.yaml` untuk pengujian yang diwajibkan.
6. `../SOP-UPDATE-DAN-DEPLOY.md` untuk alur perubahan sampai produksi.
7. `../AI_AUDIT_PROTOCOL.md` untuk protokol audit oleh AI/engineer.

**Aturan penting:** status modul, lock, baseline, dan PASS/FAIL tidak ditetapkan oleh dokumen ini. Ikuti register resmi dan bukti pengujian/deployment terbaru.

## 1. Ringkasan sistem

LHI adalah aplikasi web operasional IPSRS. Repository GitHub menjadi sumber kode utama dan riwayat perubahan. GitHub Actions menjalankan audit serta deployment otomatis. Cloudflare Worker menyajikan frontend. Supabase menyediakan Edge Functions dan database PostgreSQL.

### 1.1 Arsitektur existing yang teridentifikasi

```text
Pengembang
   |
   v
GitHub repository (branch main)
   |
   v
GitHub Actions
   |-- IPSRS Automated Audit Gate
   |     |-- audit statis
   |     |-- browser regression / Playwright
   |
   +-- jika gate berhasil dan SHA masih sesuai
          |
          +--> Cloudflare Worker + static assets (frontend/)
          |
          +--> GitHub Pages redirect
          |
          +--> Supabase deployment bila file backend/migration berubah
                    |
                    +--> Supabase Edge Functions
                    +--> Supabase PostgreSQL

Browser pengguna
   |--> Frontend di Cloudflare Worker
   |--> Memanggil backend/API Supabase sesuai konfigurasi aplikasi
```

### 1.2 Peran setiap layanan

| Layanan | Peran existing | Bukan perannya |
|---|---|---|
| GitHub | Source code utama, version history, branch, checkpoint, repository kontrol | Bukan database runtime |
| GitHub Actions | Audit, regression test, dan otomasi deployment | Bukan tempat menyimpan data aplikasi |
| Cloudflare Worker | Hosting/penyajian frontend dan static assets | Bukan database utama saat ini |
| Supabase Edge Functions | Backend/API server-side | Bukan hosting frontend utama |
| Supabase PostgreSQL | Database aplikasi | Bukan repository source code |
| GitHub Pages | Redirect pendukung sesuai workflow | Bukan hosting utama frontend saat ini |

**Catatan arsitektur:** konfigurasi `wrangler.jsonc` menetapkan assets directory `./frontend`. Dokumen proyek menyebut Cloudflare D1 sebagai arah/target migrasi, tetapi migrasi penuh ke D1 belum boleh dianggap selesai. Database aktif yang didokumentasikan saat snapshot ini adalah Supabase/PostgreSQL.

## 2. Peta direktori repository

Daftar berikut berdasarkan struktur repository pada snapshot audit. Ini adalah inventaris lokasi, bukan klaim bahwa setiap fungsi sudah terpisah secara modular.

| Path | Isi / tanggung jawab |
|---|---|
| `.github/workflows/` | Workflow audit gate dan deployment produksi |
| `frontend/` | Aplikasi web yang disajikan sebagai asset Cloudflare |
| `frontend/pages/` | Halaman Login, Dashboard, Input, Laporan, dan Online yang ditemukan pada snapshot |
| `frontend/js/` | Script kategori dan master data |
| `frontend/css/` | Style utama |
| `supabase/functions/` | Edge Functions backend |
| `supabase/migrations/` | Riwayat perubahan skema dan fungsi database |
| `scripts/` | Script audit total |
| `tests/e2e/` | Pengujian end-to-end Playwright |
| `AUDIT/` | Catatan audit dan gate |
| `backups/` | Salinan file tertentu pada titik perubahan |
| `github-pages-redirect/` | Asset redirect GitHub Pages |
| `PROJECT_CONTROL.md` | Buku Induk Kontrol Proyek |
| `LOCK_REGISTER.yaml` | Daftar modul terkunci/stable candidate |
| `BASELINE_REGISTER.yaml` | Daftar baseline dan checkpoint |
| `REGRESSION_MATRIX.yaml` | Daftar pengujian dan aturan gate |
| `SOP-UPDATE-DAN-DEPLOY.md` | SOP update sampai verifikasi produksi |
| `AI_AUDIT_PROTOCOL.md` | Protokol audit AI/engineer |
| `wrangler.jsonc` | Konfigurasi deployment Cloudflare Worker/assets |

## 3. Peta modul fungsional

Nama dan status modul di bawah mengikuti `LOCK_REGISTER.yaml` pada snapshot audit. Satu modul dapat menggunakan beberapa file dan satu file dapat digunakan oleh banyak modul.

| ID | Modul | Fungsi utama | Status register pada snapshot |
|---|---|---|---|
| AUTH | Login / Session / Access Control | Login, sesi, role, hak akses | STABLE_CANDIDATE |
| DASH | Dashboard | KPI, ringkasan, drill-down, tabel dan grafik | LOCKED |
| REPORT | Input dan siklus laporan | Buat, lihat, edit, filter, dan keamanan penghapusan laporan | STABLE_CANDIDATE |
| KAT | Sistem Kategori | Pemilihan kategori dan modal kategori | STABLE_CANDIDATE |
| MASTER | Master Area / Item / Category | Sinkronisasi master frontend, API, dan database | STABLE_CANDIDATE |
| KESLING | Data area KESLING | Pengelompokan area dan prioritas bidang | STABLE_CANDIDATE |
| SPARE_MATERIAL_UNIT | Spare Part / Material / Unit | Input, validasi, klasifikasi, dan rekap | STABLE_CANDIDATE |
| REKAP | Rekap Bulanan | Rekap dan pemilihan periode | STABLE_CANDIDATE |
| MONITORING | Monitoring Staf / Page Online | Aktivitas dan status staf | STABLE_CANDIDATE |
| PWA | PWA / Service Worker / Cache | Instalasi, cache, dan pembaruan asset | STABLE_CANDIDATE |
| PERFORMANCE | Performance / Loading | Waktu muat dan respons antarmuka | STABLE_CANDIDATE |
| SECURITY | Backend Authorization / RLS | Autentikasi API, otorisasi, RLS, keamanan data | STABLE_CANDIDATE |
| AUDIT_LOG | Audit Log / History | Riwayat dan jejak perubahan | STABLE_CANDIDATE |
| CLOUDFLARE | Cloudflare Runtime / Worker / Assets | Penyajian frontend dan deployment Worker | STABLE_CANDIDATE |
| CICD | CI/CD / Audit Gate | Audit otomatis, regression gate, deployment gate | STABLE_CANDIDATE |
| CONTROL_BOOK | Buku Induk dan register kontrol | Tata kelola perubahan, lock, baseline, audit | LOCKED |

Status di atas adalah status register yang ditemukan, bukan hasil pengujian baru pada tanggal dokumen ini. Jangan mengubah status hanya dengan mengedit tabel ini.

## 4. Peta file frontend yang teridentifikasi

### 4.1 File inti dan file bersama

| File | Catatan tanggung jawab awal |
|---|---|
| `frontend/app.js` | File inti bersama; berukuran sekitar 305 KB pada snapshot. Perlu pemetaan fungsi lebih rinci sebelum pemisahan |
| `frontend/index.html` | Entry point dan pemuatan asset |
| `frontend/config.js` | Konfigurasi frontend |
| `frontend/css/style.css` | Style bersama lintas halaman |
| `frontend/sw.js` | Service worker / cache PWA |
| `frontend/manifest.json` | Metadata instalasi PWA |
| `frontend/access-control.js` | Kontrol akses |
| `frontend/access-policy-ui.js` | Tampilan kebijakan akses |
| `frontend/access-visibility-fix.js` | Perilaku visibilitas akses |
| `frontend/login-fast.js` | Pendukung alur login |
| `frontend/laporan-fast-v2.js` | Pendukung pemuatan laporan |
| `frontend/laporan-loading-state.js` | Status pemuatan laporan |
| `frontend/dashboard-loading-v2.js` | Pendukung loading Dashboard |
| `frontend/required-fields-ui.js` | Validasi/tampilan field wajib |
| `frontend/export-laporan-excel.js` | Ekspor laporan |
| `frontend/js/kategori-modal.js` | Modal kategori |
| `frontend/js/master-data-management.js` | Pengelolaan master data |
| `frontend/js/master-item-review.js` | Review master item |
| `frontend/js/static-data.js` | Data fallback/static frontend |

### 4.2 Halaman yang ditemukan pada tree frontend

- `frontend/pages/Page_Login.html`
- `frontend/pages/Page_Dashboard.html`
- `frontend/pages/Page_Input.html`
- `frontend/pages/Page_Laporan.html`
- `frontend/pages/Page_Online.html`

**Perlu rekonsiliasi:** register modul juga mencantumkan REKAP, tetapi file `Page_Rekap.html` tidak terlihat pada daftar tree frontend yang diperiksa pada snapshot ini. Lokasi implementasi aktual REKAP harus ditelusuri sebelum dokumentasi file final dibuat.

## 5. Peta backend Supabase

Edge Functions yang ditemukan:

| Function | Tanggung jawab awal berdasarkan nama dan struktur |
|---|---|
| `ipsrs-api` | API utama aplikasi |
| `ipsrs-auth-bridge` | Jembatan autentikasi |
| `ipsrs-link-account` | Pengaitan akun |
| `ipsrs-bulk-provision-once` | Provisioning akun secara batch satu kali |
| `lhi-reset-verify` | Verifikasi proses reset LHI |

File utama `ipsrs-api/index.ts` berukuran sekitar 75 KB pada snapshot. Pemetaan endpoint, tabel yang disentuh, hak akses, dan dependensi antar-handler harus dibuat melalui audit isi kode, bukan hanya berdasarkan nama function.

Folder migration berisi perubahan skema, kebijakan keamanan, kategori, master item, spare part/material/unit, dan fungsi LHI. Migration bersifat sensitif: jangan menjalankan ulang atau mengubah database produksi tanpa pemeriksaan urutan, kondisi aktual, rencana dan rollback yang disetujui.

## 6. CI/CD dan deployment

Workflow yang ditemukan:

| Workflow | Path | Fungsi |
|---|---|---|
| IPSRS Automated Audit Gate | `.github/workflows/ipsrs-audit-gate.yml` | Audit statis dan browser regression |
| Deploy IPSRS Production | `.github/workflows/deploy-production.yml` | Deployment Cloudflare, GitHub Pages, dan Supabase secara kondisional |

Urutan wajib mengikuti `SOP-UPDATE-DAN-DEPLOY.md`:
1. Perubahan disimpan ke branch `main), kecuali pengguna memberi instruksi eksplisit lain.
2. Push memicu audit gate.
3. Jika audit gagal, deployment tidak boleh dianggap berhasil.
4. Jika audit lolos, workflow deployment meneruskan SHA yang diaudit dan memeriksa bahwa SHA masih sesuai.
5. Verifikasi deployment Cloudflare, GitHub Pages, dan backend yang berubah.
6. Pastikan smoke check pasca-deployment sukses sebelum menyatakan selesai.

Status workflow tidak dinyatakan PASS oleh dokumen ini; status harus diperiksa pada halaman Actions untuk run terkait.

## 7. Peta dependensi awal

Peta ini menunjukkan hubungan arsitektur tingkat tinggi. Ini bukan dependency graph fungsi yang lengkap.

| Komponen pemanggil | Bergantung pada | Catatan risiko |
|---|---|---|
| Halaman frontend | `app.js`, CSS, script pendukung, config | Perubahan asset dapat berdampak lintas halaman |
| `app.js` | Modul UI, API helper, akses, master data, laporan, dan fungsi bersama | File besar/shared; refactor harus bertahap |
| Frontend | Supabase Edge Functions | Kontrak API dan otorisasi harus dipertahankan |
| Edge Functions | Supabase PostgreSQL | Perubahan skema harus kompatibel dengan kode aktif |
| PWA/service worker | Nama dan versi asset | Cache lama dapat menampilkan asset tidak sinkron |
| GitHub Actions | Script audit, Playwright, secret deployment | Kegagalan gate harus memblokir deployment |
| Cloudflare Worker | Asset hasil repository `frontend/` | SHA source dan deployment harus diverifikasi |

## 8. Status modularisasi

**Kesimpulan snapshot:** aplikasi sudah mempunyai beberapa script pendukung terpisah dan folder berdasarkan jenis file, tetapi belum dapat disebut modular penuh pada tingkat kode.

Bukti utama:
- `frontend/app.js` masih menjadi file inti besar (sekitar 305 KB).
- Beberapa halaman dan script pendukung memang terpisah.
- Satu file bersama dapat melayani beberapa modul.
- Backend utama `ipsrs-api/index.ts` juga masih merupakan file besar (sekitar 75 KB).
- Belum ada bukti dependency map lengkap per fungsi pada snapshot audit.

Karena itu, tabel modul di atas adalah **peta fungsi**, bukan bukti bahwa setiap modul sudah memiliki folder, entry point, API, dan test terisolasi.

## 9. Target struktur modular — usulan, belum diterapkan

Struktur berikut adalah arah refactor. Jangan membuat folder atau memindahkan file hanya berdasarkan diagram ini tanpa audit dependensi, kontrak global, urutan script, event handler, dan regression test.

```text
frontend/
  app.js                    # sementara: entry/orchestrator existing
  pages/
  modules/
    auth/
    access/
    dashboard/
    input/
    category/
    master-data/
    reports/
    recap/
    monitoring/
    audit-log/
  shared/
    api/
    components/
    utils/
    constants/
    styles/
  pwa/
    service-worker/
    manifest/
supabase/
  functions/
    ipsrs-api/
    ipsrs-auth-bridge/
    ipsrs-link-account/
    ipsrs-bulk-provision-once/
    lhi-reset-verify/
  migrations/
tests/
  e2e/
  unit/                     # target bila tooling disiapkan
docs/
  architecture/
  module-catalog/
  decisions/
```

Prinsip target:
1. Satu modul memiliki batas tanggung jawab yang jelas.
2. Dependensi lintas modul harus eksplisit.
3. Fungsi bersama ditempatkan di shared, bukan digandakan.
4. Modul tidak boleh mengakses database secara langsung dari browser jika harus melalui API/otorisasi server.
5. Perubahan satu modul harus memiliki pengujian yang relevan.
6. Pemindahan file tidak boleh mengubah perilaku aplikasi.
7. Dashboard tetap LOCKED sampai prosedur unlock yang sah dilakukan.

## 10. Standar katalog modul yang akan dilengkapi

Setiap modul nantinya wajib mempunyai catatan berikut:

- ID dan nama modul.
- Tujuan dan ruang lingkup.
- Halaman/UI yang terkait.
- File frontend yang terkait.
- Fungsi/handler penting beserta lokasi deklarasinya.
- Endpoint API yang dipanggil.
- Edge Function dan tabel database yang terlibat.
- Modul lain yang menjadi dependensi.
- Hak akses dan aturan keamanan.
- Event, state global, cache, dan side effect.
- Test unit/integrasi/e2e.
- Status lock dan baseline.
- Risiko perubahan dan prosedur rollback.

## 11. Urutan kerja pengembangan setelah master map

| Tahap | Pekerjaan | Gerbang selesai |
|---|---|---|
| 1 | Inventarisasi file dan fungsi existing | Daftar file dan fungsi diverifikasi dari source |
| 2 | Pemetaan API dan database | Endpoint, tabel, RLS, migration, dan relasi terdokumentasi |
| 3 | Dependency mapping | Pemanggil, pemanggilan, global state, dan side effect diketahui |
| 4 | Audit coverage pengujian | Gap test ditandai; test penting tersedia |
| 5 | Desain modular final | Batas modul dan kontrak antarmodul disetujui |
| 6 | Refactor satu modul per tahap | Regression lulus dan perilaku tidak berubah |
| 7 | Deploy dan verifikasi | SHA, smoke test, parity, dan runtime terbukti |
| 8 | Perbarui kontrol | Baseline, lock, change log, dan katalog sinkron |

Tidak boleh melompat langsung ke tahap pemindahan `app.js` sebelum tahap 1–5 memadai.

## 12. Backup dan pemulihan

- Checkpoint source code yang dibuat 6 November 2026: branch `checkpoint/2026-11-06-pre-modularization`.
- SHA checkpoint saat dibuat: `7460da098bcfc6eed5e29b3e0e277c8bd7508bc6`.
- Checkpoint branch melindungi source code pada commit tersebut.
- Checkpoint ini **bukan** backup database Supabase.
- Checkpoint ini **bukan** backup konfigurasi Cloudflare, secrets, atau seluruh runtime.
- Backup database dan konfigurasi platform perlu prosedur tersendiri dan verifikasi terpisah.
- Rollback source code, database, dan platform adalah tiga prosedur yang berbeda.

## 13. Isu dokumentasi yang harus ditindaklanjuti

1. Rekonsiliasi tanggal revisi dan SHA HEAD di `PROJECT_CONTROL.md` dengan SHA repository terkini. Pada snapshot audit, nilai HEAD di dokumen kontrol tidak sama dengan SHA branch main.
2. Periksa dan dokumentasikan lokasi implementasi REKAP karena file halaman yang disebut di register tidak tampak di tree frontend yang diperiksa.
3. Lengkapi katalog fungsi di `app.js` berdasarkan deklarasi dan pemanggilan aktual.
4. Lengkapi endpoint map `ipsrs-api` beserta tabel, policy, dan role yang terkait.
5. Lengkapi dependency graph dan side-effect map.
6. Tandai pengujian PLANNED versus IMPLEMENTED sesuai bukti aktual; jangan mengubah status tanpa test result.
7. Verifikasi bahwa dokumentasi deployment mencerminkan workflow dan konfigurasi runtime terbaru.

## 14. Dokumen resmi terkait

- [PROJECT_CONTROL.md](../PROJECT_CONTROL.md) — Buku Induk Kontrol Proyek.
- [LOCK_REGISTER.yaml](../LOCK_REGISTER.yaml) — status dan proteksi modul.
- [BASELINE_REGISTER.yaml](../BASELINE_REGISTER.yaml) — baseline/checkpoint.
- [REGRESSION_MATRIX.yaml](../REGRESSION_MATRIX.yaml) — daftar test dan gate.
- [SOP-UPDATE-DAN-DEPLOY.md](../SOP-UPDATE-DAN-DEPLOY.md) — SOP update dan deployment.
- [AI_AUDIT_PROTOCOL.md](../AI_AUDIT_PROTOCOL.md) — protokol audit.
- [README-FORM-BLOK-APLIKASI.md](../README-FORM-BLOK-APLIKASI.md) — spesifikasi fitur Form Blok Aplikasi LHI, bukan README arsitektur umum.

---

## Riwayat dokumen

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-11-06 | Pembuatan master map awal berdasarkan audit repository; dokumentasi saja |

**Pernyataan batas:** Dokumen ini tidak menyatakan semua modul sudah lulus audit, semua test sudah tersedia, seluruh deployment sukses, atau modularisasi telah diterapkan. Semua status teknis harus dibuktikan melalui source, test, workflow, dan runtime aktual.
