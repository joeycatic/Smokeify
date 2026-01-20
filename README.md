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
```

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

## Links

- Next.js docs: https://nextjs.org/docs
- Stripe docs: https://stripe.com/docs
