LHI DISCIPLINE IMPLEMENTATION — REVIEW ONLY
Branch: feature/lhi-collective-warning-2026-10-31

Files changed (proposed):
- backend backup copy: staged source copy only; not deployed to Supabase.
- frontend/app.js: staged API action transport only.
- frontend/login-fast.js: staged team warning modal.

Policy (revised per user): warnings at 3, 5, and 7 consecutive calendar days without a non-deleted report; days 8–10 remain warning-only; block after MORE THAN 10 consecutive days (starting day 11). Only role KA_IPSRS is exempt and may log in. ADMINISTRASI is subject to the same discipline gate and is included in the warning list. Legacy 7-day blocked status remains blocked until manual KA IPSRS recovery for compatibility. New blocked status: DIBLOKIR_LHI_LEBIH_10_HARI.

No database schema change. No production API/function deployed. No Cloudflare deployment. No production data changed.

IMPORTANT REVIEW: This feature computes status on request and shows a modal after successful login; it is not persistent push notification and does not notify staff who do not log in. Need later add in-app notification inbox/scheduled delivery only after backup and acceptance testing.
