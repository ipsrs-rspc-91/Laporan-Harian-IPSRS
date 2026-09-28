# IPSRS Full Regression Gate

This layer extends the static Automated Audit Gate with browser-level smoke tests.

## Automatic checks

- Initial application startup.
- Authentication/loading shell presence.
- Critical browser console/page errors.
- Reachability of critical versioned frontend assets.
- Playwright trace/screenshot/video artifacts on failure.

## Deliberate scope

This is a smoke/regression layer, not a substitute for live role testing. Authenticated role/RLS tests require dedicated non-production test identities and secrets. They must never be hard-coded into the repository.

## Deployment rule

The deployment workflow consumes the successful Automated Audit Gate result. Therefore a failed browser smoke test blocks the audit workflow and consequently blocks deployment.
