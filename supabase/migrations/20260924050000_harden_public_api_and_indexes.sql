-- Hardening public Data API exposure and remove one exact duplicate index.
-- The application data path is Edge Function -> service role; anonymous direct
-- access to public application objects is not required.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, public;

alter view public.staff_dropdown set (security_invoker = true);

drop index if exists public.idx_reports_staff_date;