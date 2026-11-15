# REQUIREMENTS SPECIFICATION — APLIKASI LHI

## 1. Tujuan, status, dan kewenangan

Dokumen ini menjadi baseline kebutuhan tingkat sistem yang harus dikonfirmasi Product Owner. Kebutuhan di bawah ini adalah katalog awal hasil dokumentasi proyek; bukan bukti bahwa seluruh fungsi telah diimplementasikan atau diuji. Rincian fitur wajib memiliki spesifikasi modul dan acceptance criteria yang disetujui.

Project Control Book tetap mengatur perubahan, lock, baseline, regression, deployment, migrasi, dan rollback. Perubahan kebutuhan wajib melalui change control.

## 2. Pemangku kepentingan dan aktor

- Petugas IPSRS: membuat dan melihat laporan sesuai hak akses.
- Admin aplikasi: mengelola akun/master data sesuai permission.
- Kepala IPSRS/Product Owner: memantau, merekap, menetapkan kebutuhan, dan menerima hasil.
- Engineer/operator teknis: mengelola source, platform, deployment, dan pemeliharaan sesuai akses.
- Sistem eksternal/service account: integrasi yang disetujui dan dibatasi kontraknya.

Daftar aktor dan role final harus direkonsiliasi dengan implementasi backend, database, dan kebijakan organisasi.

## 3. Prinsip kebutuhan

- Setiap requirement memiliki ID unik, rationale, priority, owner, acceptance criteria, dan test reference.
- Kebutuhan baru dapat menambah modul kapan saja melalui persetujuan dan change control.
- Katalog modul saat ini bukan daftar final.
- Tidak semua modul harus dikembangkan sekaligus.
- Kebutuhan tidak boleh bertentangan dengan perilaku LOCKED tanpa prosedur unlock resmi.
- Requirement harus dibedakan dari solusi teknis agar alternatif desain dapat dievaluasi.

## 4. Kebutuhan fungsional tingkat sistem

| ID | Requirement | Prioritas awal | Acceptance criteria tingkat sistem | Owner requirement (belum disahkan) |
|---|---|---|---|---|
| LHI-FR-001 | Sistem menyediakan autentikasi pengguna | Critical | Identitas valid dapat masuk; identitas tidak valid ditolak; event relevan tercatat | Product Owner (menunggu pengesahan) |
| LHI-FR-002 | Sistem menegakkan otorisasi pada server | Critical | Operasi tanpa permission ditolak walau UI dimanipulasi | Product Owner (menunggu pengesahan) |
| LHI-FR-003 | Petugas dapat membuat laporan harian | Critical | Data valid tersimpan sekali dan dapat dibaca kembali oleh pihak berwenang | Product Owner (menunggu pengesahan) |
| LHI-FR-004 | Pengguna dapat melihat laporan sesuai scope akses | Critical | Filter, owner, dan role tidak membuka data yang tidak berhak | Product Owner (menunggu pengesahan) |
| LHI-FR-005 | Edit laporan mengikuti aturan bisnis dan permission | High | Perubahan ditolak bila tidak berwenang dan histori tetap konsisten | Product Owner (menunggu pengesahan) |
| LHI-FR-006 | Penghapusan mengikuti kebijakan soft-delete/audit | High | Penghapusan tidak menghilangkan jejak audit dan tidak melanggar retensi | Product Owner (menunggu pengesahan) |
| LHI-FR-007 | Master area/item/kategori dapat dikelola | High | Perubahan konsisten antara UI, API, dan database | Product Owner (menunggu pengesahan) |
| LHI-FR-008 | Sistem mendeteksi item duplikat atau sangat mirip | High | Aturan pencocokan terdokumentasi; pengguna mendapat informasi sebelum membuat duplikasi | Product Owner (menunggu pengesahan) |
| LHI-FR-009 | Klasifikasi spare part/material/unit divalidasi | High | Kategori dan field wajib mengikuti aturan yang disetujui | Product Owner (menunggu pengesahan) |
| LHI-FR-010 | Dashboard menyajikan ringkasan operasional | High | Angka dapat direkonsiliasi dengan data sumber dan role | Product Owner (menunggu pengesahan) |
| LHI-FR-011 | Rekap tersedia berdasarkan periode | High | Batas periode dan hasil agregasi benar serta konsisten | Product Owner (menunggu pengesahan) |
| LHI-FR-012 | Monitoring menyajikan status sesuai definisi resmi | High | Status, waktu, dan pengecualian dihitung sesuai spesifikasi | Product Owner (menunggu pengesahan) |
| LHI-FR-013 | Form Blok Aplikasi menegakkan aturan peringatan/blokir/pemulihan | Critical | Transisi status, batas hari, pengecualian, dan recovery sesuai spesifikasi resmi | Product Owner (menunggu pengesahan) |
| LHI-FR-014 | Aktivitas penting memiliki audit trail | High | Aktor, waktu, objek, tindakan, dan hasil tercatat tanpa secret | Product Owner (menunggu pengesahan) |
| LHI-FR-015 | Pengguna dapat mengekspor laporan sesuai izin | Medium | File hanya memuat data yang boleh diakses dan formatnya tervalidasi | Product Owner (menunggu pengesahan) |
| LHI-FR-016 | PWA/cache menyajikan asset versi yang benar | High | Pembaruan versi tidak meninggalkan asset lama yang merusak fungsi | Product Owner (menunggu pengesahan) |
| LHI-FR-017 | Sistem mendukung penambahan modul baru | High | Modul dapat ditambahkan melalui kontrak, katalog, test, dan change control tanpa redesign total yang tidak perlu | Product Owner (menunggu pengesahan) |

Prioritas di atas merupakan usulan awal untuk disahkan Product Owner; bukan prioritas final yang mengizinkan perubahan produksi.

## 5. Kebutuhan nonfungsional

| ID | Area | Requirement | Cara verifikasi |
|---|---|---|---|
| LHI-NFR-001 | Security | AuthN/AuthZ server-side dan least privilege | Security negative test, RLS/API review |
| LHI-NFR-002 | Data integrity | Constraint, validasi, transaksi, dan migrasi aman | DB test dan migration review |
| LHI-NFR-003 | Privacy | Minimisasi data dan perlindungan data pribadi | Data flow/privacy review |
| LHI-NFR-004 | Availability | SLO ditetapkan dari baseline terukur | Monitoring dan SLO report |
| LHI-NFR-005 | Performance | Latency dan kapasitas diukur untuk alur kritis | Load/stress/soak test |
| LHI-NFR-006 | Reliability | Error dan partial failure ditangani aman | Failure-path/integration test |
| LHI-NFR-007 | Maintainability | Modul dan kontrak memiliki batas yang jelas | Architecture/code review |
| LHI-NFR-008 | Compatibility | Browser/perangkat didukung dinyatakan | Compatibility matrix |
| LHI-NFR-009 | Accessibility | Alur utama menargetkan WCAG 2.2 AA | Manual/automated accessibility review |
| LHI-NFR-010 | Observability | Log, metric, alert, dan owner tersedia | Monitoring/alert drill |
| LHI-NFR-011 | Recoverability | RPO/RTO dan restore diuji | Restore drill |
| LHI-NFR-012 | Auditability | Requirement, commit, test, release, dan aktor terlacak | Traceability audit |
| LHI-NFR-013 | Scalability | Kapasitas diuji pada pola penggunaan representatif | Capacity test |
| LHI-NFR-014 | Portability | Data dan konfigurasi dapat diekspor sesuai rencana exit | Export/restore test |
| LHI-NFR-015 | Data residency | Lokasi pemrosesan, vendor, subprocessor, dan transfer lintas negara terinventaris dan disetujui | Data flow, vendor/legal review |
| LHI-NFR-016 | Regulatory privacy | Kategori data, dasar pemrosesan, retensi, hak subjek data, DPIA bila diperlukan, dan incident response terdokumentasi | Privacy assessment dan evidence review |

Target angka NFR belum dianggap disahkan sampai baseline, rumus, periode, owner, dan approval tersedia.

### 5.1 Batas data pribadi dan data klinis

Aplikasi LHI ditujukan untuk laporan pemeliharaan sarana IPSRS. Secara default, form dan laporan tidak boleh digunakan untuk mencatat nama pasien, nomor rekam medis, diagnosis, foto pasien, atau informasi klinis. Bila ada kebutuhan bisnis yang sah untuk memproses data tersebut, scope, dasar hukum, klasifikasi, akses, retensi, DPIA, dan persetujuan harus ditetapkan terlebih dahulu. Permenkes 24/2022 hanya diterapkan pada fungsi yang benar-benar memproses/menyelenggarakan rekam medis; jangan mengklasifikasikan seluruh LHI sebagai rekam medis tanpa analisis data.

## 6. Business rules dan spesifikasi modul

Aturan rinci berikut tidak boleh didefinisikan ulang secara informal di dokumen ini:
- aturan Form Blok Aplikasi LHI;
- aturan hari kalender, grace period, pengecualian, dan recovery;
- role/permission dan edit/delete;
- definisi status laporan dan monitoring;
- duplicate detection item;
- klasifikasi spare part/material/unit;
- periode dan formula rekap.

Masing-masing harus mengacu pada spesifikasi resmi modul dan diuji dengan positive serta negative test. Bila ada konflik antar dokumen, hentikan perubahan terkait dan selesaikan melalui change control.

### 6.1 Referensi rinci LHI-FR-013 — Form Blok Aplikasi

Requirement `LHI-FR-013` merujuk pada `README-FORM-BLOK-APLIKASI.md` Bagian 1–12 untuk rincian aturan penghitungan, tahapan peringatan, notifikasi, blokir individual/global, Reset, kewenangan KA IPSRS, grace period 120 jam, snapshot kewajiban, pengecualian status NONAKTIF, audit, skenario penerimaan, dan tata kelola implementasi.

README tersebut saat ini menyatakan dirinya sebagai dokumen konsep/acuan kebutuhan dan belum menjadi persetujuan perubahan script, database, konfigurasi, atau deployment. Dengan demikian:
- Aturan pada README adalah bahan spesifikasi rinci untuk dikonfirmasi Product Owner, bukan persetujuan otomatis untuk implementasi.
- Prioritas Critical pada tabel LHI-FR-013 adalah prioritas usulan awal, bukan izin perubahan produksi.
- Detail bisnis tidak boleh disalin sebagai aturan alternatif ke dokumen lain; perubahan/penyelesaian konflik harus melalui change control.
- Implementasi, status runtime, dan kesiapan recovery harus dinilai terpisah dari kelengkapan dokumen.

Cakupan penerimaan FR-013 sekurang-kurangnya harus membuktikan: (1) hitung kalender/WIB dan status kepegawaian; (2) notifikasi hari ke-4/6/7; (3) blokir individual hari ke-8, masa tunggu hari ke-9, dan trigger global hari ke-10; (4) Reset serta autentikasi dan pembatasan KA IPSRS; (5) pemulihan terpadu dan grace period 120 jam; (6) snapshot, pengecualian NONAKTIF, reaktivasi, dan pembatalan LHI; (7) audit append-only; serta (8) failure atomicity, idempotency, dan retry aman.

**Gap pengujian:** snapshot `REGRESSION_MATRIX.yaml` yang diperiksa belum memiliki kelompok test Form Blok/Recovery. File tersebut tercatat sebagai protected file di bawah CONTROL_BOOK LOCKED. Penambahan skenario ke matrix harus mengikuti prosedur unlock/change control dan persetujuan yang berlaku; dokumen SRS ini tidak mengubah register tersebut.

## 7. Requirement traceability

Crosswalk antara kapabilitas tingkat proyek `FR-01`–`FR-14` dan ID formal `LHI-FR-001`–`LHI-FR-017` dipelihara pada `MASTER_PROJECT_LHI/00_MASTER_PROJECT.md` Bagian 6.1.1. SRS ini tetap menjadi daftar ID requirement formal; crosswalk tidak membuat ID baru dan tidak menggantikan acceptance criteria rinci.

Setiap requirement wajib ditautkan pada:
- stakeholder dan kebutuhan bisnis;
- use case/acceptance criteria;
- desain, API, data model, dan ADR;
- modul dan source path;
- test case dan hasil;
- issue/PR, commit SHA, workflow run;
- release dan production verification.

Requirement tanpa owner/acceptance criteria tidak siap untuk implementasi. Kode tanpa requirement atau alasan teknis harus ditinjau sebagai potensi scope creep/technical debt.

## 8. Prioritas dan perubahan

Gunakan Critical/High/Medium/Low dengan dampak operasional dan keamanan. Prioritas ditetapkan Product Owner setelah analisis effort, dependency, risiko, dan kapasitas. Penambahan requirement/modul tidak harus menunggu seluruh backlog selesai, tetapi harus melewati change control.

## 9. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Baseline awal kebutuhan sistem LHI |
| 15 November 2026 | Memperjelas referensi rinci LHI-FR-013, status persetujuan README Form Blok, dan gap regression coverage tanpa mengubah protected control registers |
| 15 November 2026 | Menautkan SRS ke crosswalk kapabilitas Master Project agar ID requirement formal konsisten |
| 15 November 2026 | Menambahkan kolom owner requirement pada seluruh 17 requirement formal; owner ditandai menunggu pengesahan agar tidak ada penanggung jawab yang diasumsikan final |
