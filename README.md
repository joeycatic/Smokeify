# Smokeify

Smokeify is a production-oriented e-commerce platform built with Next.js, TypeScript, Prisma, PostgreSQL, and Stripe. The repository combines a customer storefront, authenticated account area, admin operations workspace, supplier/catalog tooling, and payment-aware order workflows in a single codebase.

This is an open repository, so environment values, credentials, and deployment-specific secrets are intentionally excluded. The goal of this README is to make the project understandable to outside readers while still being useful for local development.

## Why this project is interesting

- Full-stack commerce application with real business constraints, not a toy storefront
- Server-side pricing, payment, and order-state logic designed for auditability
- Admin tooling for catalog management, reports, order operations, and content control
- Operational scripts for supplier imports, repricing, market research, and stock sync
- Multi-storefront groundwork, including Smokeify and GrowVault source attribution

## What it demonstrates

- App Router architecture in a large Next.js application
- Type-safe server and database workflows with Prisma
- Stripe Checkout and webhook-driven order fulfillment flows
- Separation of presentational UI from business-critical server logic
- Operational thinking around inventory, pricing, reporting, and repeatable scripts

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma
- PostgreSQL
- Stripe
- NextAuth
- Vitest
- ESLint

## Core product areas

- Storefront browsing with collections, product detail pages, cart, and checkout initiation
- Customer account flows for orders, profile management, and related post-purchase actions
- Admin workspace for orders, reports, suppliers, catalog management, landing page controls, and governance features
- Payment and fulfillment flows built around Stripe sessions and webhook-confirmed payment state
- Supplier and pricing scripts for catalog imports, margin updates, stock sync, and market comparisons
- Supporting product features such as wishlist, blog/content pages, analytics hooks, and AI-assisted plant analysis

## Architecture notes

- UI components are primarily presentational; business rules stay server-side
- Order totals, discounts, taxes, and payment state are computed from backend sources
- Webhooks are treated as the source of truth for final payment status
- Prisma models preserve order snapshots and operational traceability
- Scripts are organized by domain so supplier, catalog, market, and order operations remain reviewable

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the template and fill in the values you need:

```bash
cp .env.example .env
```

On PowerShell, use:

```powershell
Copy-Item .env.example .env
```

At minimum, local development usually needs:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

If you are working with the GrowVault storefront source detection locally, also set:

- `NEXT_PUBLIC_GROW_APP_URL`
- `GROW_STOREFRONT_HOSTS`

Other variables in `.env.example` are grouped by concern:

- admin security
- checkout and payments
- account/token security
- loyalty and incentives
- public storefront routing
- email and messaging
- AI features
- jobs and operations
- supplier sync and repricing
- storage and observability

### 3. Prepare the database

Generate the Prisma client and apply your local schema:

```bash
npx prisma generate
npx prisma migrate dev
```

If you already have a database and only need the client:

```bash
npx prisma generate
```

### 4. Start the app

```bash
npm run dev
```

The local dev server runs on [http://localhost:3900](http://localhost:3900).

## Stripe webhooks for local testing

To test checkout completion and order creation locally:

```bash
stripe listen --forward-to http://localhost:3900/api/webhooks/stripe
```

Then copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

Useful test command:

```bash
stripe trigger checkout.session.completed
```

## Useful commands

### App quality

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```

### Catalog and supplier operations

```bash
npm run bloomtech:scrape-preview
npm run bloomtech:import-preview
npm run bloomtech:override-pricing
npm run b2b-headshop:scrape-preview
npm run b2b-headshop:override-pricing
npm run suppliers:sync-stock
```

### Orders and backfills

```bash
npm run orders:backfill-payment-fees
npm run orders:backfill-sources
npm run testing:seed-orders
```

Additional operational script notes live in [`scripts/README.md`](./scripts/README.md).

## Repository structure

```text
src/
  app/           Next.js routes, pages, route handlers, and admin UI
  components/    Shared UI building blocks
  content/       Content and content-adjacent source files
  data/          Static or curated data inputs
  hooks/         Reusable React hooks
  lib/           Domain logic, services, helpers, and tests
  types/         Shared TypeScript types

prisma/          Prisma schema and migrations
scripts/         Operational and supplier automation scripts
public/          Public assets
docs/            Supporting internal documentation
```

## Example end-to-end commerce flow

1. A customer adds products to cart and starts checkout.
2. The server rebuilds pricing and shipping from trusted backend data.
3. A Stripe Checkout Session is created with source metadata and order context.
4. Stripe redirects the customer through the hosted checkout flow.
5. The webhook confirms completion and the backend creates or updates the order.
6. Inventory, payment state, and post-purchase communication are handled from server-side events.

## Security and correctness principles

- Payment status is never trusted from client redirects alone
- Sensitive pricing and order calculations stay on the server
- Payment, inventory, and order transitions are designed to fail loudly when data is incomplete
- Environment secrets are never committed to the repository
- Admin and script workflows are structured to be explicit and reviewable

## Notes for outside readers

- This codebase is actively shaped around business correctness, not tutorial simplicity
- Some features depend on third-party services or private operational credentials and will need local configuration before they run end-to-end
- The open repository intentionally omits production secrets, supplier credentials, and deployment-specific values

## Recruiter summary

If you are reviewing this repository as a portfolio project, the strongest places to inspect are:

- [`src/app/api/checkout/route.ts`](./src/app/api/checkout/route.ts)
- [`src/app/api/webhooks/stripe/route.ts`](./src/app/api/webhooks/stripe/route.ts)
- [`src/lib/orderSource.ts`](./src/lib/orderSource.ts)
- [`src/lib/adminOrders.ts`](./src/lib/adminOrders.ts)
- [`prisma/schema.prisma`](./prisma/schema.prisma)
- [`scripts/README.md`](./scripts/README.md)

Those files give a good view of how the project handles commerce logic, data modeling, operational tooling, and the tradeoffs of maintaining a real application over time.
