LHI DISCIPLINE IMPLEMENTATION — REVIEW ONLY
Branch: feature/lhi-collective-warning-2026-10-31

Files changed (proposed):
- backend backup copy: staged source copy only; not deployed to Supabase.
- frontend/app.js: staged API action transport only.
- frontend/login-fast.js: staged team warning modal.

Policy: warnings at 3, 5, 7 consecutive calendar days without a non-deleted report; block at day 10. Legacy 7-day blocked status remains blocked until manual KA IPSRS unblock for compatibility. KA IPSRS and ADMINISTRASI excluded from discipline warning list; individual account block remains enforced in backend login gate.

No database schema change. No production API/function deployed. No Cloudflare deployment. No production data changed.

IMPORTANT REVIEW: This feature computes status on request and shows a modal after successful login; it is not persistent push notification and does not notify staff who do not log in. Need later add in-app notification inbox/scheduled delivery only after backup and acceptance testing.
