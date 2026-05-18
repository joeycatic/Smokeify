# Admin Missing Features Implementation Plan

Date: 2026-03-25

## Purpose

This document turns the current admin gap assessment into an implementation plan for the three highest-impact missing features:

1. alert workflow and ownership
2. actionable CRM controls
3. dedicated order detail workspace

The goal is not to rebuild the admin.

The goal is to extend the existing admin so operators can:

- take action on alerts instead of only reading them
- act on customer intelligence instead of only filtering it
- handle complex order operations in a dedicated order workspace instead of a list-only surface

## Why These Three

The current admin is already broad and analytically strong.

What is still missing is workflow depth in the places where operators actually need to resolve work:

- alerts are visible but not managed
- CRM is insightful but not operational
- orders are editable but do not have a true detail route

These gaps slow down day-to-day operations more than another reporting widget would.

## Non-Negotiables

- Keep payment truth backend-authoritative.
- Do not allow manual UI shortcuts to imply paid or refunded state.
- Preserve the existing admin IA where possible.
- Keep the changes additive and reviewable.
- Every privileged mutation must remain audited.
- Prefer server-side enforcement and server-side business logic.

## Current State Summary

### Already strong

- dashboard and analytics coverage
- product and catalog editing
- customer segmentation and CLV-style summary
- order list operations, refund actions, and email actions
- audit log visibility

### Missing in practice

- no alert ownership, acknowledgment, snooze, or resolution workflow
- no native CRM actions for retention, store credit, tagging, or customer follow-up
- no `/admin/orders/[id]` route even though other admin surfaces link to one

## Priority Order

Implement in this order:

1. dedicated order detail workspace
2. alert workflow and ownership
3. actionable CRM controls

This order is intentional:

- the order detail route removes the largest operational gap in a safety-critical area
- the alert workflow then gains a stronger resolution target
- the CRM action layer can build on the same audited mutation patterns

---

## Feature 1: Dedicated Order Detail Workspace

## Goal

Create a true order detail route under `/admin/orders/[id]` for high-context order handling.

The current orders page is powerful, but it is still a list-first surface. Complex order work should not depend on keeping a list row expanded.

## Why it matters

- customer and audit surfaces already expect a per-order destination
- refunds, tracking, email history, and financial breakdowns deserve a dedicated workspace
- order operations are safety-critical and should be easier to review before mutation

## Target outcome

Add an order detail page that centralizes:

- order identity and customer snapshot
- line items and item-level refund context
- tracking and fulfillment controls
- email timeline
- payment and finance breakdown
- webhook failure context when relevant
- audit and timeline history for the order

## Files to touch

- `src/app/admin/orders/[id]/page.tsx`
- new `src/app/admin/orders/[id]/AdminOrderDetailClient.tsx`
- optional shared extraction from `src/app/admin/orders/AdminOrdersClient.tsx`
- `src/app/api/admin/orders/[id]/route.ts`
- `src/app/api/admin/orders/[id]/refund/route.ts`
- `src/app/api/admin/orders/[id]/email/route.ts`
- order timeline and audit helpers in `src/lib/*` as needed

## Implementation phases

### Phase 1. Add the route and data loader

- create `/admin/orders/[id]`
- load one order with the exact fields already used by the current orders client
- load related audit and timeline data
- return `notFound()` for missing orders

### Phase 2. Move critical controls into the detail page

- status and tracking update controls
- refund preview and refund execution
- confirmation, shipping, and refund email actions
- shipping address and item detail panels

### Phase 3. Keep the list page lighter

- keep list-level triage on `/admin/orders`
- link all deep operations to the detail route
- reduce list-row expansion complexity once the detail route is proven

## Data and UX rules

- payment status remains read-only except through existing audited refund/webhook workflows
- show stale-update conflicts clearly using the existing `expectedUpdatedAt` pattern
- keep the order timeline human-readable and audit-backed
- do not hide refund math; show preview amounts explicitly

## Acceptance criteria

- `/admin/orders/[id]` exists and is routable
- user and customer admin pages can safely link into it
- all current order actions still work from a dedicated workspace
- payment truth is still not directly editable
- order updates, refunds, and email actions remain audited

---

## Feature 2: Alert Workflow And Ownership

## Goal

Turn `/admin/alerts` from a passive signal inbox into a managed operational queue.

## Why it matters

The current page already says the missing layer is:

- rule ownership
- task states
- acknowledge and snooze behavior
- digests and recurring issue grouping

Without that workflow, alerts create awareness but not accountability.

## Target outcome

Each alert should support:

- owner or assignee
- status: open, acknowledged, resolved, snoozed
- optional snooze-until timestamp
- resolution note
- audit trail for state transitions
- grouping of repeated alerts under the same underlying condition

## Preferred model

Treat alerts as derived operational records, not only transient UI output.

Recommended additive data model:

- `AdminAlert`
- `AdminAlertEvent` or audit-backed state history if reuse is cleaner

Minimum fields:

- `type`
- `category`
- `priority`
- `dedupeKey`
- `title`
- `detail`
- `href`
- `status`
- `assigneeUserId` optional
- `firstSeenAt`
- `lastSeenAt`
- `snoozedUntil` optional
- `resolvedAt` optional
- `resolutionNote` optional

## Files to touch

- `prisma/schema.prisma`
- new migration for alert persistence
- `src/app/admin/alerts/page.tsx`
- new admin alert mutation routes under `src/app/api/admin/alerts/*`
- alert-generation helpers in `src/lib/adminAddonData.ts` or new `src/lib/adminAlerts.ts`
- `src/lib/adminAuditLog.ts`

## Implementation phases

### Phase 1. Persist alert state

- introduce additive alert models
- map existing alert generation into stable `dedupeKey` records
- store open alerts instead of generating only ephemeral page output

### Phase 2. Add queue actions

- acknowledge
- resolve
- snooze
- assign

Every action must create an audit record.

### Phase 3. Improve signal quality

- collapse repeated alerts by key
- show age and repeat count
- surface direct links into order, return, catalog, or finance pages

### Phase 4. Add digest layer

- prepare daily digest generation
- keep delivery optional at first
- ensure the page remains the primary inbox

## Product rules

- alerts should not disappear silently when snoozed or resolved
- repeated issues should reopen or bump existing alerts instead of creating noisy duplicates
- alerts must stay actionable, not vanity-oriented
- do not introduce broad notification spam before ownership and dedupe are correct

## Acceptance criteria

- alerts can be assigned, acknowledged, snoozed, and resolved
- alert state survives page refreshes and recalculation
- repeated signals dedupe into the same operational record where appropriate
- all alert state changes are audited
- the alerts page feels like a queue, not only a dashboard

---

## Feature 3: Actionable CRM Controls

## Goal

Extend the customers area so operators can act on customer intelligence directly from CRM.

The current page is strong on segmentation and summary, but its quick actions are mostly navigation shortcuts.

## Why it matters

CRM value is limited if operators cannot immediately:

- issue store credit
- add notes, flags, or tags
- build reactivation cohorts
- create retention actions from churn-risk views

## Target outcome

Add native CRM actions for:

- store credit issuance
- internal tags or flags
- reactivation list creation
- direct open-orders / open-returns drill-through
- discount recommendation or customer-specific offer preparation

## Files to touch

- `src/app/admin/customers/AdminCustomersClient.tsx`
- `src/app/api/admin/customers/route.ts`
- new customer action routes under `src/app/api/admin/customers/*`
- related user/customer persistence in Prisma if tags or saved flags are added
- `src/app/admin/users/[id]/page.tsx` and related user route if shared customer actions belong there too
- `src/lib/adminAuditLog.ts`

## Preferred rollout

### Phase 1. Add low-risk internal actions

- add internal customer flag or tag support
- add richer note handling if current note storage is insufficient
- add direct links to filtered orders and returns views

These are low-risk and immediately useful.

### Phase 2. Add store credit workflow

- issue store credit from CRM with explicit amount and reason
- require confirmation and fresh admin auth behavior consistent with other high-risk actions
- record before/after balance in audit metadata

### Phase 3. Add reactivation workflow

- allow saving customer sets based on current filters
- start with exportable or saved lists before campaign automation
- focus on churn-risk, VIP, and discount-driven cohorts

### Phase 4. Add offer-prep workflow

- generate a suggested discount or retention action
- keep final coupon creation tied to existing discount rules and backend validation
- avoid hidden one-off pricing logic in the CRM UI

## Data and workflow rules

- customer actions must not duplicate discount or pricing logic
- store credit changes must be explicit, audited, and reversible only through another explicit workflow
- segmentation remains server-derived
- saved lists should use filter criteria where possible, not only static snapshots

## Acceptance criteria

- CRM supports at least one real customer mutation from the customer screen
- store credit, if implemented, is fully audited
- operators can create and revisit reactivation cohorts
- the customer intelligence rail becomes action-oriented, not only descriptive

---

## Shared Technical Requirements

These three features should use the same underlying admin patterns:

- fresh admin access for privileged mutations
- same-origin enforcement on mutation routes
- route-level rate limiting where appropriate
- `Cache-Control: private, no-store` on privileged admin APIs
- full audit coverage for all admin side effects

## Testing Plan

## Add automated coverage for

- order detail mutations still blocking direct payment-status writes
- alert state transitions and dedupe behavior
- CRM customer mutations and store credit auditing
- unauthorized or stale-admin access rejection for new mutation routes

## Manual QA checklist

- open an order from the user page and confirm the detail route resolves
- update tracking and status from the order detail route
- preview and execute a refund from the detail route
- assign, snooze, and resolve alerts
- create a customer flag or note and verify audit visibility
- issue store credit if implemented and verify resulting balance and audit log

## Rollout Strategy

Ship as three reviewable PRs:

1. order detail workspace
2. alert workflow persistence and actions
3. CRM actions and store credit flow

Do not combine all three into one PR.

## Definition Of Done

This effort is done when:

- operators can resolve order work in a dedicated order route
- alerts have state and ownership, not just visibility
- CRM can trigger real customer actions directly
- all new mutations are audited
- order and payment integrity remain unchanged

## Recommended First PR

The first PR should contain only the dedicated order detail workspace:

1. add `/admin/orders/[id]`
2. move high-context order actions there
3. keep list triage on `/admin/orders`
4. update existing links that already point to order-detail URLs

This is the clearest operational win in the highest-risk admin area.
