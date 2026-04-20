# Admin Mobile Compatibility Master Prompt

Use this prompt to perform a full mobile compatibility pass on the Smokeify admin panel while preserving the normal desktop/tablet view.

```text
You are working in the Smokeify repository, a Next.js 16 / React 19 / Tailwind CSS 4 application.

Your task is to make the entire admin panel mobile compatible without impacting the existing normal desktop view. Treat this as an end-to-end responsive admin UI hardening pass, not a redesign. Preserve the current desktop information architecture, dark admin theme, route behavior, permissions, API behavior, server data loading, and business logic.

Primary goal:
Make every admin route under `/admin` usable, readable, reachable, and action-safe on mobile widths from 320px through 430px, while keeping the current desktop layout visually and behaviorally stable at 1024px, 1440px, and 1600px.

Do not stop at the shell. Audit and fix the full admin surface:

- `/admin`
- `/admin/analytics`
- `/admin/audit`
- `/admin/finance`
- `/admin/reports`
- `/admin/vat`
- `/admin/expenses`
- `/admin/profitability`
- `/admin/pricing`
- `/admin/alerts`
- `/admin/catalog`
- `/admin/catalog/[id]`
- `/admin/categories`
- `/admin/collections`
- `/admin/landing-page`
- `/admin/discounts`
- `/admin/reviews`
- `/admin/orders`
- `/admin/orders/[id]`
- `/admin/returns`
- `/admin/inventory-adjustments`
- `/admin/customers`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/suppliers`
- `/admin/recommendations`
- `/admin/scripts`
- `/admin/email-testing`

Important repository context:

- Admin layout lives in `src/app/admin/layout.tsx`.
- The global admin shell lives in `src/components/admin/AdminShell.tsx`.
- Shared admin primitives live in:
  - `src/components/admin/AdminWorkspace.tsx`
  - `src/components/admin/AdminInsightPrimitives.tsx`
  - `src/components/admin/AdminCharts.tsx`
  - `src/components/admin/AdminCommandBar.tsx`
  - `src/components/admin/AdminBackButton.tsx`
  - `src/components/admin/RichTextEditor.tsx`
- Admin pages and clients live in `src/app/admin/**`.
- Global admin CSS and legacy dark-theme adaptation live in `src/app/globals.css`, especially the `.admin-shell`, `.admin-theme.admin-dark`, `.admin-legacy-page`, `.admin-catalog-*`, and `.admin-product-redesign` sections.
- Existing admin regression guidance is in `docs/admin-regression-checklist.md`.

Non-negotiable constraints:

1. Do not change authentication, authorization, API contracts, mutation semantics, Prisma queries, payment/refund logic, admin audit behavior, or validation rules unless a visual bug truly cannot be fixed otherwise.
2. Do not remove admin functionality on mobile. If space is limited, stack, collapse, scroll, or move controls into an accessible disclosure/drawer, but every action must remain available.
3. Do not make the desktop view worse. Existing desktop layouts at `lg`, `xl`, and wide viewports must remain effectively unchanged.
4. Prefer mobile-only or mobile-first class changes. Preserve existing desktop behavior by adding `sm:`, `md:`, `lg:`, or `xl:` variants rather than replacing desktop layout classes blindly.
5. Do not hide overflowing content with `overflow-x-clip` or `overflow-hidden` unless the user can still access it. Wide tables and grids need either responsive card layouts or deliberate horizontal scrolling.
6. Keep touch targets at least 40px high/wide where practical. Critical actions should not become tiny icon-only controls without labels or accessible names.
7. Do not introduce a new design system. Use the current admin style: dark surfaces, white/10 borders, slate text, cyan/emerald/amber/red status accents, rounded panels, and existing shared primitives.
8. Keep copy user-facing and concise. Do not add explanatory marketing text to the admin UI.

Definition of done:

- No admin route creates page-level horizontal overflow at 320px, 360px, 390px, 430px, or 768px unless the overflow is an intentional scroll container for a wide data table or editor matrix.
- The sidebar can be opened, navigated, scrolled, and closed on mobile.
- The sticky header does not cover content, force horizontal page overflow, or trap controls off-screen.
- Every filter row, search bar, tab group, action toolbar, pagination control, status badge row, modal, drawer, save bar, and destructive confirmation flow works at mobile width.
- Tables or fixed-column grids are usable on mobile through one of these patterns:
  - Convert to stacked cards below `md`.
  - Keep a real table/grid but wrap it in a clear `overflow-x-auto` container with an adequate `min-w-*`, visible context, and no page-level horizontal scroll.
  - For dense operational data, show mobile cards and keep the existing desktop table at `md` and above.
- Forms are one column on mobile, inputs are full width, labels stay attached to fields, and validation/status messages wrap.
- Long product titles, emails, order IDs, handles, URLs, tracking numbers, coupon codes, script output, and JSON/log text truncate or wrap safely.
- Modals and drawers fit inside `100dvh`, respect bottom safe area insets, and scroll internally.
- Sticky save/action bars remain reachable without covering form fields.
- Charts, metric cards, and dashboards stack without clipping text or controls.
- Desktop screenshots or visual checks at 1440px and 1600px show no material layout regression.

Start with an audit before editing:

1. Check current git status and do not revert unrelated user changes.
2. Enumerate admin routes and shared components.
3. Search for responsive hazards:
   - `grid-cols-[`
   - `min-w-[`
   - `w-[`
   - `max-w-[`
   - `overflow-hidden`
   - `overflow-x-clip`
   - `fixed`
   - `sticky`
   - `table`, `thead`, `tbody`, `tr`, `td`, `th`
   - `whitespace-nowrap`
   - `tracking-[`
   - `text-[10px]`, `text-[11px]` in cramped control areas
4. Prioritize files that define shared layout first, then high-density admin clients.

Recommended implementation order:

Phase 1: Shared shell and primitives

- Update `src/components/admin/AdminShell.tsx`.
  - Ensure the mobile sidebar uses safe viewport units and can scroll all nav groups.
  - Make header controls robust at 320px. The page title should truncate safely, and the command bar, storefront switcher, and language switcher should not push the page wider than the viewport.
  - Consider a mobile control row that horizontally scrolls inside the header while desktop remains unchanged with `sm:` / `md:` / `lg:` variants.
  - Ensure the main content wrapper cannot be wider than the viewport because of children.
- Update `src/components/admin/AdminWorkspace.tsx`.
  - Make `AdminPageIntro`, `AdminPanel`, `AdminDialog`, and `AdminDrawer` mobile-safe by default.
  - Reduce only mobile padding/radius where needed and restore the current larger desktop spacing with `sm:` or `md:` classes.
  - Make panel action areas stack full-width on mobile when they contain multiple buttons or filters.
- Update `src/components/admin/AdminInsightPrimitives.tsx`.
  - Ensure metric cards, tabs, compact metrics, and panel headers wrap cleanly.
  - Tab lists should use `overflow-x-auto` on mobile or wrap without clipping.
- Update `src/components/admin/AdminCharts.tsx`.
  - Chart containers should use responsive heights and never exceed viewport width.
  - Legends should wrap and labels should truncate or wrap safely.
- Update `src/components/admin/AdminCommandBar.tsx`.
  - The command palette should fit narrow screens, use `max-h-[calc(100dvh-...)]`, and preserve keyboard/focus behavior.

Phase 2: Global CSS support

- Update `src/app/globals.css` only for scoped admin behavior.
- Add small, reusable admin-only helpers if they reduce repeated fixes, for example:
  - `.admin-scroll-x` for deliberate horizontal scrolling containers.
  - `.admin-mobile-stack` only if used consistently.
  - Scoped rules under `.admin-shell` or `.admin-theme.admin-dark` to prevent accidental storefront impact.
- Do not globally alter normal storefront components.
- If adding CSS for mobile only, use `@media (max-width: 767px)` or Tailwind classes in components.

Phase 3: High-density admin pages

Audit and fix every admin page/client, with extra attention to these known high-risk areas:

- `src/app/admin/AdminInventoryAlertsClient.tsx`
  - Contains fixed grids like `grid-cols-[1.8fr_100px_100px_120px_120px]`. On mobile, replace with stacked cards or wrap the grid in a deliberate horizontal scroller.
- `src/app/admin/customers/AdminCustomersClient.tsx`
  - Contains wide customer grids, search/filter rows, side panels, cohort controls, and customer detail/action areas. Mobile should stack search controls, make customer rows cards below `md`, and keep side detail panels below the list instead of squeezing.
- `src/app/admin/vat/page.tsx`
  - Contains wide VAT table grids such as `grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]`. Provide a mobile card/list version or horizontal scroller with safe padding.
- `src/app/admin/catalog/[id]/AdminProductClient.tsx`
  - Large product editor with sticky section navigation, dense variant grids, image grids, cross-sell controls, modals, and sticky save bar. Ensure mobile editing is actually usable, not merely non-overflowing.
  - Fixed editor grids such as image rows, variant rows, option rows, and modal forms need mobile stack layouts below `md`.
  - Drag handles should not be the only way to understand item order on touch screens. Keep controls readable.
- `src/app/admin/orders/AdminOrdersClient.tsx`
  - Queue cards, filters, tabs, and bulk/status controls must stack and remain action-safe.
- `src/app/admin/orders/[id]/AdminOrderDetailClient.tsx`
  - Order detail panels, timeline, totals, fulfillment, refund, exchange, email, and status controls must fit mobile.
- `src/app/admin/reports/AdminReportsClient.tsx`
  - Filters, saved reports, delivery controls, export actions, and report preview tables must be mobile-safe.
- `src/app/admin/expenses/AdminExpensesClient.tsx`
  - Expense filters, recurring expenses, tables, modals, and export controls must work at 320px.
- `src/app/admin/pricing/AdminPricingClient.tsx`
  - Pricing rule tables, preview/apply flows, and competitor data need mobile-safe data presentation.
- `src/app/admin/analytics/AdminAnalyticsClient.tsx`
  - Chart grids, filter tabs, event streams, and KPI cards must stack without clipping.
- `src/app/admin/alerts/AdminAlertsClient.tsx`
  - Alert cards, mutation controls, assignment/status controls, and filtering must be touch friendly.
- `src/app/admin/scripts/AdminScriptsClient.tsx`
  - Script cards, run controls, reason inputs, and log output should wrap/scroll safely. Preserve `pre` readability with internal horizontal or wrapped scrolling as appropriate.
- `src/app/admin/users/[id]/AdminUserEditClient.tsx`
  - Governance/MFA/role controls and destructive confirmations must be safe on mobile.
- `src/app/admin/reviews/AdminReviewsClient.tsx`
  - Review moderation buttons and review metadata must stack cleanly.

Phase 4: Remaining pages

Review the rest of `src/app/admin/**` and apply the same rules. Do not assume pages are safe just because they are short server components; many render client components with dense layouts.

Responsive patterns to use:

- Mobile-first stacking:
  - Use `grid gap-3 md:grid-cols-2 xl:grid-cols-4`, not fixed columns at the base breakpoint.
  - Use `flex flex-col gap-2 sm:flex-row sm:items-center` for button/filter rows.
  - Use `w-full sm:w-auto` for buttons in mobile toolbars where stacking improves reachability.
- Wide data:
  - Preferred for action-heavy rows: render mobile cards with `md:hidden` and keep the current desktop table/grid with `hidden md:block` or `hidden md:grid`.
  - Preferred for dense read-only matrices: wrap in `overflow-x-auto` with `max-w-full`, internal padding, and `min-w-[...]`; ensure only the inner container scrolls, not the page.
- Text:
  - Add `min-w-0` to flex/grid children that contain truncating text.
  - Use `break-words`, `break-all`, or `truncate` based on content type.
  - Avoid uppercase tracking that makes labels overflow on very small screens; reduce tracking only on mobile if needed and keep current desktop tracking with `sm:` variants.
- Sticky/fixed:
  - Use `top` offsets that account for the sticky admin header.
  - On mobile, consider turning sticky section nav into an internal horizontal scroller or non-sticky block if it covers content.
  - Sticky footers/save bars should use `pb-[max(...,env(safe-area-inset-bottom))]`.
- Forms:
  - Every input/select/textarea should be `w-full min-w-0`.
  - Multi-column forms should be one column until at least `md`.
  - Inline field groups should stack on mobile unless the fields are tiny and genuinely belong together.
- Modals/drawers:
  - Use `max-h-[calc(100dvh-1rem)]` or similar and internal scrolling.
  - Bottom-sheet behavior is acceptable on mobile; side-drawer behavior can remain on desktop.

Desktop preservation strategy:

- Before changing a layout, identify the current desktop breakpoint. Keep the current desktop class behind that breakpoint.
  - Example: if a grid currently uses `grid-cols-[1fr_120px_120px]`, change the base to `grid-cols-1` and move the fixed grid to `md:grid-cols-[1fr_120px_120px]` or `lg:grid-cols-[...]`.
  - Example: if a toolbar currently uses `flex items-center justify-between`, change to `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
- Avoid editing desktop-only widths unless they cause mobile overflow at the base breakpoint.
- Do not change desktop copy, route order, nav groups, or data density unless required by accessibility or overflow.

Accessibility requirements:

- Preserve semantic buttons and links.
- Preserve or add `aria-label` for icon-only controls.
- Modal/drawer close buttons must remain reachable.
- Focus outlines must remain visible.
- Do not create keyboard traps in mobile drawers or command palette.
- Touch targets should generally be at least 40px tall.

Verification commands:

- Run `npm run lint -- <touched files>` where feasible.
- Run `npm run lint` if the touched set is broad.
- Run `npx tsc --noEmit` or the local TypeScript command available in the repo.
- Run focused tests if any behavior code changes. For visual-only responsive work, tests may be limited to lint/typecheck plus browser verification.

Browser verification:

- Start the app with `npm run dev` if not already running. The configured dev port is 3900.
- Sign in through `/auth/admin` if needed.
- Check every admin route at:
  - 320x700
  - 360x740
  - 390x844
  - 430x932
  - 768x1024
  - 1024x768
  - 1440x900
  - 1600x1000
- For each route, verify:
  - No unintended page-level horizontal scroll.
  - Header/sidebar controls are reachable.
  - Filters, tabs, pagination, primary actions, destructive actions, and forms are reachable.
  - Modals/drawers fit and scroll internally.
  - Tables/card lists are readable.
  - Desktop layout remains visually equivalent to the original.

Manual admin workflow spot checks:

- Open and navigate the sidebar on mobile.
- Open command bar on mobile and desktop.
- Switch language and storefront scope.
- Dashboard: change time range and inspect all panels.
- Analytics: inspect KPI cards, charts, filters, and event lists.
- Orders: search/filter, open an order, inspect fulfillment/refund/email/status areas.
- Catalog: search/filter products, open a product, inspect details, images, variants, categories, cross-sells, modals, and save bar.
- Customers: search/filter, select a customer, inspect notes/store credit/cohort controls.
- Reports/Finance/VAT/Expenses/Profitability/Pricing: inspect dense tables, export controls, filters, and charts.
- Users: inspect list and user detail governance/MFA controls.
- Scripts: inspect script list, run reason input, and output panels.

Expected final response after implementation:

- Summarize the responsive changes by area.
- List any routes that could not be fully verified and why.
- List the exact verification commands run.
- Mention any residual risks, especially if admin auth or seeded data prevented full route inspection.
```

## Notes For Future Maintainers

This prompt intentionally favors small, breakpoint-scoped layout changes over a redesign. The admin panel already has a mobile-aware shell and several reusable primitives, but many dense clients still contain fixed grids and desktop-first table layouts. The safest implementation path is to make shared primitives more forgiving, then convert high-density rows to mobile cards or contained horizontal scrollers while leaving the current desktop layouts behind `md`, `lg`, or `xl` breakpoints.
