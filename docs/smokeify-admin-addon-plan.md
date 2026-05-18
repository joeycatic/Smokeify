# Smokeify Admin Add-on Plan

## 1. Executive Summary

This add-on extends the existing Smokeify Admin Panel with a financial and operational control layer. It does not replace the current admin structure, core commerce workflows, or bookkeeping tools. It adds visibility where the current system is weak: revenue quality, VAT exposure, profitability, live operational activity, and exception handling.

The current panel already supports core administration through dashboard, analytics, catalog, orders, customers, returns, suppliers, and audit views. What is missing is a reliable management layer that answers practical questions quickly:

- How much of current revenue is actually net revenue?
- How much VAT has been collected and what is the likely monthly VAT liability?
- Which products generate profit, not just sales?
- Where is margin being lost through shipping, discounts, ads, refunds, or low-value orders?
- What operational issues need action right now?

This add-on turns the admin panel from a transaction console into a decision console. It gives management, operations, and finance a shared view of commercial health without turning Smokeify into an accounting or ERP system.

---

## 2. Add-on Scope

### 2.1 What the add-on should provide

- Finance visibility across revenue, refunds, costs, and contribution margin
- VAT transparency for output VAT, input VAT, and estimated monthly liability
- Profit insights at product, category, order, and customer segment level
- Operational awareness through live activity, event monitoring, and admin action visibility
- Real-time signals for sales, checkout behavior, stock risk, and anomalies
- Alerts that translate issues into actions, not just charts
- Export-ready summaries for bookkeeping and monthly review workflows

### 2.2 What is explicitly NOT included

- Full accounting system
- Official tax filing automation
- Invoice-ledger replacement
- Bank reconciliation
- ERP replacement
- Full warehouse management system
- Rebuilding the admin panel
- Replacing existing dashboard, analytics, orders, or CRM modules

---

## 3. Integration into Existing Admin Panel

The add-on should integrate into the existing admin information architecture with minimal disruption.

### Recommended integration model

1. Extend the existing `/admin` dashboard with finance, VAT, and alert summary widgets.
2. Extend the existing `/admin/analytics` area into a broader insight workspace with additional tabs or segmented panels:
   - Commercial Overview
   - Finance
   - VAT
   - Profitability
   - Live Ops
   - Alerts
3. Extend existing detail modules instead of creating parallel systems:
   - Products: profit and margin data
   - Orders: financial breakdown and VAT snapshot
   - Customers: value and profitability indicators
   - Returns: refund and margin impact
   - Suppliers: cost and VAT input linkage
   - Audit: admin actions included in live operational stream

### Extension points by current module

| Existing Module | Add-on Extension |
|---|---|
| Dashboard | Summary widgets, VAT status, alert inbox, live ops strip |
| Analytics | Main home for financial, profitability, and live operational insights |
| Orders | Order-level finance card, VAT snapshot, refund impact, margin estimate |
| Catalog / Product Detail | Product profitability, margin trend, return-adjusted performance |
| Customers | LTV, repeat revenue, refund profile, contribution segmenting |
| Returns | Return cost impact, refund VAT effect, return-rate alerts |
| Suppliers | Product cost reference, expense/VAT input linkage |
| Audit Log | Feed into live admin actions and alerts |

### Structural protection rules

- Do not replace the existing sidebar or rename current modules.
- Do not introduce a separate finance back office disconnected from orders and products.
- Use widgets, tabs, right-side panels, inline cards, and table columns first.
- Introduce at most one new top-level nav entry only if analytics becomes too dense in later phases; this is optional and not a Phase 1 requirement.

---

## 4. Add-on Components (Modular Design)

| Component | Purpose | Core Features | Key KPIs | Business Value | Integration Points |
|---|---|---|---|---|---|
| Finance Insights Layer | Show revenue quality and cost structure | Revenue cards, cost buckets, margin summary, monthly comparison, cash-style overview | Gross revenue, net revenue, contribution margin, estimated profit, refund rate | Better commercial decisions and faster issue detection | Dashboard, Analytics, Orders |
| Tax / VAT Layer | Show estimated VAT position for monthly reporting | Output VAT, input VAT, liability estimate, month close checklist, completeness score | Output VAT, input VAT, estimated Zahllast, missing-tax-data rate | Reduces blind spots before bookkeeping handover | Dashboard, Analytics, Expenses, Orders |
| Profit & Margin Insights | Show what is truly profitable | Product, category, order, and customer profit views | Profit per SKU, gross margin, contribution margin, profit after refunds | Prevents revenue-led but profit-poor decisions | Catalog, Product Detail, Analytics |
| Realtime Activity Layer | Surface live commercial and operational activity | Active sessions, live orders, checkout activity, product interest, admin action stream | Active users, live orders, checkout starts, cart drop, admin actions | Faster operational response | Dashboard, Analytics, Audit |
| Alerts & Tasks Layer | Convert signals into action | Rule engine, severity model, assignee status, snooze, acknowledge, remediation steps | Open alerts, critical alerts, unresolved age, recurring issues | Makes the panel operational, not passive | Dashboard, Orders, Products, Returns |
| Export / External Handover Layer | Prepare clean handoff to bookkeeping or management | CSV/PDF exports, month summary packs, cost and VAT summaries | Completeness score, export readiness, reporting coverage | Reduces manual reporting time | Analytics, VAT, Finance |

---

## 5. Finance Insights Layer

### Metric definitions and UI placement

| Metric | Definition | Business Relevance | Suggested UI Representation | Panel Placement |
|---|---|---|---|---|
| Gross Revenue | Sum of successful customer payments received in period, including VAT, after discounts, before refunds | Top-line sales intake | Primary KPI card with delta vs prior period | Dashboard, Analytics Overview |
| Net Revenue | Gross revenue minus output VAT and refunded gross amounts | Shows actual revenue base for margin analysis | KPI card with formula tooltip | Dashboard, Finance tab |
| Estimated Profit | Net revenue minus COGS, shipping cost, payment fees, ad allocation, tool overhead allocation, refunds cost impact | High-level profitability view | KPI card with confidence label | Dashboard, Finance tab |
| COGS | Cost of goods sold based on order item quantity and cost snapshot/allocation rules | Core margin driver | Stacked cost bar and detail row | Finance tab, Product Detail |
| Shipping Cost | Store-paid shipping and fulfillment cost | Identifies logistics drag | Cost bucket card | Finance tab, Orders |
| Payment Fees | Captured gateway/payment processing fees where available or estimated rate-based fallback | Important for order-level contribution margin | Cost bucket card | Finance tab, Orders |
| Ad Spend Allocation | Marketing spend allocated by day, campaign, channel, or product/category mapping | Connects revenue to acquisition cost | Cost breakdown chart | Finance tab, Customers, Products |
| Tool / Fixed Cost Allocation | Monthly SaaS and operating tools apportioned for visibility only | Shows operational burden on profit | Secondary cost bucket with estimated label | Finance tab |
| Contribution Margin | Net revenue minus directly variable costs only | Best short-term decision metric | Prominent KPI and trend chart | Dashboard, Product Detail, Orders |
| Monthly Comparison | Current month vs previous month for revenue, margin, refund rate, VAT liability | Shows performance trend | Comparison cards with deltas | Dashboard, Finance tab |
| Cashflow-like Overview | Operational inflows and outflows based on paid orders, refunds, recorded expenses, supplier payments marked as paid | Liquidity awareness without formal accounting | Inflow/outflow waterfall | Finance tab |

### Layer design notes

- Every financial metric must carry a calculation definition and confidence label.
- Values derived from estimates or allocations must be visually marked as `Estimated`.
- Order-level totals must come from immutable order data, not current product prices.
- Profit logic must support refund adjustments and return impact.
- Period filters should include:
  - Today
  - Last 7 days
  - Last 30 days
  - Current month
  - Previous month
  - Custom range

### Primary finance surfaces

- Dashboard:
  - Gross revenue
  - Net revenue
  - Contribution margin
  - Estimated VAT liability
  - Refund drag
- Analytics > Finance:
  - Full cost structure
  - Period comparison
  - Margin waterfall
  - Export summary
- Order detail:
  - Revenue and VAT snapshot
  - Cost estimate
  - Contribution margin
- Product detail:
  - Revenue, units, refund impact, margin trend

---

## 6. Tax / VAT Layer

### Purpose

Provide a management-grade VAT transparency layer for German regular VAT operations with input tax deduction and monthly reporting. This layer is for monitoring and preparation, not for official filing.

### Core VAT metrics

| Metric | Definition | Operational Use |
|---|---|---|
| Output VAT | VAT derived from paid customer orders and adjusted for refunds/credit corrections | Estimate tax collected from sales |
| Input VAT | VAT from recorded expenses with tax metadata and valid supporting records | Estimate recoverable VAT |
| Estimated VAT Liability (Zahllast) | Output VAT minus eligible input VAT for the selected tax period | Monthly tax exposure view |
| VAT by Rate | Breakdown by VAT rate used in orders and expenses | Detect mixed-rate issues |
| VAT by Month | Monthly VAT trend | Reporting preparation and planning |
| Missing VAT Data Rate | Percentage of expenses or orders lacking complete VAT attributes | Data quality control |

### Cash-based accounting handling

Because Smokeify uses `Istversteuerung`, the VAT layer should treat sales VAT as relevant when payment is actually received, not when the order is merely placed.

### Safe to automate

- Output VAT estimation from webhook-confirmed paid orders
- Refund VAT adjustments from refund records
- Monthly VAT buckets by payment date
- Input VAT aggregation from recorded expenses with:
  - gross amount
  - net amount
  - VAT amount
  - VAT rate
  - supplier
  - document date
  - status
- Deadline reminders and reporting completeness indicators
- Export summaries for bookkeeping handover

### Informational only, not authoritative automation

- Final tax deductibility edge cases
- Reverse-charge handling
- Intra-EU special cases
- Import VAT treatment
- Mixed-use cost treatment
- Manual tax corrections across periods
- Official VAT return generation or submission

### Suggested VAT UI

| UI Element | Purpose | Placement |
|---|---|---|
| VAT status card | Show current month output VAT, input VAT, and estimated liability | Dashboard |
| VAT timeline | Month-by-month VAT trend | Analytics > VAT |
| VAT completeness panel | Show missing cost records, uncategorized expenses, missing tax fields | Analytics > VAT |
| Filing reminder banner | Show due date proximity and readiness state | Dashboard, VAT tab |
| Export summary table | Bookkeeping handover | Analytics > VAT |

### Deadline support

- Show current reporting month status
- Show days until monthly VAT handover deadline
- Show readiness states:
  - Ready
  - Needs review
  - Incomplete
- Show exact blockers:
  - missing expense VAT
  - missing document
  - uncategorized refunds
  - unmatched supplier cost

### Estimation disclaimer model

Each VAT surface should clearly show one of three states:

- `Estimated`: system-derived management view
- `Review Required`: partial data or open issues
- `Ready for Handover`: data appears complete enough for bookkeeping review

---

## 7. Profit & Margin Insights

### Purpose

Move decision-making from revenue-only reporting to true commercial performance reporting.

### Required views

| View | Purpose |
|---|---|
| Profit per Product | Identify high-sales but low-profit items |
| Margin per Product | Compare efficiency across catalog |
| Contribution Margin | Show performance after variable costs |
| Cost Ratios | Show COGS %, shipping %, ad %, refund %, fee % |
| Profit by Category | Identify profitable and unprofitable assortments |
| True Top Products | Rank by profit, not revenue |

### Required calculations

- Revenue from paid order item snapshots
- COGS from product cost records or cost snapshots
- Return-adjusted revenue
- Refund-adjusted margin
- Contribution margin after variable costs
- Optional allocated overhead for management visibility only

### Tables and drilldowns

#### Main profitability table

Columns:

- Product
- SKU / Variant
- Units sold
- Gross revenue
- Net revenue
- COGS
- Shipping burden
- Refund amount
- Contribution margin
- Margin %
- Return rate
- Profit trend vs previous period

#### Drilldown behavior

Clicking a product should open a profitability detail panel with:

- revenue trend
- margin trend
- refund trend
- cost composition
- top customer segments
- related campaigns or discount usage
- supplier/cost reference
- inventory pressure vs margin quality

### Sorting logic

Default sort options:

- Highest profit
- Lowest profit
- Highest margin %
- Lowest margin %
- Highest refund drag
- Highest units sold
- Highest revenue
- Highest contribution margin

### Filtering

Required filters:

- Date range
- Product status
- Category
- Supplier
- Product type
- Discounted vs non-discounted
- Returned vs non-returned
- VAT rate
- Traffic / campaign source where attributable

### Business value

- Prevents scaling low-margin products
- Exposes discount-led sales that destroy profit
- Helps decide pricing, sourcing, bundling, and ad allocation
- Improves category planning and inventory prioritization

---

## 8. Realtime Activity Layer

### Purpose

Give operations and management immediate visibility into what is happening right now, not only what happened yesterday.

### Realtime modules

| Realtime Surface | Purpose | Value | UI Approach | Integration Point |
|---|---|---|---|---|
| Active Users / Sessions | Show current shopper activity | Immediate traffic awareness | Live KPI card + top pages list | Dashboard, Analytics > Live Ops |
| Live Orders | Show newly placed and newly paid orders | Operational responsiveness | Streaming order strip or recent queue | Dashboard, Orders |
| Product Views | Show trending product attention | Detect spikes and merchandising opportunities | Live top products table | Analytics > Live Ops |
| Checkout Events | Show begin checkout, payment failures, completion flow | Detect funnel friction in real time | Event counters + mini trend | Analytics > Live Ops |
| Recent Admin Actions | Show impactful staff/admin changes | Operational traceability | Live audit feed | Dashboard side panel, Audit |
| Unified Event Stream | Combine commercial and admin events | Fast situational awareness | Time-ordered stream with filters | Analytics > Live Ops |

### Event categories to include

- customer session started
- high-intent product view burst
- add-to-cart spike
- checkout start
- payment success
- payment failure
- refund created
- return requested
- stock threshold crossed
- admin price change
- admin inventory adjustment
- admin order status change

### Realtime design rules

- Prioritize freshness over density
- Use time windows such as last 5, 15, and 60 minutes
- Separate customer activity from admin/system activity with clear labels
- Allow filtering by:
  - event type
  - product
  - order
  - user/admin
  - severity

---

## 9. Alerts & Tasks System

### Goal

Transform passive insight into operational action through a rule-based alert system.

### Alert model

Each alert should include:

- Rule name
- Severity
- Trigger timestamp
- Context data
- Recommended action
- Status:
  - Open
  - Acknowledged
  - Resolved
  - Snoozed
- Owner or assignee
- Link to relevant module

### Initial alert rules

| Alert | Trigger Condition | Priority | Suggested UI | Recommended Action |
|---|---|---|---|---|
| VAT Deadline Approaching | Fewer than X days to monthly VAT handover and status not Ready | High | Dashboard alert card + banner | Complete missing expense and refund data, export review pack |
| High VAT Liability Spike | Current month estimated liability exceeds previous 3-month average by defined threshold | High | Finance alert card | Review sales spike, refund timing, tax classification |
| Missing Expense Data | Expense records missing VAT fields, supplier, or document status above threshold | High | VAT tab task list | Complete records before month close |
| Margin Drop | Contribution margin falls below threshold vs previous period | High | Dashboard + product/category alert | Review discounting, shipping cost, ad spend, COGS |
| Low Stock | Available stock below threshold on profitable or high-velocity items | High | Dashboard + product table badge | Reorder or rebalance inventory |
| High Return Rate | Product or category return rate exceeds threshold | Medium | Product profitability panel | Review quality, listing clarity, supplier issue |
| Conversion Drop | Session-to-order or checkout-to-paid rate drops below baseline | High | Live Ops + analytics alert | Inspect checkout issues, payment failures, UX regression |
| Checkout Abandonment Spike | Begin checkout volume stable but paid order completion drops sharply | High | Live Ops stream + dashboard | Investigate payment, shipping, or checkout friction |
| Refund Spike | Refund amount or refund count rises above baseline | High | Orders + Finance | Audit recent orders and product quality |
| Cost Data Stale | Product cost data older than threshold for active catalog | Medium | Catalog profitability banner | Refresh supplier cost inputs |
| Ad Spend Without Revenue | Channel spend recorded but attributed revenue below threshold | Medium | Finance / CRM | Review campaign efficiency |
| Admin Risk Change | Bulk product price/inventory changes exceed threshold | Medium | Audit + alert inbox | Review for accidental or risky changes |

### Alert presentation model

- Dashboard:
  - Critical open alerts
  - items requiring action today
- Analytics:
  - full alert center
  - history
  - filterable rule list
- Module-level:
  - inline badges and warning cards in products, orders, returns, and VAT views

### Task behavior

- Alerts should generate actionable tasks, not only notifications.
- Repeated alerts should be grouped by root cause where possible.
- Critical alerts should remain visible until acknowledged or resolved.
- Include digest views:
  - Today
  - This week
  - Month close blockers

---

## 10. Enhancements to Existing Modules

### Dashboard

Add:

- Gross revenue, net revenue, contribution margin, estimated profit
- VAT collected and estimated VAT liability
- Open alerts summary
- Realtime active sessions and live order strip
- Month-close readiness widget

### Products

Add:

- Profit per product and per variant
- Margin %
- Refund-adjusted profitability
- Cost freshness indicator
- Return-rate badge
- Profit trend sparkline

### Orders

Add:

- Order-level financial breakdown:
  - gross paid
  - VAT portion
  - net revenue
  - discount
  - shipping charge
  - shipping cost
  - payment fee
  - estimated contribution margin
- Refund impact and return cost
- Payment date used for VAT period attribution

### Customers / CRM

Add:

- Revenue per customer
- Net contribution estimate
- Repeat purchase rate
- Refund profile
- Customer value segment
- Acquisition source when available
- Cohort-style indicators:
  - new
  - repeat
  - high value
  - low margin

### Additional recommended extensions

- Returns:
  - refund cost impact
  - return reason trends
  - return-adjusted product margin
- Suppliers:
  - last known cost updates
  - input VAT-linked expense visibility
- Audit:
  - elevate commercially relevant admin actions into live ops and alerts

---

## 11. Data Model Requirements (Conceptual)

### Required entities

- Orders
- Order Items
- Products
- Product Costs
- Customers
- Expenses
- Marketing Spend
- Taxes
- Inventory
- Refunds / Returns
- Event Logs

### Conceptual relationships

| Entity | Key Relationships | Notes |
|---|---|---|
| Orders | Belongs to customer, contains order items, links to payment and refund records | Source for paid revenue and VAT output estimation |
| Order Items | Belong to order and product/variant snapshot | Must remain immutable for historical margin accuracy |
| Products | Link to categories, suppliers, costs, inventory, returns | Current product state must not rewrite historical profit |
| Product Costs | Link to product or variant and valid-from dates | Supports cost history and profitability accuracy |
| Customers | Link to orders, returns, attribution source | Enables value and segment metrics |
| Expenses | Link to supplier, VAT metadata, document status, optional category | Core input VAT and overhead visibility |
| Marketing Spend | Link to channel, campaign, date, optional category/product mapping | Supports spend allocation and contribution analysis |
| Taxes | Period summaries, rate mappings, VAT estimates, status flags | Management layer, not legal ledger |
| Inventory | Link to variant and stock movement context | Required for stock-risk and margin-aware replenishment |
| Refunds / Returns | Link to order and items | Must affect revenue, margin, and VAT adjustment views |
| Event Logs | Customer behavior, operational events, admin actions | Drives real-time monitoring and alerting |

### Derived metrics layer

Derived metrics should not be stored as primary truth if they can be calculated reliably, but selected summaries may be materialized for speed.

Recommended derived outputs:

- daily finance summary
- monthly VAT summary
- product profitability summary
- customer value summary
- alert state snapshot
- live activity aggregates

### Data consistency requirements

- Order-based financial metrics must use immutable order and order-item snapshots
- Paid revenue must be based on confirmed payment state
- Refunds must reduce both revenue and profit views
- Cost records need effective dates or snapshot logic
- Expense VAT records need completeness flags
- Attribution data should be optional, never required for core finance calculations
- Data freshness and confidence should be surfaced in the UI

---

## 12. KPI Framework

### Tier 1: Daily Operating KPIs

- Revenue
- VAT collected
- Orders
- Paid orders
- Refunds
- Active users
- Checkout starts
- Conversion rate
- Low stock count
- Critical alerts open

### Tier 2: Weekly Control KPIs

- Profit
- Contribution margin
- AOV
- Conversion
- Refund rate
- Return rate
- Product profit winners and losers
- Category margin
- Ad-spend efficiency
- Cost data completeness

### Tier 3: Monthly Management KPIs

- Net revenue
- Margin %
- Estimated profit
- Customer LTV
- Cost ratios
- VAT liability
- Input VAT coverage
- Month-close readiness
- Revenue mix by customer segment
- Profit by category and supplier

### KPI governance rules

- Daily KPIs should support fast action.
- Weekly KPIs should support optimization decisions.
- Monthly KPIs should support reporting, tax preparation, and strategic planning.
- Every KPI must have:
  - definition
  - formula
  - source data
  - freshness indicator
  - owner

---

## 13. Implementation Roadmap

### Phase 1 – Quick Wins

| Area | Features | Impact | Rough Complexity |
|---|---|---|---|
| Dashboard | Gross revenue, net revenue, contribution margin, VAT estimate, alerts widget | High | Low to Medium |
| Analytics | Finance summary tab, VAT summary tab, period comparison | High | Medium |
| Orders | Order finance breakdown card | High | Low |
| Data | Product cost records, expense capture basics, VAT metadata completeness flags | High | Medium |
| Export | Basic monthly finance/VAT export summary | Medium | Low |

### Phase 2 – Operational Layer

| Area | Features | Impact | Rough Complexity |
|---|---|---|---|
| Alerts | Rule-based alerts, severity model, task states | High | Medium |
| Profitability | Product and category profit tables, drilldowns, filters | High | Medium to High |
| CRM | Customer value metrics, repeat profitability, refund profile | Medium to High | Medium |
| Live Ops | Realtime activity stream, live checkout and order monitoring | Medium to High | Medium |
| Returns | Return-adjusted margin visibility | Medium | Medium |

### Phase 3 – Advanced Layer

| Area | Features | Impact | Rough Complexity |
|---|---|---|---|
| Forecasting | Revenue, VAT liability, and stock-risk forecasting | Medium | High |
| Finance Depth | Better cost allocation, campaign-linked contribution analysis, scenario views | High | High |
| Handover | More complete export packs for bookkeeping and monthly review | Medium | Medium |
| Automation | Alert digests, month-close checklist automation, anomaly detection | Medium | Medium to High |

### Delivery priority

Build in this order:

1. Financial truth surfaces
2. VAT visibility
3. Product profitability
4. Alerts
5. Live operational monitoring

---

## 14. UX Principles

- Additive integration only: extend existing pages and cards before introducing new destinations.
- Scannable dashboards: primary metrics first, breakdowns second, drilldowns third.
- Action-oriented UI: every alert and exception should link to the exact place where it can be resolved.
- Clear prioritization: critical financial and operational issues must dominate visual hierarchy.
- Financial clarity: always distinguish gross, net, VAT, contribution margin, and estimated profit.
- Estimation honesty: any allocated or estimated metric must be labeled clearly.
- Minimal cognitive load: avoid dense accounting jargon on top-level views; use expandable detail where needed.
- Desktop-first layout: optimize for internal operational use, large tables, comparisons, and side panels.
- Consistent context: preserve existing admin patterns, filters, and shell behavior.
- Fast drilldown: users should move from KPI to affected order, product, or customer in one click.

---

## 15. Final Summary

### Top 5 highest-impact features

1. Dashboard finance cards with gross revenue, net revenue, contribution margin, and VAT liability
2. VAT monitoring layer with monthly readiness and completeness indicators
3. Product profitability views based on profit and margin, not revenue alone
4. Rule-based alerts for VAT, margin, stock, refunds, and conversion anomalies
5. Order-level financial breakdown for operational and support teams

### What to build first

Start with the smallest control layer that immediately improves decision quality:

1. Dashboard finance and VAT widgets
2. Analytics finance and VAT tabs
3. Order finance breakdown
4. Basic product cost and expense data model support
5. Monthly export-ready summary

### Why this add-on materially improves Smokeify operations

This add-on closes the gap between commerce activity and management visibility. It lets Smokeify see which revenue is real, which profit is healthy, which VAT is accumulating, which products deserve focus, and which issues need action now. It respects the current custom admin panel, strengthens existing modules, and creates a practical control center without turning the system into a full accounting or ERP platform.
