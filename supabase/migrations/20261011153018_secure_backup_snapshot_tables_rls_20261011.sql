-- Lock down backup/snapshot tables. Preserve all rows and administrative recovery access.
ALTER TABLE public.master_data_sipil_backup_20261010 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_reclass_snapshot_20261011 ENABLE ROW LEVEL SECURITY;

-- These are rollback snapshots, not application-facing tables.
-- Remove direct table privileges from client roles; do not touch service_role or table data.
REVOKE ALL PRIVILEGES ON TABLE public.master_data_sipil_backup_20261010 FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.report_reclass_snapshot_20261011 FROM anon, authenticated;
