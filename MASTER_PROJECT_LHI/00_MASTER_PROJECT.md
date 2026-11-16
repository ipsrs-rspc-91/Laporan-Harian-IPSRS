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

### 4.3 Pengembangan dan penambahan modul secara berkelanjutan

Aplikasi LHI dirancang sebagai aplikasi yang dapat berkembang mengikuti kebutuhan operasional IPSRS. Daftar modul yang tercantum dalam Master Project, README, katalog modul, atau register teknis merupakan inventaris kondisi dan rencana pada waktu dokumen diperbarui; daftar tersebut **bukan daftar final dan bukan batas maksimum ruang lingkup aplikasi**.

Ketentuan wajib:
1. Modul baru dapat diusulkan dan dikembangkan secara bertahap berdasarkan kebutuhan bisnis yang disetujui Product Owner. Seluruh modul tidak harus dibangun sekaligus.
2. Penambahan modul tidak mensyaratkan seluruh modul yang sudah direncanakan selesai terlebih dahulu, sepanjang dependensi, risiko, kapasitas, dan prioritas telah dinilai.
3. Setiap modul harus memiliki tujuan, ruang lingkup, pemilik proses, batas tanggung jawab, role/permission, data yang dikelola, kontrak API/event, dependensi, acceptance criteria, test, dokumentasi, serta prosedur operasional.
4. Modul baru wajib mengikuti arsitektur, standar keamanan, standar data, CI/CD, dan tata kelola yang berlaku.
5. Modul baru tidak boleh mengubah perilaku modul LOCKED atau shared behavior yang dilindungi. Dampak lintas modul harus diuji melalui regression matrix dan prosedur unlock bila perubahan memang menyentuh perilaku yang dikunci.
6. Penambahan modul dilakukan melalui change control. Persetujuan kebutuhan tidak otomatis berarti persetujuan deployment produksi.
7. Arsitektur harus mendukung penambahan modul tanpa redesign seluruh aplikasi yang tidak diperlukan. Pemilihan modular monolith atau pemisahan layanan didasarkan pada kebutuhan nyata; microservices bukan pilihan default.
8. Katalog modul harus memisahkan status EXISTING, IN DEVELOPMENT, PLANNED, PROPOSED, DEPRECATED, dan RETIRED. Status hanya berubah berdasarkan bukti dan persetujuan yang tercatat.
9. Master Project dan katalog modul diperbarui ketika ada modul baru, perubahan batas tanggung jawab, integrasi, atau penghentian modul.
10. Modul yang tidak tercantum pada daftar saat ini tetap dapat ditambahkan melalui proses yang sama; tidak diperlukan perubahan identitas proyek hanya karena cakupan modul bertambah.

### 4.4 Klasifikasi status modul

- **EXISTING:** implementasi ditemukan pada source atau runtime; tingkat kelengkapan tetap harus dinilai.
- **IN DEVELOPMENT:** sedang dikerjakan pada branch atau lingkungan pengembangan.
- **PLANNED:** telah disetujui sebagai kebutuhan/pekerjaan, tetapi implementasi belum dimulai.
- **PROPOSED:** usulan yang belum memperoleh persetujuan prioritas.
- **DEPRECATED:** masih tersedia untuk transisi, tetapi tidak direkomendasikan untuk penggunaan baru.
- **RETIRED:** sudah dihentikan dengan migrasi/penghapusan yang disetujui dan bukti penutupan.

Status modul pada register teknis tetap mengikuti format dan kewenangan register tersebut. Klasifikasi di sini adalah kosakata proyek, bukan izin untuk mengubah LOCK_REGISTER.


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


### 6.1 Katalog modul bersifat dinamis

Tabel FR-01 sampai FR-14 adalah kapabilitas yang telah teridentifikasi pada snapshot dokumen, bukan daftar final seluruh modul Aplikasi LHI. Modul baru dapat ditambahkan melalui persetujuan kebutuhan dan change control tanpa menunggu seluruh kapabilitas yang ada selesai. Katalog modul wajib mencatat sekurang-kurangnya:
- ID dan nama modul yang unik;
- tujuan bisnis dan proses yang didukung;
- Product Owner/pemilik proses dan technical owner;
- status siklus hidup modul;
- batas tanggung jawab dan fungsi yang tidak menjadi tanggung jawabnya;
- halaman/UI, service, endpoint, tabel/view, job, dan integrasi terkait;
- role/permission dan aturan akses;
- data owner, klasifikasi data, retensi, serta aturan audit;
- dependensi internal/eksternal dan shared components yang digunakan;
- acceptance criteria, test suite, regression coverage, dan bukti release;
- dokumentasi operasional, monitoring, serta prosedur pemulihan.

### 6.1.1 Crosswalk kapabilitas Master Project dan requirement SRS

Kode `FR-01` sampai `FR-14` pada tabel kapabilitas Master Project adalah pengelompokan kapabilitas tingkat proyek. Kode tersebut **bukan pengganti** ID requirement formal pada SRS. Untuk menghindari dua daftar kebutuhan yang berkembang sendiri-sendiri, gunakan crosswalk berikut:

| Kapabilitas Master Project | Requirement SRS | Modul/domain pada katalog | Catatan cakupan |
|---|---|---|---|
| FR-01 Autentikasi | LHI-FR-001 | AUTH | Identitas dan proses login |
| FR-02 Otorisasi | LHI-FR-002 | AUTH, SECURITY | Pemeriksaan permission server-side |
| FR-03 Input LHI | LHI-FR-003 | REPORT | Pembuatan laporan harian |
| FR-04 Siklus laporan | LHI-FR-004, LHI-FR-005, LHI-FR-006 | REPORT, AUDIT_LOG | Lihat, edit, dan soft-delete sesuai hak akses serta audit |
| FR-05 Master data | LHI-FR-007 | MASTER, KAT | Area, item, dan kategori |
| FR-06 Validasi duplikasi | LHI-FR-008 | MASTER | Deteksi item sama/sangat mirip |
| FR-07 Klasifikasi pekerjaan/material | LHI-FR-009 | SPARE_MATERIAL_UNIT | Spare Part, Material, dan Unit |
| FR-08 Dashboard | LHI-FR-010 | DASH | Ringkasan operasional dan rekonsiliasi sumber |
| FR-09 Rekap bulanan | LHI-FR-011 | REKAP | Agregasi berdasarkan periode |
| FR-10 Monitoring | LHI-FR-012 | MONITORING | Definisi status dan aktivitas petugas |
| FR-11 Form Blok Aplikasi | LHI-FR-013 | LHI_DISCIPLINE_RECOVERY, AUTH, MONITORING | Detail aturan merujuk README Form Blok; approval dan regression coverage masih terbuka |
| FR-12 Audit trail | LHI-FR-014 | AUDIT_LOG | Aktor, waktu, objek, tindakan, dan hasil |
| FR-13 Ekspor | LHI-FR-015 | REPORT | Ekspor sesuai permission |
| FR-14 PWA/cache | LHI-FR-016 | PWA | Konsistensi versi asset dan cache |
| Kapabilitas lintas modul / maintainability | LHI-FR-017 | CROSS-CUTTING | Penambahan modul melalui kontrak, katalog, test, dan change control; bukan satu halaman tunggal |

**Aturan pemeliharaan:** SRS menjadi daftar ID requirement formal. Master Project menyajikan pengelompokan dan crosswalk tingkat proyek. Jika kebutuhan dipecah, digabung, atau dihapus, ID SRS, acceptance criteria, desain, katalog modul, dan test reference harus direkonsiliasi melalui change control; jangan mengubah ID secara diam-diam.

### 6.2 Siklus hidup modul

Usulan modul → analisis kebutuhan dan dampak → persetujuan prioritas → spesifikasi dan desain → implementasi → pengujian → UAT → release approval → verifikasi operasional → pemeliharaan → deprecation/retirement bila diperlukan.

Tidak semua usulan harus diterima. Keputusan menerima, menunda, menolak, menggabungkan, atau menghentikan modul harus memiliki alasan dan pemilik keputusan. Pengembangan modul dapat dilakukan secara iteratif dan independen selama kontrak integrasi dan dampak lintas modul dikendalikan.

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

### 8.5 Arsitektur untuk pertumbuhan modul

Aplikasi harus mendukung penambahan kapabilitas baru secara inkremental. Batas modul ditentukan berdasarkan domain/tanggung jawab bisnis, kepemilikan data, dan kontrak integrasi; bukan semata-mata berdasarkan halaman atau jumlah file.

Ketentuan desain:
1. Setiap modul memiliki interface publik yang terdokumentasi; akses langsung ke state internal modul lain dihindari.
2. Modul tidak boleh mengakses atau mengubah tabel milik modul lain tanpa kontrak data dan otorisasi yang disepakati.
3. Shared component/service hanya digunakan untuk kebutuhan lintas modul yang benar-benar sama dan memiliki owner serta regression test.
4. Event, callback, global state, cache, dan side effect lintas modul harus terinventarisasi.
5. Dependency direction harus jelas; circular dependency dicegah.
6. Modul baru tidak boleh menambah privilege lebih luas daripada kebutuhan fungsinya.
7. Migrasi dari struktur existing ke struktur modular dilakukan bertahap dengan parity check, feature flag bila sesuai, regression, dan rollback.
8. Tidak ada kewajiban mengadopsi microservices. Pemisahan proses/service dilakukan hanya jika ada alasan terukur seperti skala, isolasi risiko, kebutuhan deployment independen, atau batas keamanan.
9. Penambahan modul harus mempertahankan kompatibilitas laporan historis dan API konsumen yang masih didukung.
10. Setiap modul harus memiliki definisi health/operational signal yang relevan agar gangguan dapat dilokalisasi.

### 8.6 Diagram arsitektur wajib

Dokumentasi arsitektur harus memuat diagram C4 yang relevan:
- System Context: pengguna, Aplikasi LHI, dan sistem eksternal.
- Container: browser/frontend, backend/API, database, pipeline CI/CD, dan platform hosting.
- Component: komponen utama dalam container yang kompleks.
- Deployment: lingkungan dan penempatan komponen.

Diagram data flow wajib menandai sumber data, tujuan, protokol, trust boundary, data sensitif, autentikasi, dan kontrol keamanan. Diagram harus diperbarui saat perubahan arsitektur material terjadi. Diagram tidak boleh dianggap bukti implementasi tanpa dicocokkan dengan source dan runtime.


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

### 9.3 Program audit dan pengujian keamanan

Aplikasi LHI wajib memiliki program Security Assurance yang memeriksa ketahanan aplikasi terhadap akses tidak sah, pencurian akun, kebocoran data, manipulasi transaksi, dan gangguan layanan. Pemeriksaan keamanan merupakan persyaratan proyek dan release gate, bukan pekerjaan opsional.

Ruang lingkup minimum pemeriksaan:

1. **Authentication & account security:** brute-force dan credential-stuffing resistance, kebijakan password, proses reset akun, MFA bila ditetapkan, enumerasi akun, serta perlindungan terhadap pengambilalihan akun.
2. **Session & token security:** penerbitan, penyimpanan, masa berlaku, rotasi, invalidasi logout, pencabutan sesi, refresh token, replay, dan pencurian token.
3. **Authorization & privilege escalation:** akses horizontal/vertical antarpetugas, admin, dan Kepala IPSRS; IDOR/BOLA; pemeriksaan permission pada setiap endpoint; serta bypass kontrol UI.
4. **Web application security:** OWASP Top 10 yang relevan, termasuk injection, XSS, CSRF, SSRF bila ada jalur yang memungkinkan, insecure deserialization, security misconfiguration, dan file/upload handling bila fitur tersedia.
5. **API security:** OWASP API Security Top 10 yang relevan, termasuk broken object/property/function-level authorization, autentikasi, konsumsi resource, rate limiting, dan inventory endpoint.
6. **Database & Supabase security:** RLS untuk seluruh tabel yang terekspos, privilege/grant, akses anon/authenticated/service role, Edge Functions, SQL injection, kebocoran secret, serta pembatasan akses langsung.
7. **Infrastructure & deployment security:** GitHub Actions permissions, dependency/supply-chain risk, secret handling, Cloudflare configuration, CORS, security headers, environment separation, dan konfigurasi Supabase.
8. **Data protection & auditability:** paparan data, minimisasi data, enkripsi saat transit dan saat tersimpan sesuai kemampuan platform, log aktivitas, alert, retensi, serta larangan mencatat password/token/secret.
9. **Availability & abuse resistance:** rate limiting, abuse control, resource exhaustion, dan ketahanan terhadap pola trafik tidak wajar; uji beban harus terkoordinasi agar tidak mengganggu layanan produksi.

### 9.4 Standar acuan dan metode

- **OWASP ASVS** digunakan untuk menetapkan dan memverifikasi persyaratan keamanan aplikasi berdasarkan tingkat risiko.
- **OWASP Top 10** digunakan sebagai daftar risiko utama aplikasi web.
- **OWASP API Security Top 10** digunakan untuk evaluasi risiko API.
- **OWASP Web Security Testing Guide (WSTG)** digunakan sebagai panduan metode pengujian aplikasi web.
- Pengujian otomatis dapat mencakup SAST, dependency/SCA scanning, secret scanning, konfigurasi, dan DAST sesuai teknologi serta risiko.
- Penetration test dilakukan oleh personel kompeten atau pihak independen dengan ruang lingkup, otorisasi tertulis, aturan pelaksanaan, dan laporan temuan.

Acuan tersebut merupakan kerangka pemeriksaan; pemilihan kontrol dan tingkat verifikasi harus disesuaikan dengan risiko dan arsitektur aktual LHI. Tidak boleh mengklaim sertifikasi atau kepatuhan penuh hanya karena menggunakan daftar acuan tersebut.

### 9.5 Frekuensi dan pemicu pemeriksaan

1. Security review dilakukan sebelum release besar dan sebelum perubahan pada autentikasi, otorisasi, sesi/token, database/RLS, API, atau infrastruktur.
2. Vulnerability scanning dilakukan berkala sesuai jadwal QA/security yang disetujui dan setelah perubahan dependensi atau konfigurasi yang signifikan.
3. Penetration testing dilakukan sebelum penetapan kesiapan produksi/penilaian keamanan awal, kemudian berkala berbasis risiko dan setelah perubahan arsitektur atau kontrol keamanan yang material.
4. Pengujian tambahan dilakukan setelah insiden keamanan, indikasi akun dibobol, kebocoran data, atau temuan kerentanan kritis.
5. Jadwal, cakupan, penanggung jawab, lingkungan, dan bukti pelaksanaan dicatat dalam Security Test Plan dan laporan pengujian.

### 9.6 Pengelolaan temuan dan kriteria kelulusan

Setiap temuan wajib memiliki ID, aset/endpoint terdampak, bukti reproduksi yang aman, tingkat keparahan, dampak, rekomendasi, penanggung jawab, target penyelesaian, status, dan bukti retest. Tingkat risiko diklasifikasikan sekurang-kurangnya menjadi Critical, High, Medium, dan Low menggunakan metodologi yang konsisten (misalnya CVSS ditambah konteks dampak bisnis).

- Temuan Critical dan High harus diperbaiki dan diuji ulang sebelum release; pengecualian hanya melalui penerimaan risiko tertulis oleh pejabat berwenang, disertai mitigasi dan batas waktu.
- Temuan Medium dan Low harus masuk backlog dengan prioritas, pemilik, dan target penyelesaian yang terdokumentasi.
- Penutupan temuan membutuhkan bukti retest; status fixed tidak boleh ditetapkan hanya berdasarkan klaim pengembang.
- Hasil pengujian harus memuat cakupan, tanggal, metode, keterbatasan, temuan, bukti, retest, dan kesimpulan risiko residual.
- Tidak boleh menyatakan aplikasi aman atau bebas peretasan. Pernyataan yang diperbolehkan adalah ruang lingkup tertentu telah diuji pada tanggal tertentu dan temuan yang diketahui telah ditangani sesuai kriteria penerimaan.

### 9.7 Pemetaan regulasi, privasi, dan lokasi pemrosesan data

Aplikasi LHI wajib memiliki legal/privacy assessment yang disetujui pihak rumah sakit yang berwenang. Pemetaan awal sekurang-kurangnya mencakup:

1. **UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi:** identifikasi peran pengendali/prosesor, tujuan dan dasar pemrosesan, kategori data pribadi, hak subjek data, retensi, keamanan, penanganan insiden, dan transfer data lintas negara. Data kesehatan termasuk kategori data pribadi yang bersifat spesifik; nama, identitas petugas, dan metadata aktivitas dapat termasuk data pribadi umum.
2. **PP Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik:** evaluasi kewajiban penyelenggaraan sistem elektronik yang andal, aman, bertanggung jawab, serta menjaga ketersediaan, keutuhan, keotentikan, kerahasiaan, dan keteraksesan informasi.
3. **Permenkes Nomor 24 Tahun 2022 tentang Rekam Medis:** diterapkan pada bagian sistem yang benar-benar memproses/menyelenggarakan data rekam medis. Aplikasi LHI untuk pemeliharaan sarana tidak otomatis merupakan sistem rekam medis. Data pasien, diagnosis, atau informasi klinis tidak boleh dimasukkan ke LHI kecuali ada kebutuhan, dasar, persetujuan, dan pengendalian yang secara resmi ditetapkan.
4. **PP Nomor 33 Tahun 2026 tentang Peraturan Pelaksanaan UU PDP:** telah ditetapkan pada 2026 dan memuat masa mulai berlaku enam bulan setelah pengundangan. Tim hukum/privasi wajib memverifikasi tanggal efektif dan menyiapkan pemenuhan sebelum berlaku.

**Lokasi pemrosesan dan transfer data:** snapshot project Supabase yang diperiksa menunjukkan region `ap-southeast-1`. Infrastruktur Cloudflare dapat memproses trafik melalui jaringan global. Rumah sakit wajib menilai data apa yang dikirim/disimpan di luar wilayah Indonesia, peran vendor, lokasi pemrosesan, mekanisme perlindungan transfer, kontrak pemrosesan, subprocessor, retensi, dan mekanisme penghapusan. Temuan ini memerlukan legal/privacy review; bukan kesimpulan otomatis bahwa pemrosesan saat ini melanggar hukum.

**Kontrol wajib:**
- Katalog data dan data flow menandai data pribadi, data kesehatan spesifik, dan data operasional non-pribadi.
- Form LHI memberi peringatan agar petugas tidak memasukkan nama pasien, nomor rekam medis, diagnosis, foto pasien, atau informasi klinis.
- Data pribadi dibatasi sesuai tujuan, akses, retensi, dan kebutuhan operasional.
- Penilaian dampak pelindungan data (DPIA) dilakukan bila pemrosesan berpotensi berisiko tinggi.
- Transfer lintas negara/vendor harus ditinjau dan disetujui oleh fungsi hukum/privasi sebelum dinyatakan memenuhi ketentuan.
- Kontrak, perjanjian pemrosesan, subprocessor, dan mekanisme respons insiden vendor harus terdokumentasi.

Rujukan awal:
- UU 27/2022: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022-10
- PP 71/2019: https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019
- Permenkes 24/2022: https://jdih.kemkes.go.id/documents/peraturan-menteri-kesehatan-nomor-24-tahun-2022
- PP 33/2026: https://pemerintahdigital.id/assets/resources/PP33_2026-PeraturanPelaksanaanUU27_2022_PerlindunganDataPribadi.pdf

### 9.8 Aturan keselamatan pengujian

Pengujian aktif hanya dilakukan pada sistem dan akun yang secara tertulis diotorisasi. Utamakan staging atau lingkungan uji yang representatif. Dilarang melakukan brute force, denial-of-service, eksploitasi destruktif, pengambilan data pengguna, atau pengujian yang berpotensi mengganggu layanan produksi tanpa persetujuan eksplisit, rencana mitigasi, jendela pengujian, pemantauan, dan prosedur penghentian. Data produksi tidak boleh disalin ke lingkungan uji tanpa kontrol perlindungan data yang sesuai.

---

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

### 14.1 Hubungan fase Master Project dan Roadmap Profesionalisasi

Fase P0–P6 pada Master Project adalah fase pengendalian tingkat proyek. Tahap 0–8 pada `PROFESSIONALIZATION_ROADMAP.md` merupakan pemecahan pekerjaan yang lebih rinci; keduanya bukan dua urutan proyek yang saling menggantikan.

| Fase Master Project | Tahap Roadmap rinci |
|---|---|
| P0 — Baseline & governance | 0. Baseline & safety |
| P1 — Discovery & requirements | 1. Requirements & governance; bagian kebutuhan dari 2. Technical discovery |
| P2 — Architecture & design | Sisa 2. Technical discovery; 3. Architecture pack |
| P3 — Quality foundation | 4. Quality foundation |
| P4 — Modularization | 5. Pilot modularization; 6. Incremental migration |
| P5 — Operational hardening | Hardening keamanan, backup/recovery, performance, dan runbook pada 4, 7, dan 8 |
| P6 — Release & continuous improvement | 7. Production validation; 8. As-Built & operations |

Urutan aktual dapat beririsan untuk pekerjaan dokumentasi dan discovery, tetapi perubahan produksi tetap tunduk pada gate, lock, persetujuan, dan dependency. Status suatu fase hanya dinyatakan selesai berdasarkan kriteria keluar dan bukti, bukan karena tahap dokumen telah ditulis.

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

### 19.1 Identitas snapshot dan batas audit

Status di bawah adalah **snapshot dokumentasi/repository per 15 November 2026 sebelum revisi tahap 1**, bukan sertifikasi runtime produksi. SHA branch dokumen pada tabel adalah ref yang diaudit sebelum perubahan dokumen tahap 1; commit revisi sesudahnya tercatat pada riwayat GitHub/PR #77.

| Objek | Identitas | Status saat pemeriksaan |
|---|---|---|
| Branch utama | `main` — `de77a78a99e566a97d9be320786e47d6675ae94a` | Baseline source utama yang diperiksa |
| Branch dokumen (pre-revisi tahap 1) | `docs/lhi-professionalization-roadmap` — `b9beab3dd45cbe03ff097ef1bd58340e9493514f` | Ref yang diaudit sebelum revisi tahap 1 |
| PR #77 | Master Project LHI | OPEN / DRAFT; belum merge |
| PR #76 | Form Blok compliance alignment | OPEN / DRAFT; migration pada PR bukan bukti telah diterapkan ke database |
| PR #80 | Pelacakan source Edge Functions | OPEN / DRAFT; belum menjadi bagian dari `main` |

Pembaruan pada branch dokumen tidak mengubah `main`, database, hosting, atau runtime produksi. Semua identitas SHA dan status PR adalah snapshot pada tanggal pemeriksaan dan wajib diperbarui ketika dokumen direvisi kembali.

### 19.2 Status teknis dan gap yang teridentifikasi

| Area | Temuan pada snapshot | Status/kendali |
|---|---|---|
| Frontend | `frontend/app.js` masih merupakan file inti besar/shared; sebagian helper mulai dipisahkan, tetapi modularisasi penuh dan isolasi domain belum terbukti | IN PROGRESS |
| Frontend global namespace | Audit statis 15 November mendeteksi potensi duplikasi nama fungsi global lintas file (`render`, `check`, `injectStyles`, `session`, `ensureModal`, `close`, `load`, `init`, `show`) | WARN; perlu dependency map dan uji urutan pemuatan sebelum refactor |
| Frontend/backend boundary | Audit statis mendeteksi akses Supabase langsung pada `frontend/app.js`, `frontend/index.html`, dan `frontend/laporan-fast-v2.js` | WARN; evaluasi pemindahan operasi data ke API server-side secara bertahap, tanpa mengubah perilaku sebelum test tersedia |
| Backend | `supabase/functions/ipsrs-api/index.ts` masih memuat banyak action; pemetaan endpoint, dependensi, dan pembagian domain perlu dilengkapi | IN PROGRESS |
| Modul terkunci | `LOCK_REGISTER.yaml` menandai Dashboard (DASH) dan Control Book (CONTROL_BOOK) sebagai LOCKED | PROTECTED; tidak boleh ada perubahan perilaku tanpa prosedur dan persetujuan yang berlaku |
| Regression | `REGRESSION_MATRIX.yaml` masih memiliki banyak skenario PLANNED; status PLANNED bukan bukti test telah dijalankan | OPEN |
| Database/platform | Supabase/PostgreSQL masih merupakan database aktif yang didokumentasikan; Cloudflare D1 belum terbukti menggantikan database produksi | NOT MIGRATED / NOT CERTIFIED |
| Migration parity | Snapshot audit mencatat 75 migration remote dan 35 file migration pada `main`; branch PR #76 memiliki file tambahan yang belum berarti diterapkan | BLOCKED / NOT RECONCILED; perubahan schema produksi NO-GO |
| Edge Functions | Snapshot runtime mencatat 8 function aktif, sedangkan `main` melacak 5; PR #80 masih OPEN/DRAFT untuk sinkronisasi source tambahan | PARTIAL; belum boleh diklaim source/runtime parity penuh |
| Form Blok / Recovery | `open_lhi_global_grace_v2` masih mengembalikan `SAFE_CUTOVER_REQUIRED` menurut manifest audit; proses global recovery belum dapat dinyatakan operasional | FAIL-CLOSED / NOT CERTIFIED |
| Form Blok regression coverage | `REGRESSION_MATRIX.yaml` tidak memiliki kelompok test Form Blok/Recovery pada snapshot yang diperiksa; matrix merupakan protected file karena CONTROL_BOOK berstatus LOCKED | COVERAGE GAP; jangan ubah matrix tanpa change control/unlock |
| Kontrol Form Blok | Requirement khusus tersedia pada `README-FORM-BLOK-APLIKASI.md`; pada snapshot LOCK_REGISTER yang dirujuk dokumen, fitur ini belum tercatat sebagai modul terkunci tersendiri | NOT LISTED IN LOCK_REGISTER SNAPSHOT; bukan status LOCKED atau izin untuk mengubah produksi |
| Security / RLS | Source review dan inventory tersedia, tetapi sertifikasi live schema, grants, RLS, dan seluruh jalur authorization belum lengkap | OPEN / NOT CERTIFIED |
| Cloudflare | Source/deployment parity dan production smoke belum memiliki bukti lengkap pada dokumen audit yang dirujuk | OPEN / NOT CERTIFIED |
| Backup / DR | Checkpoint source tidak sama dengan backup database; restore drill penuh belum tersertifikasi | OPEN / NOT CERTIFIED |
| Performance | Target dan baseline numerik p50/p95 belum disahkan/dibuktikan | OPEN |
| SLO / RPO / RTO / retensi | Nilai target resmi belum ditetapkan dan disetujui | TO BE AGREED; jangan mengarang angka |
| Project Charter / persetujuan | Dokumen Charter tersedia, tetapi tabel persetujuan Sponsor/Manajemen, Product Owner, dan Technical/Operations Owner masih berstatus MENUNGGU | DRAFT / NOT APPROVED |
| Requirements baseline | SRS tersedia sebagai katalog awal; prioritas masih usulan dan baseline kebutuhan harus dikonfirmasi Product Owner | REVIEW / NOT APPROVED |
| Business case | Visi dan tujuan sudah tercantum di Master Project; belum ditemukan artefak Business Case terpisah yang memuat manfaat terukur, biaya, opsi, dan justifikasi investasi | GAP DOKUMENTASI; jangan menganggap business case telah disahkan |

**Catatan temuan audit statis:** pada run PR #77 tanggal 15 November 2026, Audit Total selesai SUCCESS tanpa failure, tetapi mengeluarkan WARN untuk potensi duplikasi nama fungsi global dan akses Supabase langsung dari frontend. WARN bukan bukti bahwa telah terjadi collision atau kebocoran; temuan harus dianalisis terhadap konteks pemanggilan, urutan script, boundary keamanan, dan regresi sebelum perubahan dilakukan.

### 19.3 Aturan membaca status

1. **EXISTING** berarti implementasi ditemukan pada source atau runtime; bukan otomatis lengkap, aman, atau lulus UAT.
2. **IN PROGRESS** berarti ada pekerjaan aktif yang dapat ditunjukkan melalui branch/PR atau artefak kerja; bukan bukti siap produksi.
3. **OPEN** berarti verifikasi atau keputusan belum selesai.
4. **BLOCKED / NO-GO** berarti tindakan yang bergantung pada gap tersebut tidak boleh diteruskan ke produksi.
5. **PASS / CERTIFIED** hanya boleh diberikan jika bukti sesuai tersedia, relevan dengan SHA/environment yang benar, dan dapat ditelusuri.
6. Status dokumen tidak boleh dipakai sebagai pengganti status source, test, deployment, database, atau runtime.

Daftar ini merupakan snapshot temuan dan batas klaim, bukan hasil audit total terhadap seluruh source maupun runtime. Untuk perubahan berikutnya, lakukan recheck terhadap branch, PR, register kontrol, workflow, dan bukti runtime sebelum memperbarui status.

### 19.4 Recheck Form Blok dan recovery — 16 November 2026

Pemeriksaan lanjutan terhadap branch PR #76, GitHub Actions, dan Supabase production dilakukan secara terpisah. Hasil berikut membedakan bukti branch/CI dari kondisi database/runtime produksi:

| Area | Bukti terbaru | Status yang boleh dinyatakan |
|---|---|---|
| PR #76 | Head `eafb67ed0a39432ead7610ac56c6ecd8b60fc61b`; OPEN / DRAFT | Implementasi berada pada branch, belum merge |
| Audit statis + Deno type-check | Workflow run `43835446297` — SUCCESS | PASS pada SHA branch tersebut |
| PostgreSQL LHI regression | Workflow run `43835446297` — SUCCESS | PASS pada database test terisolasi |
| Browser regression | Workflow run `43835446297` — 20/20 PASS | PASS pada browser test terisolasi |
| Deployment gate audit | Workflow run `43835446297` — SUCCESS | Audit gate branch PASS; bukan production deployment |
| Migration production | Migration alignment PR #76 belum diterapkan; schema production belum memiliki `staff.lhi_access_blocked_at`, `staff.lhi_employment_activated_at`, snapshot metadata obligations, dan tabel `lhi_discipline_obligation_events` | PRODUCTION SCHEMA NOT ALIGNED |
| Recovery production | `open_lhi_global_grace_v2` production masih mengembalikan `SAFE_CUTOVER_REQUIRED` | FAIL-CLOSED; belum operasional untuk membuka grace |
| Runtime grace | `LHI_GLOBAL_BLOCK=NONAKTIF`; satu incident berstatus GRACE dengan deadline 19 November 2026 pukul 18.17 WIB | Kondisi aktif harus dipertahankan; jangan reset atau memulai ulang deadline saat cutover |
| Edge Function source | `lhi-recovery-action` dan `lhi-recovery-exchange` branch disamakan dengan source runtime; `lhi-block-status` branch menambahkan pembacaan snapshot pending yang belum ada di runtime | Source branch lebih lengkap; belum deploy |

**Keputusan:** Form Blok/Recovery pada PR #76 telah lulus full automated regression gate di lingkungan test. Ini bukan sertifikasi produksi. Migration parity 75 remote vs 35 file pada `main` tetap menjadi blocker terpisah; schema production dan `open_lhi_global_grace_v2` belum mengikuti migration branch. Tidak ada perubahan produksi yang dilakukan dalam recheck ini. Promosi ke `main`/production harus mengikuti SOP, migration reconciliation, backup/checkpoint, dan verifikasi yang disyaratkan.

---

# BAGIAN V — PETA DOKUMEN DAN INVENTARIS TEKNIS

### 19.1 Temuan source-level — peringatan disiplin LHI (16 November 2026)

Audit terhadap source `main` menemukan bahwa ketentuan README Form Blok hari ke-4/6/7 belum memiliki jalur implementasi end-to-end yang terbukti:
- Backend `apiGetDisciplineWarning` hanya mengembalikan `staff_id` dan `nama`, sedangkan `frontend/login-fast.js` memfilter `missed_days >= 9`. Kontrak response tidak cocok.
- `frontend/lhi-discipline-notifications.js` memanggil `apiGetLhiNotifications` dan `apiMarkLhiNotificationRead`; kedua action tidak tersedia pada Edge Function `ipsrs-api` aktif v114. Ini memutus jalur baca dan penandaan notifikasi dari aplikasi, meskipun record sudah tersimpan.
- Generator peringatan hari ke-4/6/7 sebenarnya tersedia pada PostgreSQL melalui `run_lhi_discipline_scheduler()` dan cron `lhi-discipline-scheduler-every-5-minutes` (aktif setiap 5 menit). Pemeriksaan database produksi menemukan 521 baris notifikasi `DAY_4` dari 18 event. Jadi event Peringatan 1 sudah dibuat dan disimpan.
- Login gate menggunakan `reports.tanggal` pada tujuh tanggal sebelumnya, sedangkan README menetapkan dasar hitung `created_at` dalam WIB dan status LHI yang sah.

**Status:** source-level integration gap CONFIRMED; penyebab lengkap pada runtime produksi NOT FULLY VERIFIED. Pencatatan ini adalah gap proyek, bukan otorisasi implementasi. Tindakan: (1) backend API inbox/read sudah ditambahkan pada branch PR #77 dengan filter ketat `recipient_staff_id` dan read idempotent; (2) frontend transport sudah diarahkan ke dua action tersebut; (3) cache key `app.js` diperbarui; (4) verifikasi build/browser dan review keamanan tetap wajib; (5) deploy production belum dilakukan. Audit lebih lanjut atas konsistensi status kepegawaian vs status akses dan kontrak login gate tetap diperlukan. Perbaikan tambahan pada branch: `apiGetStaffMonitoring` kini menghitung streak dari `created_at` WIB dan menghormati `lhi_discipline_reset_at`, agar angka monitoring tidak membawa hitungan sebelum pemulihan; status bulan/rekap berbasis tanggal kejadian tetap dipisahkan dari streak kepatuhan.

Bukti source snapshot: backend blob `2409a55950cf822423eaa59f2eac7a8a7f65e01f`; frontend login warning blob `91c60d8faeb9350c48c9f939f84714b07ecf77d0`; frontend notification blob `da042578e00afeedda8c6d86187cf1c83bc7d287`; app login path blob `fc061c5a8a1d28f8e776006c180685091cf1ae58`.

## 20. Struktur dokumen proyek

Struktur dokumentasi yang ditemukan pada branch kerja saat audit 15 November 2026 (seluruh path di bawah telah diperiksa keberadaannya; roadmap disimpan dengan nama `PROFESSIONALIZATION_ROADMAP.md`, bukan file duplikat bernomor 06):

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
    PROFESSIONALIZATION_ROADMAP.md      (roadmap pengembangan; bukan status implementasi)
    07_AS_BUILT_AND_OPERATIONS.md
    08_MODULE_CATALOG.md
    09_SECURITY_ASSURANCE_PLAN.md
    10_API_DATABASE_INVENTORY.md
    11_PRODUCTION_READINESS_AUDIT.md
    12_MIGRATION_RECONCILIATION_MANIFEST.md
```

Catatan kelengkapan: visi dan tujuan produk saat ini terintegrasi di `00_MASTER_PROJECT.md`; belum ada file Business Case terpisah pada inventaris ini. Jika manajemen memerlukan business case formal, dokumen tersebut harus disusun dengan manfaat terukur, alternatif, biaya/risiko, dan persetujuan, bukan dianggap sudah tersedia hanya karena visi dan tujuan telah ditulis.

Daftar ini adalah inventaris file pada snapshot branch kerja, bukan pernyataan bahwa seluruh dokumen telah disetujui atau seluruh isinya sudah lengkap. Keberadaan file tidak sama dengan persetujuan, implementasi, atau sertifikasi. Nomor 06 tidak digunakan sebagai file placeholder; roadmap tetap memakai nama `PROFESSIONALIZATION_ROADMAP.md`. Hindari membuat dokumen duplikat yang mengulang kewenangan Project Control Book.

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

**Temuan parity runtime:** Supabase memiliki 8 Edge Functions ACTIVE, sementara source `main` pada snapshot audit hanya melacak 5. Pada 16 November, PR #76 juga membawa source ketiga function tersebut: `lhi-recovery-action` dan `lhi-recovery-exchange` dicocokkan exact dengan source runtime; `lhi-block-status` ditingkatkan pada branch untuk membaca kewajiban snapshot yang masih pending dan petugas yang masih AKTIF. Perubahan branch ini belum merge/deploy; source `main` tetap belum menjadi representasi runtime yang lengkap.

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
- [Katalog Modul](08_MODULE_CATALOG.md) — inventaris modul dinamis, status, batas tanggung jawab, dan template penambahan modul.
- [Requirements Specification](02_REQUIREMENTS_SPECIFICATION.md) — baseline kebutuhan fungsional/nonfungsional dan traceability.
- [Software Architecture](03_SOFTWARE_ARCHITECTURE.md) — arsitektur existing/target, trust boundary, data flow, dan ADR.
- [Quality Assurance Plan](05_QUALITY_ASSURANCE_PLAN.md) — strategi test, UAT, regression, performance, dan release gate.
- [Security Assurance Plan](09_SECURITY_ASSURANCE_PLAN.md) — threat model, security test, findings, dan security release gate.
- [Project Charter](01_PROJECT_CHARTER.md) — mandat, peran, ruang lingkup, dan persetujuan proyek.
- [Software Design Specification](04_SOFTWARE_DESIGN_SPECIFICATION.md) — template desain rinci per modul.
- [As-Built and Operations](07_AS_BUILT_AND_OPERATIONS.md) — inventaris existing, health check, backup, incident, dan runbook.
- [API dan Database Inventory](10_API_DATABASE_INVENTORY.md) — daftar action backend, objek database, migration snapshot, dan pekerjaan verifikasi.
- [Production Readiness Audit](11_PRODUCTION_READINESS_AUDIT.md) — hasil audit read-only database, RLS, grants, advisors, dan blocker migration parity.
- [Migration Reconciliation Manifest](12_MIGRATION_RECONCILIATION_MANIFEST.md) — daftar 75 remote migration dan 35 file lokal untuk rekonsiliasi sebelum perubahan database.
- [Professionalization Roadmap](PROFESSIONALIZATION_ROADMAP.md) — rencana tahapan, bukan dokumen induk

---


---

# BAGIAN VI — PENGUATAN STANDAR TEKNIS DAN OPERASIONAL

## 23. Threat modeling dan pengelolaan risiko keamanan

Setiap modul baru dan perubahan material pada autentikasi, otorisasi, API, database, integrasi, atau aliran data wajib melalui threat modeling sebelum release.

Threat model sekurang-kurangnya mencatat:
1. Aset yang dilindungi: akun, sesi/token, laporan, data petugas, master data, audit log, konfigurasi, secret, dan layanan.
2. Aktor dan tingkat kepercayaan: petugas, admin, Kepala IPSRS, engineer, service account, pihak eksternal, dan penyerang.
3. Entry point dan attack surface: halaman, endpoint, upload, callback, job, integrasi, pipeline, dan akses database.
4. Data flow dan trust boundary antar browser, frontend, API, database, dan platform.
5. Ancaman seperti spoofing, tampering, repudiation, information disclosure, denial of service, dan privilege escalation.
6. Mitigasi, kontrol yang diuji, residual risk, pemilik risiko, dan persetujuan penerimaan risiko.

Threat model menggunakan metode yang konsisten (misalnya STRIDE) dan diperbarui jika arsitektur, aset, atau pola ancaman berubah. Temuan keamanan harus ditautkan ke issue, test, dan release yang memperbaikinya.

## 24. Target layanan, SLI/SLO, dan kapasitas

Sebelum menetapkan SLA eksternal, proyek harus menyusun Service Level Indicator (SLI) dan Service Level Objective (SLO) berdasarkan baseline pengukuran.

SLI minimum yang dievaluasi:
- availability frontend, API, dan database;
- persentase request berhasil dan error rate;
- latency API (p50, p95, p99) untuk operasi utama;
- waktu pemuatan halaman kritis;
- keberhasilan proses simpan laporan;
- keterlambatan/ketepatan sinkronisasi data;
- usia backup terakhir dan keberhasilan backup;
- waktu deteksi dan pemulihan insiden.

Setiap SLO wajib mencantumkan definisi, rumus, sumber metrik, periode pengukuran, target, pengecualian, owner, dan tindakan jika target gagal. Target angka tidak boleh ditetapkan tanpa baseline dan persetujuan pemilik layanan.

Uji kapasitas mencakup load, stress, spike, soak, concurrency, dan batas resource yang relevan. Skenario harus mewakili jumlah petugas, pola input serentak, beban dashboard/rekap, ukuran data historis, serta jam sibuk. Pengujian beban produksi memerlukan izin, jadwal, batas beban, monitoring, dan stop condition.

## 25. Incident management dan problem management

Insiden operasional dan keamanan wajib memiliki prosedur yang dapat dijalankan.

Setiap insiden dicatat dengan:
- ID, waktu mulai/terdeteksi, pelapor, layanan/modul terdampak;
- klasifikasi severity dan dampak pengguna/data;
- incident commander/owner dan pihak yang dihubungi;
- langkah containment, mitigasi, pemulihan, dan validasi;
- komunikasi status dan estimasi pembaruan;
- bukti log, timeline, keputusan, serta perubahan darurat;
- root cause analysis dan tindakan pencegahan.

Severity sekurang-kurangnya Critical, High, Medium, dan Low dengan definisi dampak dan jalur eskalasi yang disetujui. Insiden Critical/High memerlukan post-incident review tanpa menyalahkan individu, daftar corrective/preventive action, owner, target, dan verifikasi penutupan. Perubahan darurat tetap harus direkonsiliasi ke change control setelah layanan stabil.

## 26. Disaster recovery, backup, dan business continuity

Rencana pemulihan harus menetapkan:
1. RPO dan RTO per layanan/data berdasarkan dampak bisnis dan persetujuan pemilik.
2. Jadwal backup, metode, enkripsi, lokasi, retensi, dan akses backup.
3. Pemisahan backup database dari repository source dan artefak deployment.
4. Perlindungan terhadap penghapusan, korupsi, ransomware, dan kompromi kredensial.
5. Urutan pemulihan frontend, backend, database, konfigurasi, dan secret.
6. Prosedur failover/rollback dan komunikasi kepada pengguna.
7. Restore drill berkala dengan hasil, durasi, data loss aktual, dan corrective action.

Backup dianggap dapat diandalkan hanya jika integritasnya diperiksa dan restore berhasil dibuktikan. Checkpoint GitHub bukan backup database. Nilai RPO/RTO dan retensi belum berlaku sampai disahkan dalam dokumen operasi.

## 27. API, database, dan tata kelola data

### 27.1 API contract
Inventaris API wajib memuat endpoint, method, versi, autentikasi, permission, schema request/response, error code, pagination/filter/sort, timeout, retry, idempotency, rate limit, dan konsumen. OpenAPI digunakan untuk kontrak HTTP yang sesuai. Perubahan breaking harus melalui versioning atau strategi kompatibilitas yang disetujui.

### 27.2 Database contract
Dokumentasi database wajib memuat ERD, data dictionary, nama tabel/kolom, tipe, primary/foreign key, constraint, index, trigger/function, RLS/policy, privilege, owner data, klasifikasi, retensi, dan relasi ke modul/API.

### 27.3 Migration policy
Setiap migration harus:
- memiliki tujuan dan issue/change reference;
- diuji terhadap schema/data representatif;
- aman untuk data historis;
- mempertimbangkan lock, durasi, dan backward compatibility;
- memiliki backup/checkpoint yang sesuai;
- memiliki strategi rollback atau forward-fix yang terdokumentasi;
- diverifikasi setelah diterapkan.

### 27.4 Data governance
Setiap domain data memiliki data owner, definisi, sumber kebenaran, aturan validasi, kualitas, klasifikasi, retensi, dan hak akses. Data duplikat, tidak lengkap, atau tidak konsisten memiliki mekanisme deteksi dan koreksi yang dapat diaudit. Data pribadi dikelola sesuai peraturan yang berlaku dan prinsip minimisasi.

## 28. Requirement traceability, QA, UAT, dan aksesibilitas

Setiap requirement memiliki ID unik dan hubungan yang dapat ditelusuri:
Requirement → acceptance criteria → design/ADR → module/API/schema → code change/commit → test case/result → release → production verification.

Matriks traceability wajib menunjukkan requirement tanpa implementasi, implementasi tanpa requirement, test yang belum ada, test gagal, serta perubahan yang belum diverifikasi.

### 28.1 Traceability khusus Form Blok Aplikasi LHI

| Requirement | Rujukan aturan rinci | Cakupan acceptance yang wajib dibuktikan | Status bukti pada snapshot |
|---|---|---|---|
| LHI-FR-013 | `README-FORM-BLOK-APLIKASI.md` Bagian 1–12 | Penghitungan hari berdasarkan `created_at` WIB dan status kepegawaian; peringatan hari ke-4/6/7; blokir individual hari ke-8; masa tunggu hari ke-9; blokir global hari ke-10; Reset dan autentikasi KA IPSRS; pemulihan terpadu; kelonggaran 120 jam; snapshot, pengecualian NONAKTIF, pembatalan LHI, audit append-only, dan kegagalan/percobaan ulang yang aman | README menetapkan spesifikasi approved for implementation; PR #76 full regression gate PASS pada SHA `eafb67e`; production belum tersertifikasi |
| LHI-FR-013 / test | `REGRESSION_MATRIX.yaml`; `tests/sql/lhi-grace-acceptance.sql`; `tests/e2e/app-smoke.spec.mjs` | Test unit/integration, API/security negative, E2E, concurrency/idempotency, dan recovery sesuai skenario penerimaan | SQL acceptance dan browser smoke telah berjalan di PR #76; PostgreSQL PASS dan browser 20/20 PASS. `REGRESSION_MATRIX.yaml` tetap belum memiliki kelompok Form Blok/Recovery dan tidak diubah karena protected file |

**Batas kewenangan dan kontrol:** README Form Blok menyatakan spesifikasi dan kriteria penerimaan telah disetujui untuk implementasi. Persetujuan spesifikasi tersebut tidak otomatis memberi persetujuan deployment produksi. PR #76 telah lulus full automated regression gate, tetapi masih OPEN/DRAFT dan migration belum diterapkan. `LHI-FR-013` adalah identitas requirement formal; status implementasi branch, schema production, dan runtime harus tetap dicatat terpisah.

**Kendali register terkunci:** `REGRESSION_MATRIX.yaml` termasuk protected file di bawah modul `CONTROL_BOOK` yang berstatus LOCKED pada `LOCK_REGISTER.yaml`. Master Project dan SRS ini hanya mencatat gap coverage dan kebutuhan test; keduanya **tidak mengubah** regression matrix, lock, atau baseline. Penambahan test ke matrix memerlukan prosedur unlock/change control yang berlaku dan persetujuan eksplisit sesuai Project Control Book.

Usulan kelompok skenario untuk dianalisis sebelum dimasukkan ke regression matrix:
1. Perhitungan kalender/WIB, aktivasi ulang pegawai, dan pembatalan LHI.
2. Peringatan tahap 4/6/7 serta deduplikasi notifikasi.
3. Blokir individual hari 8, hari 9, dan trigger global hari 10 oleh satu petugas.
4. Form global, Reset salah/benar, role KA IPSRS, dan akses terbatas.
5. Pemulihan terpadu, snapshot, grace 120 jam, pengecualian NONAKTIF, serta reaktivasi.
6. Append-only audit, kegagalan parsial, idempotency, dan retry setelah respons hilang.
7. Pengujian negatif API/RLS, session, bypass UI, dan isolasi role.

Daftar di atas adalah cakupan penerimaan. Sebagian cakupan telah diimplementasikan pada SQL acceptance test dan browser smoke test PR #76 dengan hasil PASS; cakupan security, concurrency, RLS, UAT, restore drill, dan regression formal pada `REGRESSION_MATRIX.yaml` tetap harus dilengkapi/ditetapkan sesuai rencana QA.

Rencana QA wajib menentukan:
- unit, integration, contract, end-to-end, regression, security, performance, compatibility, dan recovery test;
- cakupan browser/perangkat yang didukung;
- test data, environment, setup, teardown, dan data privacy;
- kriteria lulus/gagal dan bukti hasil;
- cakupan risiko dan test wajib sebelum release.

UAT dilakukan oleh perwakilan pengguna/pemilik proses dengan skenario operasional, hasil, daftar masalah, persetujuan, dan batasan penerimaan. Training dan panduan pengguna disiapkan untuk perubahan alur yang berdampak.

Antarmuka menargetkan WCAG 2.2 Level AA sejauh relevan untuk aplikasi web, dengan pengujian keyboard, fokus, label, kontras, error identification, zoom/responsiveness, dan screen reader untuk alur utama. Pengecualian harus dicatat.

## 29. Secure SDLC, CI/CD, dan pengelolaan dependensi

Pipeline wajib menerapkan least privilege dan pemisahan environment. Quality gate ditentukan berdasarkan risiko, mencakup:
- format/lint/type/syntax dan unit/integration/E2E test;
- SAST dan secret scanning;
- SCA/dependency vulnerability serta license review;
- pemeriksaan konfigurasi dan IaC bila digunakan;
- artifact integrity dan provenance;
- SBOM untuk release yang relevan;
- branch protection, pull request review, dan approval;
- deployment hanya dari commit yang lulus gate;
- verifikasi hasil deployment dan rollback readiness.

Dependency wajib memiliki owner, versi yang dikendalikan, pemantauan kerentanan, proses upgrade, dan penanganan komponen usang. Lisensi pihak ketiga diperiksa sebelum penggunaan. Secret tidak boleh ditanam pada source, artifact publik, frontend, atau log. Development, staging, dan production dipisahkan sesuai kemampuan platform dan risiko.

## 30. Production Readiness Review dan operational acceptance

Sebelum release besar atau peluncuran modul baru, lakukan Production Readiness Review (PRR) yang mencakup:
- kebutuhan dan acceptance criteria disetujui;
- arsitektur, threat model, dan data/API contract diperbarui;
- test wajib lulus dan bukti tersedia;
- tidak ada temuan keamanan Critical/High terbuka tanpa risk acceptance resmi;
- monitoring, alert, dashboard, owner, dan runbook tersedia;
- backup/restore dan rollback diuji sesuai risiko;
- kapasitas dan SLO dievaluasi;
- support, komunikasi, training, dan UAT siap;
- dependency dan lisensi diperiksa;
- release SHA, artifact, environment, serta verifikasi pasca-deployment tercatat.

PRR menghasilkan keputusan GO, CONDITIONAL GO, atau NO-GO dengan alasan, persetujuan, risiko residual, owner, dan batas waktu. Deployment gate teknis tidak menggantikan persetujuan bisnis/operasional.

## 31. Pengelolaan risiko, vendor, biaya, dan siklus akhir layanan

### 31.1 Risk register
Setiap risiko mencatat likelihood, impact, skor inherent, kontrol/mitigasi, residual risk, owner, due date, trigger, contingency, dan status. Risiko tinggi memerlukan persetujuan pemilik risiko.

### 31.2 Vendor dan layanan eksternal
Untuk layanan pihak ketiga, catat fungsi, data yang diproses, lokasi/ketentuan pemrosesan, SLA/status support, dependency, biaya, batas penggunaan, mekanisme ekspor data, backup/portability, notifikasi insiden, dan exit plan. Perubahan ketentuan vendor harus dievaluasi dampaknya.

### 31.3 Biaya dan kapasitas
Biaya hosting, database, bandwidth, observability, backup, domain, dan layanan eksternal dipantau. Buat proyeksi pertumbuhan berdasarkan jumlah pengguna, volume laporan, ukuran file/data, trafik, dan retensi. Optimasi tidak boleh mengorbankan keamanan, integritas, atau kemampuan pemulihan.

### 31.4 Technical debt dan standar kode
Technical debt dicatat dengan dampak, risiko, owner, prioritas, dan rencana penyelesaian. Standar kode, review minimal oleh pihak selain pembuat untuk perubahan berisiko, serta aturan penanganan linting/test exception ditetapkan. Pengecualian harus memiliki alasan dan masa berlaku.

### 31.5 Feature flag dan deprecation
Feature flag dapat digunakan untuk peluncuran bertahap, pemulihan cepat, dan pembatasan fitur; setiap flag harus memiliki owner, kondisi default yang aman, tanggal evaluasi, dan rencana penghapusan. Deprecation/retirement harus memiliki komunikasi, migrasi data, masa transisi, penghapusan akses/secret, dan bukti bahwa dependensi tidak lagi digunakan.

### 31.6 Knowledge transfer dan akses
Perubahan owner/pengembang harus disertai transfer dokumentasi dan prosedur. Akun, token, key, akses vendor, dan service account yang tidak lagi diperlukan harus dicabut sesuai proses offboarding dan audit. Tidak boleh ada ketergantungan operasional pada satu individu tanpa dokumentasi pemulihan.

---


## Riwayat revisi

| Tanggal | Perubahan |
|---|---|
| 2026-11-06 | Peta arsitektur dan inventaris awal repository |
| 2026-11-15 | Penyempurnaan menjadi dokumen induk proyek yang mencakup mandat, visi, tujuan, ruang lingkup, kebutuhan, arsitektur, standar, tata kelola, delivery, risiko, kriteria penerimaan, dan peta dokumen |
| 2026-11-15 | Audit tahap 1: menambahkan identitas snapshot branch/PR, matriks status teknis, dan aturan interpretasi status agar temuan dokumentasi tidak disalahartikan sebagai sertifikasi produksi |
| 2026-11-15 | Audit tahap 3: menambahkan traceability LHI-FR-013 ke README Form Blok, mengidentifikasi gap regression coverage, dan mempertahankan lock CONTROL_BOOK tanpa mengubah register |
| 2026-11-15 | Audit tahap 4: menambahkan crosswalk FR-01–FR-14 ke ID formal LHI-FR-001–017 agar Master Project dan SRS memiliki satu jalur traceability |
| 2026-11-15 | Audit tahap 5: menautkan setiap requirement formal ke ID modul/domain pada Katalog Modul untuk memperjelas ownership dan cakupan lintas modul |
| 2026-11-15 | Audit tahap 6: menyelaraskan fase P0–P6 Master Project dengan tahap 0–8 Roadmap agar tidak terbaca sebagai dua urutan delivery yang bertentangan |
| 2026-11-15 | Audit tahap 7: merekonsiliasi daftar persetujuan Charter termasuk Sponsor/Manajemen dengan tabel persetujuan dokumen Charter |
| 2026-11-16 | Recheck Form Blok: mencatat PR #76 full regression gate PASS (static, Deno, PostgreSQL, browser 20/20), membedakan status branch dari production, dan mencatat schema/recovery production masih belum cutover serta grace aktif sampai 19 November 2026 pukul 18.17 WIB |

**Pernyataan status:** Master Project ini menetapkan baseline arah dan kerangka proyek. Dokumen ini tidak menyatakan semua fitur telah selesai, seluruh test lulus, semua modul telah modular, backup dapat dipulihkan, atau produksi telah terverifikasi. Setiap status teknis harus didukung bukti dari source, test, workflow, dan runtime.
