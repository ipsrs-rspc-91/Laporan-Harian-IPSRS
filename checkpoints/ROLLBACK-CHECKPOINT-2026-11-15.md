# Rollback Checkpoint — 2026-11-15

## Architecture contract
- GitHub is the sole source of truth for application code.
- Cloudflare Workers hosts the application built from GitHub.
- Supabase is the production database and application data store.
- This checkpoint is read-only with respect to production services. No code was deployed and no production database rows/settings were changed.

## GitHub code checkpoint
- Repository: ipsrs-rspc-91/Laporan-Harian-IPSRS
- Branch: backup/rollback-2026-11-15
- Base commit: de77a78a99e566a97d9be320786e47d6675ae94a
- Base commit title: Fix LAINNYA submenu selection before adding items (#75)
- Branch purpose: preserve the exact repository tree at the base commit for code rollback/reference.
- Restore reference: create a reviewed PR or reset the intended deployment source to this commit; do not force-push main.

## Cloudflare hosting checkpoint
- Account: 0658729027fb6dd3721cf1bd1848946c
- Worker: laporan-harian-ipsrs
- Active deployment ID: 0b70462e-ddfe-4456-8c12-7701ff8d1225
- Active version ID: ef341e79-414e-435f-a26d-410320514174
- Version number: 1429
- Traffic: 100%
- Version created: 2026-11-10T22:19:41.157158Z
- Deployment created: 2026-11-10T22:19:41.480232Z
- Rollback reference: Cloudflare Workers version 1429 (ID above). A rollback should be executed only after confirming compatibility with the current Supabase schema and data.

## Supabase production database checkpoint (reference only)
- Project: Laporan Harian IPSRS
- Project ref: tcrmlhfsroyhaxdfwyll
- Region: ap-southeast-1
- Project status at check: ACTIVE_HEALTHY
- PostgreSQL engine: 17.11
- Latest migration recorded: 20261104091349 — lhi_global_day10_notify_all_delinquent_staff
- Observed LHI_GLOBAL_BLOCK value at check: NONAKTIF
- Observed scheduler: active, every 5 minutes
- Observed incident: incident 3 in GRACE; this is an operational state, not a backup.

IMPORTANT: This file is a rollback manifest, NOT a database dump. The connected Supabase actions available in this session do not expose a database dump/download or backup-list operation. No claim is made that a manual full database backup was created or that a specific daily backup is available. Before any schema/data rollback, verify the actual Supabase backup in Dashboard > Database > Backups (or use the authorized Supabase Management API/CLI to create and verify a logical dump). Supabase Storage objects require a separate backup if present.

## Rollback safety
1. Keep GitHub main unchanged until a reviewed fix is approved.
2. For application code, restore from the GitHub checkpoint commit.
3. For Cloudflare, use the recorded immutable Worker version only after reviewing version/schema compatibility.
4. For Supabase, restore only from a verified backup/restore point; database restoration can discard later data and cause downtime.
5. Do not roll back Cloudflare alone if the older Worker expects a different database schema.
