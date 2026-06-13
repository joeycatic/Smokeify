# Smokeify

Smokeify is a production-style e-commerce application built around two connected surfaces:

- a customer-facing storefront
- an advanced internal admin and operations layer

The repository is intentionally broader than a basic shop demo. It includes checkout and payment handling, customer accounts, catalog and inventory workflows, finance and tax tooling, reporting, operational automations, and supporting scripts in one Next.js codebase.

## What This Repository Covers

| Area | Included in the repo |
| --- | --- |
| Storefront | Product discovery, collections, cart, wishlist, checkout entry, order success flows |
| Customer account | Authentication, account pages, order history, password management, returns-related flows |
| Commerce backend | Order creation, payment state handling, webhook processing, inventory-aware workflows |
| Admin layer | Orders, catalog, suppliers, procurement, inventory adjustments, pricing, analytics, reports, finance, VAT, users |
| Operations | Audit-oriented workflows, saved reports, backfills, maintenance scripts, scheduled jobs |
| Data layer | Prisma schema, migrations, PostgreSQL-oriented domain modeling |

## Platform Summary

At a high level, this repository represents an e-commerce platform with a strong operational bias:

- Public storefront and account experience
- Server-side checkout validation and Stripe integration
- Admin-first workflows for day-to-day operations
- Finance, expense, VAT, and profitability reporting
- Inventory, supplier, and procurement support
- Reporting, alerts, and automation hooks
- Scriptable maintenance and backfill tooling

The emphasis is not just on selling products. It is on running the system behind the store with enough structure to support real operational work.

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

## Core Capabilities

### Storefront

- Product listing and detail routes
- Collection and category browsing
- Search and merchandising support
- Cart and wishlist
- Checkout start and hosted payment flow
- Order confirmation and follow-up flows

### Admin and Operations

- Order review, fulfillment, refunds, and operational documents
- Catalog and variant management
- Inventory tracking and manual adjustment workflows
- Supplier, purchase-order, and procurement workflows
- Pricing and recommendation tooling
- Analytics, reports, alerts, and audit surfaces
- Expense capture, recurring expenses, finance, VAT, and profitability views
- User and support-oriented admin tooling

### Integrations and Automation

- Stripe Checkout and webhook-driven payment confirmation
- Email and notification flows
- Scripted catalog and order maintenance tasks
- Scheduled operational jobs
- Export and reporting endpoints for admin workflows

## Architecture Principles

- Business-critical decisions stay on the server.
- Payment state is driven by authoritative backend signals.
- Admin features are implemented as workflows, not raw database shortcuts.
- Domain logic is separated from UI where possible.
- Operational changes are designed to be traceable and reviewable.
- Shared helpers and tests cover correctness-sensitive paths.

## Repository Structure

```text
src/
  app/          App routes, pages, layouts, route handlers, and admin surfaces
  components/   Shared UI for storefront and admin interfaces
  content/      Content sources
  data/         Static and curated inputs
  hooks/        Reusable React hooks
  lib/          Domain logic, services, integrations, guards, tests, and helpers
  types/        Shared TypeScript definitions

prisma/         Schema and migrations
scripts/        Operational scripts and backfills
public/         Static assets
remotion/       Video/banner rendering workspace
```

## Local Development

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

Typical local configuration includes values such as:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `VIVA_ENVIRONMENT` (`demo` or `production`)
- Demo Viva credentials when `VIVA_ENVIRONMENT=demo`:
  - `VIVA_DEMO_CLIENT_ID`
  - `VIVA_DEMO_CLIENT_SECRET`
  - `VIVA_DEMO_SOURCE_CODE`
  - `VIVA_DEMO_MERCHANT_ID`
  - `VIVA_DEMO_API_KEY`
- Production Viva credentials when `VIVA_ENVIRONMENT=production`:
  - `VIVA_PRODUCTION_CLIENT_ID`
  - `VIVA_PRODUCTION_CLIENT_SECRET`
  - `VIVA_PRODUCTION_SOURCE_CODE`
  - `VIVA_PRODUCTION_MERCHANT_ID`
  - `VIVA_PRODUCTION_API_KEY`
- Optional scoped webhook keys:
  - `VIVA_DEMO_WEBHOOK_VERIFICATION_KEY`
  - `VIVA_PRODUCTION_WEBHOOK_VERIFICATION_KEY`
- Legacy `VIVA_CLIENT_ID`, `VIVA_CLIENT_SECRET`, `VIVA_SOURCE_CODE`, `VIVA_MERCHANT_ID`, `VIVA_API_KEY`, and `VIVA_WEBHOOK_VERIFICATION_KEY` still work as fallbacks.

### 3. Prepare the database

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Run the application

```bash
npm run dev
```

The development server runs at [http://localhost:3900](http://localhost:3900).

## Build and Verification

Useful commands:

```bash
npm run dev
npm run build
npm run vercel-build
npm run start
npm run lint
npm test
```

## Stripe Webhook Testing

For local payment-flow testing:

```bash
stripe listen --forward-to http://localhost:3900/api/webhooks/stripe
```

Then add the generated signing secret to `STRIPE_WEBHOOK_SECRET` and trigger a sample event:

```bash
stripe trigger checkout.session.completed
```

## Operational Scripts

The repository includes a set of maintenance and backfill scripts for order, catalog, supplier, and pricing operations.

Examples:

```bash
npm run suppliers:sync-stock
npm run orders:backfill-payment-fees
npm run orders:backfill-sources
npm run orders:backfill-attribution
npm run testing:seed-orders
```

Additional notes are documented in [scripts/README.md](./scripts/README.md).

## Suggested Review Path

These files give a good cross-section of the repository:

- [src/app/api/checkout/route.ts](./src/app/api/checkout/route.ts)
- [src/app/api/webhooks/stripe/route.ts](./src/app/api/webhooks/stripe/route.ts)
- [src/lib/checkoutPolicy.ts](./src/lib/checkoutPolicy.ts)
- [src/lib/adminFinance.ts](./src/lib/adminFinance.ts)
- [src/lib/adminAddonData.ts](./src/lib/adminAddonData.ts)
- [src/lib/pricingAutomationEngine.ts](./src/lib/pricingAutomationEngine.ts)
- [prisma/schema.prisma](./prisma/schema.prisma)
- [scripts/README.md](./scripts/README.md)

## Notes

- This repository does not include production credentials or deployment secrets.
- Some end-to-end flows require configured third-party services.
- The codebase is best read as a full-stack commerce and admin platform rather than a minimal storefront example.
