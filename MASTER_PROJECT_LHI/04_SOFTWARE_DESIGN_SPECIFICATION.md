# SOFTWARE DESIGN SPECIFICATION — APLIKASI LHI

## 1. Tujuan dan status

SDS mendokumentasikan desain rinci yang diturunkan dari requirement dan architecture. Dokumen ini merupakan kerangka desain awal. Detail implementasi yang belum diverifikasi ditandai OPEN/NOT VERIFIED dan tidak boleh diisi dengan asumsi.

## 2. Hubungan dokumen

- 00_MASTER_PROJECT.md: arah dan batas proyek.
- 02_REQUIREMENTS_SPECIFICATION.md: requirement dan acceptance criteria.
- 03_SOFTWARE_ARCHITECTURE.md: arsitektur, container, trust boundary, ADR.
- 05_QUALITY_ASSURANCE_PLAN.md: test dan quality gate.
- 09_SECURITY_ASSURANCE_PLAN.md: security controls dan threat model.
- PROJECT_CONTROL.md: kontrol perubahan, lock, baseline, regression, deployment.

## 3. Template spesifikasi per modul

Setiap modul menggunakan bagian berikut:

### 3.1 Identitas
- Module ID:
- Nama:
- Status lifecycle:
- Status lock (rujuk LOCK_REGISTER):
- Product Owner:
- Technical Owner:
- Versi/revisi:
- Requirement IDs:

### 3.2 Tujuan dan batas
- Masalah bisnis:
- Tujuan:
- In scope:
- Out of scope:
- Aktor:
- Trigger:
- Precondition:
- Postcondition:

### 3.3 Use case dan alur
- Main flow:
- Alternate flow:
- Error/exception flow:
- State transition:
- Business rule reference:
- Acceptance criteria:

### 3.4 UI/UX
- Route/page/component:
- Field dan validasi:
- Loading/empty/error/success state:
- Accessibility:
- Responsive behavior:
- Permission visibility:
- Cache/state behavior:

### 3.5 API/service contract
- Endpoint/function:
- Method:
- Authentication:
- Authorization:
- Request schema:
- Response schema:
- Error codes:
- Pagination/filter/sort:
- Timeout/retry/idempotency:
- Rate limit:
- Consumers:

### 3.6 Data design
- Tables/views:
- Column/type:
- PK/FK/unique/check constraints:
- Index:
- RLS/policy:
- Trigger/function:
- Data owner/classification:
- Retention:
- Migration:
- Audit requirements:

### 3.7 Dependencies dan side effects
- Modul yang dipanggil:
- Modul yang memanggil:
- Shared files/services:
- Events/callbacks:
- Global state:
- Cache:
- External services:
- Failure propagation:

### 3.8 Security design
- Assets:
- Trust boundary:
- Threat scenarios:
- Controls:
- Negative authorization tests:
- Sensitive logging constraints:

### 3.9 Test design
- Unit:
- Component:
- Contract:
- Integration:
- E2E:
- Regression:
- Security:
- Performance:
- Recovery:
- Test data/environment:
- Expected evidence:

### 3.10 Release dan operasi
- Feature flag:
- Migration order:
- Rollout:
- Rollback/forward-fix:
- Monitoring/alert:
- Runbook:
- Support owner:
- Production verification:

## 4. Design principles

1. API dan database menjadi boundary resmi untuk data sensitif.
2. Modul tidak boleh mengubah data domain lain tanpa kontrak.
3. Permission selalu diperiksa di server.
4. Validasi frontend adalah UX; validasi backend adalah enforcement.
5. Shared code memiliki owner dan test lintas modul.
6. State, cache, event, dan side effect harus eksplisit.
7. Perubahan schema mempertahankan compatibility atau memiliki migration plan.
8. Modul baru tidak mengubah perilaku modul LOCKED.
9. Desain tidak memaksakan microservices tanpa alasan terukur.
10. Detail yang belum diverifikasi diberi status OPEN, bukan ditebak.

## 5. Status desain awal

| Area | Status | Tindakan |
|---|---|---|
| Frontend shared code | OPEN | Buat dependency/function map dari source |
| Backend API | OPEN | Buat endpoint inventory per handler |
| Database schema | OPEN | ERD, data dictionary, RLS inventory |
| Role/permission | OPEN | Rekonsiliasi frontend, API, database |
| Module boundaries | PARTIAL | Validasi melalui dependency map |
| Event/global state | OPEN | Inventarisasi state dan side effects |
| External integration | OPEN | Catat hanya integrasi yang benar-benar ada |
| Error handling | OPEN | Katalog error dan failure-path tests |

## 6. Change impact analysis

Sebelum perubahan, identifikasi requirement, module, shared file, API, table, RLS, migration, event, cache, role, regression test, dan production dependency yang terdampak. Perubahan lintas modul harus menambahkan regression coverage dan bukti review.

## 7. Temuan desain modul — LHI discipline notification

Status desain: **OPEN / GAP CONFIRMED FROM SOURCE**. Ini adalah catatan desain dan bukan izin untuk mengubah script/database/konfigurasi produksi.

| Elemen | Kondisi source yang diperiksa 16 Nov 2026 | Kebutuhan desain/keputusan berikutnya |
|---|---|---|
| Perhitungan hari tanpa input | Scheduler database memakai `created_at` WIB dan reset timestamp; login gate Edge Function masih memakai `reports.tanggal` | Rekonsiliasi login gate agar mengikuti sumber perhitungan scheduler/README dan status LHI sah/batal |
| Monitoring streak | Sebelum fix branch, endpoint monitoring memakai `reports.tanggal` dan tidak menghormati `lhi_discipline_reset_at` | PR #77 mengubah streak monitoring memakai `created_at` WIB dan baseline reset; monthly reporting metrics tetap terpisah |
| Peringatan tahap | PostgreSQL scheduler membuat event hari 4/6/7 setiap 5 menit; row `DAY_4` ditemukan pada database produksi | Pertahankan event key unik dan deduplikasi; uji penerima dan batas waktu tahap |
| API peringatan login | `apiGetDisciplineWarning` mengembalikan `staff_id,nama`; UI memfilter `missed_days >= 9` | Kontrak response disepakati; field tahap/hari/nama/waktu dan penerima dinyatakan eksplisit |
| Inbox notifikasi | Tabel `lhi_discipline_notifications` tersedia dan terisi; Edge Function v114 tidak memiliki dua action yang diminta frontend | PR #77 menambahkan list/read API; verifikasi recipient isolation, pagination, read idempotency, dan deploy parity |
| Blokir individual | Login gate memblokir berdasarkan tujuh tanggal kosong dan memperbarui `staff.status` | Pisahkan status kepegawaian dan status hak akses aplikasi sesuai README; jangan ubah sebelum audit migrasi dan status runtime |
| Blokir global/recovery | Action recovery tersedia pada source, tetapi integrasi penuh dengan kalkulasi `created_at` belum tersertifikasi | State machine, transaksi atomik, snapshot, retry/idempotency, dan recovery test |

### 7.1 Kontrak target minimum yang harus dirancang
- Service backend menghasilkan `missed_days`, `last_valid_lhi_created_at`, `calculation_date_wib`, `warning_stage`, dan `access_state` dari satu aturan yang konsisten.
- Scheduler database menghasilkan satu event untuk tahap 4, 6, dan 7 dengan `event_key` dan unique conflict handling; penerima meliputi petugas terkait dan petugas aktif/tim sesuai implementasi scheduler.
- Notification API list/read ditambahkan pada branch PR #77; query list membatasi `recipient_staff_id` ke sesi aktif dan 50 baris terakhir; read hanya memperbarui notifikasi milik sesi tersebut dan retry aman.
- Perhitungan tidak boleh bergantung pada aktivitas login pengguna; jadwal/trigger evaluasi harus ditetapkan secara arsitektural dan tidak memakai polling frontend sebagai sumber kebenaran.
- Kegagalan pengiriman tidak boleh menghapus peristiwa; retry harus idempotent dan dapat diaudit.

Semua butir di atas adalah rancangan yang harus disetujui dan diuji; bukan pernyataan bahwa implementasi sudah tersedia.

## 7. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | SDS baseline/template awal |
