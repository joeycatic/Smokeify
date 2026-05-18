# Analyzer Control Plane Boundary

`Smokeify` is no longer a public analyzer runtime.

## Own in Smokeify

- `src/app/admin/analyzer/*`
- analyzer review and QA
- recommendation profiles and guide mappings
- shared Growvault support contracts under `src/app/api/shared/growvault/*`

## Transitional only

- `src/app/pflanzen-analyzer/page.tsx`
- `src/app/api/plant-analyzer/*`
- `src/app/api/mobile/ai/*`
- `src/app/api/mobile/journal/state/route.ts`

These routes now exist only as a compatibility bridge to `Growvault` and must not gain new analyzer business logic.

## Cutover rules

- Public analyzer pages redirect to Growvault.
- Public analyzer and mobile endpoints proxy to Growvault with deprecation headers and logs.
- Smokeify nav and homepage should not present a second local analyzer product.
- Remove the compatibility bridge after the stabilization window once legacy traffic is clear.
