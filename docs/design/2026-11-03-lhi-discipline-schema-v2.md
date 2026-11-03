# Tahap 2A — Rancangan Skema Disiplin LHI v2

Status: rancangan untuk review teknis; **bukan migration aktif dan tidak diterapkan ke database**.  
Tanggal: 3 November 2026.

## 1. Aturan sumber kebenaran

- `staff.status` hanya menyatakan status kepegawaian: `Aktif` atau `Nonaktif`.
- Status hak akses LHI disimpan terpisah: `NORMAL` atau `BLOCKED_LHI`.
- Titik awal pemantauan periode aktif disimpan sebagai timestamp WIB-aware (`timestamptz`) pada `staff.lhi_active_since`.
- Perubahan NONAKTIF → Aktif harus memperbarui `lhi_active_since` dan membuka blokir individual hanya jika blokir tersebut berasal dari disiplin LHI. Perubahan ini tidak boleh menonaktifkan `LHI_GLOBAL_BLOCK`.
- LHI sah ditentukan dari `reports.created_at` dan `deleted_at IS NULL`; `reports.tanggal` tidak dipakai untuk kepatuhan.
- Seluruh penghitungan tanggal menggunakan `(created_at AT TIME ZONE 'Asia/Jakarta')::date`.

## 2. Perubahan tabel staff yang diusulkan

| Kolom | Tipe | Default / aturan | Tujuan |
|---|---|---|---|
| `lhi_access_status` | text | `NORMAL`, CHECK `NORMAL/BLOCKED_LHI` | Status hak akses LHI, terpisah dari status kepegawaian. |
| `lhi_active_since` | timestamptz | wajib untuk petugas AKTIF | Titik awal periode aktif terakhir; di-reset saat NONAKTIF → Aktif. |
| `lhi_access_blocked_at` | timestamptz | NULL saat NORMAL | Waktu blokir individual terakhir. |
| `lhi_access_block_reason` | text | NULL saat NORMAL | Alasan blokir; minimal `LHI_NONCOMPLIANCE`. |

Kolom `lhi_manual_unblock_until` tidak boleh lagi menjadi jalan pintas untuk melewati status akses. Jangan menghapus kolom lama dalam migration pertama; pertahankan untuk kompatibilitas dan audit sampai seluruh referensi lama sudah dibersihkan.

## 3. Riwayat status kepegawaian

Tabel usulan: `staff_employment_status_events`.

Kolom minimum:
- `event_id` bigint identity primary key
- `staff_id` text not null
- `old_status` text
- `new_status` text not null
- `changed_at` timestamptz not null default clock_timestamp()
- `changed_by_staff_id` text
- `change_source` text not null (ADMIN_UI, IMPORT, SYSTEM, BACKFILL)
- `reason` text
- `lhi_access_before` text
- `lhi_access_after` text

Trigger status kepegawaian harus:
1. Mencatat setiap perubahan status.
2. Saat NONAKTIF → Aktif, mengisi `lhi_active_since=clock_timestamp()`.
3. Jika status akses sebelumnya `BLOCKED_LHI` dan reason-nya `LHI_NONCOMPLIANCE`, membuka blokir individual serta mencatat waktu/peristiwa pembukaan.
4. Tidak pernah mengubah `access_settings.LHI_GLOBAL_BLOCK`.
5. Tidak mengubah status kepegawaian sebagai akibat scheduler atau laporan yang disimpan.

Backfill awal harus hati-hati: `staff.created_at` dapat dipakai sebagai titik awal awal hanya setelah diverifikasi cocok dengan tanggal mulai aktif. Status legacy `Nonaktif_LHI_HARI_8` / `DIBLOKIR_LHI_7_HARI` tidak boleh otomatis dianggap status kepegawaian NONAKTIF; perlu rekonsiliasi sebelum migrasi karena nilai tersebut pernah dipakai oleh scheduler untuk blokir disiplin.

## 4. Snapshot kewajiban satu baris per petugas

Tabel baru yang diusulkan: `lhi_discipline_snapshot_members`.

Constraint penting: UNIQUE (`incident_id, staff_id`). Satu petugas lalai = satu kewajiban snapshot, bukan satu baris per tanggal yang terlewat.

Kolom minimum:
- `member_id` bigint identity primary key
- `incident_id` bigint not null references `lhi_discipline_incidents`
- `staff_id` text not null
- `snapshot_created_at` timestamptz not null
- `anchor_input_at` timestamptz null
- `missed_full_days_at_snapshot` nullable integer check >= 0; NULL means no valid legacy LHI input timestamp exists and HR anchor is unverified
- `employment_status_at_snapshot` text not null
- `obligation_status` text not null CHECK IN (`PENDING`, `COMPLETED`, `EXCLUDED_INACTIVE`)
- `completed_at` timestamptz null
- `qualifying_report_id` text null
- `excluded_at` timestamptz null
- `exclusion_reason` text null

Snapshot hanya memasukkan petugas AKTIF yang lalai/tidak memenuhi kewajiban pada saat global lock dipicu. Petugas normal yang tidak lalai tidak dimasukkan. Satu LHI sah dengan `created_at` dalam rentang `[grace_started_at, grace_deadline_at)` cukup untuk memenuhi kewajiban.

## 5. Riwayat peristiwa kewajiban (append-only)

Tabel usulan: `lhi_discipline_obligation_events`.

Kolom minimum:
- `event_id` bigint identity primary key
- `member_id` bigint not null references `lhi_discipline_snapshot_members`
- `event_type` text not null (SNAPSHOT_CREATED, REPORT_QUALIFIED, REPORT_CANCELLED, OBLIGATION_REOPENED, EXCLUDED_INACTIVE, GRACE_COMPLETED, GLOBAL_RELOCKED)
- `event_at` timestamptz not null default clock_timestamp()
- `report_id` text null
- `old_status` text null
- `new_status` text null
- `actor_staff_id` text null
- `details` jsonb not null default '{}'::jsonb

Jangan UPDATE atau DELETE event historis. Status terkini berada di tabel snapshot member; setiap perubahan harus menambah event baru.

## 6. Grace dan transaksi pemulihan

- `lhi_discipline_incidents` tetap menjadi satu sumber waktu mulai/tenggat.
- Fungsi pemulihan harus mengunci baris `access_settings.LHI_GLOBAL_BLOCK` dan insiden LOCKED dengan `FOR UPDATE`.
- Satu transaksi: verifikasi insiden LOCKED → buat snapshot member hanya untuk petugas lalai aktif → ubah semua `lhi_access_status=BLOCKED_LHI` menjadi NORMAL → set incident GRACE dan waktu mulai/tenggat → ubah global lock menjadi NONAKTIF → tulis audit. Jika salah satu gagal, seluruh transaksi rollback.
- Jika status incident sudah GRACE, retry mengembalikan incident dan tenggat yang sama; tidak membuat snapshot baru dan tidak menggeser waktu.
- Scheduler pada tenggat memeriksa hanya member PENDING yang pegawainya masih Aktif. Member yang berubah NONAKTIF menjadi EXCLUDED_INACTIVE; kewajiban lama tidak dihidupkan lagi saat reaktivasi.
- Jika seluruh member aktif telah COMPLETED atau EXCLUDED_INACTIVE, incident COMPLETED dan global lock tetap NONAKTIF. Jika masih ada PENDING yang pegawainya Aktif, incident EXPIRED dan global lock AKTIF.
- Jika LHI yang memenuhi dibatalkan sebelum tenggat, status kembali PENDING hanya jika pegawai masih Aktif dan belum dikecualikan serta tidak ada LHI sah pengganti dalam jendela grace.

## 7. Trigger laporan

Trigger lama `trg_reactivate_lhi_staff_after_report` harus dihapus/diganti dalam migration terkontrol. Menyimpan laporan tidak boleh mengubah `staff.status` atau membuka blokir individual. Scheduler dan evaluator grace membaca langsung `reports.created_at` serta `deleted_at`, sehingga pembatalan dapat membatalkan pemenuhan secara deterministik.

## 8. Urutan implementasi dan pengamanan

1. Backup skema dan data relevan; ambil snapshot serta checksum sebelum migration.
2. Rekonsiliasi nilai `staff.status` legacy, khususnya satu atau lebih nilai blokir lama.
3. Buat migration resmi menggunakan Supabase CLI `supabase migration new <nama>`; jangan menulis migration aktif secara manual.
4. Terapkan ke project nonproduksi terlebih dahulu; jalankan advisors dan seluruh uji penerimaan.
5. Deploy Edge Function hanya setelah skema tersedia dan seluruh fungsi RPC/trigger lulus.
6. Jalankan validasi data setelah deploy; sediakan rollback yang telah diuji.

## 9. Batas pekerjaan saat ini

- Rancangan ini belum diterapkan ke Supabase.
- Helper tanggal murni sudah dibuat di `supabase/functions/ipsrs-api/lhi-discipline.mjs` dan pengujian ada di `tests/lhi-discipline.test.mjs`.
- Helper tersebut belum dihubungkan ke scheduler produksi.
- Scheduler, trigger, fungsi pemulihan, skema, dan sesi Reset tetap belum siap deploy.
- Jangan mengubah produksi sampai seluruh langkah di atas selesai dan mendapat persetujuan.
