# Customizer Control Plane Boundary

`Smokeify` is no longer a public customizer runtime.

## Own in Smokeify

- preset management and related catalog operations
- operational diagnostics and reporting for customizer-backed flows
- any internal/shared Growvault support contracts that stay admin-owned

## Transitional only

- `src/app/customizer/page.tsx`
- `src/app/api/customizer/options/route.ts`

These routes now exist only as a compatibility bridge to `Growvault` and must not gain new customizer business logic.

## Cutover rules

- public `/customizer` traffic redirects to Growvault
- public `/api/customizer/*` compatibility routes proxy to Growvault with deprecation headers and logs
- Smokeify may still link outward to the Growvault customizer, but it must not present a second local customizer implementation
- remove the compatibility bridge after the stabilization window once legacy traffic is clear
