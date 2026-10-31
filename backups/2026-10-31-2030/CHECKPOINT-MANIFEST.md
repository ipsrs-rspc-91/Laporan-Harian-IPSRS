# ROLLBACK CHECKPOINT — 2026-10-31 20:30 WIB

Checkpoint requested for 20:30 WIB. Actual capture was performed shortly after 20:30; timestamps below are the exact platform values returned during capture.

## GitHub
- Repository: ipsrs-rspc-91/Laporan-Harian-IPSRS
- Source branch head at checkpoint: e03f75938200a7940e56c423f4561c45abdbadda
- Rollback branch: rollback/checkpoint-2026-10-31-2030
- Branch created from the source head above.
- This branch preserves the complete repository tree at that commit.
- Snapshot files in this folder also preserve the currently deployed Supabase Edge Function source.

## Supabase
- Project: tcrmlhfsroyhaxdfwyll
- Function: ipsrs-api
- Status: ACTIVE
- Version: 96
- verify_jwt: false
- Source SHA-256 reported by Supabase: 66180cd0c6850d5bbc0ac84a280863d4c57638740bcb5e9c7129fc286ea29d80
- Files copied into this folder: supabase-ipsrs-api-index.ts and supabase-ipsrs-api-deno.json

## Cloudflare
- Worker: laporan-harian-ipsrs
- Latest version observed: 1130
- Version ID: a6dbea50-17fe-4019-9ab0-4704aa9119f6
- Created: 2026-10-31T13:01:50.125039Z
- Latest deployment ID: 5fedf798-b4ba-4265-a8d2-e62ed4e204bd
- Deployment created: 2026-10-31T13:01:50.477732Z
- Traffic allocation: 100% to version 1130
- Compatibility date: 2026-09-23
- Worker script source could not be exported through the connected Cloudflare API call (content endpoint returned HTTP 204 with empty body). Therefore this checkpoint records the exact deployed version/deployment identifiers, but does NOT claim a source-code backup of the Worker.

## Scope / safety
- No production code was modified.
- No deployment was triggered.
- No database rows or schema were changed.
- GitHub rollback branch and Supabase function source snapshots are available for recovery.
- Cloudflare rollback can be targeted by the recorded version/deployment identifiers; confirm current Cloudflare API support and bindings before performing rollback.
