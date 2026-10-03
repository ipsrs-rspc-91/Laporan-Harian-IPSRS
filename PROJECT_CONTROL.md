# PROJECT CONTROL — Laporan-Harian-IPSRS

> Audit gate syntax fix applied in `fa51116949d8a145f9778719aec2694c4abfbe56`; re-validation required before promoting any additional module to LOCKED.


**Control Book Version:** 1.0.0  
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
