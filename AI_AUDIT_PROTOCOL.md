# AI AUDIT PROTOCOL — LHI

## Mandatory pre-flight
Before any audit/change:
1. Read PROJECT_CONTROL.md.
2. Read LOCK_REGISTER.yaml.
3. Read BASELINE_REGISTER.yaml.
4. Identify the requested module.
5. Identify direct and indirect dependencies.
6. Determine whether the requested change crosses a LOCKED boundary.

## Never do
- Never modify a LOCKED module without explicit user request.
- Never assume a file is isolated because its name looks unrelated.
- Never call a partial inspection an "audit total".
- Never declare Cloudflare production equal to GitHub without actual parity evidence.
- Never overwrite a known-good fix just because an older baseline is easier.
- Never remove GitHub during the migration unless the user explicitly requests it after Cloudflare stability is proven.

## Required change sequence
REQUEST -> IMPACT MAP -> CHECKPOINT -> CHANGE -> STATIC TEST -> REGRESSION -> CACHE CHECK -> DEPLOY -> PRODUCTION SMOKE -> PARITY -> RE-LOCK.

## Shared-file rule
If a shared file such as frontend/app.js is required:
- identify protected functions/behaviors;
- modify only the requested scope;
- run all regression tests for protected behaviors;
- if a protected behavior fails, BLOCK the change and restore/reconcile before deployment.

## Lock lifecycle
STABLE -> LOCKED
LOCKED -> (explicit user request) -> UNLOCKED
UNLOCKED -> TESTING
TESTING -> RE-LOCKED only after all required tests pass
TESTING -> BLOCKED if any protected regression fails

## Evidence rule
Every PASS must cite concrete evidence: commit, file, test, deployment/version, query result, or runtime result. "Looks correct" is not evidence.

## Final response format
- Scope audited
- Files/modules checked
- LOCKED modules affected: yes/no
- Regression result
- Deployment result
- Remaining risks
- Final status: PASS / PASS WITH WARNING / BLOCKED
