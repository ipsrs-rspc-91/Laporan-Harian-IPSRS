-- Security hardening: the snapshot contains report/staff data and is backend-only.
-- Production applied this migration as 20261016103823; this file records the same
-- change in the GitHub source of truth. RLS remains enabled, and service_role
-- retains backend access while direct client roles cannot access the table.
ALTER TABLE public.report_elektromedik_snapshot_20261012 ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.report_elektromedik_snapshot_20261012 FROM anon, authenticated;
