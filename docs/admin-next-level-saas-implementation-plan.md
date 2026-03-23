# Admin Next-Level SaaS Implementation Plan

Date: 2026-03-23

## Purpose

This file is the implementation brief for upgrading the existing Smokeify admin into a stronger SaaS-style commerce control panel.

This is not a rebuild-from-scratch document.

The goal is to:

- keep the current admin structure
- preserve current backend truth and order/payment integrity
- extend the current dashboard, analytics, CRM, and catalog with better business insights
- add missing realtime, funnel, customer-intelligence, and product-performance layers

This file should be followed during implementation.

## Scope

Primary target surfaces:

- `src/app/admin/page.tsx`
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/analytics/AdminAnalyticsClient.tsx`
- `src/app/api/admin/analytics/route.ts`
- `src/app/admin/customers/page.tsx`
- `src/app/admin/customers/AdminCustomersClient.tsx`
- `src/app/api/admin/customers/route.ts`
- `src/app/admin/catalog/page.tsx`
- `src/app/admin/catalog/AdminCatalogClient.tsx`
- `src/app/admin/catalog/[id]/page.tsx`
- `src/app/admin/catalog/[id]/AdminProductClient.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders/AdminOrdersClient.tsx`
- `src/app/admin/audit/page.tsx`
- new additive analytics/event routes under `src/app/api/admin/*` and `src/app/api/analytics/*`

Secondary surfaces:

- `src/components/admin/*`
- `src/lib/analytics.ts`
- `prisma/schema.prisma`

## Non-Negotiables

- Do not replace the existing admin IA.
- Do not remove current functionality.
- Do not trust client-side values for revenue, conversion truth, stock, discount totals, or paid state.
- Do not mark orders paid from redirects or client callbacks.
- Keep Stripe webhooks as payment source of truth.
- Keep changes additive and reviewable.
- No paid third-party analytics vendor.
- Use first-party event collection built into the existing stack.

## Current State Summary

The current admin already covers:

- dashboard
- analytics
- catalog and product editing
- customers
- orders
- returns
- discounts
- suppliers
- audit log
- inventory alerts
- webhook failure visibility

What is already strong:

- order and revenue operations
- low-stock visibility
- customer listing and basic segmentation
- top-product revenue aggregation
- audit trail for admin actions

What is missing:

- session and visitor visibility
- realtime view of active traffic
- product view to purchase conversion
- funnel drop-off visibility
- cart and checkout abandonment intelligence
- CLV and churn-risk segmentation
- product margin and return-risk ranking
- campaign and traffic-source reporting
- anomaly detection and operational alerts

## Implementation Principle

Build on the current admin in three layers:

1. Add first-party event data collection.
2. Extend existing dashboard and analytics pages with better KPIs and decision surfaces.
3. Add customer intelligence, product intelligence, alerts, and realtime views on top of current modules.

Do not start with visual-only polish.
Start with the data and KPI layer that unlocks the UI.

## Existing Data We Can Reuse Immediately

Already available in the database:

- `Order`
- `OrderItem`
- `ReturnRequest`
- `ReturnItem`
- `User`
- `UserCartItem`
- `Variant`
- `VariantInventory`
- `InventoryAdjustment`
- `ProcessedWebhookEvent`
- `AdminAuditLog`
- `BackInStockRequest`
- `Supplier`
- `Discount` data via current Stripe-backed flows

Already available in the frontend tracking layer:

- `view_item`
- `view_item_list`
- `select_item`
- `search`
- `add_to_cart`
- `remove_from_cart`
- `view_cart`
- `begin_checkout`
- `add_shipping_info`
- `add_payment_info`
- `sign_up`
- `generate_lead`

Current limitation:

- these frontend events are only pushed to `dataLayer`
- they are not yet persisted as first-party admin analytics data

## Required New Data Layer

### Goal

Persist lightweight first-party event data so the admin can compute:

- active visitors
- active sessions
- top live pages
- product views
- product conversion
- cart abandonment
- checkout abandonment
- traffic sources
- funnel step completion

### Preferred approach

Add additive analytics models, for example:

- `AnalyticsSession`
- `AnalyticsEvent`

Minimum fields needed:

- `sessionId`
- `userId` optional
- `eventName`
- `pageType`
- `pagePath`
- `productId` optional
- `variantId` optional
- `orderId` optional
- `referrer` optional
- `utmSource` optional
- `utmMedium` optional
- `utmCampaign` optional
- `deviceType` optional
- `country` optional if already safely derivable
- `createdAt`

Important:

- keep the schema additive
- do not store invasive fingerprinting data
- respect existing consent model in `src/lib/analytics.ts`

### Event ingestion rules

- create a first-party analytics endpoint
- keep the payload compact
- debounce noisy events when needed
- store `purchase` from server truth when possible, not browser-only
- link checkout/order events to actual orders where possible

## Build Order

## Phase 1. First-Party Event Pipeline

### Goal

Make existing storefront interactions usable inside the admin.

### Deliverables

- additive Prisma models for analytics sessions/events
- ingestion route for consented frontend analytics
- helper in `src/lib/analytics.ts` to forward tracked events to the app backend
- session heartbeat support for active-visitor counts
- server-side aggregation helpers for dashboard and analytics widgets

### Must produce

- active visitors in last 5 minutes
- active sessions by page type
- product views last 24h / 7d / 30d
- add-to-cart counts
- begin-checkout counts
- source attribution buckets

### Definition of done

- event data is stored first-party
- current storefront tracking still works
- dashboard queries can consume the stored events

## Phase 2. Dashboard Upgrade

### Target

Extend `/admin` as the operational control room, not a new page.

### Add these widgets

#### 1. Live User Count

- why: immediate traffic pulse
- data: active session heartbeats in rolling 5-minute window
- UI: compact KPI with live dot and mini sparkline

#### 2. Active Sessions + Top Pages

- why: shows where users currently are
- data: latest active session events grouped by page type/path
- UI: table or list of top active pages with counts

#### 3. Conversion Rate

- why: turns traffic into a business signal
- data: sessions vs paid orders, or begin-checkout vs paid orders depending on card
- UI: KPI card with delta vs previous period

#### 4. Cart / Checkout Abandonment

- why: directly tied to lost revenue
- data: `add_to_cart`, `view_cart`, `begin_checkout`, paid order completion, recovery jobs
- UI: alert card with abandonment rate and worst step

#### 5. Revenue Trend vs Previous Period

- why: existing revenue is useful but lacks context
- data: current and previous period from `Order`
- UI: keep current chart, add delta badges and compare toggle

#### 6. AOV Trend

- why: useful for merchandising, pricing, and discount health
- data: paid orders
- UI: KPI with 7d and 30d delta

#### 7. Returning vs New Customers

- why: separates acquisition from retention quality
- data: first purchase date per user or guest email group
- UI: split card and donut

#### 8. Top / Flop Products

- why: makes merchandising decisions faster
- data: product views + add-to-cart + purchases + revenue
- UI: side-by-side lists:
  - top performers
  - high views, weak conversion

#### 9. Low Stock with Days of Cover

- why: better than raw low-stock thresholds
- data: `VariantInventory` + 7d/30d sales velocity
- UI: alert table with `days left`

#### 10. Unified Activity Feed

- why: makes the admin feel alive and actionable
- data: `AdminAuditLog`, orders, returns, webhook failures, live purchases
- UI: time-ordered feed in right rail or lower panel

### Do not remove

- current KPI cards
- failed webhook visibility
- pending return visibility
- inventory alerts
- back-in-stock demand

## Phase 3. Realtime Layer

### Goal

Add live awareness without turning the admin into a separate analytics app.

### Deliverables

- realtime dashboard block
- polling or SSE-based refresh
- top live products
- live purchases
- live checkout drop-offs
- live traffic sources

### Realtime modules

#### Live visitors

- based on session heartbeat freshness

#### Currently viewed products

- grouped by `view_item` in recent rolling window

#### Live purchases

- fed by confirmed paid orders

#### Realtime checkout problems

- triggered when drop-off spikes above baseline

#### Traffic source pulse

- grouped by UTM/referrer in rolling windows

### Definition of done

- admin can answer “what is happening right now?” without leaving the app

## Phase 4. CRM Intelligence Upgrade

### Target

Upgrade the current customer page instead of replacing it.

### Add customer intelligence metrics

- CLV
- net revenue after refunds/store credit
- AOV
- order frequency
- days since last order
- first-order date
- most purchased categories
- discount usage rate
- return rate
- support/return pressure signal

### Add customer segments

- New
- Repeat
- High Value
- Churn Risk
- Discount Driven
- Return Risk
- VIP

### Add customer quick filters

- segment
- guest vs registered
- no order in last 30/60/90 days
- CLV range
- return rate
- newsletter opt-in
- discount-heavy
- store-credit balance

### Add quick actions

- add note
- add tag/flag
- issue store credit
- open orders
- open returns
- create reactivation list
- generate personalized discount

### UI direction

- keep list + search structure
- add a customer intelligence rail or detail drawer
- do not rebuild the entire CRM into a new app

## Phase 5. Product Intelligence Upgrade

### Target

Turn catalog and product detail into performance-aware surfaces.

### Add product KPIs

- views
- add-to-cart rate
- checkout starts
- purchases
- product conversion rate
- revenue
- gross margin
- refund rate
- return rate
- stock cover days
- trend score

### Add to catalog list

New sortable columns:

- `7d Views`
- `7d Revenue`
- `CVR`
- `Margin %`
- `Return Rate`
- `Stock Cover`

### Add to product detail

New `Performance` section:

- 30d trend sparkline
- view to purchase funnel
- top traffic sources
- top variants
- return reasons
- margin summary

### Important

- use `OrderItem` snapshots for historical revenue/cost logic where needed
- do not derive historic totals from mutable current product data

## Phase 6. Analytics Add-Ons

### Target

Expand the current analytics page with tabs or sections, not a separate subsystem.

### Add these modules

#### Funnel

- sessions
- product views
- add to cart
- begin checkout
- paid order

#### Cohorts

- first-order month cohorts
- repeat purchase after 30/60/90 days

#### Retention

- returning-customer revenue share
- repeat order rate
- days-to-second-order

#### Campaign analysis

- revenue by source / medium / campaign
- conversion by landing page

#### Discount analysis

- code usage
- revenue generated
- margin impact
- new vs returning customer share

#### Payment analysis

- payment method usage
- payment failure rate
- refund share by payment method

### Keep current analytics content

- revenue
- top products
- inventory pressure
- customer mix

## Phase 7. Alerts And Automation Layer

### Goal

Turn the admin from passive reporting into active operational guidance.

### Add alerts for

- low stock
- stock cover below threshold
- revenue drop vs baseline
- conversion drop vs baseline
- unusual checkout abandonment
- webhook failure spike
- top product trend spike
- high-value inactive customers
- return/refund spike by product/category

### Alert output surfaces

- dashboard action center
- optional email digest later
- quick links into affected area

### Alert rule requirements

- use historical baselines where possible
- avoid noisy alerts without thresholds
- prioritize actionable alerts over vanity alerts

## Priority Map

### High Impact

- first-party event pipeline
- dashboard conversion and abandonment widgets
- period-over-period deltas
- returning vs new customer revenue
- customer CLV and segmentation
- product views vs purchases
- stock cover days
- activity feed

### Medium Impact

- realtime layer
- campaign analysis
- discount analysis
- payment analysis
- churn-risk lists
- return-risk product scoring

### Nice To Have

- cohort heatmaps
- predictive reorder suggestions
- anomaly scoring beyond thresholds
- recommended actions per customer/product

## File-Level Execution Plan

### Step 1. Data foundation

Touch:

- `prisma/schema.prisma`
- new migration
- new analytics helpers under `src/lib/*`
- new ingestion route under `src/app/api/analytics/*`

### Step 2. Dashboard extension

Touch:

- `src/app/admin/page.tsx`
- possibly new shared admin chart/list widgets

### Step 3. Analytics page upgrade

Touch:

- `src/app/admin/analytics/AdminAnalyticsClient.tsx`
- `src/app/api/admin/analytics/route.ts`

### Step 4. CRM extension

Touch:

- `src/app/admin/customers/AdminCustomersClient.tsx`
- `src/app/api/admin/customers/route.ts`

### Step 5. Product insights

Touch:

- `src/app/admin/catalog/AdminCatalogClient.tsx`
- `src/app/admin/catalog/[id]/AdminProductClient.tsx`
- supporting APIs if needed

### Step 6. Alerts layer

Touch:

- dashboard and analytics routes/components
- possibly shared alert utilities

## Acceptance Criteria

This upgrade is done only when:

- the current admin still works end-to-end
- dashboard answers both `what is happening now?` and `what needs action?`
- analytics answers `where do we lose money?`
- CRM answers `which customers matter and which are at risk?`
- catalog answers `which products perform and which products need intervention?`
- alerts surface meaningful operational issues automatically
- all new insights are backed by server-side or first-party-tracked data

## Immediate Start Order

Implement in this exact order:

1. analytics schema and ingestion pipeline
2. dashboard KPI and widget expansion
3. analytics API expansion
4. customer intelligence
5. product intelligence
6. realtime widgets
7. alerting

## Final Rule

If a feature adds visual complexity without producing an operational decision, do not build it yet.

Every new module must help an admin do at least one of these faster:

- detect a problem
- prioritize work
- understand a conversion loss
- protect revenue
- protect stock
- retain customers
