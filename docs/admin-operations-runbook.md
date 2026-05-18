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
