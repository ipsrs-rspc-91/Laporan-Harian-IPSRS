# MIGRATION RECONCILIATION MANIFEST — LHI

## 1. Tujuan dan batas

Manifest ini merekam perbandingan read-only antara migration history Supabase dan file SQL pada repository main pada 15 November 2026. Manifest ini tidak mengubah migration history atau schema. Nama/timestamp yang berbeda tidak otomatis membuktikan migration hilang atau belum diterapkan; setiap baris harus diperiksa terhadap isi SQL, commit history, dan schema aktual.

Project Supabase: `tcrmlhfsroyhaxdfwyll`  
Repository: `ipsrs-rspc-91/Laporan-Harian-IPSRS`  
Repository main SHA saat snapshot: `de77a78a99e566a97d9be320786e47d6675ae94a`

## 2. Ringkasan perbandingan

| Item | Jumlah |
|---|---:|
| Remote migration history | 75 |
| Local SQL files | 35 |
| Exact version/timestamp match | 15 |
| Remote-only (timestamp tidak ada di main) | 60 |
| Local-only (timestamp tidak ada di remote) | 20 |

**PENTING:** istilah *exact version/timestamp match* hanya berarti 14-digit version pada nama file lokal sama dengan version di migration history Supabase. Ini **BUKAN** hasil pembandingan isi SQL atau checksum. Belum ada klaim bahwa 15 pasangan tersebut identik secara konten. Status SQL equivalence seluruh pasangan masih **NOT VERIFIED**.

**Status keseluruhan: NOT RECONCILED.** Tidak boleh menjalankan `supabase db push`, `migration repair`, menghapus history, atau mengubah schema produksi sebelum manifest ini direview dan status setiap migration diputuskan.

## 3. Remote migration history

| Remote version | Remote name | File lokal dengan version sama | Status awal |
|---|---|---|---|
| `20260922190106` | `create_master_data` | — | REMOTE_ONLY |
| `20260922190115` | `seed_master_categories_areas` | — | REMOTE_ONLY |
| `20260922190141` | `harden_master_data_functions` | — | REMOTE_ONLY |
| `20260922190154` | `create_lhi_core_tables` | — | REMOTE_ONLY |
| `20260922190203` | `lhi_rls_and_indexes` | — | REMOTE_ONLY |
| `20260922190206` | `tighten_master_data_policy` | — | REMOTE_ONLY |
| `20260922190230` | `seed_master_items_1` | — | REMOTE_ONLY |
| `20260922190232` | `seed_master_items_181` | — | REMOTE_ONLY |
| `20260922190236` | `seed_master_items_361` | — | REMOTE_ONLY |
| `20260922190239` | `seed_master_items_541` | — | REMOTE_ONLY |
| `20260922223358` | `add_staff_presence_tracking` | — | REMOTE_ONLY |
| `20260922223702` | `enforce_report_server_created_at` | — | REMOTE_ONLY |
| `20260923011035` | `optimize_access_policy_select_overlap` | — | REMOTE_ONLY |
| `20260923070128` | `align_ipsrs_authorization_rls` | — | REMOTE_ONLY |
| `20260923070305` | `grant_ipsrs_rls_helpers` | — | REMOTE_ONLY |
| `20260923085810` | `add_login_device_tracking` | — | REMOTE_ONLY |
| `20260923103309` | `perf_reports_date_index_20260923` | — | REMOTE_ONLY |
| `20260923103534` | `perf_remove_unused_date_index_20260923` | — | REMOTE_ONLY |
| `20260924021155` | `permanent_report_privacy_hardening_20260924` | `20260924021155_permanent_report_privacy_hardening_20260924.sql` | VERSION_MATCH_ONLY |
| `20260924035728` | `harden_public_api_and_indexes` | `20260924035728_harden_public_api_and_indexes.sql` | VERSION_MATCH_ONLY |
| `20260924035824` | `close_anon_default_privileges` | `20260924035824_close_anon_default_privileges.sql` | VERSION_MATCH_ONLY |
| `20260924040217` | `align_report_update_rls` | `20260924040217_align_report_update_rls.sql` | VERSION_MATCH_ONLY |
| `20260926112505` | `create_rollback_snapshot_20260926_1816` | — | REMOTE_ONLY |
| `20260926152613` | `harden_staff_data_access_and_admin_edit` | `20260926152613_harden_staff_data_access_and_admin_edit.sql` | VERSION_MATCH_ONLY |
| `20260926235410` | `20260927000000_soft_delete_reports` | `20260926235410_soft_delete_reports.sql` | VERSION_MATCH_ONLY |
| `20260928092227` | `fix_target_specific_edit_permission` | — | REMOTE_ONLY |
| `20261002231924` | `remove_dummy_add_master_items_20261002` | — | REMOTE_ONLY |
| `20261004233054` | `add_spmu_dual_side_schema_only_20261005` | — | REMOTE_ONLY |
| `20261008082850` | `add_lhi_manual_unblock_until` | — | REMOTE_ONLY |
| `20261008082953` | `activate_heri_lhi_manual_unblock` | — | REMOTE_ONLY |
| `20261008082958` | `audit_heri_lhi_manual_unblock` | — | REMOTE_ONLY |
| `20261010091828` | `reorganize_sipil_master_data_20261010` | `20261010091828_reorganize_sipil_master_data_20261010.sql` | VERSION_MATCH_ONLY |
| `20261010094055` | `rename_sipil_item_akrilik_meja_20261010` | — | REMOTE_ONLY |
| `20261010094650` | `rename_kitchen_area_to_me_kitchen_20261010` | — | REMOTE_ONLY |
| `20261010095657` | `move_ceklist_me_utiliti_below_kesling_20261010` | — | REMOTE_ONLY |
| `20261010141447` | `prevent_duplicate_master_items` | — | REMOTE_ONLY |
| `20261010152312` | `remove_ruang_anggrek_utility_checklist_20261010` | — | REMOTE_ONLY |
| `20261010152815` | `add_meteran_air_deep_well_utility_checklist_20261010` | — | REMOTE_ONLY |
| `20261011005510` | `lock_final_12_standard_categories` | `20261011005510_lock_final_12_standard_categories.sql` | VERSION_MATCH_ONLY |
| `20261011005549` | `enforce_final_kategori_on_new_reports` | `20261011005549_enforce_final_kategori_on_new_reports.sql` | VERSION_MATCH_ONLY |
| `20261011153018` | `secure_backup_snapshot_tables_rls_20261011` | `20261011153018_secure_backup_snapshot_tables_rls_20261011.sql` | VERSION_MATCH_ONLY |
| `20261011153827` | `harden_trigger_function_search_path_20261011` | `20261011153827_harden_trigger_function_search_path_20261011.sql` | VERSION_MATCH_ONLY |
| `20261013010650` | `master_item_review_queue` | `20261013010650_master_item_review_queue.sql` | VERSION_MATCH_ONLY |
| `20261013015853` | `allow_subarea_master_data` | — | REMOTE_ONLY |
| `20261013052926` | `guard_report_item_required_on_write` | `20261013052926_guard_report_item_required_on_write.sql` | VERSION_MATCH_ONLY |
| `20261013085608` | `fix_master_item_review_submitter_identity` | — | REMOTE_ONLY |
| `20261013092327` | `secure_report_elektromedik_snapshot_rls_20261013` | — | REMOTE_ONLY |
| `20261016103823` | `secure_elektromedik_snapshot_client_grants` | — | REMOTE_ONLY |
| `20261031194743` | `lhi_form_block_tables_20261101` | — | REMOTE_ONLY |
| `20261031194749` | `lhi_form_block_incident_tables_20261101` | — | REMOTE_ONLY |
| `20261031194754` | `enable_lhi_discipline_scheduler_20261101` | — | REMOTE_ONLY |
| `20261031194824` | `lhi_form_block_scheduler_logic_20261101` | — | REMOTE_ONLY |
| `20261031194849` | `guard_duplicate_lhi_global_incidents_20261101` | — | REMOTE_ONLY |
| `20261031194855` | `schedule_lhi_discipline_scheduler_every_five_minutes_20261101` | — | REMOTE_ONLY |
| `20261031195259` | `seed_existing_lhi_global_lock_incident_20261101` | — | REMOTE_ONLY |
| `20261031195311` | `snapshot_legacy_global_lock_lhi_obligations_20261101` | — | REMOTE_ONLY |
| `20261031195642` | `reactivate_day8_staff_on_valid_lhi_20261101` | — | REMOTE_ONLY |
| `20261031201917` | `protect_lhi_manual_unblock_from_scheduler_20261101` | — | REMOTE_ONLY |
| `20261101113939` | `prevent_global_duplicate_master_items_20261101` | — | REMOTE_ONLY |
| `20261101114007` | `normalize_global_item_duplicate_guard_20261101` | — | REMOTE_ONLY |
| `20261102023802` | `fix_lhi_discipline_daily_obligation_rollover_20261102` | — | REMOTE_ONLY |
| `20261102031051` | `backup_lhi_access_before_agung_unblock_20261102` | — | REMOTE_ONLY |
| `20261102093643` | `lhi_grace_atomic_open_and_staff_completion` | `20261102093643_lhi_grace_atomic_open_and_staff_completion.sql` | VERSION_MATCH_ONLY |
| `20261102114305` | `secure_lhi_backup_tables_and_reset_hash_20261102` | `20261102114305_secure_lhi_backup_tables_and_reset_hash_20261102.sql` | VERSION_MATCH_ONLY |
| `20261103050231` | `revoke_legacy_lhi_trigger_rpc_execute_20261103` | — | REMOTE_ONLY |
| `20261103052214` | `restrict_lhi_discipline_tables_to_service_role_20261103` | — | REMOTE_ONLY |
| `20261103173358` | `lhi_secure_recovery_challenge_v2` | — | REMOTE_ONLY |
| `20261103173710` | `lhi_recovery_status_and_unlock_guard_v2` | — | REMOTE_ONLY |
| `20261104083250` | `lhi_recovery_accept_expired_incident_and_120h_grace` | — | REMOTE_ONLY |
| `20261104085221` | `lhi_grace_120h_scheduler_alignment` | — | REMOTE_ONLY |
| `20261104085307` | `lhi_grace_120h_audit_text` | — | REMOTE_ONLY |
| `20261104090206` | `lhi_successful_grace_resets_discipline_counter` | — | REMOTE_ONLY |
| `20261104090846` | `lhi_grace_status_and_day10_messages_fix` | — | REMOTE_ONLY |
| `20261104090930` | `lhi_scheduler_day10_reactivation_text` | — | REMOTE_ONLY |
| `20261104091349` | `lhi_global_day10_notify_all_delinquent_staff` | — | REMOTE_ONLY |

## 4. File migration lokal yang tidak memiliki version exact di remote

| Local version | File lokal | Status awal |
|---|---|---|
| `20260928100000` | `20260928100000_align_admin_edit_rls.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261004150000` | `20261004150000_spare_part_material_unit.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261004170000` | `20261004170000_spare_part_material_unit_status_contract.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261004180000` | `20261004180000_spmu_dual_side_storage.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261005050000` | `20261005050000_add_spmu_dual_side_schema_only.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261010094600` | `20261010094600_rename_kitchen_area_to_me_kitchen_20261010.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261010100000` | `20261010100000_move_ceklist_me_below_kesling_20261010.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261010112000` | `20261010112000_move_kulkas_area_to_me_20261010.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261011190000` | `20261011190000_reorder_administrasi_ipsrs_items.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261012050000` | `20261012050000_normalize_report_category_picker_choices.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261013100000` | `20261013100000_fix_master_item_submitter_identity.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261013103000` | `20261013103000_secure_report_elektromedik_snapshot_rls.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104100000` | `20261104100000_lhi_grace_duration_100_hours.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104103000` | `20261104103000_lhi_recovery_expired_incident_fix.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104150000` | `20261104150000_lhi_grace_120h_scheduler_alignment.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104151000` | `20261104151000_lhi_grace_120h_audit_text.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104160000` | `20261104160000_lhi_successful_grace_resets_discipline_counter.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104170000` | `20261104170000_lhi_grace_status_and_day10_messages_fix.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104171000` | `20261104171000_lhi_scheduler_day10_reactivation_text.sql` | LOCAL_ONLY — perlu review isi SQL |
| `20261104180000` | `20261104180000_lhi_global_day10_notify_all_delinquent_staff.sql` | LOCAL_ONLY — perlu review isi SQL |

## 5. Langkah rekonsiliasi

Untuk setiap baris REMOTE_ONLY dan LOCAL_ONLY:
1. Cari file SQL asal pada seluruh branch, commit history, backup, atau proses perubahan eksternal.
2. Bandingkan SQL dan efek schema, bukan hanya nama/timestamp.
3. Tandai sebagai RENAMED_EQUIVALENT, SQUASHED, EXTERNAL_APPLIED, SOURCE_MISSING, LOCAL_PENDING, SUPERSEDED, atau UNKNOWN hanya setelah ada bukti.
4. Catat commit/file asal, checksum, tabel/fungsi/policy yang terdampak, dan hasil schema comparison.
5. Uji urutan pemulihan pada database terisolasi.
6. Minta review DBA/engineer dan persetujuan Product Owner/administrator.
7. Baru putuskan apakah perlu mengembalikan file source, membuat baseline, memperbaiki migration history, atau menyiapkan migration baru.
8. Jangan mengubah status remote dengan `migration repair` sebelum keputusan tertulis dan backup/restore plan disetujui.

## 6. Schema gaps terkait Form Blok dan recovery

Pemeriksaan awal pada snapshot audit menemukan beberapa objek belum tersedia. **Recheck read-only terbaru pada 15 November 2026 sekitar 13:34 UTC** (melalui inventory schema Supabase) mengoreksi satu temuan: tabel `public.lhi_reset_attempts` ternyata sudah ada. Karena itu, daftar gap yang masih terverifikasi saat recheck adalah:
- tabel `public.lhi_discipline_obligation_events` belum ditemukan;
- kolom `staff.lhi_access_blocked_at` belum ditemukan;
- kolom `staff.lhi_employment_activated_at` belum ditemukan;
- kolom `lhi_discipline_obligations.snapshot_last_lhi_created_at` belum ditemukan;
- kolom `lhi_discipline_obligations.snapshot_missed_days` belum ditemukan.

Tabel `public.lhi_reset_attempts` **sudah ada** pada recheck, dengan kolom `ip_hash`, `window_started_at`, `attempt_count`, dan `updated_at`. Keberadaan tabel ini tidak membuktikan seluruh recovery flow sudah lengkap atau aman.

Migration `20261115120000_lhi_form_block_compliance_alignment.sql` pada branch PR #76 memuat perubahan terkait objek tersebut dan implementasi penuh `open_lhi_global_grace_v2`. Migration tersebut tidak tercatat sebagai file pada main snapshot dan tidak boleh dianggap telah diterapkan ke database.

Fungsi `open_lhi_global_grace_v2` yang saat ini ada di database masih mengembalikan `SAFE_CUTOVER_REQUIRED`. Ini konsisten dengan keputusan fail-closed sampai schema/snapshot dan prosedur recovery tervalidasi. Jangan mengganti stub ini secara langsung.

## 7. Keputusan keselamatan

- Migration parity menjadi deployment blocker.
- Tidak ada migration yang diterapkan selama audit.
- Perubahan backend Supabase juga harus menunggu deployment gate yang memastikan tidak ada migration push sebelum parity disetujui.
- Repository variable `SUPABASE_MIGRATION_PARITY_VERIFIED` hanya boleh diset `true` setelah rekonsiliasi selesai, bukti disimpan, dan approval diberikan.
- Setelah parity disetujui, deployment tetap memerlukan backup, checkpoint, regression, migration review, dan production verification.

## 8. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Snapshot read-only 75 remote migrations vs 35 local migration files; klasifikasi hanya berdasarkan version/timestamp, belum content equivalence. |


## 9. Pemeriksaan tambahan terhadap branch dan riwayat GitHub (15 November 2026)

Pemeriksaan direktori `supabase/migrations` pada beberapa ref yang tersedia memberikan hasil:
- `docs/lhi-professionalization-roadmap`: 35 file SQL.
- `checkpoint/2026-11-06-pre-modularization`: 35 file SQL.
- `backup/rollback-2026-11-15`: 35 file SQL.
- `checkpoint/production-main-2026-11-15`: 35 file SQL.
- `checkpoint-2026-10-13-0605`: 21 file SQL.
- `checkpoint-2026-10-12-1627`: 21 file SQL.
- `fix/lhi-form-block-compliance-2026-11-15`: 36 file SQL, termasuk migration compliance PR #76 yang belum diterapkan.

Pemeriksaan GitHub commit-path untuk tiga contoh migration remote-only (`20261031194743_lhi_form_block_tables_20261101.sql`, `20260922190106_create_master_data.sql`, dan `20261013015853_allow_subarea_master_data.sql`) mengembalikan daftar kosong. Ini menunjukkan tidak ditemukan riwayat file dengan path tersebut pada endpoint yang diperiksa; ini **tidak** membuktikan SQL-nya tidak pernah dibuat atau dijalankan di luar repository.

### Kesimpulan sementara

- Tidak ditemukan bukti bahwa 60 remote-only migration dapat dipulihkan sebagai file dengan nama/path yang sama dari ref GitHub yang diperiksa.
- Tidak ditemukan file source SQL untuk sebagian migration awal/core dan batch Form Blok pada snapshot repository yang diperiksa.
- Migration history Supabase hanya memberikan version dan name; tool audit read-only yang tersedia tidak mengembalikan body SQL historis. Karena itu, content-level equivalence dan checksum tidak dapat dibuktikan dari metadata tersebut.
- Rekonsiliasi tetap **BLOCKED / NOT RECONCILED**. Langkah aman selanjutnya adalah memperoleh arsip SQL historis dari backup resmi/riwayat deployment atau export schema yang disetujui, lalu melakukan semantic diff pada database staging/isolated. Jangan merekonstruksi migration lama dari tebakan nama atau schema saat ini, dan jangan menjalankan `migration repair`.
## 10. Recheck migration/schema/runtime — 16 November 2026

### 10.1 Schema production yang dikonfirmasi read-only

| Objek | Status pada production |
|---|---|
| staff.lhi_access_blocked_at | BELUM ADA |
| staff.lhi_employment_activated_at | BELUM ADA |
| staff.lhi_discipline_reset_at | ADA |
| lhi_discipline_obligation_events | BELUM ADA |
| lhi_discipline_obligations.snapshot_last_lhi_created_at | BELUM ADA |
| lhi_discipline_obligations.snapshot_missed_days | BELUM ADA |
| lhi_discipline_obligations.completed_at / excluded_at | ADA |
| register_lhi_reset_attempt(text) | ADA; service_role EXECUTE |
| validate_lhi_recovery_session(text,text) | ADA; metadata insiden dikembalikan |

Function production open_lhi_global_grace_v2 masih mengembalikan SAFE_CUTOVER_REQUIRED setelah validasi recovery session. Migration 20261115120000_lhi_form_block_compliance_alignment.sql pada PR #76 mengganti guard tersebut dengan implementasi state transition yang diuji, tetapi belum diterapkan ke production.

### 10.2 Status incident pada saat recheck

- LHI_GLOBAL_BLOCK = NONAKTIF.
- Satu incident GRACE masih aktif; started_at 14 November 2026 pukul 18.17 WIB dan deadline 19 November 2026 pukul 18.17 WIB.
- Terdapat 42 baris obligation berstatus pending pada saat query; jumlah baris tidak boleh disamakan dengan jumlah petugas unik.
- Recheck bersifat read-only. Tidak ada migration history, schema, lock, incident, obligation, atau function production yang diubah.

### 10.3 Bukti migration pada branch PR #76

PR #76 memuat migration alignment dan rangkaian migration LHI terkait. Rangkaian tersebut telah diterapkan pada fixture PostgreSQL terisolasi melalui GitHub Actions workflow 43835446297 dan acceptance test berhasil PASS. Full gate pada SHA eafb67ed0a39432ead7610ac56c6ecd8b60fc61b juga menunjukkan static audit PASS, Deno type-check PASS, browser 20/20 PASS, dan deployment-gate audit PASS.

**Interpretasi:** keberhasilan fixture test membuktikan migration dapat dijalankan pada schema test yang disiapkan dan skenario acceptance yang tersedia. Ini tidak membuktikan kesetaraan penuh terhadap seluruh schema production atau menyelesaikan migration parity 75 remote vs 35 file pada main. Migration alignment tetap NOT APPLIED / NOT CERTIFIED di production.

### 10.4 Keputusan keselamatan terkini

1. Jangan menjalankan db push, migration repair, atau deployment backend hanya berdasarkan CI branch PASS.
2. Pertahankan incident GRACE yang sedang berjalan dan deadline 19 November 2026 pukul 18.17 WIB; jangan membuka ulang, mengganti, atau memulai ulang masa grace selama cutover tanpa prosedur dan persetujuan yang sesuai.
3. Rekonsiliasi seluruh remote-only/local-only migration, termasuk file LHI 4–15 November, berdasarkan isi SQL dan schema aktual.
4. Uji migration chain lengkap pada staging/isolated database yang merepresentasikan schema production, bukan hanya fixture minimal.
5. Siapkan backup/checkpoint dan rencana forward-fix/rollback yang dapat diuji sebelum perubahan production.
6. Perbarui manifest dengan checksum, source commit, status equivalence, owner, reviewer, dan keputusan setiap migration.

## 11. Riwayat

| Tanggal | Perubahan |
|---|---|
| 16 November 2026 | Recheck read-only schema dan runtime; mencatat missing snapshot columns/event table, SAFE_CUTOVER_REQUIRED masih aktif, incident GRACE sampai 19 November 2026 18.17 WIB, serta PR #76 full regression gate PASS namun belum diterapkan ke production. |
