# StrongTrademarks

Trademark filings, reviewed by a licensed attorney. Users complete a guided intake, pay a flat fee, and a licensed trademark attorney reviews and files the application with the USPTO.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind CSS v4**
- **Drizzle ORM** + **Postgres** (via `postgres-js`)
- **Stripe** Checkout for payments
- **Auth.js** + Drizzle adapter for authentication (stubbed)
- **react-hook-form** + **zod** for the intake form

## Getting started

```bash
cp .env.example .env.local        # fill in DATABASE_URL, Stripe keys, AUTH_SECRET
npm install
npm run db:generate               # generate migration from schema
npm run db:migrate                # apply migration
npm run dev                       # http://localhost:3000
```

For Stripe webhooks during local dev, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the printed signing secret in `STRIPE_WEBHOOK_SECRET`.

## Project layout

```
src/
  app/
    (marketing)/   public pages — landing, pricing, FAQ, how-it-works, sign-in
    (app)/         authed customer area — dashboard, intake form, review, success
    (admin)/admin/ attorney inbox + per-application review
    api/stripe/    checkout session creation, webhook handler
  db/              Drizzle schema and client
  lib/             stripe client, auth helpers, utility functions
```

See `CLAUDE.md` for the architecture in detail.

## Important

StrongTrademarks is not a law firm and does not provide legal advice. Trademark applications are reviewed and filed by licensed independent attorneys. The "not a law firm" disclaimer in the marketing footer is required — leave it in place.
