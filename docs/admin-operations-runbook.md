# Admin Operations Runbook

## Required migrations

Run Prisma migrations before relying on finance, expenses, ops automation, or inventory adjustment workflows:

```bash
npx prisma migrate deploy
npx prisma generate
```

The admin panel now expects these storage areas to exist:

- `Expense`
- `RecurringExpense`
- `ExpenseStorefrontAllocation`
- `RecurringExpenseStorefrontAllocation`
- `InventoryAdjustment.sourceReference`
- Automation control-plane tables used by `/admin/ops`

## Post-migration checks

Use these checks after deploy:

```bash
npx tsc --noEmit
npm test -- adminRoute
```

Then verify the admin panel directly:

1. Open `/admin/ops`.
2. Confirm the environment health card shows expense storage, recurring expenses, and automation as ready.
3. Confirm a recent successful automation run is visible if automations are enabled in the environment.
4. Open `/admin/expenses` and confirm expenses load without a migration warning.
5. Open `/admin/inventory-adjustments` and confirm variant search works in the manual adjustment form.
6. Open `/admin/attribution` and confirm unresolved orders and excluded newsletter recipients load without route errors.

## Functional smoke checks

Run these after a schema or admin deployment:

1. Create a manual inventory adjustment from `/admin/inventory-adjustments` and confirm:
   - on-hand inventory changes
   - a new `InventoryAdjustment` row exists
   - an admin audit log entry exists
2. Save tracking on an order from `/admin/orders/[id]` with `Notify customer` enabled and confirm:
   - the order saves
   - the shipping email is recorded once
   - a repeated save does not send another shipping email
3. Create or edit an expense and confirm storefront allocations serialize in the API response.
4. Open `/admin/reports`, `/admin/profitability`, and `/admin/email-testing` and confirm attribution warnings link to `/admin/attribution`.

## Storefront catalog and homepage operations

Use the storefront scope deliberately before editing public merchandise:

1. In `/admin/catalog`, assign products and their visible categories to `MAIN` for Smokeify, `GROW` for GrowVault, or both when appropriate.
2. Keep products active and confirm variant price, image, and stock before expecting them on a public surface.
3. In `/admin/landing-page`, select `MAIN` to control Smokeify hero, deal, and bestseller slots. Select `GROW` only for GrowVault merchandising.
4. Publish the landing-page revision after review. If a slot is left automatic, the storefront uses catalog-driven products from the selected storefront only.
5. Preview and verify Smokeify search, wishlist, recommendation, sitemap, and product pages after changing assignments. Shared image URLs remain owned by Smokeify storage and must load from both deployments where assigned.
6. For a cross-storefront change, run the Smokeify and GrowVault checks documented in `docs/cross-storefront-operating-runbook.md` before release.

The public storefront overhaul does not change admin layout, Prisma ownership,
Viva/webhook behavior, or shared-feed contracts. Do not work around a missing
public item by hardcoding it into a storefront component; correct the product,
category, landing-page, stock, or publication state in admin.

## Attribution remediation workflow

Use `/admin/attribution` for one-off fixes.

- Only apply exact candidates automatically.
- For ambiguous rows, require an operator reason before assigning `MAIN` or `GROW`.
- Newsletter recipients remain excluded until at least one exact storefront path exists.

For bulk repair, run:

```bash
npm run orders:backfill-attribution
```

Review the dry-run output, then apply:

```bash
npm run orders:backfill-attribution -- --apply
```

Useful flags:

- `--limit 50`
- `--order-id <order-id>`

## Failure patterns

- Missing expense tables: finance and expenses should show blocked messaging instead of raw Prisma errors.
- Missing automation tables: `/admin/ops` should show the automation bootstrap warning and environment health should report the block.
- Repeated shipping email sends: check whether the order already has `shippingEmailSentAt`.
- Missing storefront-scoped finance numbers: check for unallocated expenses and unresolved order attribution.
