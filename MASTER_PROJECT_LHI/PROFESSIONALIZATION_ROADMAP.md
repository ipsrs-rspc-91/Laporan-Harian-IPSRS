# ROADMAP PROFESIONALISASI APLIKASI LHI

**Repository:** `ipsrs-rspc-91/Laporan-Harian-IPSRS`  
**Branch kerja:** `docs/lhi-professionalization-roadmap`  
**Status:** Draft rencana kerja — bukan bukti bahwa implementasi atau produksi telah selesai.  
**Prinsip:** mempertahankan sistem berjalan, perubahan bertahap, dapat diuji, dapat diaudit, dan dapat dipulihkan.

## 1. Keputusan arsitektur dokumen

LHI sudah memiliki dokumen pengendalian proyek. Profesionalisasi tidak dimulai dengan mengganti atau membuat ulang dokumen induk.

Hierarki dokumentasi yang digunakan:

1. **Product Vision & Business Case** — alasan, manfaat, pemilik, dan kelayakan produk.
2. **Project Charter** — mandat, tujuan, ruang lingkup, kewenangan, dan batas proyek.
3. **Project Management Plan / Master Project** — rencana induk pengelolaan proyek, tata kelola, risiko, jadwal, mutu, komunikasi, perubahan, dan rilis.
4. **Project Control Book** — aturan operasional perubahan, lock, baseline, regression, deployment, dan rollback yang berlaku di repository. Dokumen existing: `PROJECT_CONTROL.md`.
5. **Requirements Engineering** — BRD, SRS, user stories, acceptance criteria, kebutuhan fungsional dan nonfungsional.
6. **Software Architecture & Detailed Design** — SAD (arsitektur tingkat sistem), ADD (desain rinci aplikasi/modul), database design, API contract, UI/UX design, security design, dan deployment architecture.
7. **Implementation & Quality** — coding standards, dependency rules, unit/integration/E2E tests, security tests, performance tests, UAT.
8. **Release & Operations** — CI/CD, release approval, backup, rollback, monitoring, incident response, dan maintenance.
9. **As-Built Documentation** — dokumentasi yang direkonsiliasi dengan source, konfigurasi, database, dan versi produksi yang benar-benar aktif.

Istilah **Master Project** dipakai sebagai nama paket/dokumen induk proyek. Istilah **Project Management Plan** adalah istilah manajemen proyek yang lebih baku. SAD dan ADD adalah dokumen teknis di bawah tata kelola proyek, bukan pengganti Master Project atau Project Control Book.

## 2. Dokumen existing yang harus dipertahankan

Berdasarkan pemeriksaan file pada branch `main` saat roadmap ini disusun:

- `MASTER_PROJECT_LHI/00_MASTER_PROJECT.md` sudah menjadi dokumen navigasi dan peta arsitektur tingkat proyek.
- `PROJECT_CONTROL.md` menyatakan dirinya sebagai dokumen pengendali utama dan mengatur perubahan, baseline, lock, regresi, deployment, migrasi, dan rollback.
- `LOCK_REGISTER.yaml` menetapkan modul yang terkunci dan perilaku yang dilindungi.
- `BASELINE_REGISTER.yaml` menyimpan checkpoint dan baseline referensi.
- `REGRESSION_MATRIX.yaml` mendefinisikan tes dan deployment gate.
- `SOP-UPDATE-DAN-DEPLOY.md` mengatur alur update hingga verifikasi produksi.
- `AI_AUDIT_PROTOCOL.md` mengatur audit dan urutan perubahan.

Dokumen kontrol tersebut tidak boleh ditimpa atau disederhanakan oleh roadmap ini. Status lock, baseline, PASS/FAIL dan deployment hanya boleh berubah berdasarkan bukti sesuai aturan yang berlaku.

## 3. Baseline teknis yang diketahui

Hasil inspeksi dokumentasi dan struktur kode menunjukkan:

- Frontend menggunakan `frontend/index.html`, dengan `frontend/app.js` sebagai file inti bersama yang masih besar/terpusat.
- Beberapa halaman dan script pendukung sudah dipisahkan, tetapi pemisahan file belum membuktikan modularitas dan isolasi dependensi.
- Backend utama masih memiliki fungsi terkonsentrasi pada Supabase Edge Function `ipsrs-api`; beberapa fungsi khusus sudah dipisahkan.
- GitHub merupakan source code dan version history; GitHub Actions menjalankan audit dan deployment; Cloudflare menyajikan frontend; Supabase Edge Functions dan PostgreSQL menjadi backend dan database aktif menurut dokumentasi repository.
- Migrasi ke Cloudflare D1 tidak boleh dianggap selesai tanpa bukti migrasi data, parity, keamanan, backup, dan production verification.
- `REGRESSION_MATRIX.yaml` yang diperiksa memuat sejumlah skenario berstatus PLANNED. Status ini harus diverifikasi terhadap workflow dan test aktual, bukan otomatis dianggap telah diuji.
- Modul `DASH` dan `CONTROL_BOOK` berstatus LOCKED pada `LOCK_REGISTER.yaml`. Perilaku dan dokumen terlindungi tidak boleh diubah tanpa prosedur dan persetujuan eksplisit yang diwajibkan.

Baseline ini adalah ringkasan inspeksi repository, bukan audit total atau pernyataan kondisi runtime produksi terkini.

## 4. Target standar profesional

### 4.1 Arsitektur dan modularitas
- Setiap modul memiliki tanggung jawab, entry point, public interface, pemilik data, dan kontrak yang terdokumentasi.
- Dependensi antarmodul eksplisit; tidak ada akses silang ke internal modul tanpa kontrak.
- Fungsi bersama ditempatkan pada shared layer yang memiliki pemilik dan pengujian.
- Hindari global mutable state, implicit coupling, duplikasi business rules, dan circular dependency.
- Refactor dilakukan bertahap dengan facade/adapter kompatibilitas bila diperlukan.
- Pemindahan file saja tidak dihitung sebagai modularisasi selesai.

### 4.2 Kualitas kode
- Tetapkan format, lint, type-check, naming, error handling, logging, input validation, dan code review rules.
- Pecah file besar berdasarkan batas domain dan dependency graph, bukan berdasarkan ukuran semata.
- Hindari perubahan perilaku yang tidak termasuk scope.

### 4.3 Database dan API
- Dokumentasikan schema, relasi, constraint, index, RLS, ownership, migration order, dan strategi rollback.
- API memiliki kontrak request/response, autentikasi, otorisasi, error codes, idempotency, pagination, dan versioning yang jelas.
- Perubahan schema harus backward-compatible selama masa transisi dan diuji pada environment terisolasi.

### 4.4 Keamanan
- Terapkan least privilege, server-side authorization, RLS, secret management, audit trail, rate limiting yang proporsional, dan secure session handling.
- Tidak ada service-role key atau secret di frontend, repository, atau log.
- Jalankan dependency/security scanning dan negative authorization tests.

### 4.5 Pengujian dan mutu
- Unit test untuk business rules.
- Integration test untuk API dan database.
- E2E test untuk alur pengguna kritis.
- Regression test untuk modul terdampak dan seluruh modul LOCKED yang berbagi file.
- Security, performance, accessibility, dan mobile smoke tests sesuai risiko.
- Setiap tes memiliki owner, data fixture, expected result, dan bukti run.
- Status test hanya boleh menjadi IMPLEMENTED/PASS bila ada test yang benar-benar dijalankan dan hasilnya tersimpan.

### 4.6 Release, operasi, dan pemulihan
- Setiap perubahan memiliki checkpoint source dan rencana rollback.
- Audit gate harus selesai sebelum deployment.
- SHA yang diuji harus sama dengan SHA yang dirilis.
- Verifikasi deployment Cloudflare dan Supabase dilakukan sesuai komponen yang berubah.
- Jalankan post-deployment smoke test, pantau error, dan catat versi runtime.
- Backup database dan uji restore dilakukan dengan prosedur aman; tidak mengubah data produksi untuk keperluan tes.

### 4.7 Dokumentasi As-Built
- Catat source commit, workflow run, deployment version, environment, migration yang aktif, Edge Functions aktif, schema aktual, dan hasil smoke test.
- Tandai perbedaan antara desain, source branch, dan production runtime.
- Jangan menyatakan kondisi produksi berdasarkan README atau commit saja.

## 5. Rencana pelaksanaan bertahap

| Tahap | Pekerjaan | Kriteria keluar |
|---|---|---|
| 0. Baseline & safety | Rekonsiliasi main, PR terbuka, checkpoint, lock, dan kondisi production | Baseline source dan production dapat dibedakan dengan jelas |
| 1. Requirements & governance | Lengkapi vision, charter, ruang lingkup, stakeholder, acceptance criteria, risiko | Kebutuhan dan otoritas keputusan disetujui |
| 2. Technical discovery | Inventaris fungsi, global state, DOM/event hooks, API calls, DB tables, RLS, dependency graph | Peta dependensi memiliki bukti source dan pemilik |
| 3. Architecture pack | SAD, ADD per modul, database/API/security/deployment design | Setiap modul punya kontrak dan batas tanggung jawab |
| 4. Quality foundation | Lint/type-check, test strategy, coverage map, security and performance gates | Gate berjalan dan hasilnya dapat direproduksi |
| 5. Pilot modularization | Pilih satu modul non-LOCKED berisiko rendah; buat facade kompatibilitas | Tes modul dan regression lintas modul lulus |
| 6. Incremental migration | Migrasi modul satu per satu, review dan checkpoint tiap tahap | Tidak ada regresi dan dependency boundary terjaga |
| 7. Production validation | Rilis terkontrol, parity check, smoke, monitoring, rollback readiness | SHA, deployment, dan runtime tervalidasi |
| 8. As-Built & operations | Dokumentasi aktual, SOP incident, maintenance, recovery drill | Dokumentasi sesuai sistem yang aktif |

Tahap 0–8 pada tabel ini adalah rincian pelaksanaan dari fase pengendalian P0–P6 pada `00_MASTER_PROJECT.md` Bagian 14.1. Jika ada perbedaan tingkat rincian, Master Project mengatur fase proyek dan roadmap menguraikan aktivitasnya; keduanya tidak mengubah kewenangan Project Control Book.

Tidak ada tahap yang otomatis dianggap selesai hanya karena dokumen dibuat.

## 6. Aturan pemilihan pilot modularisasi

Pilot pertama harus:
- bukan modul LOCKED;
- memiliki ruang lingkup kecil dan fungsi yang dapat diisolasi;
- tidak mengubah schema/database produksi;
- tidak mengubah autentikasi, hak akses, atau perilaku bisnis kritis;
- mempunyai regression test yang memadai sebelum refactor;
- dapat dikembalikan tanpa memengaruhi modul lain.

Dashboard dan Control Book tetap dilindungi. Perubahan shared file seperti `frontend/app.js`, `frontend/index.html`, CSS utama, API utama, migration, dan service worker harus diperlakukan sebagai high-impact sesuai Project Control Book.

## 7. Definition of Done — Profesionalisasi LHI

Profesionalisasi tidak boleh dinyatakan selesai sampai seluruh syarat berikut terpenuhi:

- [ ] Product vision, business case, charter, ruang lingkup, dan acceptance criteria terdokumentasi.
- [ ] Master Project dan Project Control Book saling konsisten tanpa menggandakan otoritas.
- [ ] SAD dan ADD mencerminkan sistem aktual dan target yang disetujui.
- [ ] Semua modul memiliki katalog, owner, interface, dependency map, dan lock status.
- [ ] Database, API, security, UI/UX, deployment, dan recovery terdokumentasi.
- [ ] Tidak ada circular dependency atau akses internal lintas modul yang tidak disetujui.
- [ ] Test suite untuk jalur kritis dan modul terdampak lulus.
- [ ] Security, performance, mobile, dan accessibility checks memiliki bukti.
- [ ] CI/CD memblokir rilis saat gate gagal.
- [ ] SHA source, hasil test, deployment version, dan runtime production dapat direkonsiliasi.
- [ ] Backup/restore dan rollback telah diuji dengan prosedur aman.
- [ ] As-Built dan SOP operasi sesuai dengan kondisi produksi.

## 8. Batas pekerjaan dan keselamatan

Roadmap ini hanya menetapkan rencana dan standar. File ini sendiri tidak mengubah aplikasi, database, Edge Functions, workflow, Cloudflare, atau Supabase.

Tidak boleh:
- menggabungkan roadmap ini ke `main` tanpa review;
- melakukan deploy hanya karena dokumen dibuat;
- mengubah modul LOCKED atau dokumen kontrol terlindungi tanpa otorisasi;
- menerapkan migration atau mengubah data produksi sebagai bagian audit;
- menyatakan PASS tanpa bukti.

Setiap implementasi berikutnya harus mengikuti `PROJECT_CONTROL.md`, `LOCK_REGISTER.yaml`, `BASELINE_REGISTER.yaml`, `REGRESSION_MATRIX.yaml`, `SOP-UPDATE-DAN-DEPLOY.md`, dan `AI_AUDIT_PROTOCOL.md`.

---

**Status akhir dokumen:** ROADMAP DITULIS; implementasi profesionalisasi belum dinyatakan selesai.
**Catatan sinkronisasi:** tahap 0–8 adalah rincian fase P0–P6 pada Master Project Bagian 14.1.  
**Langkah teknis berikutnya:** audit dependency graph aktual dan rekonsiliasi baseline source-versus-production sebelum memilih modul pilot.
