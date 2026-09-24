-- Close residual non-SELECT default privileges for anonymous access.
-- Keep authenticated/service_role defaults unchanged because the application
-- currently relies on authenticated policy access and service-role backend access.

alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, public;