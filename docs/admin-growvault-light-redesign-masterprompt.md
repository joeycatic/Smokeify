# Admin GrowVault-Style Light Redesign Masterprompt

Date: 2026-07-11
Status: approved for implementation, not yet started
Owner decision record: theme, navigation, scope, and IA regrouping were decided with Joey on 2026-07-11. Do not re-open these decisions mid-implementation.

## Purpose

Full redesign of the Smokeify admin panel into a compact, professional, light UI in the visual style of the GrowVault storefront (`/Users/jojiarmani/development/Growvault`). This is a standalone brief: implementation can start later without relying on chat history.

This supersedes the previous rule "admin work should use existing dark admin style." The dark admin theme is being retired.

## Decisions Already Made (do not change)

1. **Theme**: light GrowVault look. Cream/off-white surfaces, forest green primary, clay accent. No dark mode, no toggle.
2. **Navigation**: slim icon rail (~64px, icon-only workspaces with tooltips/flyouts) + compact horizontal section tabs under the header.
3. **Scope**: full per-page redesign of all admin pages, phased in waves. Not just a retheme.
4. **Information architecture**: workspaces are regrouped as specified below. Every existing route stays reachable. No functionality may be lost.

## Non-Negotiable Constraints

- Zero functionality loss. Every feature, filter, bulk action, form, and query param that exists today must exist after each phase.
- No backend/API/Prisma changes. This is a UI/UX project. Server components, data fetching, and permission checks stay as they are.
- Preserve all shell behaviors: admin AFK idle timer (10 min, visible after 1 min elapsed), command bar (`AdminCommandBar`), connection status (`AdminConnectionStatus`), storefront scope switching (`?storefront=ALL|MAIN|GROW` semantics in `AdminShell.navHref`/`storefrontHref`), role/scope-based nav filtering (`getVisibleAdminWorkspaces`), hidden route titles, saved views, robots noindex metadata.
- Preserve mobile compatibility (see `docs/admin-mobile-compatibility-masterprompt.md` patterns: `admin-mobile-card-list`, `admin-scroll-x`, `admin-data-grid-scroll`).
- Do not touch or revert in-flight work on the GrowVault chatbot admin panel (`src/app/admin/growvault/page.tsx`, `src/app/admin/growvault/GrowvaultChatbotPanel.tsx`, `src/app/api/admin/growvault/`, `src/lib/growvaultChatbot*.ts`) if it is still uncommitted; rebase around it and restyle it in its wave only after it lands.
- German customer-facing copy rules do not apply here (admin is internal, English), but do not change any customer-facing strings that pass through admin forms.
- No architecture calls mid-implementation. If something in this brief is ambiguous or wrong, stop and ask Joey; do not improvise structure.

## Design System

### Tokens

Add an admin token block in `src/app/globals.css`, derived from GrowVault (`/Users/jojiarmani/development/Growvault/src/app/globals.css`). Namespace `--adm-*` so it cannot collide with storefront `--smk-*` tokens:

```css
.admin-theme.admin-light {
  color-scheme: light;
  --adm-bg: #f7f8f7;            /* page background (gv-forest) */
  --adm-surface: #ffffff;       /* cards, panels (gv-surface-2) */
  --adm-surface-2: #eaf1ec;     /* subtle fills, table headers (gv-surface) */
  --adm-border: rgba(20, 26, 22, 0.1);
  --adm-border-strong: rgba(20, 26, 22, 0.18);
  --adm-text: #16241a;
  --adm-text-muted: #55645a;
  --adm-text-faint: #8a978d;
  --adm-primary: #1f5f3f;       /* forest green — actions, active states */
  --adm-primary-dim: #123723;
  --adm-primary-soft: rgba(31, 95, 63, 0.14);  /* active fills, focus glow */
  --adm-accent: #bd5b2b;        /* clay — secondary accents, highlights */
  --adm-accent-soft: #f7e4d6;
  --adm-info: #2f6690;          /* sky — informational badges */
  --adm-info-soft: #e2edf4;
  --adm-success: #1f5f3f;
  --adm-warning: #e2a136;
  --adm-error: #c0432c;
  --adm-shadow: 0 10px 30px rgba(20, 26, 22, 0.08);
  --adm-shadow-lg: 0 24px 60px rgba(20, 26, 22, 0.16);
}
```

Semantic status colors: success = green `--adm-success` soft fill; warning = `--adm-warning`; error = `--adm-error`; neutral/paused = `--adm-text-faint` on `--adm-surface-2`. Replace all cyan/emerald/amber/red white-alpha badge styling with these.

### Typography

- Load DM Sans via `next/font` and apply it inside the admin shell only (scope via the shell wrapper class, do not change storefront fonts). Fallback: `"Segoe UI", sans-serif`. Letter-spacing `-0.01em` like GrowVault.
- JetBrains Mono (or existing mono font) for numeric/tabular data: order totals, VAT numbers, SKUs, timers. Use `tabular-nums` everywhere numbers align in columns.
- Type scale (compact): page title 18px/semibold, section title 14px/semibold, body 13px, table cells 13px, meta/labels 11px, micro-labels 10px uppercase with `tracking-[0.16em]` (keep the uppercase-microlabel language from the current admin — it works, just recolor to `--adm-text-faint`).

### Density and Shape Rules

Applied consistently in the shell and every page wave:

- Control height: 32px (`h-8`) for buttons, inputs, selects, tabs. 36px only for primary page-level CTAs.
- Card padding: 12–16px (`p-3`/`p-4`), never `p-6`+. Section gaps 12px.
- Radius: 10px (`rounded-[10px]`) for controls, 14px (`rounded-xl`) for cards. Do not use the storefront's very round `rounded-2xl`/pill-heavy look except for status badges (pills are fine for badges).
- Borders: 1px `--adm-border` everywhere; shadows only `--adm-shadow` on elevated cards, hover lift optional and subtle.
- Tables: 13px text, 8px vertical cell padding, `--adm-surface-2` header row, row hover `rgba(31,95,63,0.05)`, sticky headers where lists exceed viewport.
- Remove decorative gradients/backdrops (`admin-shell__backdrop` radial glows, `admin-reveal` entry animations may stay but shorten to ≤200ms or remove). The light theme is flat, calm, trust-oriented — like the GrowVault storefront, not biopunk.

### Shared Primitives

Create `src/components/admin/ui/` with the compact primitives, then use them in every page wave instead of ad-hoc markup:

- `AdminCard` (title, optional description, optional header actions, body)
- `AdminStat` (label, value, delta with semantic color, optional sparkline slot)
- `AdminTable` (wraps `admin-data-grid-scroll`, sticky header, empty state, loading skeleton)
- `AdminBadge` (variant: success | warning | error | info | neutral | accent)
- `AdminButton` (variant: primary green / secondary outline / ghost / danger), `AdminInput`, `AdminSelect`, `AdminSearchField`
- `AdminToolbar` (filter row pattern: search + selects + actions right-aligned, wraps on mobile)
- `AdminModal` / `AdminDrawer` (light surfaces, `--adm-shadow-lg`)
- `AdminEmptyState`, `AdminSkeleton`
- `AdminPageHeader` (page title + description + primary actions; replaces per-page hero blocks)

Refactor existing `AdminAnalyticsPrimitives.tsx`, `AdminCharts.tsx`, `AdminSavedViews.tsx`, `AdminWorkspace.tsx` to consume the tokens. Charts: recolor series to a GrowVault-derived categorical palette (green `#1f5f3f`, clay `#bd5b2b`, sky `#2f6690`, gold `#e2a136`, then muted variants); grid lines `--adm-border`; no neon.

## Navigation: New Information Architecture

Rewrite `ADMIN_WORKSPACES` in `src/components/admin/adminNavigation.ts` to exactly this grouping. Scopes stay as they are today per item; only grouping and labels change. Update `adminNavigation.test.ts` accordingly.

1. **Overview** (icon: HomeIcon)
   - `/admin` Dashboard (exact, `dashboard.read`)
   - `/admin/analytics` Analytics (`analytics.read`)
   - `/admin/smokeify` Smokeify (`analytics.read`)
   - `/admin/growvault` GrowVault (`analytics.read`)
2. **Orders** (icon: CreditCardIcon)
   - `/admin/orders` Orders (`orders.read`)
   - `/admin/procurement` Procurement (`procurement.read`)
   - `/admin/returns` Returns (`returns.read`)  ← lives here only; remove the duplicate from Customer Care
3. **Catalog** (icon: CubeIcon)
   - `/admin/catalog` Catalog (`catalog.read`)
   - `/admin/catalog/hygiene` Hygiene (`catalog.read`)
   - `/admin/categories` Categories (`catalog.write`)
   - `/admin/collections` Collections (`catalog.write`)
   - `/admin/compliance` Compliance (`catalog.write`)
   - `/admin/suppliers` Suppliers (`suppliers.read`)
   - `/admin/supplier-import` Supplier Import (`catalog.write`)
   - `/admin/inventory-adjustments` Inventory (`inventory.read`)
4. **Customers** (icon: UsersIcon)
   - `/admin/support` Support (`support.read`)
   - `/admin/customers` Contacts CRM (`customers.read`)  ← moved out of MCC
   - `/admin/reviews` Reviews (`catalog.write`)  ← moved out of Catalog; it is customer feedback
5. **Marketing** (icon: ChartBarSquareIcon)
   - `/admin/mcc` Command Center (`marketing.read`)
   - `/admin/growth` Growth (`marketing.read`)
   - `/admin/email-testing` Email (`marketing.send`)
   - `/admin/landing-page` Landing Page (`content.landing.manage`)
   - `/admin/discounts` Discounts (`discounts.manage`)
   - `/admin/attribution` Attribution (`marketing.read`)
6. **Finance & Pricing** (icon: BanknotesIcon)
   - `/admin/finance` Finance (`finance.read`)
   - `/admin/profitability` Profitability (`finance.read`)
   - `/admin/pricing` Pricing (`pricing.read`)  ← moved out of MCC
   - `/admin/recommendations` Recommendations (`pricing.review`)  ← moved out of MCC
   - `/admin/vat` VAT (`tax.review`)
   - `/admin/expenses` Expenses (`tax.review`)
   - `/admin/reports` Reports (`finance.read`)
7. **System** (icon: CommandLineIcon)
   - `/admin/ops` Ops (`ops.read`)
   - `/admin/alerts` Alerts (`alerts.read`)
   - `/admin/analyzer` Analyzer (`ops.read`)  ← moved out of MCC; it is GrowVault ops tooling
   - `/admin/page-previews` Page Previews (`ops.read`)
   - `/admin/scripts` Scripts (`scripts.execute`)
   - `/admin/users` Users (`users.manage`)
   - `/admin/audit` Audit Log (`audit.read`)

Rules:

- Each route appears in exactly one workspace. Where a page previously benefited from a cross-group duplicate (Returns in Customer Care), add an inline link on the relevant page instead (e.g. Support page header links to Returns).
- `ADMIN_HIDDEN_ROUTE_TITLES` (catalog/users/procurement/orders/compliance detail pages) keeps working; verify `getActiveAdminWorkspace` still resolves detail routes to the right workspace.
- Command bar groups derive from the same `ADMIN_WORKSPACES`, so it inherits the new IA automatically — verify search still surfaces every route.

## Shell Redesign (`AdminShell.tsx`)

Replace the current 16.5rem sidebar + tab row with:

### Icon rail (desktop ≥ md)

- Fixed left rail, 64px wide, `--adm-surface` background, right border `--adm-border`.
- Top: Smokeify mark (small square logo or "S" monogram, 32px).
- One icon button per workspace (from IA above), 40px square, `rounded-[10px]`. Active: `--adm-primary-soft` fill + `--adm-primary` icon + 2px left indicator bar. Inactive: `--adm-text-muted`, hover `--adm-surface-2`.
- Tooltip on hover showing workspace label (CSS-only or headless tooltip; 150ms delay).
- Optional flyout on hover/focus listing the workspace's section links (keyboard accessible: focusable, Escape closes). If flyout complexity threatens the timeline, ship tooltips only — section tabs already cover navigation.
- Bottom of rail: settings (gear) button and user avatar circle (initials from email) opening the settings panel.

### Header (sticky, top)

- Height ~52px, `--adm-surface` with bottom border, no blur/transparency games.
- Left: workspace label (micro-label) + current page title (18px semibold) + storefront scope badge (compact pill, green outline when scoped).
- Right: AFK timer chip (keep exact current logic/thresholds; recolor: >2min neutral, ≤2min warning, ≤1min error), command bar trigger, settings button.
- Remove the "Workspace tabs preserve existing admin routes" helper pill.

### Compact section tabs (second header row)

- Horizontal scrollable row (`admin-scroll-x`) of the active workspace's items, shown when the workspace has ≥2 items.
- Tab: 32px height, 13px text, icon 16px, `rounded-[10px]`. Active: `--adm-primary` text on `--adm-primary-soft`. Inactive: `--adm-text-muted`, hover `--adm-surface-2`.
- Keep `navHref` storefront-scope propagation exactly as implemented today.

### Mobile (< md)

- Rail hidden; hamburger opens a full sidebar drawer (existing pattern) listing workspaces with labels and their section links (accordion or flat list). Reuse current overlay/close logic.
- Section tabs remain as the horizontal scroll row.

### Settings panel

- Keep current contents (context info, storefront scope switcher with `sourceStorefront` handling for `/admin/reports`, AFK display) restyled as a light drawer/popover anchored top-right on desktop, bottom sheet on mobile.

### Shell chrome

- Root: `admin-theme admin-light` classes; page background `--adm-bg`; drop `admin-shell__backdrop` gradients (render nothing or a flat background).
- `main` content container: keep current responsive padding, max width 1680px centered (matches `analytics-commerce` behavior) so ultra-wide screens don't stretch tables.

## Theme Layer Migration

`globals.css` currently contains a large `.admin-theme.admin-dark` override section (~line 1117 onward) that remaps utility classes (`.text-stone-300`, `.bg-white\/5`, etc.). Strategy:

1. Phase 0: add `.admin-theme.admin-light` tokens + a **temporary compatibility layer** that remaps the most common dark utility patterns (`text-slate-*`, `text-white`, `bg-white/[0.03..0.08]`, `border-white/10`, `bg-black/*`) to light equivalents, so un-migrated pages remain usable (not pretty, but readable) while waves proceed.
2. Each page wave replaces inline dark utilities with tokens/primitives, shrinking dependence on the compatibility layer.
3. Final phase: delete the compatibility layer and the entire `admin-dark` block. Grep gate: `grep -rn "admin-dark\|text-slate-\|border-white/10\|bg-white/\[0" src/app/admin src/components/admin` must return zero hits (excluding intentional exceptions, which must be listed in the PR description).

## Per-Page Redesign Waves

Each wave = one PR-sized unit. For every page: adopt `AdminPageHeader`, primitives, density rules; kill per-page "hero" blocks; keep all data, filters, bulk actions, modals, and URL params. Redesign means re-laying-out for compactness (tighter toolbars, denser tables, grouped forms in two-column layouts on desktop), not just recoloring.

- **Phase 0 — Foundation**: tokens, DM Sans, primitives in `src/components/admin/ui/`, compatibility layer, new `adminNavigation.ts` IA + tests, `AdminShell` rebuild (rail/header/tabs/settings), `AdminCommandBar` + `AdminConnectionStatus` restyle.
- **Phase 1 — Overview**: `/admin` (`AdminStorefrontDashboard`), `/admin/analytics` (`AdminAnalyticsClient`, `analytics-commerce` token swap), `/admin/smokeify`, `/admin/growvault` (only after the pending chatbot panel work is committed).
- **Phase 2 — Orders**: `/admin/orders` + `[id]`, `/admin/procurement` + `[id]`, `/admin/returns`.
- **Phase 3 — Catalog**: `/admin/catalog` (workspace, product workspace, taxonomy drawers, `[id]`, hygiene), `/admin/categories`, `/admin/collections`, `/admin/compliance`, `/admin/suppliers`, `/admin/supplier-import`, `/admin/inventory-adjustments`.
- **Phase 4 — Customers + Marketing**: `/admin/support`, `/admin/customers`, `/admin/reviews`, `/admin/mcc`, `/admin/growth`, `/admin/email-testing`, `/admin/landing-page`, `/admin/discounts`, `/admin/attribution`.
- **Phase 5 — Finance + System**: `/admin/finance`, `/admin/profitability`, `/admin/pricing`, `/admin/recommendations`, `/admin/vat`, `/admin/expenses`, `/admin/reports`, `/admin/ops`, `/admin/alerts`, `/admin/analyzer`, `/admin/page-previews`, `/admin/scripts`, `/admin/users` + `[id]`, `/admin/audit`.
- **Phase 6 — Cleanup**: remove `admin-dark` CSS + compatibility layer, dead classes (`admin-reveal` variants if dropped, `admin-sidebar-workspace*`, `admin-workspace-tab*` legacy styles), grep gate, full regression pass.

Wave order within a phase is flexible; phase order is not (foundation first, cleanup last).

## Verification (every phase)

- `npm run check` (lint, unit tests, production build) must pass.
- Manual smoke per `docs/admin-regression-checklist.md` for the touched pages, plus always: storefront scope switching on a scoped page, command bar navigation, AFK timer appearance, one mobile-width pass (375px) per redesigned page.
- Navigation tests in `adminNavigation.test.ts` updated in Phase 0 and green thereafter.
- No `npm run test:e2e` requirement unless storefront-shared components are touched (they should not be). No GrowVault repo contract checks needed — this project must not change GrowVault-facing APIs.

## Out of Scope

- Any backend, Prisma, API route, or permission-scope changes.
- Storefront (`smk-*`) styling, fonts, or components.
- New features. Feature gaps noticed during redesign go into a notes list in the PR description, not into the implementation.
- Dark mode.
