# Smokeify / GrowVault Storefront Parity Masterprompt

## Objective

Rebuild the complete public Smokeify storefront from GrowVault commit `4b11a73`
while preserving Smokeify branding, legal identity, `MAIN` catalog exposure,
commerce backend, and shared-admin ownership.

GrowVault is the visual and interaction reference. Smokeify remains a separate
deployment and must not import runtime code from the GrowVault repository.

## Source Of Truth

- Visual reference: GrowVault `4b11a73`.
- Product, category, collection, price, stock, and merchandising truth: the
  shared Smokeify database and Smokeify admin.
- Smokeify storefront eligibility: explicit `MAIN` storefront assignment.
- GrowVault storefront eligibility: explicit `GROW` assignment plus GrowVault
  safety vetoes.
- Admin and operational ownership: Smokeify.
- Public customizer and plant-analyzer ownership: GrowVault.

## Required Outcome

Smokeify must use the same light, trust-oriented design language as GrowVault:

- DM Sans body typography, Syne display typography, and JetBrains Mono labels.
- Warm white and pale sage surfaces with forest-green primary actions, clay and
  sky supporting accents, subtle borders, soft shadows, and restrained motion.
- The same responsive shell patterns, content widths, card geometry, product
  density, filter/drawer behavior, focused checkout treatment, and accessible
  interaction states.
- Smokeify branding, metadata, contact details, legal copy, and canonical URLs.
- Smokeify products and categories selected from `MAIN`; never hardcoded
  GrowVault product handles or counts.

## Route And Template Matrix

### Shared storefront shell

- Root layout and metadata
- Announcement bar
- Desktop and mobile navigation
- Category navigation and search
- Cart and account drawers
- Cookie consent and settings
- Footer and newsletter
- Loading, empty, error, and not-found states

### Discovery and commerce

- `/`
- `/products`
- `/products/[handle]`
- `/products/compare`
- `/bestseller`, `/neuheiten`, and collection aliases
- SEO category and subcategory routes under `/(seo)/[...slug]`
- Search, quick view, filters, recommendations, and recently viewed products
- `/wishlist`
- `/cart`
- `/checkout/start` and `/checkout/payment`
- `/order/success`, `/order/failure`, `/order/rejected`, and `/order/view/[id]`

### Customer and support

- Authentication routes
- Account dashboard, settings, password, order detail, reorder, and returns
- Contact, FAQ, about, shipping, returns, privacy, terms, imprint, youth
  protection, and withdrawal pages plus their existing aliases
- Blog listing and detail templates

### GrowVault-owned public tools

- Smokeify `/customizer` redirects to GrowVault `/customizer` and preserves the
  query string.
- Smokeify `/pflanzen-analyse` and legacy analyzer aliases redirect to
  GrowVault `/pflanzen-analyse` and preserve the query string.
- Smokeify must not expose local customizer/analyzer UI, APIs, presets, case
  libraries, chatbot runtime, or grow-only guides as newly supported public
  surfaces.
- Smokeify navigation may link to the canonical GrowVault destinations with
  clear accessible labels.

## Catalog And Admin Contract

- Every Smokeify catalog query must require active `MAIN` assignment.
- Category and collection visibility must respect `MAIN` assignments.
- Homepage hero, deal, and bestseller products use the existing
  `LandingPageSection` records for `MAIN`; catalog-driven fallbacks are required
  when no rows are configured.
- Homepage category cards and counts come from live `MAIN` catalog data.
- Search, recommendations, PDPs, quick view, wishlist, mobile APIs, sitemap,
  and product feed must never expose a `GROW`-only product.
- Checkout and order creation continue to record `sourceStorefront: MAIN`.
- Prices, totals, discounts, stock, tax, payment state, and authorization remain
  server-owned.
- Smokeify shared GrowVault feeds and admin APIs keep their existing contracts.

## Implementation Boundaries

- Do not replace or synchronize Prisma schemas from GrowVault.
- Do not copy GrowVault API, cron, admin, analyzer, chatbot, or supplier logic.
- Do not change Smokeify admin information architecture, permissions, or page
  bodies as part of this storefront pass.
- Keep admin tokens and styles isolated from storefront token changes.
- Do not change Viva webhook truth, payment state semantics, inventory mutation,
  refunds, return authorization, or account authorization.
- Do not modify the GrowVault worktree. Existing uncommitted GrowVault order and
  cart work belongs to the user.
- Use real German umlauts in visible copy.
- Do not deploy or perform another externally visible action without explicit
  confirmation.

## Responsive And Accessibility Requirements

- No unintended page-level horizontal overflow at 390, 768, or 1440 pixels.
- Navigation, drawers, dialogs, filters, cart controls, checkout forms, and
  account actions remain keyboard and touch accessible.
- Maintain logical headings, visible focus, labelled controls, meaningful alt
  text, and live regions for changing status.
- Touch targets should be at least 44 pixels where practical.
- Motion must respect `prefers-reduced-motion`.
- Text/background contrast must meet WCAG AA.

## Verification

Smokeify:

```bash
npm run check
npm run test:e2e
```

GrowVault, because shared catalog and ownership contracts are in scope:

```bash
npm run check
npm run contracts:growvault-catalog
```

Browser verification must cover the shared shell, homepage, catalog, filter
drawer, PDP, cart, checkout, authentication/account, and legal templates at
390, 768, and 1440 pixels. Validate one `MAIN` product across discovery through
checkout and prove a `GROW`-only product is absent from every Smokeify public
catalog surface.

## Definition Of Done

- Corresponding Smokeify and GrowVault templates have the same visual hierarchy,
  spacing, density, responsiveness, and interaction treatment, with deliberate
  differences limited to brand/legal identity, catalog scope, and GrowVault-only
  tools.
- Smokeify admin changes to `MAIN` assignments and landing-page selections are
  reflected without code changes.
- GrowVault catalog behavior and shared control-plane feeds remain compatible.
- All required quality gates pass, residual risks are documented, the operating
  runbook is current, and SecondBrain records the completed decision.
