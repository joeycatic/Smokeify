# Smokeify Admin Security and Performance Plan

## 1. Purpose

This document turns the current admin review into an implementation plan for a robust admin hardening pass and a follow-up performance improvement pass.

The priorities are:

1. Protect admin entry points and privileged side effects
2. Preserve payment and order integrity
3. Make authorization and audit behavior consistent across the admin surface
4. Reduce admin page latency and data load as the dataset grows

This plan is intentionally phased. Security and data-integrity work comes first. Performance work follows once the admin invariants are enforced.

---

## 2. Current Assessment

## 2.1 Strengths already present

- Edge-level admin gating exists in `middleware.ts`
- Stronger admin freshness logic exists in `src/lib/adminAccess.ts`
- Server-side admin helpers exist in `src/lib/adminCatalog.ts`
- Same-origin protection is used on many admin mutation routes via `src/lib/requestSecurity.ts`
- Rate limit infrastructure exists in `src/lib/rateLimit.ts`
- Admin audit storage exists via `AdminAuditLog`
- Stripe webhook idempotency storage exists via `ProcessedWebhookEvent`
- Upload validation already checks file type and size in `src/app/api/admin/uploads/route.ts`

## 2.2 Main gaps found

### Security and integrity gaps

- The dedicated admin reauth path skips brute-force protection in `src/lib/auth.ts`
- Some admin pages and APIs still use `session.user.role === "ADMIN"` instead of the stronger fresh admin access check
- The admin order update API can directly overwrite `status` and `paymentStatus`
- Audit logging is incomplete for some privileged side effects
- Fresh admin verification is not treated as a route invariant everywhere

### Performance gaps

- Several admin pages fetch full datasets without pagination
- Heavy server routes run broad `findMany` and `groupBy` batches on every request
- Large admin payloads are serialized into client components
- The dashboard and analytics surfaces do a large amount of synchronous work per request
- Existing indexes are decent, but some admin query patterns still need dedicated support

---

## 3. Non-Negotiable Rules

These rules should drive every implementation decision in this plan.

### Admin access rules

- Middleware is a guardrail, not the source of truth
- Every admin page, route handler, and server action must enforce admin access server-side
- Privileged mutations and side effects must require fresh admin verification, not only role membership

### Order and payment rules

- Orders must never become paid because of a manual UI state flip
- Payment success remains webhook-confirmed only
- Refund state changes must be backed by a Stripe-backed refund flow or a dedicated audited workflow
- Historical order totals and item values remain snapshot-based

### Audit rules

- Every admin mutation must create an audit record
- Every external side effect must create an audit record
- Audit logging should include actor, action, target, summary, and minimal structured metadata

### Performance rules

- Do not ship full admin datasets to the browser when a paged or summarized version is sufficient
- Prefer server-side aggregation and selective projection over broad `include: true` patterns
- Cache only non-user-specific admin summaries, and keep privileged live data uncached or very short-lived

---

## 4. Risk Register

| Risk | Severity | Why it matters | Immediate action |
|---|---|---|---|
| Admin reauth not rate-limited | Critical | Makes password re-entry guessable online | Enforce admin-specific limits in `src/lib/auth.ts` |
| Order payment status writable by admin route | Critical | Breaks payment source of truth | Remove direct `paymentStatus` writes from generic admin patch route |
| Fresh admin verification applied inconsistently | High | Weakens MFA and reauth policy to middleware only | Centralize route-level fresh-admin enforcement |
| Missing audit logs on side-effect routes | High | Reduces incident traceability and accountability | Add mandatory audit logging wrapper for mutations |
| Large unpaged admin queries | Medium | Will degrade UX and raise DB load as orders and analytics grow | Introduce pagination, projections, and summary queries |

---

## 5. Target Architecture

## 5.1 Authorization model

Introduce a single shared admin enforcement layer for routes and server components.

### New target helpers

- `requireFreshAdmin()`
  - wraps `getServerSession(authOptions)`
  - enforces `hasAdminAccess(...)`
  - returns a typed admin session or `null`

- `assertFreshAdmin()`
  - same as above but throws or returns a response helper for route handlers

- `withAdminRoute()`
  - standard wrapper for admin API handlers
  - enforces:
    - fresh admin access
    - same-origin check for mutations
    - optional per-route rate limits
    - `Cache-Control: private, no-store`
    - standardized error responses

### Result

The goal is to remove ad hoc role checks from:

- admin pages
- admin API routes
- future admin server actions

and replace them with one consistent security contract.

## 5.2 State machine model

Split admin order operations into two categories:

### Allowed generic admin updates

- tracking fields
- internal status fields that do not imply payment truth
- admin notes
- operational metadata

### Disallowed generic admin updates

- `paymentStatus = paid`
- `paymentStatus = refunded`
- any change that implies external payment confirmation
- any transition that should only come from Stripe webhooks or audited refund workflows

### Dedicated workflows

- Refund initiation route
- Manual cancellation route
- Operational fulfillment route
- Webhook replay / recovery route

Each dedicated workflow must validate allowed transitions explicitly.

## 5.3 Audit model

Every admin mutation and side effect should log:

- actor ID
- actor email
- action name
- target type
- target ID
- short summary
- structured metadata with before/after where relevant

The plan should treat missing audit coverage as a defect.

---

## 6. Implementation Plan

## Phase 1: Critical Security and Integrity

Goal: close the current high-risk gaps without changing the admin UX more than necessary.

### 6.1 Fix admin reauth brute-force protection

#### Files

- `src/lib/auth.ts`
- `src/lib/rateLimit.ts`
- `src/app/auth/admin/page.tsx`

#### Work

- Apply `ADMIN_LOGIN_RATE_LIMIT` inside the `adminIntent` branch
- Enforce three admin keys:
  - identifier
  - IP
  - IP + identifier
- Return a single safe error to the UI when blocked
- Keep the existing TOTP flow intact
- Ensure the UI hints match the real backend behavior

#### Acceptance criteria

- Admin password re-entry is rate-limited
- Repeated failed attempts return `RATE_LIMIT`
- Limits apply before password verification
- Existing customer login rate limiting still works

### 6.2 Centralize fresh admin access

#### Files

- `src/lib/adminCatalog.ts`
- `src/lib/adminAccess.ts`
- `src/app/admin/layout.tsx`
- admin pages under `src/app/admin/**/page.tsx`
- admin APIs under `src/app/api/admin/**/route.ts`

#### Work

- Introduce `requireFreshAdmin()` as the only approved admin server auth helper
- Replace route-level checks that only do `session.user.role === "ADMIN"`
- Replace page-level checks that only do role checks and `notFound()`
- Make fresh admin verification a route invariant for all admin pages and side-effect routes

#### Acceptance criteria

- No admin page depends on middleware alone
- No admin mutation route depends on role-only checks
- Fresh reauth and MFA policy are enforced the same way everywhere

### 6.3 Lock down order state transitions

#### Files

- `src/app/api/admin/orders/[id]/route.ts`
- related order/refund timeline logic
- possibly shared order-status helpers in `src/lib/`

#### Work

- Remove raw passthrough writes for `status` and `paymentStatus`
- Define allowed admin-editable fields explicitly
- Create a transition validator for operational status changes
- Prevent direct writes to paid/refunded payment truth from the generic admin patch route
- Require refund and payment-related changes to flow through dedicated, audited handlers

#### Acceptance criteria

- Generic admin updates cannot mark an order paid
- Generic admin updates cannot mark an order refunded
- Invalid transitions return 400 or 409
- Order timeline events are still recorded for allowed transitions

### 6.4 Close audit coverage gaps

#### Files

- `src/app/api/admin/email-testing/route.ts`
- `src/app/api/admin/orders/[id]/email/route.ts`
- `src/app/api/admin/products/[id]/cross-sells/route.ts`
- `src/app/api/admin/webhooks/stripe/reprocess/route.ts`
- any other admin mutation route missing `logAdminAction(...)`

#### Work

- Add audit logging to all side-effect routes
- Record enough metadata to reconstruct intent without storing secrets
- Standardize action names
- Log both success and meaningful failure states where appropriate

#### Acceptance criteria

- Every admin mutation route writes an audit record
- Every admin side-effect route writes an audit record
- Audit records are searchable by actor and target

---

## Phase 2: Security Consistency and Hardening

Goal: reduce hidden variance and make future regressions harder.

### 6.5 Build a reusable admin route wrapper

#### Target

Create a shared wrapper in `src/lib/` for admin API routes.

#### Responsibilities

- fresh admin auth
- same-origin enforcement on non-safe methods
- optional per-route rate limiting
- no-store cache headers
- standard unauthorized and forbidden responses
- optional request correlation ID for logs

#### Benefit

This removes repeated boilerplate and prevents future routes from forgetting security controls.

### 6.6 Tighten high-risk routes

#### Priority routes

- order email send
- webhook reprocess
- uploads
- user role changes
- refund operations
- email testing

#### Work

- review rate limits route by route
- add stricter limits for side effects
- require fresh admin auth everywhere
- verify no response leaks unnecessary internals

### 6.7 Review cache behavior for admin routes

#### Work

- ensure admin APIs return `Cache-Control: private, no-store` where appropriate
- ensure SSR admin pages are not accidentally cached publicly
- review any fetch calls inside admin clients that may inherit undesirable caching behavior

---

## Phase 3: Admin Performance Improvements

Goal: make the admin scale with more orders, events, and catalog complexity.

### 6.8 Paginate high-volume views

#### Files

- `src/app/admin/orders/page.tsx`
- `src/app/admin/customers/page.tsx`
- `src/app/admin/catalog/page.tsx`
- corresponding admin APIs

#### Current issue

Some views load entire datasets into client components.

#### Work

- add pagination and filtering at query level
- only select fields needed for the current viewport
- lazy-load secondary detail panels
- avoid large `include` trees on initial page load

#### Acceptance criteria

- order list is paginated
- customers list is paginated
- catalog list is paginated
- initial payload size is materially reduced

### 6.9 Reduce dashboard query cost

#### Files

- `src/app/admin/page.tsx`
- `src/app/api/admin/analytics/route.ts`
- `src/lib/adminInsights.ts`
- `src/lib/adminAddonData.ts`
- `src/lib/adminFinance.ts`

#### Current issue

The admin home and analytics endpoints run broad `Promise.all(...)` batches that read large slices of orders, variants, users, expenses, and analytics events on every request.

#### Work

- move repeated heavy calculations into shared summary functions
- replace broad `findMany` calls with narrower projections
- use date-bounded summary queries aggressively
- materialize daily admin summary tables if query cost remains high
- separate live metrics from historical summary metrics

#### Acceptance criteria

- dashboard queries are bounded and selective
- heavy aggregates are not recomputed from raw tables on every request when avoidable
- admin analytics remains responsive on larger datasets

### 6.10 Add admin-specific indexes and query support

#### Current schema status

Existing indexes already cover some important paths:

- `Order.status`
- `Order.createdAt`
- `Order.userId`
- `ProcessedWebhookEvent.eventId`
- `ProcessedWebhookEvent.status`
- `AdminAuditLog.createdAt`

#### Recommended additions to evaluate

- `Order(paymentStatus, createdAt)`
- `Order(status, createdAt)` if the current access pattern needs composite support
- `ReturnRequest(status, createdAt)` if pending-return queries are common
- additional analytics composite indexes based on observed `groupBy` and date filters
- summary-table indexes if materialized admin rollups are introduced

#### Work

- inspect actual Prisma query patterns from admin pages
- match indexes to high-frequency filters and sort orders
- avoid adding indexes with unclear benefit

### 6.11 Shrink browser work on large admin clients

#### Files

- `src/app/admin/orders/AdminOrdersClient.tsx`
- `src/app/admin/analytics/AdminAnalyticsClient.tsx`
- other large admin clients as needed

#### Work

- split oversized client components by concern
- virtualize large tables if row count is high
- defer non-critical charts and secondary panels
- avoid hydrating data that can remain server-rendered

#### Acceptance criteria

- less hydration work
- smaller initial JS payload
- faster time to interactive on admin screens

---

## 7. Testing Plan

## 7.1 Automated tests to add

### Auth and access

- admin login rate limit blocks repeated `adminIntent` attempts
- admin access helper rejects stale `adminVerifiedAt`
- admin side-effect routes reject role-only stale sessions

### Order integrity

- generic admin order patch cannot set `paymentStatus=paid`
- generic admin order patch cannot set `paymentStatus=refunded`
- allowed operational status changes still work
- invalid state transitions are rejected

### Audit

- side-effect routes create `AdminAuditLog` rows
- user role changes create audit rows
- webhook reprocess creates audit rows

### Performance-adjacent correctness

- paginated admin routes return stable cursors or page metadata
- summary routes return the same business totals as the raw implementation

## 7.2 Manual QA checklist

- sign in to `/auth/admin` with wrong password repeatedly and verify blocking
- verify TOTP-required admin accounts still work
- verify stale admin session gets redirected back to admin reauth
- try editing an order and confirm paid/refunded states cannot be forged
- send admin order emails and confirm audit entries appear
- replay a failed Stripe webhook and confirm audit + timeline behavior
- open admin dashboard and orders on seeded large data and compare responsiveness before and after

---

## 8. Rollout Plan

## Step 1

Ship the Phase 1 security fixes first in a small reviewable PR:

- admin reauth rate limiting
- fresh admin helper adoption on the highest-risk routes
- order state machine lock for the generic admin patch route

## Step 2

Ship the audit completion pass:

- side-effect route logging
- standard action naming
- optional shared admin route wrapper

## Step 3

Ship performance improvements in isolated PRs:

- pagination
- dashboard query reductions
- analytics summary optimization
- large-client splitting and virtualization

## Step 4

After each step:

- run typecheck
- run lint
- run focused tests for admin auth and order integrity
- verify no behavior regression in checkout, refunds, or webhook handling

---

## 9. Definition of Done

This effort is done when all of the following are true:

- The admin reauth path is actually rate-limited
- All admin pages and routes enforce fresh admin access server-side
- Middleware is no longer the only protection layer for any privileged admin action
- Generic admin order editing cannot overwrite payment truth
- All admin mutations and external side effects are audited
- High-volume admin views are paginated or summarized
- Dashboard and analytics queries are bounded and materially lighter
- Typecheck and lint pass
- Security and regression tests cover the new invariants

---

## 10. Recommended First PR Scope

To keep the first implementation safe and reviewable, the first PR should contain only:

1. admin login rate limiting in `src/lib/auth.ts`
2. a shared fresh-admin helper
3. migration of the highest-risk role-only routes to that helper
4. removal of direct `paymentStatus` writes from `src/app/api/admin/orders/[id]/route.ts`
5. tests for the new auth and order-integrity rules

This gives the highest risk reduction with the smallest safe change set.
