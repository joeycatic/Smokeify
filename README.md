Smokeify is a custom e-commerce storefront built with Next.js, Tailwind, Prisma, and Stripe Checkout.

## Getting Started

## Environment setup

Copy `.env.example` to `.env` and fill in the values.

Minimum required:
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

## Stripe webhook setup (local)

1) Run Stripe CLI: `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`
2) Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
3) Trigger a test event: `stripe trigger checkout.session.completed`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Critical flow checklist

- Browse catalog -> open PDP -> verify price, availability, low stock badge
- Add to cart -> update quantity -> validate totals
- Start checkout -> Stripe Checkout opens -> complete payment
- Receive `checkout.session.completed` webhook -> order created -> inventory decremented/reserved released
- Order confirmation email sent (Resend) -> order visible in account + admin

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
