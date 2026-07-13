# Cross-Storefront Operating Runbook

Smokeify is the shared control plane for the main Smokeify storefront and GrowVault. Treat cross-storefront work as an operational workflow, not as two independent shop deployments.

## Source of truth

- Product, category, and collection storefront visibility is owned in Smokeify through the shared `storefronts` fields.
- `MAIN` means visible on Smokeify.
- `GROW` means eligible for GrowVault.
- Products may be assigned to both storefronts when the offer, compliance posture, and merchandising intent fit both brands.
- GrowVault may still apply safety vetoes at render time, but those vetoes are a backstop. They are not the primary catalog assignment workflow.

## Storefront parity contract

- GrowVault commit `4b11a73` is the visual and interaction reference for the public Smokeify storefront. The implementation contract and full route matrix live in `docs/smokeify-growvault-storefront-parity-masterprompt.md`.
- Smokeify and GrowVault remain separate deployments. Smokeify ports the reference presentation locally and does not import GrowVault runtime code.
- Smokeify public catalog, search, category, PDP, wishlist, recommendation, sitemap, and merchandising surfaces require active `MAIN` assignment. A `GROW`-only product must never appear on Smokeify.
- Homepage hero, deal, and bestseller slots are controlled in Smokeify admin with the `MAIN` storefront selected. Empty slots use active `MAIN` catalog fallbacks; product handles and counts are not hardcoded.
- GrowVault owns the public customizer, plant analyzer, setup presets, chatbot, and grow guides. Smokeify links or redirects to the canonical GrowVault routes and preserves handoff query parameters.
- Prices, stock, discounts, tax, authorization, Viva payment state, and order attribution remain server-owned in Smokeify. Smokeify checkout traffic must resolve to `sourceStorefront: MAIN`; shared GrowVault checkout traffic must continue to resolve to `GROW`.

## Required checks before release

Run these before deploying changes that affect catalog visibility, checkout, shared feeds, analyzer review, merchandising, or pricing:

```bash
npm run check
```

For GrowVault-facing changes, also run this in the GrowVault repo:

```bash
npm run check
npm run contracts:growvault-catalog
```

For Smokeify storefront releases, run `npm run test:e2e`. In seeded or staging
environments, set `SMOKEIFY_E2E_PRODUCT_PATH=/products/<handle>` so the smoke
also covers product add-to-cart and checkout-start handoff.

The browser pass must cover 390, 768, and 1440 pixel viewports, including the
homepage, catalog/filter drawer, dynamic category and PDP routes, cart,
checkout, authentication/account, legal pages, keyboard dismissal,
reduced-motion behavior, and page-level overflow.

## Failure modes

If GrowVault cannot reach Smokeify shared feeds:

- keep GrowVault storefront browsing and checkout online when direct database reads still work
- hide or fall back shared merchandising slots instead of rendering partial operator state
- show the latest local diagnostics in GrowVault `/internal/shared-health`
- fix Smokeify shared API or deployment health before changing GrowVault fallback code

If storefront assignment looks wrong:

- inspect the product/category `storefronts` fields in Smokeify admin
- verify the product is active, has an active variant, price, stock state, and product image
- run the GrowVault catalog contract check
- only then inspect GrowVault text/category safety vetoes

If pricing or stock differs between storefronts:

- treat Smokeify database values as canonical
- pause repricing/supplier automation if the issue could be automated drift
- verify supplier sync and pricing automation logs before manual overrides
- record manual inventory or price changes through admin workflows, not direct database writes

## Escalation order

1. Smokeify admin health and deployment status
2. Shared database schema and migrations
3. Shared GrowVault feeds under `/api/shared/growvault/*`
4. GrowVault `/internal/shared-health`
5. Storefront-specific rendering or safety veto logic

## Ownership

- Smokeify owns operator workflows, catalog assignments, pricing, procurement, finance, admin permissions, and shared feeds.
- GrowVault owns grow-only storefront rendering, customer-facing grow flows, analyzer UX, and storefront fallback behavior.
- Cross-storefront incidents need one owner for the incident and one explicit storefront impact label: `MAIN`, `GROW`, or `BOTH`.
- Public Smokeify design parity is owned in the Smokeify repository; GrowVault's storefront remains the visual reference and must not be edited as part of a Smokeify-only parity release.
