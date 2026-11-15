# API DAN DATABASE INVENTORY — APLIKASI LHI

## 1. Tujuan dan batas audit

Dokumen ini mencatat inventory statis dari source repository `main` yang diperiksa pada 15 November 2026. Inventory bukan bukti endpoint sedang aktif di production, bukan bukti policy RLS benar, dan bukan bukti semua action dapat diakses. Authorization dan database behavior harus diuji pada environment yang diotorisasi.

Snapshot source:
- Repository: `ipsrs-rspc-91/Laporan-Harian-IPSRS`
- Main commit: `de77a78a99e566a97d9be320786e47d6675ae94a`
- Backend source: `supabase/functions/ipsrs-api/index.ts`
- Backend blob SHA: `2409a55950cf822423eaa59f2eac7a8a7f65e01f`
- Source size: 75,042 characters; 627 lines
- Static action names identified: 40
- Supabase tables/views referenced through `.from()`: 11
- Migration files in snapshot: 35

## 2. Backend actions teridentifikasi

### 2.1 Identity, session, and system
- `apiWhoAmI`
- `apiRecordLogin`
- `apiHeartbeat`
- `apiLogout`
- `apiChangePassword`
- `apiGetSystemInfo`

### 2.2 Reports and analytics
- `apiCreateReport`
- `apiGetReports`
- `apiGetOverdueReports`
- `apiGetReportById`
- `apiUpdateReport`
- `apiDeleteReport`
- `apiGetReportHistory`
- `apiGetStaffReports`
- `apiGetStaffPerformance`
- `apiGetMonthlyRecap`
- `apiDashboardStats`

### 2.3 Master data and item review
- `apiGetMasterData`
- `apiGetKategoriKustom`
- `apiGetAreaKerjaKustom`
- `apiGetItemKustom`
- `apiTambahKategori`
- `apiTambahAreaKerja`
- `apiTambahItem`
- `apiManageMasterData`
- `apiListMasterItemReviews`
- `apiReviewMasterItem`

### 2.4 Monitoring and staff
- `apiGetOnlineUsers`
- `apiListStaff`
- `apiGetDisciplineWarning`
- `apiGetStaffMonitoring`
- `apiGetStaffDailyStatus`

### 2.5 Access and permissions
- `apiGetAccessControl`
- `apiListEditPermissions`
- `apiSetAccessSetting`
- `apiSetEditPermission`

### 2.6 LHI discipline and administrative recovery
- `apiGetLhiGraceStatus`
- `apiStartLhiGrace`
- `apiAdminUnblockLhi`
- `apiAdminResetPassword`

### 2.7 Audit
- `apiGetAuditLog`

The grouping above is an initial domain classification. It does not define final module ownership or permission. Every action requires an endpoint contract, caller inventory, role matrix, input/output schema, negative tests, and audit requirements.

## 3. Database objects referenced by backend source

| Object | Initial domain | Required verification |
|---|---|---|
| `access_settings` | Access/configuration | owner, key/value constraints, who can read/write, audit |
| `audit_log` | Audit | insert/read permissions, immutability, retention |
| `edit_permissions` | Permission delegation | grantor/grantee constraints, expiry, revocation |
| `lhi_discipline_incidents` | LHI discipline | state machine, uniqueness, transition rules |
| `lhi_discipline_obligations` | LHI discipline | obligations, recovery, status transitions |
| `master_data` | Master data | data_type constraints, duplicate prevention, active/inactive lifecycle |
| `master_item_review_queue` | Master data governance | submit/review permissions, duplicate resolution, audit |
| `report_history` | Report history | write/read access, immutable history, retention |
| `reports` | LHI transactions | ownership, visibility, edit/delete, soft-delete, indexes |
| `staff` | Identity/staff | sensitive fields, role/status, RLS, profile visibility |
| `staff_dropdown` | Staff read model | view definition, column minimization, grants |

Names are taken from static `.from()` references. Views and tables must be distinguished using database catalog/DDL. No conclusion about RLS coverage or privilege safety is made by this list alone.

## 4. Migration inventory

The inspected main snapshot contains 35 SQL migration files:
- 2026-09-24: report privacy hardening, public API/index hardening, anon default privileges, report update RLS.
- 2026-09-26: staff data access/admin edit, report soft-delete.
- 2026-09-28: admin edit RLS alignment.
- 2026-10-04/05: spare part/material/unit schema and status contract.
- 2026-10-10/11: master data reorganization, category rules, backup snapshot RLS, trigger search_path hardening.
- 2026-10-12/13: category picker normalization, master item review queue, report item validation, submitter identity, Elektromedik snapshot RLS.
- 2026-11-02/04: LHI grace/discipline, backup table security, reset hash, recovery, 120-hour grace, counter reset, day-10 messages and notification.

Full filenames and ordering are authoritative in `supabase/migrations/`. This document does not prove that every migration is applied to production. Production migration status must be compared with Supabase migration history and schema.

## 5. High-priority audit work

1. Build an endpoint contract for all 40 actions: method, payload, return schema, authentication, role, permission, data access, error, cache, and audit.
2. Trace each action to frontend callers and document unused/orphan actions.
3. Build a role × action × object matrix; include negative tests and object-level authorization.
4. Extract actual schema/DDL and classify each object as table/view/function.
5. Export every RLS policy, GRANT, trigger, constraint, index, and function dependency.
6. Verify migration history against production database; do not infer applied state from files.
7. Map each API action to requirement IDs, module owner, test IDs, and audit event.
8. Verify cache key scoping, TTL, invalidation, and cross-user data isolation.
9. Verify pagination and response-size limits on all list/report endpoints.
10. Verify error handling and avoid returning internal exception details or sensitive database information.

## 6. Known source-level discrepancy requiring correction

The inspected `apiGetSystemInfo` action contains hard-coded API version, database migration, commit SHA, service-worker version, frontend version, and deployment date from October 2026. The System Info UI also contains hard-coded rollback checkpoint information from 11 October 2026. These values can become stale and must not be treated as current runtime truth.

A separate corrective change is being prepared in PR #78 to:
- remove stale hard-coded backend metadata;
- use explicitly configured environment metadata or report NOT_CONFIGURED;
- remove stale rollback checkpoint values from the UI;
- direct operators to the current `BASELINE_REGISTER.yaml` and approved recovery procedure;
- add regression coverage.

Until that corrective PR is reviewed, tested, and released, the discrepancy remains a known source issue. No production change is implied.

## 7. Verification status

| Area | Status |
|---|---|
| Static action inventory | COMPLETE for inspected source snapshot |
| Static table/view reference inventory | COMPLETE for direct `.from()` references |
| API contract and caller map | NOT STARTED |
| Role/permission matrix | NOT VERIFIED |
| Database DDL/ERD/data dictionary | NOT VERIFIED |
| RLS/GRANT audit | NOT VERIFIED |
| Production migration parity | NOT VERIFIED |
| Per-action negative tests | NOT VERIFIED |
| Runtime API health/security | NOT VERIFIED |

## 8. Riwayat

| Tanggal | Perubahan |
|---|---|
| 15 November 2026 | Inventory awal dari source main dan pencatatan discrepancy metadata |
