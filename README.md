# SMOKEIFY

```
   ____  __  ___  ____  __ __ ________  __
  / __ \/  |/  / / __ \/ //_// ____/ / / /
 / / / / /|_/ / / / / / ,<  / /   / /_/ /
/ /_/ / /  / / / /_/ / /| |/ /___/ __  /
\____/_/  /_/  \____/_/ |_|\____/_/ /_/
```

Signal: engineered to sell fast, stay secure, and scale without drama.

## Stack

- Next.js + React + TypeScript
- Tailwind CSS
- Prisma + Postgres
- Stripe (Checkout Sessions + Payment Intents)

## Features

- Product catalog, cart, and order lifecycle
- Webhook-driven payment state transitions
- Order snapshots for historical pricing
- Admin auditing tools

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment

Copy `.env.example` to `.env` and fill in values.

Required:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Optional (order email + Telegram notifications):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Required for Discord account linking:

- `SMOKEIFY_LINK_TOKEN_SECRET`

## Stripe webhooks (local)

1. Run Stripe CLI: `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`
2. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`
3. Trigger: `stripe trigger checkout.session.completed`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run bloomtech:scrape-preview
npm run bloomtech:import-preview
npm run bloomtech:override-pricing
npm run b2b-headshop:scrape-preview
npm run b2b-headshop:override-pricing
npm run suppliers:sync-stock
npm run orders:backfill-payment-fees
npm run testing:seed-orders
```

Script details are documented in `scripts/README.md`.

## Critical flow checklist

- Browse catalog -> open PDP -> verify price, availability, low stock badge
- Add to cart -> update quantity -> validate totals
- Start checkout -> Stripe Checkout opens -> complete payment
- Receive `checkout.session.completed` webhook -> order created -> inventory decremented/reserved released
- Order confirmation email sent (Resend) -> order visible in account + admin

## Security notes

- All totals computed server-side from DB truth
- Webhooks are the source of payment truth
- Orders are never marked paid from return URLs

## Discord account linking

Smokeify can now issue signed Discord link tokens for the bot-side `/account connect provider:Smokeify` flow.

Current temporary manual flow:

1. Run `/account connect provider:Smokeify` in Discord.
2. Copy the short-lived challenge code, such as `ABCD-EFGH`.
3. Open Smokeify account settings while logged in.
4. Enter the challenge code and your Discord user ID.
5. Copy the signed token Smokeify returns.
6. Run `/account connect provider:Smokeify token:<token>` in Discord before the token expires.

Token details:

- Provider is always `SMOKEIFY`
- `customerId` is always the authenticated Smokeify `User.id`
- `customerRef` is limited to the user username when present
- `displayName` is limited to the user's own profile name when present
- Tokens are signed with `SMOKEIFY_LINK_TOKEN_SECRET`
- Tokens currently expire after 10 minutes

TODO:

- Replace the manual Discord user ID entry with a direct bot-to-site callback once the bot can hand off verified session context.
- Replace manual token copy/paste with a first-class OAuth or deep-link-based account-link confirmation flow.

## Links

- Next.js docs: https://nextjs.org/docs
- Stripe docs: https://stripe.com/docs
