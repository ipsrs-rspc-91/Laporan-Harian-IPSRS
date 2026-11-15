# MASTER PROJECT LHI
## Laporan Harian Instalasi Pemeliharaan Sarana Rumah Sakit (IPSRS)

> **Dokumen induk proyek.** Dokumen ini menetapkan mandat, visi, tujuan, ruang lingkup, kebutuhan tingkat proyek, arsitektur, standar mutu, tahapan pelaksanaan, serta kriteria keberhasilan Aplikasi LHI. Dokumen ini menjadi acuan bersama pemilik produk, pengelola proyek, pengembang, penguji, dan operator.
>
> **Batas kewenangan:** Master Project menetapkan arah dan kerangka proyek. `PROJECT_CONTROL.md` tetap menjadi Buku Induk Kontrol Proyek yang mengatur prosedur perubahan, lock, baseline, regresi, deployment, migrasi, dan rollback. Master Project tidak membatalkan atau menggantikan aturan tersebut.

| Atribut | Nilai |
|---|---|
| Nama proyek | Aplikasi Laporan Harian IPSRS (LHI) |
| Organisasi/pemilik proses | Instalasi Pemeliharaan Sarana Rumah Sakit (IPSRS), Rumah Sakit Puri Cinere |
| Repository | `ipsrs-rspc-91/Laporan-Harian-IPSRS` |
| Dokumen | Master Project LHI |
| Versi dokumen | 2.0 |
| Tanggal penyusunan | 15 November 2026 |
| Status | Draft induk untuk review dan pengesahan pemilik proyek |
| Status implementasi aplikasi | Existing system; pengembangan dan pematangan dilakukan bertahap |
| Ruang lingkup perubahan pada dokumen ini | Dokumentasi proyek; tidak mengubah kode, database, workflow, hosting, atau konfigurasi produksi |

---

# BAGIAN I — MANDAT DAN ARAH PROYEK

## 1. Ringkasan eksekutif

Aplikasi LHI merupakan sistem informasi operasional untuk mendukung pencatatan, pemantauan, penelusuran, dan rekapitulasi aktivitas harian petugas IPSRS. Sistem diarahkan agar pelaporan pekerjaan lebih tertib, data terpusat, aktivitas dapat ditelusuri, dan pimpinan memperoleh informasi operasional yang konsisten untuk pengawasan serta pengambilan keputusan.

Aplikasi telah memiliki implementasi berjalan dengan frontend web, backend API, database, autentikasi, pelaporan, master data, dashboard, monitoring, dan otomasi audit/deployment. Namun, keberadaan fitur tidak otomatis berarti seluruh modul telah memenuhi standar produksi. Tingkat kematangan setiap modul harus dinilai berdasarkan source code, pengujian, kontrol akses, bukti deployment, dan verifikasi runtime.

Master Project ini menyatukan arah produk dan rencana pengelolaan teknis pada tingkat proyek. Dokumen ini juga membedakan secara tegas kondisi **existing**, target **to-be**, dan pekerjaan yang **belum diverifikasi** agar tidak terjadi klaim implementasi yang belum terbukti.

## 2. Visi, misi, dan prinsip produk

### 2.1 Visi

Mewujudkan sistem pelaporan dan monitoring IPSRS yang terintegrasi, mudah digunakan, akurat, aman, dapat diaudit, dan dapat dikembangkan secara berkelanjutan.

### 2.2 Misi

1. Menstandarkan pencatatan aktivitas harian petugas IPSRS.
2. Menyediakan data laporan yang terpusat dan mudah ditelusuri.
3. Menyediakan rekapitulasi dan monitoring untuk Kepala IPSRS.
4. Menjaga konsistensi master area, item, kategori, spare part, material, dan unit.
5. Menerapkan kontrol akses berdasarkan identitas dan kewenangan pengguna.
6. Menyediakan jejak audit untuk aktivitas dan perubahan data penting.
7. Meningkatkan kualitas perangkat lunak melalui modularisasi, pengujian, dokumentasi, dan deployment terkendali.

### 2.3 Prinsip desain dan pengelolaan

- **Single source of truth:** data operasional tersimpan pada backend/database yang ditetapkan, bukan tersebar sebagai salinan yang saling bersaing.
- **Traceability:** perubahan kebutuhan, kode, database, pengujian, dan deployment dapat ditelusuri.
- **Security by design:** autentikasi, otorisasi, validasi server-side, dan kebijakan database wajib menjadi bagian desain.
- **Modular by responsibility:** modul dipisahkan berdasarkan tanggung jawab dan kontrak yang jelas, bukan sekadar pemecahan file.
- **Backward compatibility:** perubahan tidak boleh merusak data historis dan alur yang masih digunakan tanpa rencana migrasi.
- **Evidence-based status:** status selesai/PASS/LOCKED harus didukung bukti.
- **Controlled delivery:** perubahan produksi harus mengikuti Project Control Book dan SOP deployment.
- **No silent behavior change:** perubahan aturan bisnis harus dinyatakan, diuji, dan disetujui.

## 3. Tujuan dan hasil yang diharapkan

| ID | Tujuan | Hasil yang diharapkan | Indikator penerimaan |
|---|---|---|---|
| OBJ-01 | Tertib pelaporan harian | Petugas dapat membuat dan melihat laporan sesuai hak akses | Skenario input, validasi, simpan, dan baca lulus |
| OBJ-02 | Monitoring pelaksanaan | Pimpinan dapat memantau status pengisian dan aktivitas | Angka dan status cocok dengan data sumber |
| OBJ-03 | Rekapitulasi | Laporan dapat direkap berdasarkan periode dan filter yang ditetapkan | Hasil rekap konsisten dengan data transaksi |
| OBJ-04 | Konsistensi master data | Area, item, kategori, dan klasifikasi terjaga | Tidak ada duplikasi yang lolos aturan validasi |
| OBJ-05 | Keamanan | Data dan fungsi hanya dapat diakses sesuai kewenangan | Uji autentikasi, otorisasi, dan RLS/API lulus |
| OBJ-06 | Keterlacakan | Aktivitas penting memiliki jejak audit | Peristiwa penting dapat ditelusuri |
| OBJ-07 | Keandalan | Perubahan tidak merusak modul lain | Regression gate dan smoke test lulus |
| OBJ-08 | Maintainability | Struktur kode dan dokumentasi mudah dipelihara | Modul, kontrak, dependensi, dan pemiliknya terdokumentasi |

Target numerik seperti waktu respons, availability, RPO, RTO, dan retensi log belum ditetapkan dalam dokumen sumber yang diaudit. Nilai tersebut harus disepakati dan dibuktikan sebelum dijadikan SLA/SLO resmi; jangan mengarang angka.

## 4. Ruang lingkup proyek

### 4.1 Termasuk dalam ruang lingkup

- Login, sesi, identitas, role, dan kontrol akses.
- Input dan pengelolaan Laporan Harian IPSRS.
- Validasi data laporan dan pengelolaan siklus laporan.
- Master area kerja, item, kategori, dan data pendukung.
- Data Spare Part, Material, dan Unit sesuai aturan bisnis.
- Dashboard dan ringkasan operasional.
- Rekapitulasi laporan berdasarkan periode.
- Monitoring aktivitas/pengisian petugas.
- Audit log dan histori perubahan yang ditetapkan.
- Pengelolaan Form Blok Aplikasi LHI sesuai spesifikasi resminya.
- Backend/API, database, integrasi, backup, pengujian, deployment, dan dokumentasi.
- Peningkatan modularitas, keamanan, kinerja, dan maintainability.

### 4.2 Di luar ruang lingkup kecuali disetujui sebagai perubahan proyek

- Penggantian total platform/database produksi.
- Migrasi penuh dari Supabase ke Cloudflare D1.
- Perubahan proses bisnis IPSRS yang belum disetujui pemilik proses.
- Integrasi dengan SIMRS atau sistem rumah sakit lain yang belum memiliki spesifikasi dan persetujuan.
- Pengadaan perangkat keras/jaringan di luar kebutuhan operasional aplikasi.
- Perubahan perilaku modul berstatus LOCKED tanpa prosedur unlock resmi.

## 5. Pemangku kepentingan dan peran

| Pemangku kepentingan | Tanggung jawab utama |
|---|---|
| Kepala IPSRS / Product Owner | Menetapkan kebutuhan, prioritas, aturan bisnis, dan penerimaan hasil |
| Admin/pengelola aplikasi | Pengelolaan akun/master sesuai kewenangan dan SOP |
| Petugas IPSRS | Mengisi dan memeriksa laporan sesuai tugas |
| Pengembang/engineer | Analisis, desain, implementasi, code review, dan dokumentasi |
| QA/tester | Menyusun dan menjalankan pengujian serta melaporkan bukti |
| Pengelola infrastruktur/platform | Menjaga konfigurasi, secret, hosting, database, backup, dan pemantauan |
| Pihak manajemen terkait | Memberi persetujuan kebijakan, sumber daya, dan perubahan berdampak lintas unit |

Satu orang dapat menjalankan lebih dari satu peran pada kondisi operasional tertentu, tetapi persetujuan perubahan dan bukti pelaksanaan tetap harus dicatat.

---

# BAGIAN II — KEBUTUHAN DAN DESAIN SISTEM

## 6. Kapabilitas dan kebutuhan fungsional tingkat proyek

Daftar berikut merupakan baseline kapabilitas tingkat proyek, bukan pernyataan bahwa semua skenario telah selesai atau lulus pengujian.

| ID | Kapabilitas | Kebutuhan utama | Modul terkait |
|---|---|---|---|
| FR-01 | Autentikasi | Pengguna masuk melalui mekanisme autentikasi yang tervalidasi | AUTH |
| FR-02 | Otorisasi | Akses fungsi dan data dibatasi berdasarkan role/permission | AUTH, SECURITY |
| FR-03 | Input LHI | Petugas membuat laporan dengan field dan validasi yang ditetapkan | REPORT |
| FR-04 | Siklus laporan | Laporan dapat dilihat, difilter, dan diubah sesuai izin | REPORT |
| FR-05 | Master data | Area, item, kategori, dan data referensi dikelola konsisten | MASTER, KAT |
| FR-06 | Validasi duplikasi | Sistem mendeteksi data item yang sama atau sangat mirip sesuai aturan yang disepakati | MASTER |
| FR-07 | Klasifikasi pekerjaan/material | Data spare part, material, dan unit mengikuti klasifikasi bisnis | SPARE_MATERIAL_UNIT |
| FR-08 | Dashboard | Menampilkan ringkasan operasional dari sumber data yang benar | DASH |
| FR-09 | Rekap bulanan | Menyajikan data berdasarkan periode yang dipilih | REKAP |
| FR-10 | Monitoring | Menampilkan status/aktivitas petugas berdasarkan definisi resmi | MONITORING |
| FR-11 | Form Blok Aplikasi | Menegakkan aturan peringatan, pembatasan, blokir, dan pemulihan sesuai spesifikasi | AUTH, MONITORING |
| FR-12 | Audit trail | Merekam tindakan penting sesuai kebijakan audit | AUDIT_LOG |
| FR-13 | Ekspor | Menyediakan ekspor laporan sesuai format dan hak akses | REPORT |
| FR-14 | PWA/cache | Mengelola asset dan pembaruan cache tanpa menampilkan versi usang | PWA |

**Aturan definisi:** rincian field, formula, ambang hari, status, transisi, dan pengecualian tiap fitur wajib merujuk dokumen spesifikasi modul yang berwenang. Master Project tidak boleh menjadi sumber aturan alternatif yang bertentangan dengan README/spesifikasi fitur, kontrak API, atau Project Control Book.

## 7. Kebutuhan nonfungsional dan standar mutu

| Area | Standar yang wajib dipenuhi | Bukti yang diminta |
|---|---|---|
| Security | Secret tidak boleh berada di frontend; server memvalidasi identitas dan hak akses; RLS/API diuji | Audit secret, test permission, test RLS |
| Data integrity | Validasi server-side, constraint yang tepat, transaksi aman, dan migrasi terkontrol | Test integritas, review SQL/migration |
| Reliability | Error ditangani; operasi kritis tidak menghasilkan status sukses palsu | Integration test, log, failure-path test |
| Performance | Query, payload, asset, dan rendering diukur; optimasi berbasis hasil pengukuran | Baseline dan hasil uji kinerja |
| Usability | Alur konsisten, pesan kesalahan jelas, layout responsif, aksesibilitas dasar | Uji browser dan perangkat |
| Maintainability | Pemisahan modul, kontrak eksplisit, minim global state, dokumentasi kode | Dependency map, code review |
| Compatibility | Browser/perangkat yang didukung ditetapkan dan diuji | Compatibility test matrix |
| Observability | Error dan kejadian penting dapat ditelusuri tanpa membocorkan data sensitif | Log terstruktur dan pemeriksaan monitoring |
| Backup/recovery | Backup source, database, dan konfigurasi dibedakan serta prosedur restore diuji | Bukti backup dan restore drill |
| Auditability | Perubahan dan deployment dapat dilacak ke commit, test run, dan aktor | Commit, workflow run, audit trail |

Target kuantitatif untuk setiap standar nonfungsional harus ditetapkan pada dokumen SRS/SLO atau rencana QA setelah baseline pengukuran tersedia.

## 8. Arsitektur sistem

### 8.1 Arsitektur existing yang teridentifikasi

```text
Pengembang
   |
   v
GitHub repository (main sebagai source of truth)
   |
   v
GitHub Actions
   |-- audit statis
   |-- regression/browser test
   |-- deployment gate
   |
   +--> Cloudflare Worker + frontend static assets
   |
   +--> Supabase Edge Functions (backend/API)
              |
              v
        Supabase PostgreSQL

Browser pengguna
   |--> Frontend melalui Cloudflare Worker
   |--> API/backend melalui Supabase Edge Functions
```

### 8.2 Peran platform

| Platform | Peran yang berlaku pada baseline dokumentasi | Batasan |
|---|---|---|
| GitHub | Repository source utama, version history, branch, checkpoint, pull request | Bukan database runtime |
| GitHub Actions | Audit otomatis, regression gate, dan workflow deployment | Keberhasilan commit tidak otomatis membuktikan produksi sehat |
| Cloudflare Worker | Penyajian frontend/static assets | Bukan database utama saat ini |
| Supabase Edge Functions | Backend/API server-side | Tidak menggantikan repository source |
| Supabase PostgreSQL | Database aplikasi aktif yang terdokumentasi | Migrasi harus mengikuti prosedur dan backup |
| GitHub Pages | Redirect pendukung sesuai workflow | Bukan hosting frontend utama |

**Pernyataan status:** Cloudflare D1 pernah dicatat sebagai arah/target, tetapi migrasi penuh ke D1 tidak boleh dinyatakan selesai tanpa bukti parity, keamanan, backup, dan production verification. Supabase/PostgreSQL tetap menjadi database aktif yang didokumentasikan pada baseline ini.

### 8.3 Prinsip arsitektur target

1. Frontend hanya menangani presentasi, interaksi, dan validasi awal; keputusan otorisasi tetap dilakukan server-side.
2. Backend/API menjadi boundary resmi untuk operasi data yang memerlukan otorisasi dan aturan bisnis.
3. Database menjadi sumber data transaksi dan referensi yang konsisten.
4. Modul memiliki tanggung jawab, kontrak input/output, dependensi, dan pengujian yang eksplisit.
5. Shared services/utilities dipisahkan dari aturan bisnis modul.
6. Integrasi tidak boleh bergantung pada asumsi global state yang tidak terdokumentasi.
7. Perubahan skema database harus kompatibel, dapat diuji, dan memiliki rencana pemulihan.
8. Deployment harus mengirim artefak dari SHA yang sama dengan SHA yang lulus audit.

### 8.4 Struktur modular target

Struktur ini adalah target desain, bukan gambaran struktur yang seluruhnya sudah diterapkan.

```text
frontend/
  app-entry/
  pages/
  modules/
    auth/
    access/
    dashboard/
    reports/
    input/
    category/
    master-data/
    spare-material-unit/
    recap/
    monitoring/
    audit-log/
    pwa/
  shared/
    api/
    components/
    utils/
    constants/
    styles/
supabase/
  functions/
  migrations/
tests/
  unit/
  integration/
  e2e/
docs/
  requirements/
  architecture/
  design/
  module-catalog/
  decisions/
  operations/
```

Pemisahan dilakukan bertahap setelah pemetaan fungsi, event, global state, endpoint, tabel, dan regression test. Tidak boleh melakukan pemindahan massal hanya berdasarkan struktur target.

## 9. Data, privasi, dan keamanan

### 9.1 Prinsip pengelolaan data

- Data transaksi LHI dikelola melalui backend dan database resmi.
- Master data harus memiliki aturan identitas, normalisasi, dan pencegahan duplikasi.
- Data historis tidak boleh dihapus atau ditimpa tanpa dasar kebijakan dan jejak audit.
- Perubahan data penting harus dapat ditelusuri.
- Data pribadi/akun hanya digunakan sesuai tujuan operasional dan kewenangan.
- Data uji harus menggunakan data sintetis atau data yang telah dianonimkan bila memungkinkan.

### 9.2 Kontrol keamanan minimum

- Autentikasi diverifikasi pada server.
- Otorisasi diperiksa pada setiap operasi API sensitif.
- RLS dan privilege database diuji, bukan hanya diasumsikan aktif.
- Service-role key dan secret deployment hanya disimpan pada secret manager/platform yang sesuai.
- Validasi input dilakukan di frontend untuk pengalaman pengguna dan di backend untuk keamanan/integritas.
- Proteksi terhadap injection, XSS, CSRF (sesuai mekanisme autentikasi), replay/session misuse, dan akses lintas role ditinjau.
- Log tidak boleh memuat password, token, secret, atau data sensitif yang tidak diperlukan.
- Proses reset akun, blokir, dan pemulihan harus memiliki audit trail dan kontrol otorisasi.

## 10. Integrasi, dependensi, dan kontrak

Setiap integrasi wajib didokumentasikan dengan:
- nama sistem/komponen pemanggil dan tujuan;
- endpoint/method dan skema request/response;
- autentikasi dan otorisasi;
- timeout, retry, idempotency, dan error mapping;
- tabel/database yang dibaca atau ditulis;
- dampak perubahan dan versi kontrak;
- test integrasi serta prosedur rollback.

Kontrak API tidak boleh berubah secara breaking tanpa identifikasi konsumen, rencana kompatibilitas, dan pengujian.

---

# BAGIAN III — PENGELOLAAN DAN PELAKSANAAN PROYEK

## 11. Tata kelola dokumen dan kewenangan

Dokumen proyek memiliki fungsi berbeda dan tidak saling menggantikan.

| Dokumen | Fungsi | Kewenangan |
|---|---|---|
| **MASTER_PROJECT_LHI/00_MASTER_PROJECT.md** | Dokumen induk: mandat, tujuan, scope, arsitektur, standar, target, dan rencana tingkat proyek | Acuan utama arah proyek |
| **PROJECT_CONTROL.md** | Buku Induk Kontrol Proyek: perubahan, lock, baseline, regresi, deployment, migrasi, rollback, protokol AI/engineer | Pengendali wajib untuk setiap perubahan |
| **LOCK_REGISTER.yaml** | Status dan file/perilaku modul yang dilindungi | Sumber status lock |
| **BASELINE_REGISTER.yaml** | Baseline dan checkpoint yang diakui | Sumber baseline |
| **REGRESSION_MATRIX.yaml** | Test wajib dan statusnya | Sumber matriks regresi |
| **SRS/Requirements Specification** | Kebutuhan rinci dan acceptance criteria per fitur | Baseline kebutuhan setelah disetujui |
| **SAD/Software Architecture Document** | Arsitektur teknis, komponen, deployment, integrasi, dan keputusan arsitektur | Baseline arsitektur |
| **SDS/Software Design Specification** | Desain rinci modul, API, data model, state, dan algoritma | Baseline desain teknis |
| **QA/Test Plan** | Strategi, skenario, data, lingkungan, dan pelaporan test | Acuan verifikasi |
| **Development Roadmap** | Tahapan, urutan prioritas, dependensi, dan target waktu | Dokumen pelaksanaan; bukan dokumen induk |
| **As-Built/Operations Runbook** | Kondisi aktual yang terpasang dan prosedur operasional | Catatan keadaan aktual |

Jika terdapat konflik, aturan perubahan/lock/deployment wajib mengikuti Project Control Book dan register resmi. Spesifikasi fitur yang disetujui menjadi acuan rincian aturan bisnis fitur tersebut. Konflik harus dicatat sebagai isu dan diselesaikan melalui change control; jangan memilih aturan secara sepihak.

## 12. Siklus hidup perubahan

Setiap perubahan mengikuti siklus umum berikut, dengan detail dan pengecualian tetap tunduk pada `PROJECT_CONTROL.md` dan `SOP-UPDATE-DAN-DEPLOY.md`.

1. Catat kebutuhan/masalah dan dampak bisnis.
2. Identifikasi modul, file, API, tabel, lock, baseline, dan test terkait.
3. Analisis risiko, keamanan, kompatibilitas, dan rollback.
4. Dapatkan persetujuan sesuai kewenangan.
5. Buat checkpoint yang sesuai sebelum perubahan berisiko.
6. Implementasikan pada branch kerja; jangan mengubah modul LOCKED tanpa unlock resmi.
7. Jalankan static audit, unit/integration/e2e regression yang relevan.
8. Review diff dan pastikan tidak ada perubahan tak terkait.
9. Merge/deploy hanya setelah gate yang diwajibkan lulus dan otorisasi tersedia.
10. Verifikasi SHA, deployment target, smoke test, backend parity, dan fungsi terdampak.
11. Perbarui baseline, dokumentasi, changelog, dan status lock melalui prosedur resmi.
12. Jika verifikasi gagal, hentikan promosi dan jalankan prosedur rollback yang sesuai.

## 13. Strategi kualitas dan pengujian

Pengujian disusun berlapis:
- **Static analysis:** syntax, lint, secret scan, dependency/config checks.
- **Unit test:** fungsi bisnis dan utilitas terisolasi.
- **Integration test:** frontend/API/database dan kontrak integrasi.
- **End-to-end test:** alur pengguna dari login hingga operasi utama.
- **Security test:** role/permission, RLS, input validation, session, dan akses negatif.
- **Regression test:** modul terdampak dan modul yang berbagi file/komponen.
- **Production smoke test:** pemeriksaan terbatas setelah deployment.
- **Recovery test:** restore/rollback sesuai risiko perubahan.

Kriteria minimum untuk menyatakan perubahan selesai:
- kebutuhan dan acceptance criteria terpenuhi;
- diff hanya mencakup scope yang disetujui;
- test relevan lulus dan hasilnya dapat ditelusuri;
- tidak ada regresi pada modul terlindungi;
- security/data integrity tidak menurun;
- deployment dan runtime diverifikasi bila perubahan dipromosikan;
- dokumentasi dan baseline diperbarui sesuai aturan.

Status test pada `REGRESSION_MATRIX.yaml` tidak boleh diubah menjadi IMPLEMENTED/PASS hanya karena test direncanakan atau script dibuat. Harus ada bukti test yang dapat diperiksa.

## 14. Rencana pelaksanaan tingkat proyek

| Fase | Fokus | Output utama | Gerbang untuk lanjut |
|---|---|---|---|
| P0 — Baseline & governance | Rekonsiliasi dokumen, source, baseline, dan status produksi | Baseline yang dapat dipercaya; daftar gap | SHA dan status sumber diverifikasi |
| P1 — Discovery & requirements | Inventaris fungsi, wawancara proses, SRS dan acceptance criteria | Katalog kebutuhan dan modul | Kebutuhan prioritas disetujui |
| P2 — Architecture & design | SAD, SDS, API map, data model, dependency map | Desain target dan ADR | Review desain dan risiko selesai |
| P3 — Quality foundation | Unit/integration/e2e/security test, observability | Test coverage dan quality gate | Gate kritis lulus |
| P4 — Modularization | Refactor per modul dengan kontrak stabil | Modul terpisah bertahap | Regression dan parity tiap tahap lulus |
| P5 — Operational hardening | Backup/restore, performance, security, runbook | Bukti kesiapan operasional | Kriteria release terpenuhi |
| P6 — Release & continuous improvement | Release terkendali dan evaluasi | Release record, as-built, backlog | Verifikasi pasca-release selesai |

Roadmap rinci, tanggal target, owner per task, dan estimasi disusun terpisah setelah kapasitas, prioritas, dan dependensi dikonfirmasi. Fase di atas bukan janji tanggal penyelesaian.

## 15. Release, deployment, dan operasi

### 15.1 Release

- Setiap release harus memiliki tujuan, daftar perubahan, risiko, commit SHA, hasil test, dan rencana rollback.
- Perubahan produksi dilakukan melalui workflow resmi.
- SHA yang diuji harus sama dengan SHA yang dipromosikan.
- Deployment sukses pada platform belum membuktikan seluruh fungsi bisnis berjalan benar.
- Verifikasi pasca-deployment wajib dilakukan terhadap komponen yang berubah.

### 15.2 Operasi

Runbook operasional harus mencakup:
- pemeriksaan kesehatan frontend, backend, dan database;
- pemeriksaan log dan error;
- pemantauan kapasitas, performa, dan kegagalan;
- backup dan restore;
- rotasi secret dan pengelolaan akses;
- penanganan insiden;
- prosedur rollback aplikasi dan database;
- komunikasi perubahan kepada pengguna.

### 15.3 Backup dan pemulihan

Backup harus dibedakan menjadi:
1. source code/repository;
2. database dan data transaksi;
3. konfigurasi platform, secrets, dan environment;
4. artefak release serta catatan deployment.

Checkpoint GitHub tidak sama dengan backup database. Keberadaan file backup juga tidak membuktikan restore berhasil. Frekuensi backup, retensi, RPO, dan RTO harus ditetapkan melalui kebijakan operasional dan diuji.

---

# BAGIAN IV — RISIKO, KEBERHASILAN, DAN BASELINE

## 16. Risiko proyek utama

| ID | Risiko | Dampak | Mitigasi/aksi |
|---|---|---|---|
| R-01 | File frontend/backend terlalu terpusat | Perubahan kecil berpotensi berdampak lintas fitur | Audit dependensi dan refactor bertahap |
| R-02 | Test coverage belum merata | Regresi dapat lolos ke produksi | Prioritaskan test untuk alur kritis dan modul shared |
| R-03 | Dokumentasi tidak sama dengan runtime | Keputusan dibuat berdasarkan informasi usang | Rekonsiliasi source, workflow, dan runtime secara berkala |
| R-04 | Perubahan database tidak kompatibel | Data atau operasi terganggu | Migration review, backup, staging, dan rollback |
| R-05 | Otorisasi hanya mengandalkan UI | Akses data tidak sah | Enforcement server-side dan RLS |
| R-06 | Cache/PWA menyajikan asset lama | UI tidak sinkron dengan backend | Asset versioning dan cache regression |
| R-07 | Perubahan pada modul LOCKED | Fungsi yang sudah dilindungi rusak | Ikuti unlock/change/test/verify/re-lock |
| R-08 | Backup tidak dapat dipulihkan | Pemulihan insiden gagal | Restore drill dan bukti hasil |
| R-09 | Migrasi platform terlalu dini | Downtime atau kehilangan parity | Migrasi bertahap dengan parity/security/restore gate |
| R-10 | Master data ganda/tidak konsisten | Rekap dan analisis tidak akurat | Normalisasi, constraint, dan duplicate detection |

## 17. Asumsi, batasan, dan dependensi

### Asumsi yang perlu dijaga
- GitHub repository merupakan sumber kode utama.
- Workflow GitHub Actions adalah jalur audit/deployment yang ditetapkan.
- Frontend existing disajikan melalui Cloudflare Worker.
- Backend dan database aktif yang didokumentasikan menggunakan Supabase Edge Functions dan PostgreSQL.
- Aturan bisnis fitur harus memiliki spesifikasi resmi dan pemilik persetujuan.

### Batasan
- Modul LOCKED tidak boleh diubah perilakunya tanpa prosedur resmi.
- Master Project tidak memberikan izin otomatis untuk perubahan kode atau produksi.
- Tidak boleh menyatakan migrasi, backup, test, atau deployment selesai tanpa bukti.
- Target arsitektur tidak boleh diperlakukan sebagai kondisi existing.

### Dependensi
- Ketersediaan akses repository dan workflow.
- Akses yang sah ke Cloudflare dan Supabase untuk verifikasi.
- Secret dan environment yang dikelola dengan aman.
- Persetujuan pemilik proses untuk aturan bisnis.
- Data uji yang aman dan representatif.
- Waktu/kapasitas pengembang dan penguji.

## 18. Kriteria keberhasilan proyek

Proyek dapat dinyatakan memenuhi target profesionalisasi setelah seluruh kriteria berikut memiliki bukti yang dapat diperiksa:

1. Kebutuhan bisnis prioritas telah disetujui dan memiliki acceptance criteria.
2. Katalog modul, file, fungsi, API, tabel, role, dan dependensi telah direkonsiliasi dengan source.
3. SAD dan SDS menggambarkan arsitektur serta desain aktual/target dengan pemisahan yang jelas.
4. Alur kritis memiliki test otomatis yang relevan.
5. Kontrol autentikasi, otorisasi, RLS, secret, dan audit telah diverifikasi.
6. Perubahan database memiliki migration plan dan prosedur pemulihan.
7. Deployment dapat ditelusuri ke commit yang lulus gate.
8. Production smoke test dan parity check lulus untuk release terkait.
9. Backup dan restore diuji, bukan hanya dicatat.
10. Dokumentasi as-built dan runbook sesuai kondisi runtime.
11. Modul yang dinyatakan LOCKED memiliki bukti regression dan verifikasi produksi sesuai aturan kontrol.
12. Tidak ada isu kritis terbuka yang disembunyikan dari status proyek.

## 19. Status baseline dan gap yang diketahui

Berdasarkan dokumen repository yang diperiksa untuk penyusunan ini:

- `frontend/app.js` masih merupakan file inti besar/shared; modularisasi penuh belum terbukti.
- Backend utama `supabase/functions/ipsrs-api/index.ts` masih terkonsentrasi; pemetaan endpoint dan dependensi perlu dilengkapi.
- Beberapa script dan halaman sudah dipisah, tetapi pemisahan file belum membuktikan isolasi modul.
- `LOCK_REGISTER.yaml` menandai Dashboard dan Control Book sebagai LOCKED; aturan tersebut tetap berlaku.
- `REGRESSION_MATRIX.yaml` masih mencatat banyak skenario sebagai PLANNED; status tidak boleh dinaikkan tanpa bukti test.
- Dokumentasi mencatat Supabase/PostgreSQL sebagai database aktif; Cloudflare D1 belum boleh dianggap sebagai database produksi pengganti.
- Pemetaan rinci endpoint, tabel, RLS, global state, event, dan side effect masih memerlukan audit source.
- Nilai target SLA/SLO, RPO/RTO, dan retensi belum ditetapkan pada baseline dokumen yang diperiksa.

Temuan tersebut adalah daftar kerja dan batas klaim, bukan hasil audit total terhadap seluruh source maupun runtime pada tanggal ini.

---

# BAGIAN V — PETA DOKUMEN DAN INVENTARIS TEKNIS

## 20. Struktur dokumen proyek

Struktur dokumentasi yang dituju:

```text
/
  README.md
  PROJECT_CONTROL.md
  LOCK_REGISTER.yaml
  BASELINE_REGISTER.yaml
  REGRESSION_MATRIX.yaml
  SOP-UPDATE-DAN-DEPLOY.md
  AI_AUDIT_PROTOCOL.md
  MASTER_PROJECT_LHI/
    00_MASTER_PROJECT.md
    01_PROJECT_CHARTER.md
    02_REQUIREMENTS_SPECIFICATION.md
    03_SOFTWARE_ARCHITECTURE.md
    04_SOFTWARE_DESIGN_SPECIFICATION.md
    05_QUALITY_ASSURANCE_PLAN.md
    06_DEVELOPMENT_ROADMAP.md
    07_AS_BUILT_AND_OPERATIONS.md
    PROFESSIONALIZATION_ROADMAP.md
```

Daftar ini adalah struktur target. Dokumen yang belum ada atau belum disetujui tidak boleh dianggap telah selesai. Hindari membuat dokumen duplikat yang mengulang kewenangan Project Control Book.

## 21. Inventaris arsitektur existing — snapshot audit

### 21.1 Direktori utama

| Path | Isi/tanggung jawab |
|---|---|
| `.github/workflows/` | Workflow audit gate dan deployment |
| `frontend/` | Aplikasi web dan static assets |
| `frontend/pages/` | Halaman Login, Dashboard, Input, Laporan, Online pada snapshot |
| `frontend/js/` | Script kategori dan master data |
| `frontend/css/` | Style frontend |
| `supabase/functions/` | Backend Edge Functions |
| `supabase/migrations/` | Riwayat perubahan database |
| `scripts/` | Script audit |
| `tests/e2e/` | Playwright end-to-end |
| `AUDIT/` | Catatan audit |
| `backups/` | Salinan file tertentu |
| `github-pages-redirect/` | Redirect GitHub Pages |
| `wrangler.jsonc` | Konfigurasi Cloudflare Worker/assets |

### 21.2 File frontend yang teridentifikasi

| File | Catatan |
|---|---|
| `frontend/app.js` | File inti bersama; perlu pemetaan fungsi sebelum pemisahan |
| `frontend/index.html` | Entry point dan pemuatan asset |
| `frontend/config.js` | Konfigurasi frontend |
| `frontend/css/style.css` | Style lintas halaman |
| `frontend/sw.js` | Service worker/cache |
| `frontend/manifest.json` | Metadata PWA |
| `frontend/access-control.js` | Kontrol akses |
| `frontend/access-policy-ui.js` | UI kebijakan akses |
| `frontend/access-visibility-fix.js` | Visibilitas akses |
| `frontend/login-fast.js` | Pendukung login |
| `frontend/laporan-fast-v2.js` | Pendukung pemuatan laporan |
| `frontend/laporan-loading-state.js` | Status loading laporan |
| `frontend/dashboard-loading-v2.js` | Pendukung loading Dashboard |
| `frontend/required-fields-ui.js` | Validasi/tampilan field wajib |
| `frontend/export-laporan-excel.js` | Ekspor laporan |
| `frontend/js/kategori-modal.js` | Modal kategori |
| `frontend/js/master-data-management.js` | Pengelolaan master data |
| `frontend/js/master-item-review.js` | Review master item |
| `frontend/js/static-data.js` | Data fallback/static |

Halaman yang teridentifikasi pada snapshot: `Page_Login.html`, `Page_Dashboard.html`, `Page_Input.html`, `Page_Laporan.html`, dan `Page_Online.html`. Lokasi implementasi REKAP perlu ditelusuri karena register modul mencantumkannya tetapi halaman khususnya tidak terlihat pada daftar snapshot yang diperiksa.

### 21.3 Backend Supabase yang teridentifikasi

| Function | Catatan tanggung jawab awal |
|---|---|
| `ipsrs-api` | API utama |
| `ipsrs-auth-bridge` | Jembatan autentikasi |
| `ipsrs-link-account` | Pengaitan akun |
| `ipsrs-bulk-provision-once` | Provisioning akun batch satu kali |
| `lhi-reset-verify` | Verifikasi reset LHI |

Pemetaan endpoint, tabel, role, policy, dan dependency setiap handler belum dianggap lengkap sampai diverifikasi langsung dari source.

### 21.4 Workflow

| Workflow | Path | Peran |
|---|---|---|
| IPSRS Automated Audit Gate | `.github/workflows/ipsrs-audit-gate.yml` | Audit statis dan browser regression |
| Deploy IPSRS Production | `.github/workflows/deploy-production.yml` | Deployment Cloudflare, GitHub Pages, dan Supabase secara kondisional |

Status workflow harus diperiksa berdasarkan run yang relevan. Dokumen ini tidak menyatakan workflow tertentu sedang PASS.

## 22. Dokumen dan register rujukan

- [Project Control Book](../PROJECT_CONTROL.md)
- [Lock Register](../LOCK_REGISTER.yaml)
- [Baseline Register](../BASELINE_REGISTER.yaml)
- [Regression Matrix](../REGRESSION_MATRIX.yaml)
- [SOP Update dan Deploy](../SOP-UPDATE-DAN-DEPLOY.md)
- [AI Audit Protocol](../AI_AUDIT_PROTOCOL.md)
- [README Form Blok Aplikasi](../README-FORM-BLOK-APLIKASI.md) — spesifikasi fitur khusus, bukan pengganti Master Project
- [Professionalization Roadmap](PROFESSIONALIZATION_ROADMAP.md) — rencana tahapan, bukan dokumen induk

---

## Riwayat revisi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-11-06 | Peta arsitektur dan inventaris awal repository |
| 2.0 | 2026-11-15 | Diperluas menjadi Master Project: mandat, visi, tujuan, ruang lingkup, kebutuhan, arsitektur, standar, tata kelola, delivery, risiko, acceptance criteria, dan peta dokumen |

**Pernyataan status:** Master Project ini menetapkan baseline arah dan kerangka proyek. Dokumen ini tidak menyatakan semua fitur telah selesai, seluruh test lulus, semua modul telah modular, backup dapat dipulihkan, atau produksi telah terverifikasi. Setiap status teknis harus didukung bukti dari source, test, workflow, dan runtime.
