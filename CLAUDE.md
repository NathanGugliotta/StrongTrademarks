# StrongTrademarks

## What this is
A web app that lets global trademark applicants complete an intake form, pay a flat fee, and have a licensed trademark attorney review, prepare and file the application with the USPTO. We sit between pro se filing (cheap, high abandonment) and traditional counsel (expensive).

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, Postgres, file storage)
- Stripe (payments)
- Resend (transactional email)
- Deployed on Vercel

## Domain context
- Filings are USPTO trademark applications under the Lanham Act
- v1 supports: TEAS Base filings, 1(a) use-based and 1(b) intent-to-use, US-domiciled applicants only
- Specimen of use is required at intake for 1(a) — image upload
- Attorney of record will be a licensed Ohio attorney at Gugliotta & Gugliotta, LPA
- Our flat fee is on top of USPTO government fees, quoted at intake based on classes and filing basis

## Conventions
- Plain language in user-facing copy — no legalese, no "pursuant to"
- Commit messages: imperative mood, under 72 chars
- Component files: PascalCase
- Database tables: snake_case, singular (`application`, not `applications`)
- TypeScript strict mode, no `any`

## Out of scope for v1
- Madrid Protocol / foreign filings
- Office Action responses
- Watch / monitoring
- Renewals
- trademark clearance searches
