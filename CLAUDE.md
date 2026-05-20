# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web app that lets trademark applicants complete an intake form, pay a flat fee, and have a licensed trademark attorney review, prepare, and file the application with the USPTO. We sit between pro se filing (cheap, high abandonment) and traditional counsel (expensive). **StrongTrademarks itself is not a law firm** — the filing attorney is, and the marketing footer must reflect that.

## Domain context

- Filings are USPTO trademark applications under the Lanham Act.
- v1 supports: **TEAS Base filings**, **1(a)** use-based and **1(b)** intent-to-use, **US-domiciled applicants only**.
- Specimen of use is required at intake for 1(a) — image upload.
- Attorney of record will be a licensed Ohio attorney at **Gugliotta & Gugliotta, LPA**.
- Our flat fee is on top of USPTO government fees, quoted at intake based on classes and filing basis.

## Out of scope for v1

- Madrid Protocol / foreign filings
- Office Action responses
- Watch / monitoring
- Renewals
- Trademark clearance searches (beyond a knock-out check by the attorney)

## Stack (as built)

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind v4**
- **Drizzle ORM** + **Postgres** (postgres-js). For deployment we use Neon.
- **Auth.js v5** (`next-auth@beta`) + Drizzle adapter + Nodemailer email magic-link
- **Stripe** Checkout for payments
- **Vercel Blob** for specimen/drawing uploads
- **Resend** for transactional email (via Nodemailer SMTP transport)
- Deployed on **Vercel**

> Note: an earlier version of this doc named Supabase for auth/Postgres/storage and shadcn/ui for components. We diverged during the scaffold — Auth.js + Drizzle + Vercel Blob ended up being the simpler integration, and we use plain Tailwind components instead of shadcn. If we want to switch any of these, treat it as a deliberate migration rather than "fixing drift".

## Commands

```bash
npm run dev         # next dev (Turbopack)
npm run build       # production build
npm run start       # serve production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run db:generate # drizzle-kit generate (create migrations from schema)
npm run db:migrate  # apply migrations to DATABASE_URL
npm run db:studio   # browse the database
```

Copy `.env.example` to `.env.local` before running anything that touches Stripe, auth, or the database.

## Conventions

- Plain language in user-facing copy — no legalese, no "pursuant to".
- Commit messages: imperative mood, under 72 chars on the subject line.
- TypeScript strict mode, no `any`.
- Server components by default. Mark client components with `"use client"` only when they need state, refs, or event handlers.
- Server actions live next to the routes that use them in an `actions.ts` (or `upload-actions.ts` etc.) file with `"use server"` at the top. Keep zod schemas in a sibling file, not inside the actions file — `"use server"` files may only export async functions.
- Tailwind utility classes with `cn()` from `src/lib/utils.ts` for conditional joins.
- Money stored as integer cents (`amountCents`). Format with `formatCents()` from `src/lib/utils.ts`.
- All TODO markers point to the next concrete piece of work — `grep -r TODO src` to find open ends.

**Known divergences from the original plan:**
- Component files are kebab-case (`application-form.tsx`), not PascalCase. We follow the Next.js App Router conventions where `page.tsx` / `layout.tsx` already enforce lowercase filenames, and kept the rest of the tree consistent with that.
- Database tables are plural snake_case (`users`, `applications`, `attorney_reviews`), not singular. The Auth.js Drizzle adapter expects plural names; flipping to singular would force a fork of those defaults. If we ever switch off Auth.js we can revisit.

## Architecture

### Route groups

The App Router is partitioned into three groups, none of which appear in URLs:

- `src/app/(marketing)/` — public site (`/`, `/how-it-works`, `/pricing`, `/faq`, `/sign-in`). Own layout with public header/footer. The footer carries the "not a law firm" disclaimer — leave it in place.
- `src/app/(app)/` — authenticated customer area (`/dashboard`, `/apply`, `/apply/[applicationId]`, `/apply/[applicationId]/review`, `/apply/[applicationId]/success`). Own layout with signed-in nav.
- `src/app/(admin)/admin/` — attorney inbox and review surface. Gated on role `attorney` or `admin` via `requireAttorney()` in the layout.

Each group has its own `layout.tsx` so headers/footers don't leak across surfaces.

### Application status state machine

```
draft ──submit──▶ submitted ──pay──▶ paid ──attorney picks up──▶ in_review
                                                                    │
                          ┌─────────────────────────────────────────┤
                          ▼                                         │
                  changes_requested ──customer resubmits──▶ in_review (no second payment)
                          │                                         │
                          │                                         ├──▶ filed (terminal, USPTO serial set)
                          │                                         │
                          │                                         └──▶ rejected (terminal)
```

- `/apply/[id]` is editable when `status ∈ {draft, changes_requested}`. Otherwise it redirects to `/apply/[id]/review`.
- `submitApplicationForReview` does `draft → submitted` (payment required) OR `changes_requested → in_review` (skip payment, already paid). The return value `{ paymentRequired: boolean }` tells the form whether to route to the checkout page or back to the dashboard.
- `submittedAt` is set once on the first transition out of `draft` and not reset on resubmission.

### The intake flow

1. `/apply` runs `createDraftApplication` and redirects to `/apply/[id]`.
2. `/apply/[id]` renders the form (`application-form.tsx`, client component, react-hook-form + zod). The form autosaves via `saveApplication` and submits via `submitApplicationForReview`. If `paymentRequired`, the form routes to `/apply/[id]/review`; otherwise to `/dashboard`.
3. `/apply/[id]/review` shows the price and renders `<CheckoutButton>`, which POSTs to `/api/stripe/checkout` to create a Stripe Checkout Session and redirects to Stripe.
4. Stripe's success URL points back to `/apply/[id]/success`. The **source of truth** for "payment succeeded" is the webhook at `/api/stripe/webhook`, not the success page redirect.
5. The webhook flips the application status to `paid` and surfaces it in the attorney inbox at `/admin`.

### Zod schema split

`src/app/(app)/apply/schema.ts` holds the zod schema and inferred types. `src/app/(app)/apply/actions.ts` is the `"use server"` file. They are intentionally separate because a `"use server"` file may only export async functions — exporting the schema object from it breaks `next build`.

### Build-time env handling

- `src/lib/stripe.ts` defers Stripe client construction via a Proxy until first access. `STRIPE_SECRET_KEY` doesn't need to be set at build time.
- `src/db/index.ts` constructs the Drizzle client eagerly with a fallback DSN if `DATABASE_URL` is unset (postgres-js connects lazily on first query, so build still passes). The DrizzleAdapter does an `instanceof PgDatabase` check at construction, so the db must be a real Drizzle instance, not a Proxy — don't refactor this back to a Proxy.
- Module-load throws for missing env are deliberately avoided so `next build` works in CI without secrets.

### Database

Drizzle ORM over postgres-js. Schema lives in `src/db/schema.ts`; the typed client is `src/db/index.ts`. Core tables:

- `users` — `role` enum is `customer | attorney | admin`. One table for all three.
- `applications` — owned by a customer user. Status flow per the state machine above.
- `payments` — keyed by Stripe session/intent IDs, one-to-many from applications.
- `attorney_reviews` — one row per attorney decision. Holds notes, filed timestamp, and the USPTO serial number returned at filing. The full review history is rendered on both the customer review page and the admin detail page.
- `files` — uploaded specimens/drawings, one-to-many from applications.
- Auth.js tables: `accounts`, `sessions`, `verification_tokens`.

Run `npm run db:generate` after editing the schema, then `npm run db:migrate`.

### Auth

Auth.js v5 beta (`next-auth@beta`) with the Drizzle adapter and email magic-link sign-in (Nodemailer provider).

- **Config:** `src/auth.ts` exports `{ handlers, signIn, signOut, auth }`. Session strategy is `"database"` (required for the Email provider).
- **Route handler:** `src/app/api/auth/[...nextauth]/route.ts` re-exports `handlers.GET` / `handlers.POST`.
- **Helpers:** `src/lib/auth.ts` wraps `auth()` with `getCurrentUser`, `requireUser`, and `requireAttorney`. The `require*` helpers `redirect("/sign-in")` (or `"/"` for non-attorneys) so server components and actions can just call them at the top.
- **Route protection:** the `(app)` and `(admin)/admin` layouts call `requireUser()` / `requireAttorney()` so unauthenticated visitors are redirected before any child renders. No middleware-based protection — Auth.js v5 middleware runs on the Edge runtime and can't use the Drizzle adapter without a split config.
- **Sign-in flow:** `/sign-in` renders a form that calls the `sendMagicLink` server action; NextAuth then redirects to `/sign-in/verify`. Clicking the link in the email completes the session and redirects to `/dashboard`.
- **Dev email:** if `EMAIL_SERVER` is unset, the custom `sendVerificationRequest` in `src/auth.ts` logs the magic link to the server console. Set `EMAIL_SERVER=smtp://...` (Resend recommended) for real delivery.
- **Role on the session:** the `session` callback exposes `session.user.id` and `session.user.role`. TS augmentation in `src/types/next-auth.d.ts`. To make a user an attorney, update their `role` directly in the `users` table.

### File uploads (Vercel Blob)

The intake page renders a `<SpecimenUploader>` below the form. Customers upload JPG / PNG / WebP / PDF up to 10MB. Files go directly from the browser to Vercel Blob, then we record the metadata in our `files` table.

- **`/api/upload`** (`src/app/api/upload/route.ts`) — uses `handleUpload` from `@vercel/blob/client` to issue short-lived client tokens. `onBeforeGenerateToken` authenticates the user, verifies they own the application, and checks the application is still in `draft`. Allowed content types and max size are constrained at the token level.
- **`recordSpecimen` / `removeSpecimen`** (`src/app/(app)/apply/upload-actions.ts`) — server actions called from the uploader after the blob upload completes. `recordSpecimen` re-validates ownership + status, checks the URL is from our Blob store, and inserts a `files` row. `removeSpecimen` calls `del()` on the blob and deletes the row.
- **Why not `onUploadCompleted`** — Vercel Blob calls that webhook from their servers, which doesn't work against a local dev server. To keep dev and prod paths identical, the DB insert is always done client-side via `recordSpecimen`. The route's `onUploadCompleted` is a deliberate no-op. Trade-off: if the user closes their browser between the blob upload and the `recordSpecimen` call, the blob is orphaned without a DB row. Acceptable for now.

### Reviewer decisions

`src/app/(admin)/admin/applications/[applicationId]/actions.ts` exports a single `reviewerDecision(formData)` server action that dispatches on a hidden `intent` field. Three intents:

- `filed` — requires a USPTO serial number. Inserts an `attorney_reviews` row with `status='filed'`, sets `filedAt` + `usptoSerialNumber`, flips `applications.status` to `filed`.
- `changes_requested` — requires notes. Same insert/update pattern with `status='changes_requested'`.
- `rejected` — requires notes. Same pattern with `status='rejected'`.

Each runs in a transaction (review insert + application update) and `revalidatePath`s the inbox and the detail page.

### Customer-side feedback loop

Attorney decisions are surfaced to the customer in three places:

- **Dashboard** — a banner counts apps in `changes_requested`, status pills on each row, USPTO serial column populated from the latest `filed` review.
- **`/apply/[id]/review`** — status pill, emerald banner with USPTO serial when filed, amber banner with edit link when changes requested, full timeline of attorney updates.
- **`/apply/[id]` (the form)** — when re-entered in `changes_requested`, shows the latest attorney note above the form as an amber banner; submit button label becomes "Resubmit for review".

## What's stubbed vs. real

Real and working (assuming `DATABASE_URL`, `AUTH_SECRET`, Stripe, and Blob keys are set): magic-link auth, intake form (autosave + validation), specimen uploads, dashboard, attorney inbox, per-application review, Stripe Checkout + webhook, route protection.

Still stubbed:

- **Role assignment** — making someone an attorney requires manually updating `users.role`. No admin UI for this.
- **Email notifications** — status transitions don't email the customer. Plumbing exists (we already have the Nodemailer transport for auth); needs templates per status.
- **Office-action follow-ups** — out of scope for v1.
