LHI DISCIPLINE IMPLEMENTATION — REVIEW ONLY
Branch: feature/lhi-collective-warning-2026-10-31

Files changed (proposed):
- backend backup copy: staged source copy only; not deployed to Supabase.
- frontend/app.js: staged API action transport only.
- frontend/login-fast.js: staged team warning modal.

Policy (revised per user): warnings at 3, 5, and 7 consecutive calendar days without a non-deleted report; days 8–10 remain warning-only; block after MORE THAN 10 consecutive days (starting day 11). Only role KA_IPSRS is exempt and may log in. ADMINISTRASI is subject to the same discipline gate and is included in the warning list. Legacy 7/10-day LHI block statuses are migrated on login: released to Aktif if the current missed streak is 10 days or fewer; converted to the new over-10-day blocked status if the streak is 11 days or more. New blocked status: DIBLOKIR_LHI_LEBIH_10_HARI.

No database schema change. No production API/function deployed. No Cloudflare deployment. No production data changed.

Audit hardening: the automated audit now checks the LHI policy contract and the workflow type-checks the staged backend source with Deno. A prior browser regression failure was traced to an obsolete test expecting per-row Excel buttons while the current app intentionally uses toolbar-only export; the test was updated to reflect the current UI contract. The staged backend also now paginates staff and report queries to avoid the PostgREST default row cap. The latest audit run passed Deno type-check and all LHI static policy checks; the browser regression suite is running.

IMPORTANT REVIEW: This feature computes status on request and shows a modal after successful login; it is not persistent push notification and does not notify staff who do not log in. Need later add in-app notification inbox/scheduled delivery only after backup and acceptance testing.
