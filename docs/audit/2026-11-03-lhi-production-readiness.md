# LHI Production Readiness Audit — 3 November 2026

Status: READ-ONLY AUDIT. No production rows, settings, functions, schedules, or application deployments were changed by this audit.

Project: `tcrmlhfsroyhaxdfwyll` (Laporan Harian IPSRS, ap-southeast-1)  
Audit timestamp: `2026-11-03 12:09:39 UTC`  
PostgreSQL: `17.11`

## Production state verified

| Check | Observed |
|---|---:|
| Staff rows | 40 |
| Staff status = Aktif | 21 |
| Staff status = Nonaktif | 18 |
| Staff status = Nonaktif_LHI_HARI_8 | 1 |
| Reports rows | 1,925 |
| LHI incidents | 1 |
| LHI incident status | LOCKED |
| LHI global block setting | AKTIF |
| LHI obligations | 156 |
| Distinct staff in obligations | 21 |

The user's operational report says 22 staff are affected. The obligation snapshot currently contains 21 distinct staff IDs. These figures are not interchangeable; reconcile the 22-person operational list against the database snapshot before any production recovery.

## Existing backup tables are partial, not a production backup

| Existing table | Rows |
|---|---:|
| `lhi_staff_agung_backup_20261102` | 1 |
| `lhi_agung_obligations_backup_20261102` | 10 |
| `lhi_access_settings_backup_20261102` | 5 |

These tables do not constitute a full backup of the application database, staff, reports, master data, audit records, authentication relationships, storage objects, Edge Function versions, or scheduled jobs. They must not be described as a restorable production backup.

## Production version gap

- `ipsrs-api`: version 109.
- `lhi-block-status`: version 2.
- `lhi-reset-verify`: version 1.
- No production `lhi-recovery-exchange` or `lhi-recovery-action` function appeared in the function inventory.
- The production migration history ends with the legacy LHI changes on 3 November; the v2 recovery drafts in this branch are not applied.

The v2 frontend and recovery flow must not be deployed alone against this backend. That would create a version mismatch and could violate the restricted KA recovery flow.

## Mandatory release gates

1. Obtain a full database backup using a supported Supabase backup/PITR or client-side `pg_dump` process. Include a restore rehearsal into an isolated database. A table-copy query is not a substitute.
2. Export and archive the current Edge Function source/version configuration, Cloudflare Worker deployment/configuration, relevant secrets through the approved secret-management process, and cron/job definitions. Never put secrets in Git.
3. Verify backup row counts and checksums for all critical tables, including all 1,925 reports and all 40 staff records, plus master data, access settings, LHI incident/obligation/audit tables, and authentication linkage.
4. Reconcile each active employee's LHI start/activation date against authoritative HR records. Do not use `created_at` as a verified HR activation date without evidence.
5. Reconcile the 22-person operational impact list with the 21 distinct staff IDs in the current obligation snapshot.
6. Complete a production-like migration rehearsal, rollback rehearsal, Edge Function compatibility test, browser test, and controlled KA-only recovery test.
7. Only after gates 1–6 pass, obtain explicit release authorization before production migration, function deployment, Worker deployment, scheduler cutover, or unlocking.

## Safety decision

Production remains locked (`LHI_GLOBAL_BLOCK=AKTIF`; incident `LOCKED`). This audit did not unlock it. Do not unlock by directly editing `access_settings`, do not manually clear individual LHI statuses, and do not deploy only the frontend. Keep the current production state until the complete recovery package and restore path are proven.

## Audit limitations

The connected Supabase operations available in this session provide SQL inspection and project/function metadata but do not provide a downloadable full database dump or a verified restore rehearsal. Therefore this document records readiness blockers; it does not claim that a backup has been completed.
