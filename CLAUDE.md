# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 3900
npm run build        # Production build (also runs prisma generate)
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Vitest in watch mode
npm run test:coverage
npx prisma migrate dev   # Apply schema changes to local DB
npx prisma studio        # Browse DB in browser
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

### Stack
- **Next.js 16 App Router** (React 19, TypeScript 5, Tailwind CSS v4)
- **Prisma 6 + PostgreSQL** — all DB access goes through `src/lib/prisma.ts` singleton
- **NextAuth v4** — JWT sessions, credentials-only (email+password), custom pages at `/auth/*`
- **Stripe Checkout Sessions** — payment flow
- **Resend** (primary) + Nodemailer (fallback) for email
- **Vercel Blob** for image storage
- **Sentry** for error tracking

### Request / Data Flow

**Product data** is fetched server-side via `src/lib/catalog.ts` (marked `server-only`). It wraps Prisma queries in `unstable_cache` with short TTLs (30–300s). The canonical frontend type is `Product` in `src/data/types.ts`. Admin reads go directly through `src/lib/adminCatalog.ts` without caching.

**Cart** is stored client-side as a JSON cookie `smokeify_cart` — an array of `{ variantId, quantity, options[] }`. The `CartProvider` context (`src/components/CartProvider.tsx`) manages client state and calls `/api/cart`. There is no server-side cart session.

**Checkout / payment flow:**
1. `/api/checkout` reads the cookie, atomically reserves inventory via raw SQL (prevents overselling under concurrency), validates discount codes via Stripe Promotion Codes API, then creates a Stripe Checkout Session.
2. Stripe redirects to `/order/success?session_id=...` on completion.
3. The **Stripe webhook** (`/api/webhooks/stripe`) is the authoritative path that creates the `Order` record, deducts inventory, sends confirmation email, and handles idempotency via `ProcessedWebhookEvent`. Do not rely on the success redirect for order creation.

**Auth flow:** Login checks IP + identifier rate limits against the `RateLimit` DB table. New devices trigger a verification code email (purpose `NEW_DEVICE`); known devices are tracked by a hashed `smokeify_device` cookie. JWT tokens carry `id` and `role`.

**Admin protection:** API routes check `role === "ADMIN"` from the NextAuth session. Middleware (`middleware.ts`) guards `/maintenance` and enforces `MAINTENANCE_MODE=1` env var site-wide.

### Key Directories

| Path | Purpose |
|------|---------|
| `src/data/types.ts` | Canonical frontend types (`Product`, `Cart`, `ProductFilters`, etc.) |
| `src/lib/` | Server utilities (catalog, auth, email, rateLimit, paymentFees, etc.) |
| `src/app/api/` | Route handlers (REST, no tRPC/GraphQL) |
| `src/app/admin/` | Admin pages — all require `ADMIN` role |
| `src/components/` | Shared React components |
| `prisma/schema.prisma` | Full DB schema — source of truth for all models |
| `scripts/` | One-off Node.js scripts for supplier sync, bestseller scoring, pricing, etc. |

### Business Logic Constants

- **Free shipping threshold:** `€69` (`src/lib/checkoutPolicy.ts`)
- **Minimum order:** `€15` (`src/lib/checkoutPolicy.ts`)
- **Bestseller score:** computed weekly by `scripts/catalog/updateBestsellerScores.mjs` — stored on `Product.bestsellerScore`
- **Prices** are always stored and processed in **cents** (`priceCents`, `costCents`, etc.)
- **Currency** is hardcoded to `EUR`
- All user-facing copy is in **German**

### Inventory Model

Each `Variant` has one `VariantInventory` with `quantityOnHand` and `reserved`. Available stock = `quantityOnHand - reserved`. Reservation happens atomically at checkout start; fulfillment/deduction happens via the Stripe webhook. `InventoryAdjustment` records every change for audit purposes.

### Rate Limiting

IP-based and identifier-based limits are stored in the `RateLimit` Prisma model (not Redis). See `src/lib/rateLimit.ts`.
