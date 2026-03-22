# Admin Dashboard Redesign Plan

Date: 2026-03-22

## Goal

Redesign the entire admin dashboard into a dedicated dark admin product with a Vercel-like visual direction:

- black / charcoal / graphite base
- detached from the public Smokeify storefront design
- persistent sidebar navigation
- same functional coverage as the current implementation
- better usability for dense admin work
- stronger analytics / CRM visualizations

This is a planning document only. No implementation should be started from this file without following the phases below.

## Current Structure Assessment

### What exists now

The current admin is already functionally broad. It covers:

- `/admin` dashboard
- `/admin/catalog`
- `/admin/catalog/[id]`
- `/admin/categories`
- `/admin/collections`
- `/admin/orders`
- `/admin/returns`
- `/admin/customers`
- `/admin/suppliers`
- `/admin/discounts`
- `/admin/analytics`
- `/admin/audit`
- `/admin/inventory-adjustments`
- `/admin/email-testing`
- `/admin/users/[id]`

### Structural issues

1. The admin is not truly detached from the storefront.
   It still renders inside [`src/components/PageLayout.tsx`](C:/Users/Joey/development/projects/webdev/smokeify/src/components/PageLayout.tsx), which includes the public navbar, announcement bar, commerce shell, and footer.

2. Navigation is fragmented.
   The current `/admin` page acts like a link hub instead of a real app shell. Once inside a section, there is no persistent sidebar or strong wayfinding.

3. The visual language is inconsistent.
   Most pages use emerald gradients, white cards, and the same visual DNA as the public site. That directly conflicts with the requested “separate admin product” feel.

4. Admin state is mostly page-local and client-heavy.
   Many sections work, but patterns are repeated page by page instead of being normalized into reusable admin primitives.

5. Category and collection management are duplicated.
   There are standalone routes for them, but large parts of the same workflow also live inside catalog management.

6. The product editor is strong but not fully aligned with schema coverage.
   The schema already has `seoTitle`, `seoDescription`, and `sellerName`, but the current editor does not surface them. That is an opportunity during redesign.

7. Analytics and CRM are useful but visually underpowered.
   They mostly present cards and tables. The next version should turn them into clearer operational dashboards.

## My Input

If this redesign is done well, it should be treated as a separate internal product, not as “the storefront with admin cards.”

My recommendation:

1. Build a dedicated admin shell first.
   New layout, new background system, new navigation, new spacing rules, new table/form primitives.

2. Keep backend behavior stable during the redesign.
   Reuse current routes and business logic first. Move UI before changing admin APIs.

3. Migrate route by route behind one consistent shell.
   Do not rewrite everything at once. Shell first, then dashboard, then catalog, then product detail, then operations and CRM.

4. Use dark-first only.
   Since the target is explicitly Vercel-like and detached from Smokeify, I would not center the current light/dark toggle. Dark should be the default design system, not an alternate skin.

5. Make the catalog and order surfaces denser.
   These are operational tools. Information density, fast filtering, sticky actions, and clear state badges matter more than decorative cards.

## Non-Negotiables For The Redesign

- Preserve all current admin capabilities before shipping the new dashboard.
- Entire admin surface stays `ADMIN` only.
- Do not break any existing payment, order, refund, webhook, or inventory workflow.
- Do not remove password-confirmed destructive actions.
- Keep server-side truth and current backend rules intact.
- Do not rely on client-side derived business logic for money or inventory.

## Access Policy

The redesign should assume a strict access model:

- every admin route is `ADMIN` only
- no `STAFF` access
- no read-only backoffice mode for non-admins
- no partial section access for non-admin roles

Implementation note:

- keep access enforcement centralized at the admin layout / server boundary
- audit all admin API routes and pages for consistent `ADMIN` checks
- sidebar should not be role-aware beyond `ADMIN`, because no other role should enter the admin at all

## Required Functional Parity

### 1. Admin Home

Current functionality that must remain:

- user list with search and pagination
- role changes with admin password confirmation
- link to per-user edit page
- low-stock inventory alerts with search and pagination
- back-in-stock request summary
- entry points to all admin sections

### 2. Catalog List

Current functionality that must remain:

- product search by title / handle
- sorting by title, status, variants, category, updatedAt
- pagination
- create product
- duplicate product
- delete product with admin password
- bulk selection
- bulk status update
- bulk price adjustment by percent or fixed amount
- bulk low-stock threshold update
- bulk tag add / remove
- bulk category add / remove
- bulk supplier assign / clear
- bulk product group set / clear
- category CRUD
- collection CRUD

Create-product parity checklist:

- title
- handle
- supplier
- lead time days
- default status `DRAFT`

### 3. Product Detail Editor

This is the most important parity area.

#### Core product fields that currently exist in the editor

- title
- handle
- manufacturer
- productGroup
- supplierId
- sellerUrl
- leadTimeDays
- status

#### Shipping / dimensions fields

- weightGrams
- shippingClass
- lengthMm
- widthMm
- heightMm

#### Category-specific merch fields

- growboxPlantCountMin
- growboxPlantCountMax
- growboxSize
- growboxConnectionDiameterMm
- lightSize
- airSystemDiameterMm

#### Content fields

- shortDescription
- description
- technicalDetails
- tags

Current editor also enforces merchant text policy validation on product copy. That must remain.

#### Category / collection assignments

- select parent categories
- select child categories
- filter categories
- save categories
- save collections
- preserve main category behavior from selected parent category

#### Images

- upload local images through admin uploads
- add image entries
- reorder images by drag and drop
- edit image alt text
- delete images

#### Variants and stock

- edit variant title
- edit SKU
- edit price
- edit cost
- edit compare-at price
- edit low-stock threshold
- edit inventory quantityOnHand
- edit inventory reserved
- edit variant options
- option `imagePosition`
- reorder variants
- add variant
- delete variant with admin password
- save all variants
- preserve payment-fee / profit calculator UI behavior

#### Cross-sells / FBT

- search products
- assign up to 3 cross-sell products
- remove assigned cross-sells
- save cross-sells

### 4. Orders

Current functionality that must remain:

- list orders
- search by order id, customer email, customer name
- separate relevant vs archived orders
- inspect order items
- show payment status and fulfillment state
- show shipping address
- show event timeline
- edit order status
- edit tracking carrier / number / URL
- send confirmation email
- send shipping email
- send refund email
- resend emails with confirmations
- full refund with admin password
- item-based refund with quantity selection
- optional shipping refund
- delete order with explicit `DELETE` confirmation
- show failed Stripe webhook events
- manually reprocess failed webhook events

### 5. Customers

Current functionality that must remain:

- load registered customers
- load guest customers
- tab filter: all / registered / guest
- search by email or name
- revenue summary
- link registered customers to user detail page

### 6. Users

Current functionality that must remain:

- quick role editing from dashboard
- full user profile editing page
- user profile fields:
  - email
  - name
  - firstName
  - lastName
  - street
  - houseNumber
  - postalCode
  - city
  - country
  - customerGroup
  - notes
  - newsletterOptIn
- recent orders on user page
- audit log on user page

### 7. Suppliers

Current functionality that must remain:

- create supplier
- edit supplier
- delete supplier with admin password

Supplier fields:

- name
- contactName
- email
- phone
- website
- notes
- leadTimeDays

### 8. Discounts

Current functionality that must remain:

- list Stripe promotion codes
- create percent discount
- create fixed amount discount
- currency
- max redemptions
- expiresAt
- activate / deactivate existing discount

### 9. Returns

Current functionality that must remain:

- list return requests
- show user + order info
- show request reason
- edit admin note
- approve request
- reject request

### 10. Analytics

Current functionality that must remain:

- conversion funnel metrics
- revenue summary
- top products
- stockout list
- AI quality metrics:
  - total analyses
  - fallback rate
  - low confidence rate
  - feedback total
  - feedback correct rate
  - top issue labels

### 11. Audit / Inventory / Email Testing

Current functionality that must remain:

- audit log feed
- inventory adjustment history
- email testing for:
  - confirmation
  - shipping
  - refund
  - return confirmation
  - cancellation
  - newsletter
  - newsletter confirmation
  - back in stock
  - checkout recovery

## Additional Gaps To Decide During Redesign

These already exist in schema or system context and should be consciously handled:

- `sellerName` exists in schema but is not surfaced in the main product editor
- `seoTitle` exists in schema but is not surfaced
- `seoDescription` exists in schema but is not surfaced
- category and collection CRUD are split across standalone pages and catalog

Recommendation:

- include `sellerName`, `seoTitle`, and `seoDescription` in the redesign
- keep standalone pages for categories and collections only if they still add operational value
- otherwise fold them into catalog and keep the routes as redirects later

## Target UX Direction

### Visual system

- Vercel-inspired dark UI
- matte black / graphite background
- slightly elevated charcoal panels
- neutral grays first, restrained accent colors second
- no storefront emerald/cream identity
- monospace for metrics / ids / technical labels where useful
- sharp, compact spacing for tables and forms

### Layout

- fixed left sidebar
- top command bar / page toolbar
- content canvas with max width by page type
- sticky filter/action bars for dense pages
- mobile: collapsible drawer sidebar

### Sidebar structure

Recommended information architecture:

- Overview
  - Dashboard
  - Analytics
  - Audit Log
- Commerce
  - Catalog
  - Categories
  - Collections
  - Discounts
- Orders
  - Orders
  - Returns
  - Inventory
- CRM
  - Customers
  - Users
  - Suppliers
- Utilities
  - Email Testing

## Proposed New Features

These are safe additions that improve the admin without changing payment truth or order integrity.

### Dashboard additions

- KPI strip: revenue, paid orders, AOV, refund rate, low-stock count, pending returns
- mini charts for 7d / 30d sales trend
- operational alerts block:
  - failed webhooks
  - out-of-stock variants
  - pending return requests
  - back-in-stock demand

### Catalog additions

- saved filter presets
- denser bulk action tray
- clearer product status chips
- inventory availability column
- supplier / collection / category quick filters

### Product editor additions

- split into clear tabs or anchored sections:
  - Overview
  - Content
  - Merch
  - Media
  - Variants
  - Associations
  - SEO
- sticky save bar with dirty-state tracking
- field grouping based on merch type instead of one long page

### Orders additions

- order health summary cards
- cleaner timeline visualization
- payment / fulfillment / communication status grouped into one status rail
- easier refund flow with preview of refund amount before confirmation

### CRM additions

- customer segmentation cards:
  - registered vs guest
  - repeat buyers
  - high-value customers
- supplier CRM overview:
  - product count per supplier
  - average lead time
  - suppliers with most low-stock products

### Analytics visualizations

Prefer custom SVG / CSS charts or a small OSS chart dependency only if necessary.

Charts to add:

- revenue over time
- orders over time
- paid vs refunded ratio
- top products bar chart
- stockout leaderboard
- customer mix chart
- supplier exposure chart

## Technical Plan

### Phase 1. Foundation

- create a dedicated admin shell layout under `src/app/admin`
- remove dependency on storefront `PageLayout` for admin routes
- make the shell and all child routes `ADMIN` only
- introduce admin-only design tokens:
  - colors
  - spacing
  - border radii
  - shadows
  - typography
- build reusable admin primitives:
  - sidebar
  - topbar
  - page header
  - section card
  - data table
  - filter bar
  - stat card
  - status badge
  - empty state
  - confirm modal
  - sticky action footer

### Phase 2. Route Map And Layout Migration

- keep current route paths
- wrap every admin page in the new shell
- make sidebar routing permanent
- add current-page breadcrumbs
- add global search / command bar placeholder

### Phase 3. Dashboard Redesign

- rebuild `/admin` as the operational overview
- preserve user management, inventory alerts, and back-in-stock data
- move quick links into sidebar and contextual action cards
- surface webhook failures and returns at dashboard level

### Phase 4. Catalog List Redesign

- rebuild product table with denser layout
- preserve search / sort / pagination / bulk editing
- move category and collection management into clearer side panels or split panes
- preserve create, duplicate, delete, and bulk flows

### Phase 5. Product Detail Redesign

- rebuild product editor around tabs or anchored sections
- preserve every current editable field and operation
- explicitly add missing schema-backed fields:
  - sellerName
  - seoTitle
  - seoDescription
- keep upload, drag reorder, variant reorder, and cross-sell flows intact

### Phase 6. Operations Pages

- redesign orders
- redesign returns
- redesign inventory adjustments
- redesign discount management
- redesign email testing

Priority inside this phase:

1. Orders
2. Returns
3. Discounts
4. Inventory
5. Email testing

### Phase 7. CRM Pages

- redesign customers
- redesign users and user detail
- redesign suppliers
- add stronger summaries and visualizations

### Phase 8. Analytics

- rebuild `/admin/analytics` as a real analytics surface
- retain all existing metrics
- add sales, stock, CRM, and AI-quality charts

### Phase 9. QA And Rollout

- verify route parity
- verify all write actions
- verify all destructive actions
- verify all admin auth guards are `ADMIN` only
- verify catalog/product data integrity
- verify refund and email flows still hit the same backend contracts

## Missing Considerations Added

### 1. Strict Admin-Only Permissions

This is now a hard requirement for the redesign.

Rules:

- all admin pages require `ADMIN`
- all admin APIs require `ADMIN`
- no `STAFF` entry points
- no mixed capability matrix in this redesign

Consequence:

- navigation stays simpler
- action visibility stays simpler
- less risk of accidentally exposing refunds, deletes, or webhook tools to non-admin users

### 2. Performance And Load Strategy

The redesign must include performance work, not just UI work.

Current risk areas:

- orders page loads a large data set
- dashboard inventory alerts are computed in memory
- analytics can become expensive once charts and summaries are added
- a denser shell with more widgets can multiply query cost

Required planning rules:

- paginate all large entities by default
- avoid loading full detail data for list views
- keep dashboard widgets scoped to recent / summarized data
- prefer server-side aggregation for KPI cards
- if needed, add lightweight aggregated endpoints for charts instead of overloading existing routes
- define query budgets before adding more dashboard panels

Targets to enforce later:

- dashboard should remain fast even with many orders / products
- list pages should not fetch detail payloads they do not render
- charts should not block core admin interactions

### 3. Concurrency And Change Safety

The redesign must explicitly account for multiple admins editing the same data.

Current risk:

- product, order, and supplier edits are effectively last-write-wins

Required safeguards to plan for:

- unsaved-changes warnings before route leave
- save state clearly shown in the UI
- stale-data detection using `updatedAt` where practical
- warning or refresh prompt when data changed on the server since page load
- destructive actions continue to require explicit confirmation

Minimum acceptable outcome:

- admins should not silently overwrite each other without warning on the most important surfaces
- product editor and order management should be the first places to receive stale-data protection

## Implementation Notes For Later

### Recommended build order

1. Admin shell and sidebar
2. Shared UI primitives
3. Dashboard
4. Catalog list
5. Product detail
6. Orders
7. CRM pages
8. Analytics
9. Remaining utility pages

### Recommended strategy

- keep current API contracts first
- avoid simultaneous backend refactors
- migrate one route at a time
- use the old page as parity reference until the new page is verified

### Commit Strategy

This redesign should be committed in small, structured steps for reproducibility and rollback safety.

Rules:

- make frequent commits during implementation
- each commit should represent one coherent milestone
- avoid mixing shell work, route migration, and behavior changes in the same commit
- keep commits reviewable and reversible

Recommended commit sequence:

1. admin shell foundation
2. sidebar and shared admin primitives
3. dashboard migration
4. catalog list migration
5. product detail migration
6. orders migration
7. CRM pages migration
8. analytics migration
9. utility pages migration
10. QA fixes and polish

Why this matters:

- better structure during implementation
- easier reproducibility if a later step must be rebuilt
- safer rollback points for live deployment
- clearer review history for each admin area

### Reusable components worth creating

- `AdminShell`
- `AdminSidebar`
- `AdminTopbar`
- `AdminPageHeader`
- `AdminSectionCard`
- `AdminDataTable`
- `AdminMetricCard`
- `AdminTrendChart`
- `AdminFilterPills`
- `AdminEntityDrawer`
- `AdminConfirmDialog`
- `AdminStickyActions`

## Acceptance Checklist

The redesign is only done when:

- the admin no longer visually depends on storefront layout components
- every current admin route is reachable from the sidebar
- all current product create / edit fields are preserved
- bulk catalog actions still work
- image, variant, and cross-sell flows still work
- orders still support status edits, tracking edits, refunds, emails, and webhook reprocessing
- users, suppliers, discounts, returns, customers, analytics, audit, inventory, and email testing all retain parity
- the new UI is dark-first, easy to scan, and faster to use than the current one

## Final Direction

The redesign should not be a skin swap.

It should become a real internal operations console:

- dark
- dense
- clear
- route-consistent
- operationally focused
- visually separate from Smokeify storefront

If tradeoffs appear during implementation, preserve functional parity first, then visual polish second.
