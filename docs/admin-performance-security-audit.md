# Admin Performance and Security Audit

Last updated: 2026-05-17

## Scope

- Admin pages under `/admin/*`
- Admin APIs under `/api/admin/*`
- Shared admin libraries in `src/lib/*`

## Current Route Inventory

### Admin pages

Primary admin pages currently shipped:

- `/admin`
- `/admin/alerts`
- `/admin/analytics`
- `/admin/analyzer`
- `/admin/audit`
- `/admin/catalog`
- `/admin/catalog/[id]`
- `/admin/categories`
- `/admin/collections`
- `/admin/compliance`
- `/admin/customers`
- `/admin/discounts`
- `/admin/email-testing`
- `/admin/expenses`
- `/admin/finance`
- `/admin/growvault`
- `/admin/inventory-adjustments`
- `/admin/landing-page`
- `/admin/ops`
- `/admin/orders`
- `/admin/orders/[id]`
- `/admin/pricing`
- `/admin/procurement`
- `/admin/procurement/[id]`
- `/admin/profitability`
- `/admin/recommendations`
- `/admin/reports`
- `/admin/returns`
- `/admin/reviews`
- `/admin/scripts`
- `/admin/suppliers`
- `/admin/support`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/vat`

### Admin APIs

High-traffic or security-sensitive admin API groups currently shipped:

- `/api/admin/audit/*`
- `/api/admin/analytics`
- `/api/admin/analyzer/*`
- `/api/admin/automation/*`
- `/api/admin/categories/*`
- `/api/admin/collections/*`
- `/api/admin/compliance/*`
- `/api/admin/customer-tasks/*`
- `/api/admin/customers/*`
- `/api/admin/customizer/*`
- `/api/admin/discounts/*`
- `/api/admin/email-testing`
- `/api/admin/expenses/*`
- `/api/admin/images/*`
- `/api/admin/landing-page/*`
- `/api/admin/newsletters`
- `/api/admin/orders/*`
- `/api/admin/pricing/*`
- `/api/admin/products/*`
- `/api/admin/purchase-orders/*`
- `/api/admin/recommendations/*`
- `/api/admin/reports/*`
- `/api/admin/returns/*`
- `/api/admin/reviews/*`
- `/api/admin/scripts`
- `/api/admin/search/*`
- `/api/admin/suppliers/*`
- `/api/admin/support-cases/*`
- `/api/admin/uploads`
- `/api/admin/users/*`
- `/api/admin/variants/*`
- `/api/admin/vat/*`
- `/api/admin/webhooks/stripe/reprocess`

## Authorization and Wrapper Model

### Server pages

- Admin pages continue to enforce access server-side with `requireAdminScope(...)`.
- Middleware remains a guardrail only. It is not treated as the source of truth.

### Admin APIs

- Default contract is now `withAdminRoute(...)`.
- `withAdminRoute(...)` centralizes:
  - fresh admin session enforcement
  - same-origin validation for mutating requests
  - per-route rate limiting
  - `no-store` admin headers
  - `Server-Timing` and `X-Response-Time`
- Export and direct-open exceptions are explicitly documented and limited.

### Documented `sameOrigin: false` exceptions

- `/api/admin/customer-tasks`
  - read-only CRM view intended for session-authenticated admin usage
- `/api/admin/vat/ustva`
  - CSV export that admins open directly in a new tab

Any new exception should be documented in the route file and this audit.

## High-Cost Surfaces

### Largest client workspaces

- `src/app/admin/catalog/[id]/AdminProductClient.tsx`: 4253 lines
- `src/app/admin/expenses/AdminExpensesClient.tsx`: 2539 lines
- `src/app/admin/customers/AdminCustomersClient.tsx`: 1710 lines
- `src/app/admin/analytics/AdminAnalyticsClient.tsx`: 1700 lines
- `src/app/admin/orders/[id]/AdminOrderDetailClient.tsx`: 1513 lines

### Heaviest current server aggregations

- `/admin`
  - dashboard loads finance, VAT, funnel, order mix, customer mix, product performance, activity, stock coverage, webhook failures, and live session data
- `/admin/catalog`
  - product list, category/collection/supplier reference data, stock coverage, return pressure, and product performance
- `/admin/orders`
  - scoped order list plus webhook failure summary
- `/api/admin/search`
  - multi-entity command/search surface used across admin navigation

## Performance and UX Baseline

### Current improvements in place

- `turbopack.root` is pinned in `next.config.ts` to the repository root.
- `adminScriptExecution` no longer traces the whole repo through `cwd: process.cwd()`.
- `AdminShell` lazy-loads the command bar and connection-status widgets.
- Admin request status reporting is now scoped instead of monkeypatching `window.fetch`.
- Command search uses deferred input, debounce, and a short session cache.
- Dashboard, catalog, and orders pages emit structured server timing logs through `measureServerExecution(...)`.
- Admin API responses wrapped by `withAdminRoute(...)` emit `Server-Timing` and `X-Response-Time`.

### Working budgets

- Admin shell JavaScript loaded on first route paint: keep incremental additions under 35 KB gzipped unless the route is editor-heavy.
- Route transition to usable state: target under 700 ms on cached local navigation for summary pages.
- Admin mutation response time: target under 500 ms for standard metadata updates and under 2 s for export or generation flows.
- First visible dashboard content: target under 1.2 s on warm server data.
- New admin list endpoints: ship page data, not whole datasets, for first render.

## Security Baseline

- `next` upgraded to `^16.2.6`
- `react` and `react-dom` upgraded to `19.2.4`
- Admin JSON responses send:
  - `Cache-Control: no-store, max-age=0, must-revalidate`
  - `Pragma: no-cache`
  - `Expires: 0`
  - `X-Robots-Tag: noindex, nofollow`
- Admin attachment exports now use a shared hardened header helper with:
  - `Content-Disposition: attachment`
  - `X-Content-Type-Options: nosniff`

## Remaining Follow-Up

- Break the largest admin clients into route-local modules and progressively load secondary panels.
- Paginate first-render list data more aggressively on orders, customers, and analytics surfaces.
- Tighten CSP for admin routes by inventorying inline style/script requirements before removing `'unsafe-inline'`.
- Extend `withAdminRoute(...)` adoption to remaining ad hoc admin routes until exceptions are rare and documented.
