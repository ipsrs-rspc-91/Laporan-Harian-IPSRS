# LHI production security hotfix — 3 November 2026

## Scope

A narrowly scoped permission correction was applied to the production Supabase project
`tcrmlhfsroyhaxdfwyll`. It does not alter LHI status, staff records, reports, global-block
settings, incident state, scheduler behavior, cron configuration, Edge Functions, or the
Cloudflare Worker.

## Finding

The Supabase Security Advisor reported that these legacy `SECURITY DEFINER` functions
were executable by `anon` and `authenticated`:

- `public.protect_lhi_manual_unblock_status()`
- `public.reactivate_lhi_staff_after_report()`

A read-only dependency check confirmed both functions are attached to existing database
triggers:

- `trg_protect_lhi_manual_unblock_status`
- `trg_reactivate_lhi_staff_after_report`

## Change applied

Migration `20261103050231_revoke_legacy_lhi_trigger_rpc_execute_20261103` revoked
`EXECUTE` from `PUBLIC`, `anon`, `authenticated`, and `service_role` on the two
functions. PostgreSQL ownership execution remains with `postgres`.

Post-change verification confirmed:

- Both trigger attachments remain present.
- Both function ACLs now contain only `postgres=X/postgres`.
- The two functions are no longer exposed as callable RPCs to application roles.
- Supabase Security Advisor no longer reports either function under
  `anon_security_definer_function_executable` or
  `authenticated_security_definer_function_executable`.

## Remaining advisor findings

The advisor still reports informational RLS/no-policy findings on server-managed,
backup, and review tables, plus leaked-password protection disabled. These are not
silently changed here: table access must be checked against the intended service-role
and application access model, and Auth security settings require a separate reviewed
configuration change.

## Production boundary

This hotfix does **not** unlock LHI or deploy the LHI v2 recovery workflow.
The production global block remains unchanged. Four LHI v2 migrations, recovery Edge
Functions, secrets, cron cutover, full restorable database backup, and Worker release
remain separate gated release steps.
