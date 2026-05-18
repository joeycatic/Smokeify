# Pricing Backend Migration Plan

## Goal

Move pricing backend ownership from `growvault` into `smokeify` so the shared admin, pricing models, pricing automation logic, approval flow, and audit trail all run inside one backend.

## Non-Goals

- Rewriting pricing rules or changing business logic during the move
- Reworking the admin UI beyond what is needed for backend relocation
- Changing pricing behavior, review thresholds, or approval semantics as part of the migration

## Current State

- Shared admin UI lives in `smokeify`
- Pricing backend currently lives in `growvault`
- Smokeify admin currently reaches GrowVault pricing over an integration layer
- GrowVault owns the pricing Prisma models, pricing routes, pricing service, and pricing migrations

## Target State

- Smokeify owns:
  - Prisma pricing models and migrations
  - pricing automation engine and service
  - admin pricing routes
  - variant pricing profile persistence
  - pricing run, recommendation, and audit records
- GrowVault becomes a storefront-only consumer and no longer owns pricing backend state
- Cross-app pricing proxying is removed

## Constraints

- Preserve pricing correctness over speed
- Avoid any silent pricing fallback
- Keep approval and audit flows trustworthy
- Minimize downtime and avoid partial cutovers
- Do not lose historical pricing runs, recommendations, or change audit records

## Phase 0: Discovery And Mapping

### Tasks

1. Inventory all pricing-related files in `growvault`:
   - Prisma models and migration files
   - `pricingAutomationEngine`
   - `pricingAutomationService`
   - admin pricing routes
   - product and variant admin routes with `pricingProfile`
   - sample seed scripts and tests
2. Inventory all pricing integration touchpoints in `smokeify`:
   - `adminPricingIntegration`
   - admin pricing page routes
   - catalog variant pricing profile UI
   - product page pricing profile loading
3. Confirm schema compatibility assumptions:
   - product ids
   - variant ids
   - user ids
   - admin audit log shape
   - money units and enum values
4. Identify code that can be copied as-is versus code that must be adapted to Smokeify-specific models or utilities.

### Deliverable

A written migration map with:
- source file
- destination file
- copy/adapt/rebuild decision
- data dependencies
- blockers

## Phase 1: Schema Port Into Smokeify

### Tasks

1. Port GrowVault pricing enums and models into Smokeify Prisma schema:
   - `VariantPricingProfile`
   - `PricingRun`
   - `PricingRecommendation`
   - `PricingChangeAudit`
   - related enums
2. Review relations against Smokeify `User`, `Product`, and `Variant` models.
3. Generate a Smokeify migration without changing semantics.
4. Review indexes and constraints carefully.

### Validation

- Prisma schema compiles
- migration SQL is reviewable and additive
- no existing Smokeify relations are broken

### Exit Criteria

Smokeify can represent all GrowVault pricing data locally without code using it yet.

## Phase 2: Data Migration Strategy

### Tasks

1. Decide cutover model:
   - one-time backfill plus freeze
   - or dual-write bridge for a limited window
2. Build a migration script that copies pricing data from GrowVault DB tables into Smokeify DB tables.
3. Preserve:
   - ids where safe
   - timestamps
   - recommendation status history
   - actor email and actor id relationships
4. Define behavior for actor ids when the same admin user ids do not match across apps.

### Validation

- row counts match
- key aggregates match
- sample recommendations and price-change audits match exactly
- migrated data produces the same admin pricing overview output

### Exit Criteria

A repeatable, dry-run-capable migration script exists and has been tested on non-production data.

## Phase 3: Service Layer Port

### Tasks

1. Move pricing runtime code into Smokeify:
   - pricing engine
   - pricing config
   - pricing service
   - any serialization helpers
2. Adapt imports to Smokeify utilities:
   - Prisma client
   - admin audit logging
   - auth/admin actor handling
3. Keep business logic byte-for-byte equivalent where possible.
4. Add or port tests into Smokeify.

### Validation

- unit tests pass
- engine outputs match GrowVault for identical fixtures
- review and apply flows generate equivalent DB writes

### Exit Criteria

Smokeify has a local pricing service with behavior parity to GrowVault.

## Phase 4: Route Port

### Tasks

1. Replace Smokeify proxy routes with real local route handlers.
2. Port or adapt these route families into Smokeify:
   - `/api/admin/pricing`
   - `/api/admin/pricing/run`
   - `/api/admin/pricing/recommendations/[id]`
   - `/api/admin/products/[id]` pricing-profile loading path
   - `/api/admin/variants/[id]` pricing-profile update path
3. Remove cross-app internal auth from Smokeify pricing integration once local routes are active.
4. Keep response payload shapes stable so the admin UI does not need a broad rewrite.

### Validation

- admin pricing overview works locally without remote calls
- preview run works
- approve and reject flows work
- variant pricing profile edit works
- no external pricing network requests occur

### Exit Criteria

Smokeify pricing admin works entirely against its own backend.

## Phase 5: UI And Integration Cleanup

### Tasks

1. Remove obsolete integration code in Smokeify:
   - remote fetch wrapper
   - GrowVault internal API key usage
   - pricing proxy env variables
2. Simplify naming so UI and docs reflect true ownership.
3. Remove no-longer-needed GrowVault internal access exceptions for pricing admin routes.

### Validation

- no references remain to old pricing proxy env vars
- Smokeify builds without remote pricing integration code
- GrowVault still behaves correctly as storefront-only

### Exit Criteria

Smokeify is the clear pricing backend owner in code, config, and docs.

## Phase 6: GrowVault Decommissioning For Pricing Backend

### Tasks

1. Remove or retire GrowVault pricing admin route implementations.
2. Keep storefront-safe pricing dependencies only if still needed for display logic.
3. Remove unused GrowVault pricing migrations or mark them historical-only.
4. Remove temporary server-to-server auth path added for Smokeify integration.

### Validation

- GrowVault no longer exposes or owns pricing backend behavior
- storefront behavior remains unchanged
- no broken imports or dead route references remain

### Exit Criteria

GrowVault is no longer a pricing backend dependency.

## Cutover Plan

1. Merge schema and service code into Smokeify behind a feature flag or disabled route switch.
2. Run Smokeify migration in staging.
3. Backfill pricing data into Smokeify staging.
4. Compare Smokeify and GrowVault pricing outputs on staging using the same sample variants.
5. Enable local Smokeify pricing routes in staging.
6. Validate admin flows end-to-end.
7. Repeat migration and verification in production during a controlled window.
8. Flip Smokeify to local pricing backend.
9. Monitor logs, pricing runs, approvals, and audit rows.
10. Remove temporary cross-app integration after stability window.

## Rollback Plan

- Keep GrowVault pricing backend intact until Smokeify cutover is proven stable
- Make route ownership switch reversible via config or a narrow code revert
- Do not delete GrowVault pricing tables or routes during the first production cutover
- If Smokeify pricing fails, revert route ownership to GrowVault and preserve all written audit context

## Test Plan

- Unit tests for pricing engine parity
- Unit tests for service-layer run/apply/reject behavior
- Route tests for pricing overview and review actions
- Integration tests for variant pricing profile update flow
- Manual validation in admin:
  - pricing overview loads
  - preview run completes
  - apply run writes expected price changes
  - pending review approval updates variant price and audit log
  - rejection updates recommendation status only

## Open Questions

1. Are Smokeify and GrowVault using the same physical database in all environments?
2. Are admin user ids shared across both apps, or only emails?
3. Does any non-admin GrowVault flow read pricing tables directly today?
4. Do we want a temporary dual-write period, or a hard cutover after backfill?
5. Should historical pricing ids be preserved exactly, or only business meaning and timestamps?

## Recommended Execution Order

1. Finish discovery map
2. Port schema into Smokeify
3. Build and test data migration
4. Port service layer
5. Port local routes
6. Run staging cutover
7. Run production cutover
8. Remove GrowVault pricing backend ownership
