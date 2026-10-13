-- Security hardening: snapshot contains report and staff data and must not be exposed via public PostgREST.
-- Backend accesses this table through the service-role client, which bypasses RLS.
alter table public.report_elektromedik_snapshot_20261012 enable row level security;
