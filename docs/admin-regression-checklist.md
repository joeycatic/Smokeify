# Admin Regression Checklist

Use this checklist after meaningful admin-panel changes, especially in order, catalog, pricing, scripts, and user-management flows.

## Static Verification

- Run `npm run lint -- <touched files>`
- Run `.\node_modules\.bin\tsc.cmd --noEmit`
- Run `npm run vercel-build`

## Order Workspace

- Verify tab switching works with mouse and keyboard.
- Verify the selected tab announces correctly and focus remains visible.
- Verify reduced-motion mode softens or removes non-essential tab motion.
- Verify changing fulfillment fields marks the page dirty.
- Verify reload restores safe local draft state.
- Verify `Discard local draft` clears restored changes.
- Verify leaving with unsaved changes triggers a browser warning.
- Verify `fulfilled` does not auto-send shipping email.
- Verify `shipped` with tracking shows the auto-send outcome clearly.
- Verify manual shipping email requires a reason.
- Verify refunds require a reason.
- Verify stale refund attempts show a conflict message instead of overwriting.

## Catalog Product Editor

- Verify changing details, media, variants, categories, collections, or manual overrides marks the page dirty.
- Verify reload restores the local product draft only when product and variant versions still match.
- Verify `Discard local draft` reloads the authoritative product state.
- Verify stale product saves return a conflict message.
- Verify stale variant saves return a conflict message.
- Verify variant deletion requires:
  - typed confirmation
  - a reason
  - admin password
- Verify variant deletion logs the reason in audit metadata.

## Pricing

- Verify preview runs can still execute without apply-only notes if that remains the intended behavior.
- Verify apply runs require notes.
- Verify permission or validation failures return clear operator-facing errors.

## Scripts

- Verify every mutating script run requires a reason.
- Verify script execution stays disabled while a run is active.
- Verify audit entries capture the script reason on start and completion/failure.

## User Management

- Verify the user edit screen marks unsaved changes correctly.
- Verify reload restores the local user draft only when the user record version still matches.
- Verify `Entwurf verwerfen` reloads the authoritative user state.
- Verify stale user saves return a conflict error instead of overwriting.
- Verify role changes require a reason.
- Verify governance actions require a reason.
- Verify MFA/governance audit entries retain operator intent metadata.

## Manual Browser Pass

- Check desktop and narrow-width layouts for:
  - sticky admin controls
  - modal layering
  - visible focus outlines
  - readable contrast on inputs, selects, and badges
- Exercise at least one happy path and one failure path in each touched admin area.
