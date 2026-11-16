# KATALOG MODUL APLIKASI LHI

## 1. Tujuan dokumen

Dokumen ini mencatat inventaris modul Aplikasi LHI, batas tanggung jawab tingkat tinggi, status siklus hidup, dan aturan penambahan modul. Katalog ini bersifat dinamis: daftar modul yang tercantum adalah snapshot inventaris, bukan daftar final atau batas maksimum pengembangan Aplikasi LHI.

Master Project LHI menetapkan arah dan kebijakan proyek. `PROJECT_CONTROL.md`, `LOCK_REGISTER.yaml`, `BASELINE_REGISTER.yaml`, dan `REGRESSION_MATRIX.yaml` tetap menjadi sumber kewenangan untuk kontrol perubahan, status lock, baseline, dan pengujian. Katalog ini tidak mengubah status atau kewenangan register tersebut.

## 2. Aturan status dan sumber kebenaran

- Status lock dan file/perilaku yang dilindungi wajib dibaca dari `LOCK_REGISTER.yaml`.
- Status baseline wajib dibaca dari `BASELINE_REGISTER.yaml`.
- Status pengujian wajib dibaca dari `REGRESSION_MATRIX.yaml` dan bukti workflow yang relevan.
- Katalog tidak boleh mengubah status menjadi PASS, LOCKED, atau selesai tanpa bukti dan prosedur resmi.
- Status siklus hidup modul (EXISTING, IN DEVELOPMENT, PLANNED, PROPOSED, DEPRECATED, RETIRED) berbeda dari status lock (LOCKED, STABLE_CANDIDATE, BLOCKED).
- Satu modul dapat EXISTING sekaligus STABLE_CANDIDATE; keduanya menjawab hal berbeda.

## 3. Inventaris modul pada snapshot register

Snapshot berikut diturunkan dari `LOCK_REGISTER.yaml` yang terakhir diperiksa pada 4 Oktober 2026. Ini bukan verifikasi runtime pada tanggal pembacaan katalog.

| ID | Modul/domain | Status lock pada register | Ruang tanggung jawab ringkas |
|---|---|---|---|
| DASH | Dashboard | LOCKED | Ringkasan operasional, kartu, tabel, dan drill-down dashboard |
| KAT | Sistem Kategori | STABLE_CANDIDATE | Pengelolaan dan pemilihan kategori |
| KESLING | KESLING area/master-data behavior | STABLE_CANDIDATE | Konsistensi area dan urutan prioritas KESLING |
| AUTH | Login / Session / Access Control | STABLE_CANDIDATE | Login, sesi, identitas, role, dan permission |
| REPORT | Daftar Laporan / Input / Report Lifecycle | STABLE_CANDIDATE | Input, daftar, edit, filter, dan siklus hidup laporan |
| MASTER | Master Area / Item / Category data | STABLE_CANDIDATE | Master area, item, kategori, dan rekonsiliasi data |
| SPARE_MATERIAL_UNIT | Spare Part / Material / Unit | STABLE_CANDIDATE | Klasifikasi dan pencatatan spare part, material, serta unit |
| PWA | PWA / Service Worker / Cache | STABLE_CANDIDATE | Instalasi PWA, versi asset, dan pembaruan cache |
| PERFORMANCE | Performance / Loading | STABLE_CANDIDATE | Kinerja startup, dashboard, laporan, dan monitoring |
| SECURITY | Backend Authorization / RLS / Audit Safety | STABLE_CANDIDATE | Otorisasi backend, RLS, audit, dan keamanan data |
| CONTROL_BOOK | Project Control Book / Control Registers | LOCKED | Tata kelola perubahan, lock, baseline, regression, dan protokol |
| REKAP | Rekap Bulanan / Month Picker | STABLE_CANDIDATE | Rekap laporan bulanan dan pemilihan periode |
| MONITORING | Monitoring Staf / Page Online | STABLE_CANDIDATE | Status petugas dan aktivitas online |
| LHI_DISCIPLINE_RECOVERY | Form Blok Aplikasi & Recovery LHI | NOT LISTED IN LOCK_REGISTER SNAPSHOT | Aturan disiplin LHI, blokir individual/global, snapshot kewajiban, grace period, dan pemulihan administratif; implementasi harus mengikuti README-FORM-BLOK-APLIKASI.md |
| AUDIT_LOG | Audit Log / History | STABLE_CANDIDATE | Histori perubahan dan audit aktivitas |
| CLOUDFLARE | Cloudflare Runtime / Worker / Assets | STABLE_CANDIDATE | Penyajian frontend dan runtime Worker |
| CICD | CI/CD / Audit Gate | STABLE_CANDIDATE | Audit otomatis, regression gate, dan deployment gate |

Catatan:
1. Status di atas adalah status lock dari snapshot register, bukan penilaian kelengkapan fitur.
2. Modul STABLE_CANDIDATE belum otomatis berarti seluruh acceptance criteria, regression, dan verifikasi produksi telah lulus.
3. Status DASH dan CONTROL_BOOK yang LOCKED wajib dipertahankan sesuai prosedur kontrol.
4. Domain baru dapat ditambahkan melalui proses pada Bab 4, 6, dan 8 Master Project.
5. Domain Form Blok/Recovery dicantumkan sebagai domain kebutuhan karena memiliki requirement tersendiri, tetapi tidak tercatat sebagai modul terpisah pada snapshot `LOCK_REGISTER.yaml` tanggal 4 Oktober 2026. Label `NOT LISTED IN LOCK_REGISTER SNAPSHOT` bukan status lock baru dan tidak memberikan izin perubahan. README Form Blok menyatakan spesifikasi/kriteria penerimaan disetujui untuk implementasi. Branch PR #76 telah lulus full automated regression gate pada 16 November 2026, tetapi PR masih OPEN/DRAFT dan belum diterapkan ke production. Runtime production masih menahan `open_lhi_global_grace_v2` dengan `SAFE_CUTOVER_REQUIRED`; status domain ini adalah IN DEVELOPMENT / BRANCH TEST PASS / PRODUCTION NOT CERTIFIED. Status lock formal tetap mengikuti `LOCK_REGISTER.yaml` dan change control.

## 4. Katalog modul baru

Modul yang belum ada pada inventaris saat ini dapat ditambahkan. Contoh domain masa depan yang dapat dipertimbangkan berdasarkan kebutuhan dan persetujuan Product Owner antara lain:
- pengelolaan jadwal dan preventive maintenance;
- work order dan penugasan pekerjaan;
- inventaris aset/peralatan IPSRS;
- pemeliharaan berkala dan riwayat peralatan;
- stok dan permintaan spare part/material;
- SLA pekerjaan dan eskalasi;
- pengelolaan vendor/kontrak;
- analitik dan laporan manajemen;
- notifikasi dan komunikasi operasional;
- integrasi SIMRS atau sistem rumah sakit lain.

Daftar contoh tersebut **bukan komitmen pengembangan dan bukan persetujuan scope**. Modul hanya masuk ke roadmap setelah kebutuhan, manfaat, pemilik proses, risiko, dependensi, dan prioritas disetujui.

## 5. Persyaratan minimum setiap modul

Setiap modul baru atau perubahan besar pada modul existing wajib memiliki:

1. ID unik, nama, tujuan bisnis, dan deskripsi.
2. Product Owner/pemilik proses serta technical owner.
3. Ruang lingkup termasuk dan tidak termasuk.
4. Daftar aktor, role, permission, dan matriks akses.
5. Use case dan alur utama/alternatif/error.
6. Data yang dikelola, data owner, klasifikasi, retensi, dan sumber kebenaran.
7. UI/page/component dan batas tanggung jawab frontend.
8. API/service/function, kontrak request/response, dan error handling.
9. Tabel, view, function, policy RLS, constraint, dan migration bila relevan.
10. Dependensi ke modul lain, shared component, event, cache, dan side effect.
11. Acceptance criteria yang dapat diuji.
12. Unit, integration, contract, E2E, security, dan regression test sesuai risiko.
13. Monitoring, log, alert, dan operational owner.
14. Dokumentasi pengguna, teknis, dan runbook.
15. Rencana deployment, rollback/recovery, dan verifikasi produksi.
16. Status siklus hidup dan bukti persetujuan.

## 6. Template pencatatan modul baru

Gunakan template berikut ketika modul disetujui untuk dianalisis:

| Atribut | Isi |
|---|---|
| ID modul | Diisi setelah disetujui |
| Nama modul | Nama yang unik dan jelas |
| Status siklus hidup | PROPOSED / PLANNED / IN DEVELOPMENT / EXISTING / DEPRECATED / RETIRED |
| Pemilik proses | Penanggung jawab kebutuhan bisnis |
| Technical owner | Penanggung jawab teknis |
| Masalah/kebutuhan | Masalah operasional yang diselesaikan |
| Tujuan dan manfaat | Hasil yang ingin dicapai |
| Scope in/out | Batas tanggung jawab |
| Aktor dan permission | Pengguna dan hak akses |
| Data ownership | Data yang dikelola dan sumber kebenaran |
| API/kontrak | Endpoint, event, input/output |
| Dependensi | Modul, service, vendor, dan sistem lain |
| Acceptance criteria | Kondisi penerimaan yang terukur |
| Test dan regression | Test yang wajib lulus |
| Risiko | Risiko dan mitigasi |
| Operasional | Monitoring, alert, backup, runbook |
| Persetujuan | Referensi keputusan/change request |

## 7. Proses perubahan katalog

1. Usulan modul dicatat dan diberi status PROPOSED.
2. Product Owner memutuskan diterima, ditunda, ditolak, atau digabung.
3. Modul yang disetujui masuk PLANNED dan memiliki kebutuhan/acceptance criteria.
4. Setelah pekerjaan dimulai, status menjadi IN DEVELOPMENT.
5. Status EXISTING diberikan setelah implementasi dapat dibuktikan; status ini tidak sama dengan lulus produksi.
6. Status LOCKED hanya dapat diberikan melalui prosedur pada Project Control Book dan Lock Register.
7. Perubahan scope, owner, kontrak, dependensi, atau status harus dicatat dan direview.
8. Modul deprecated/retired harus memiliki rencana migrasi, komunikasi, pencabutan akses/secret, serta bukti penutupan.

## 8. Larangan dan batasan

- Katalog ini tidak memberi izin untuk mengubah modul LOCKED.
- Katalog ini tidak menggantikan spesifikasi fitur, Project Control Book, atau register kontrol.
- Jangan menganggap contoh modul masa depan sebagai kebutuhan yang telah disetujui.
- Jangan menandai modul selesai hanya karena halaman UI tersedia.
- Jangan menambahkan modul dengan akses database langsung yang melewati backend/otorisasi yang ditetapkan.
- Jangan memecah aplikasi menjadi microservices tanpa justifikasi kebutuhan dan biaya operasional.

## 9. Riwayat perubahan

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Katalog awal berdasarkan snapshot Lock Register; ditambahkan aturan katalog dinamis dan template modul baru |
