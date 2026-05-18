# Remaining Admin Dark Redesign Plan

Date: 2026-03-23

## Purpose

This file is a standalone implementation brief for the remaining admin surfaces that still feel like the old Smokeify backoffice.

It is intentionally written so implementation can start later without relying on chat history.

## Scope

Pages to redesign:

- `src/app/admin/catalog/AdminCatalogClient.tsx`
- `src/app/admin/categories/AdminCategoriesClient.tsx`
- `src/app/admin/collections/AdminCollectionsClient.tsx`
- `src/app/admin/discounts/AdminDiscountsClient.tsx`
- `src/app/admin/email-testing/AdminEmailTestingClient.tsx`

Do not treat this as a color tweak. The goal is a full UI and UX rethink for these pages while preserving current backend behavior and current admin-only access rules.

## Current Assessment

### 1. Catalog

Current state:

- the page now has better data coverage than before, but still carries large parts of the previous visual and interaction model
- category and collection management are still embedded as old-form management blocks inside the same page
- bulk operations are functionally broad but visually noisy
- the page still mixes old light card sections, color-coded accent sections, and legacy modal styling

Main problem:

- it does not yet feel like the same product as the dark dashboard, analytics, or newer admin shell

### 2. Categories

Current state:

- pure legacy structure: hero, create form, edit list
- light cards, emerald/amber accents, old modal style
- operationally workable but visually and spatially outdated

Main problem:

- categories look like a form demo, not an internal admin tool

### 3. Collections

Current state:

- almost the same UX pattern as categories
- no stronger information architecture than create block + list block
- still dependent on the old green/light feel

Main problem:

- collections should feel like curated merch entities, not generic CRUD rows

### 4. Discounts

Current state:

- functionally correct but still visually mapped to the old design
- create form is long and flat
- active discount list works, but hierarchy is weak and scanning is slower than it should be

Main problem:

- discount management should feel transactional and status-focused, not like a marketing form stuck in the old theme

### 5. Email Testing

Current state:

- still heavily old-style
- long single-column form with green borders and white cards
- weak separation between email-type setup, payload preview, and mock order inputs

Main problem:

- email testing should behave more like a compact lab or QA console, not a storefront-styled form

## Design Direction

These pages must match the black / graphite admin shell already used on the newer admin surfaces.

Design rules:

- matte black / charcoal base only
- dark elevated panels only
- neutral grays first
- cyan / amber / red / violet only as restrained semantic accents
- no emerald brand-led layouts
- no cream / white page backgrounds
- no “numbered marketing cards” layout pattern from the old admin
- compact typography and tighter vertical rhythm
- more table, tray, drawer, and split-pane patterns
- motion should be minimal, clean, and structural

## UX Direction By Surface

### Catalog

Target UX:

- convert the page into a real operational workspace
- keep the product table as the primary surface
- move category and collection management out of the current long scrolling composition
- use a denser sticky top action bar
- use right-side drawers or lower split panes for category/collection management

Required structure:

1. page header
2. sticky control bar
3. product table
4. bulk action tray
5. secondary management surfaces for categories and collections

Interaction goals:

- search, sort, quick filters, and saved views must stay visible and fast
- create product should open in a focused modal or drawer
- bulk actions should not visually dominate until rows are selected
- category and collection CRUD should no longer visually compete with the table

### Categories

Target UX:

- make this a dedicated taxonomy management view
- use a two-pane or three-pane layout:
  - left: hierarchy / tree
  - center: selected category detail editor
  - optional right: metadata / child relationships / usage info

Required behaviors to preserve:

- create category
- edit name / handle / description / parent
- delete with admin password

Desired additions:

- clearer hierarchy visualization
- selected node state
- top-level vs child badge
- better empty state when nothing is selected

### Collections

Target UX:

- make collections feel like merch groupings
- use a list-to-detail layout
- center the list as browsable collection cards or rows
- open selected collection details in a side panel or main editor pane

Required behaviors to preserve:

- create collection
- edit name / handle / description
- delete with admin password

Desired additions:

- count / usage context if cheaply available later
- stronger scanability than generic edit rows

### Discounts

Target UX:

- redesign around two clear areas:
  - creation rail
  - active / inactive discounts table
- creation should feel like a compact transaction builder
- existing codes should show strong status chips and clear value formatting

Required behaviors to preserve:

- create percent discount
- create fixed amount discount
- currency
- max redemptions
- expiresAt
- activate / deactivate

Desired additions:

- KPI strip: total codes, active codes, expiring soon, most redeemed
- discount type chip
- expiry warning chip
- denser list layout

### Email Testing

Target UX:

- turn this into a QA workbench
- use a left configuration rail and right preview / payload rail
- dynamically show only the fields relevant to the selected email type
- make mock order items editable in a tighter table-like builder

Required behaviors to preserve:

- send all existing email types
- mock order payload fields
- mock newsletter fields
- mock back-in-stock fields
- mock checkout recovery fields

Desired additions:

- type picker cards
- payload summary block
- explicit validation summary
- send state / result area detached from the form

## Shared UI Requirements

These surfaces should reuse a consistent admin pattern set:

- `AdminPageHeader`
- `AdminWorkspaceToolbar`
- `AdminSurface`
- `AdminSplitLayout`
- `AdminTable`
- `AdminDrawer`
- `AdminEntityList`
- `AdminEntityEditor`
- `AdminEmptyState`
- `AdminInlineNotice`
- `AdminConfirmDialog`
- `AdminStickySelectionBar`

If these primitives do not exist yet, create them before rewriting multiple pages.

## Animation Rules

Allowed motion:

- page-enter fade / rise
- drawer slide-in
- hover lift on cards and action surfaces
- table-row background transition
- pill / badge / chart fill transitions

Not allowed:

- bouncy marketing motion
- flashy glow effects
- long or distracting animations

Respect `prefers-reduced-motion`.

## Functional Parity Checklist

Do not ship the redesign unless all of these still work:

### Catalog

- product search
- sorting
- pagination
- create product
- duplicate product
- delete product with admin password
- bulk select
- bulk status update
- bulk price update
- bulk low-stock threshold update
- bulk tag add / remove
- bulk category add / remove
- bulk supplier assign / clear
- bulk product group set / clear
- saved views
- quick filters
- inventory availability column

### Categories

- create
- edit
- parent assignment
- delete with password

### Collections

- create
- edit
- delete with password

### Discounts

- list existing Stripe promotion codes
- create percent code
- create amount code
- currency
- max redemptions
- expiresAt
- activate
- deactivate

### Email Testing

- confirmation
- shipping
- refund
- return confirmation
- cancellation
- newsletter
- newsletter confirmation
- back in stock
- checkout recovery

## Technical Constraints

- keep routes unchanged
- keep admin access `ADMIN` only
- keep existing API contracts unless a very small additive improvement is clearly justified
- do not mix these page rewrites with payment, order, or inventory business-logic refactors
- do not remove password-confirmed destructive actions

## Implementation Plan

### Phase 1. Shared Dark Primitives

Create or finalize reusable primitives and tokens first.

Deliverables:

- dark page header pattern
- dark surface / panel pattern
- drawer pattern
- compact table pattern
- sticky toolbar / sticky selection tray pattern
- consistent dark modal styling

Files likely touched:

- `src/components/admin/*`
- `src/app/globals.css`

### Phase 2. Catalog Workspace Rewrite

Rebuild the catalog page as the primary commerce workspace.

Deliverables:

- new sticky toolbar
- cleaner product table
- improved saved views presentation
- bulk action tray redesign
- category / collection management moved into drawers or split panes
- dark create-product modal

Files likely touched:

- `src/app/admin/catalog/AdminCatalogClient.tsx`
- optional new shared components under `src/components/admin`

### Phase 3. Dedicated Taxonomy Surfaces

Rebuild categories and collections around list/detail or tree/detail workflows.

Deliverables:

- new categories page layout
- new collections page layout
- dark confirm dialogs
- stronger entity editing ergonomics

Files likely touched:

- `src/app/admin/categories/AdminCategoriesClient.tsx`
- `src/app/admin/collections/AdminCollectionsClient.tsx`
- optional shared entity management components

### Phase 4. Discount Console Rewrite

Rebuild discounts as a dark transaction/status view.

Deliverables:

- compact creation form
- active/inactive table
- KPI strip
- expiry / status visualization

Files likely touched:

- `src/app/admin/discounts/AdminDiscountsClient.tsx`

### Phase 5. Email Testing Workbench Rewrite

Rebuild email testing as a QA lab surface.

Deliverables:

- type picker
- contextual form sections
- payload summary / preview panel
- tighter item builder
- dark success/error result rail

Files likely touched:

- `src/app/admin/email-testing/AdminEmailTestingClient.tsx`

### Phase 6. QA And Visual Consistency Pass

Deliverables:

- no remaining old green/light layout on scoped target pages
- modal consistency
- drawer consistency
- mobile check
- desktop check
- reduced motion check

## Concurrent Commit Strategy

This work should be done in small commits, but some sub-work can be developed in parallel if write scopes stay disjoint.

### Safe concurrent lanes

Lane A:

- shared admin primitives
- dark modal / drawer / table / toolbar components
- `src/components/admin/*`
- `src/app/globals.css`

Lane B:

- categories + collections rewrite
- `src/app/admin/categories/*`
- `src/app/admin/collections/*`

Lane C:

- discounts rewrite
- `src/app/admin/discounts/*`

Lane D:

- email testing rewrite
- `src/app/admin/email-testing/*`

Lane E:

- catalog surface rewrite after primitives stabilize
- `src/app/admin/catalog/*`

Catalog should not start before the shared primitives are at least minimally stable, because it is the largest surface and otherwise will duplicate temporary patterns.

## Recommended Commit Sequence

Use this exact order unless there is a concrete reason to deviate:

1. `Create dark admin workspace primitives`
2. `Unify dark modal and drawer patterns`
3. `Rewrite admin catalog workspace shell`
4. `Move catalog category and collection management into dark panels`
5. `Redesign standalone categories page`
6. `Redesign standalone collections page`
7. `Redesign discounts console`
8. `Redesign email testing workbench`
9. `Polish remaining catalog interactions and bulk tray`
10. `Finish dark consistency pass for admin commerce utilities`

## Notes For Future Implementation

### Optional context

The current redesign baseline already exists on:

- `/admin`
- `/admin/analytics`
- `/admin/orders`
- `/admin/users`

Those pages should be used as style references, not the old CRUD pages.

### Important warning

Do not keep the current numbered emerald/amber section-card pattern and merely recolor it.

That would preserve the old UX structure and only darken it. The goal here is to replace the structure as well.

### Catalog-specific note

The current catalog page still carries category and collection CRUD inside the same long page. During implementation, prefer secondary management panes or drawers so the product table remains the main workspace.

## Definition Of Done

This remaining redesign is done only when:

- catalog, categories, collections, discounts, and email testing no longer use the old green/light structure
- these pages visually match the black/dark admin shell
- the UX structure is meaningfully improved, not just recolored
- all current create/edit/delete/send flows still work
- destructive actions still require confirmation
- build passes
- lint passes
- the work is split into clear commits
