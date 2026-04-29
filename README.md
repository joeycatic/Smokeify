# Smokeify

Smokeify is a production-oriented commerce platform for indoor gardening products. It combines a public storefront, authenticated customer accounts, Stripe checkout, operational admin tools, supplier/catalog automation, and AI-assisted plant analysis in one Next.js codebase.

The project is built to demonstrate the kind of engineering needed behind a real online shop: trustworthy payment handling, auditable order state, catalog operations, admin workflows, and maintainable full-stack application structure.

## Highlights

- Full-stack storefront with product browsing, collections, search, cart, wishlist, account, checkout, and post-purchase flows.
- Stripe Checkout integration with webhook-confirmed order handling instead of relying on client redirects.
- Admin workspace for orders, catalog, suppliers, pricing, analytics, returns, reports, expenses, users, alerts, and content controls.
- Prisma/PostgreSQL data model covering commerce, inventory, tax, returns, reviews, supplier data, pricing automation, analytics, and governance workflows.
- Operational scripts for supplier imports, stock sync, market price checks, pricing overrides, test order seeding, and backfills.
- AI plant analyzer flow with upload validation, history, feedback, review status, and admin governance hooks.
- Multi-storefront groundwork for Smokeify and GrowVault source attribution.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 6
- PostgreSQL
- Stripe
- NextAuth
- Vitest
- ESLint
- Vercel Blob and Sentry integration points

## Product Areas

### Customer Experience

- Landing page merchandising and curated product sections
- Product listing, filters, collections, SEO routes, and product detail pages
- Cart, checkout start, hosted payment flow, and order confirmation
- Customer account dashboard, order history, password management, returns, wishlist, and Discord account linking
- Blog/content pages, newsletter flows, contact forms, and policy pages

### Commerce Operations

- Order management with payment state, tax snapshots, refunds, returns, and operational documents
- Catalog management for products, variants, categories, collections, media, cross-sells, and compliance metadata
- Supplier management, purchase orders, stock sync, inventory adjustments, and procurement workflows
- Pricing automation with recommendation history, review queues, margin inputs, and audit trails
- Admin analytics, finance, VAT, profitability, reports, alerts, audit logs, customer tasks, and support cases

### Automation and Integrations

- Stripe sessions and webhooks for payment-aware order workflows
- Supplier scraping/import scripts for catalog and cost data
- Market comparison scripts for price monitoring
- Scheduled routes for checkout recovery, admin reports, rate-limit cleanup, supplier sync, a daily supplier sync Telegram report, and diagnostics
- Email-oriented flows for newsletters, orders, refunds, and storefront notifications

## Architecture Notes

Smokeify keeps business-critical decisions on the server. Checkout, pricing, discounts, tax handling, payment state, inventory movement, admin access, and compliance checks are handled through backend routes, shared domain helpers, and Prisma-backed persistence.

Key patterns:

- Client UI is separated from server-side commerce rules.
- Stripe webhooks are treated as the authoritative payment signal.
- Order and payment workflows preserve snapshots for later audit and reconciliation.
- Admin features are organized as first-class workflows rather than one-off database edits.
- Operational scripts are explicit, reviewable, and dry-run oriented where practical.
- Tests focus on shared domain logic such as checkout policy, tax, payment fees, order updates, uploads, security, reports, and pricing automation.

## Repository Structure

```text
src/
  app/          Next.js pages, layouts, route handlers, admin routes, and API routes
  components/   Shared storefront, checkout, navigation, and admin UI components
  content/      Blog/content source files
  data/         Static and curated data inputs
  hooks/        Reusable React hooks
  lib/          Domain logic, service functions, integrations, guards, and tests
  types/        Shared TypeScript declarations

prisma/         Prisma schema and migrations
scripts/        Supplier, catalog, pricing, market, order, and maintenance scripts
public/         Static assets, logos, uploads, favicons, and storefront media
remotion/       Video/banner rendering workspace
```

## Getting Started

This repository intentionally excludes production credentials, supplier credentials, and deployment-specific secrets. Some flows require external services before they run end to end.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Common local values include:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Optional feature groups in `.env.example` cover admin security, email, checkout, loyalty, public storefront routing, AI features, jobs, supplier sync, pricing automation, storage, observability, and GrowVault storefront attribution.

### 3. Prepare the database

```bash
npx prisma generate
npx prisma migrate dev
```

If the database schema is already prepared and you only need the generated client:

```bash
npx prisma generate
```

### 4. Run locally

```bash
npm run dev
```

The dev server runs at [http://localhost:3900](http://localhost:3900).

## Stripe Webhook Testing

To test checkout completion locally:

```bash
stripe listen --forward-to http://localhost:3900/api/webhooks/stripe
```

Copy the generated signing secret into `STRIPE_WEBHOOK_SECRET`, then trigger a sample event:

```bash
stripe trigger checkout.session.completed
```

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run test:coverage
```

Operational scripts:

```bash
npm run bloomtech:scrape-preview
npm run bloomtech:import-preview
npm run bloomtech:override-pricing
npm run b2b-headshop:scrape-preview
npm run b2b-headshop:override-pricing
npm run suppliers:sync-stock
npm run orders:backfill-payment-fees
npm run orders:backfill-sources
npm run testing:seed-orders
```

Additional script notes are documented in [scripts/README.md](./scripts/README.md).

## Example Checkout Flow

1. A customer adds products to the cart and starts checkout.
2. The server rebuilds prices, discounts, shipping, tax, and order context from trusted backend data.
3. A Stripe Checkout Session is created with order metadata and storefront source attribution.
4. Stripe hosts the payment flow.
5. The webhook confirms payment completion.
6. The backend creates or updates the order, records payment state, and continues post-purchase workflows from server-side events.

## Security and Correctness Principles

- Payment completion is never trusted from a browser redirect alone.
- Sensitive pricing, tax, discount, and order calculations stay server-side.
- Admin routes use explicit access checks and governance-oriented workflows.
- Upload, auth, token, and request-security helpers are covered by focused tests.
- Secrets and deployment-specific credentials are kept out of the repository.
- Operational scripts favor explicit inputs and reviewable output before writes.

## Suggested Review Path

For interviewers or reviewers, these files provide a useful cross-section of the codebase:

- [src/app/api/checkout/route.ts](./src/app/api/checkout/route.ts) - checkout session creation and server-side commerce validation
- [src/app/api/webhooks/stripe/route.ts](./src/app/api/webhooks/stripe/route.ts) - webhook-driven payment/order handling
- [src/lib/checkoutPolicy.ts](./src/lib/checkoutPolicy.ts) - checkout rules and constraints
- [src/lib/adminOrders.ts](./src/lib/adminOrders.ts) - admin order domain logic
- [src/lib/pricingAutomationEngine.ts](./src/lib/pricingAutomationEngine.ts) - pricing recommendation logic
- [src/lib/adminFinance.ts](./src/lib/adminFinance.ts) - finance/admin reporting logic
- [src/lib/plantAnalyzer.ts](./src/lib/plantAnalyzer.ts) - AI-assisted plant analysis integration
- [prisma/schema.prisma](./prisma/schema.prisma) - data model and domain breadth
- [scripts/README.md](./scripts/README.md) - operational automation overview

## Notes for Outside Readers

Smokeify is not a tutorial storefront. It is an evolving application shaped around commerce correctness, operational tooling, and practical business constraints. Running every feature locally requires configured third-party services, but the codebase is structured so the main application architecture, domain modeling, and workflow design can be reviewed directly from the repository.
