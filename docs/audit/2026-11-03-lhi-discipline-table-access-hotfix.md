# LHI discipline table access hotfix — 3 November 2026

## Finding

Production inspection found that the three internal LHI discipline tables had RLS enabled
but no policies, while broad table privileges were still granted to `authenticated`.
With no policies, authenticated reads/writes were already filtered by RLS; however, the
grants were unnecessarily broad and did not reflect the intended server-only access model.

## Change

Migration `20261103052214_restrict_lhi_discipline_tables_to_service_role_20261103`
revokes all table privileges from `PUBLIC`, `anon`, and `authenticated` on:

- `public.lhi_discipline_incidents`
- `public.lhi_discipline_notifications`
- `public.lhi_discipline_obligations`

The `service_role` retains the required data-operation privileges. RLS remains enabled.
The Edge API/scheduler uses the privileged server-side Supabase client; the browser does
not receive direct table access.

## Verification

A post-migration catalog query confirmed all three tables retain RLS and have grants
only for `service_role` among application roles.

## Scope boundary

No rows, LHI status, incident state, global lock setting, cron job, staff employment
status, Edge Function deployment, or Cloudflare Worker were changed by this migration.
This is an access-hardening change only.
