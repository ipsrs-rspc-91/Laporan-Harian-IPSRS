-- CANDIDATE ONLY: do not apply to production until direct app usage is checked.
-- Purpose: prevent authenticated browser users from reading or modifying internal rollback snapshots.
-- service_role and postgres remain privileged for controlled recovery.
REVOKE ALL PRIVILEGES ON TABLE public.master_data_sipil_backup_20261010 FROM anon, authenticated, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.report_reclass_snapshot_20261011 FROM anon, authenticated, PUBLIC;
