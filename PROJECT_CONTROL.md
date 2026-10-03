# PROJECT CONTROL — Laporan-Harian-IPSRS

> Audit gate was corrected and self-tested in c35f7b83b33d3c80abe070e07ee03544693ec070; production/browser workflow verification remains required before promoting additional modules to LOCKED.


**Control Book Version:** 1.1.0  
**Created:** 2026-10-04  
**Repository:** ipsrs-rspc-91/Laporan-Harian-IPSRS  
**Production target:** Cloudflare  
**GitHub:** retained as source/backup until Cloudflare is proven stable

## 1. Purpose
This document is the master control book for the Laporan-Harian-IPSRS project. It defines architecture, module boundaries, locks, baselines, regression rules, deployment gates, and audit procedure.

## 2. Non-negotiable rules
1. A module marked LOCKED must not be changed unless the user explicitly requests an update/fix to that module.
2. A change to one file must be assessed against its dependent and dependent-on modules; file-level review alone is insufficient.
3. A LOCKED behavior must have a regression test. If the test fails, the change is BLOCKED.
4. After an approved update: UNLOCK -> CHANGE -> TEST -> DEPLOY VERIFY -> RE-LOCK.
5. Do not claim production parity without checking source, deployed asset/runtime, backend, database and smoke tests.
6. GitHub is not deleted during migration. It remains backup/source history until Cloudflare is independently verified.
7. If any required audit area is not checked, the audit status is NOT COMPLETE.

## 3. Master table of contents
001 Project identity and status
002 Architecture
003 Complete file map
004 Frontend
005 Input report
006 Category system
007 Area and item
008 Dashboard
009 Report list
010 Monthly recap
011 Staff monitoring
012 Login/session
013 Access control/security
014 Backend API
015 Supabase database
016 RLS/authorization
017 Audit log/history
018 Master data
019 PWA/service worker
020 Cache/versioning
021 Performance
022 E2E/regression testing
023 GitHub
024 Cloudflare
025 Supabase deployment
026 CI/CD
027 Backup/rollback
028 Data integrity
029 UI/UX
030 Mobile/responsive
031 Cross-module integration
032 Regression audit
033 Deployment verification
034 Final production audit
035 Change log
036 Known issues
037 Baselines/checkpoints
038 Change-control rules
039 Audit procedure
040 Audit command form

## 4. Control files
- LOCK_REGISTER.yaml — machine-readable module protection.
- BASELINE_REGISTER.yaml — known-good checkpoints and versions.
- REGRESSION_MATRIX.yaml — required regression coverage.
- AI_AUDIT_PROTOCOL.md — instructions for any AI/engineer auditing or changing this project.

## 5. Current architecture target
Cloudflare:
- Frontend/PWA
- Worker/API
- D1/database when migration is complete

GitHub:
- source history
- backup
- recovery/rollback reference
- CI/CD during transition

Supabase:
- current backend/database dependency until migration is complete; it must not be removed merely because Cloudflare frontend is live.

## 6. Release gate
A release is PASS only when:
SOURCE = PASS
DEPENDENCIES = PASS
REGRESSION = PASS
CACHE/VERSION = PASS
GITHUB = PASS
CLOUDFLARE = PASS
SUPABASE = PASS (while still used)
DATABASE = PASS
SECURITY = PASS
PRODUCTION SMOKE = PASS
PARITY = PASS

Otherwise status is BLOCKED or PASS WITH WARNING.

## 7. Change protocol
Before changing code:
1. Identify target module.
2. Read LOCK_REGISTER.
3. Read BASELINE_REGISTER.
4. Build impact/dependency map.
5. Create or verify rollback checkpoint.
6. Change only the approved scope.
7. Run targeted and cross-module regression tests.
8. Check cache/version references.
9. Verify deployment.
10. Re-lock after successful verification.

## 8. Audit command
When the user says **AUDIT IPSRS — TOTAL**, inspect all chapters 001-040 and report exact PASS/WARNING/BLOCKED evidence. Do not substitute a partial audit and call it total.

When the user says **AUDIT IPSRS — BAB N**, inspect that chapter plus every dependency it affects.

When the user says **UPDATE/REPAIR [MODULE]**, do not touch unrelated LOCKED modules.

## 9. Lock philosophy
Locks are behavioral, not merely file-based. A single file may contain multiple module behaviors. Therefore a shared file must be edited only within the requested scope, with protected behaviors regression-tested.

## 10. Migration rule
The Control Book and its machine-readable registers remain in GitHub even after production migrates to Cloudflare. A Cloudflare Control Plane may mirror/control these records later, but GitHub remains the independent recovery copy.

## 11. Chapter completion status — 2026-10-04
The 40 chapters are the required audit scope. A chapter is not COMPLETE merely because it appears in the table of contents.

| Chapter | Current status | Evidence / note |
|---|---|---|
| 001 | PARTIAL | Repository, target architecture and migration posture recorded above. |
| 002 | PARTIAL | GitHub → Cloudflare Worker → Supabase current path recorded; final D1 target recorded. |
| 003 | PARTIAL | Key control files, frontend, Supabase and workflow paths are known; full file/function inventory still required. |
| 004–009 | PARTIAL | Module boundaries exist in LOCK_REGISTER; full source audit still required. |
| 010 | PARTIAL | REKAP module registered; implementation and regression evidence pending. |
| 011 | PARTIAL | MONITORING module registered; implementation and regression evidence pending. |
| 012–018 | PARTIAL | AUTH, REPORT, MASTER, SECURITY and AUDIT_LOG controls registered; source/database audit pending. |
| 019–021 | PARTIAL | PWA, cache and performance controls registered; numeric production baselines pending. |
| 022 | PARTIAL | DASH browser tests are now implemented; remaining matrix tests are explicitly PLANNED. |
| 023–026 | PARTIAL | GitHub/Cloudflare/Supabase/CI controls registered; parity/deployment audit pending. |
| 027 | WARNING | Current backup evidence is insufficient for full restore certification; full backup/restore procedure is required. |
| 028–034 | PARTIAL | Required control scope exists, but production/data/security/parity evidence is not yet complete. |
| 035 | ACTIVE | Change log begins with the current audit-control corrections below. |
| 036 | ACTIVE | Known issues are recorded below and must remain visible until closed. |
| 037 | ACTIVE | Baselines are controlled through BASELINE_REGISTER.yaml. |
| 038–040 | ACTIVE | Change-control, audit procedure and command contract are defined by this book and AI_AUDIT_PROTOCOL.md. |

## 12. Change log — control-system corrections
- 869ec51da37648f810e2d89f8c425cc8ec21765c3 — corrected audit lock/secret-scan regex escaping.
- c34e9d1f96d0252f7015d27653e05768e3cd89c3 — corrected BASELINE_REGISTER structure and recorded the audit-gate checkpoint.
- 373890d45bde872c901c2be8c06eca38407eca12 — added IMPLEMENTED/PLANNED status to regression tests.
- a676abb9f3910f38c2d055f472c43393376ae0b9 — implemented four DASH regression tests.
- c35f7b83b33d3c80abe070e07ee03544693ec070 — repaired LOCK gate parser and added executable synthetic self-test.
- a354fd45d4f0a7c888cea1ced5981fe5af43dc67 — expanded protected files/modules in LOCK_REGISTER.

## 13. Known issues / open gates
1. DASH is LOCKED, but its new browser tests still require a successful CI run before this control revision can be considered fully verified.
2. KAT, KESLING, AUTH, REPORT, MASTER, PWA, PERFORMANCE and SECURITY remain STABLE_CANDIDATE until their required regression and production evidence exists.
3. Cloudflare source/deployment parity has not yet been certified from this control revision.
4. Supabase database/RLS/API parity has not yet been fully audited.
5. Backup/restore has not yet been certified as a full project recovery path.
6. Numeric performance baselines are not yet captured for startup, Dashboard, reports and Monitoring.
7. Remaining PLANNED regression IDs must be implemented before corresponding modules can become LOCKED.

## 14. Baseline / checkpoint policy
- Never delete the only recovery baseline for a module.
- Every approved behavioral update gets a new commit checkpoint after regression.
- A source checkpoint is not a production-approved checkpoint until deployment and smoke verification are evidenced.
- GitHub remains the independent recovery copy during and after Cloudflare migration.

## 15. Backup / rollback minimum procedure
### GitHub source recovery
1. Preserve the target commit SHA in BASELINE_REGISTER.yaml.
2. Clone/export the repository at that exact SHA.
3. Preserve .github, frontend, supabase, wrangler.jsonc, migrations and control registers.
4. Verify the exported tree before using it for recovery.

### Supabase recovery
1. Preserve migration history and Edge Function source in GitHub.
2. Export database schema and required production data using the authorized Supabase/Postgres backup mechanism.
3. Record project ref, migration state and Edge Function version.
4. Restore schema first, then data, then Edge Function.
5. Run RLS/auth/report smoke tests before reconnecting production.

### Cloudflare recovery
1. Preserve Worker name, deployment/version identifier and asset source.
2. Keep the last known-good Worker deployment reference.
3. Re-deploy the known-good source/asset set from GitHub.
4. Verify HTTP, asset versions and backend connectivity before declaring rollback complete.

Current limitation: this section is a procedure, not proof that a complete automated backup archive has already been produced.

## 16. Control principle
The Control Book is a gate, not a diary. Any PASS must have evidence; any missing evidence remains PARTIAL/WARNING; any failed LOCKED-module regression blocks deployment.