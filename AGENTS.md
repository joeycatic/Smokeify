# Agent Instructions

Before starting any task in this repo, read these SecondBrain notes:

1. `/Users/jojiarmani/development/Obsidian/SecondBrain/Dashboard.md`
2. `/Users/jojiarmani/development/Obsidian/SecondBrain/00_System/Agent Memory Protocol.md`
3. `/Users/jojiarmani/development/Obsidian/SecondBrain/01_Profile/Persistent Behavior.md`
4. `/Users/jojiarmani/development/Obsidian/SecondBrain/01_Profile/Mistakes and Habits to Avoid.md`
5. `/Users/jojiarmani/development/Obsidian/SecondBrain/02_Projects/Smokeify.md`

Then inspect this repo's current instructions and relevant docs before editing:

- `README.md`
- `docs/cross-storefront-operating-runbook.md`
- `docs/admin-operations-runbook.md`
- Any task-specific masterprompt in `docs/`

## Operating Rules

- Check `git status --short --branch` before editing.
- Do not revert unrelated user changes.
- Do not make architecture calls mid-implementation when a masterprompt or project decision is required first.
- For cross-storefront changes, treat Smokeify as the shared control plane and GrowVault as the grow-only storefront.
- For GrowVault-facing changes, also check the GrowVault repo and run its contract checks when relevant.
- Keep German customer-facing copy in real German with umlauts where applicable.
- Do not commit secrets, `.env` files, API keys, or webhook secrets.
- Production deployments or externally visible actions require explicit confirmation.

## Verification

- Standard quality gate: `npm run check`
- Storefront smoke when relevant: `npm run test:e2e`
- For GrowVault-facing changes, also run in GrowVault: `npm run check` and `npm run contracts:growvault-catalog`

## Closeout

In final responses, state:

- which SecondBrain notes were read
- which repo instructions or masterprompts were followed
- what verification ran
- whether the SecondBrain vault was updated

