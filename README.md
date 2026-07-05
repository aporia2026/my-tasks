# My Tasks

A personal task dashboard. Drop a meeting recording, screenshot, or document
on a task and OpenAI writes a full description plus a TLDR of exactly what
you need to do.

How it works: the browser extracts and compresses the audio track from
recordings (the original video never leaves your machine), splits it into
ten minute chunks, and uploads only those. Each chunk is transcribed
separately and saved as it lands, so a failed run resumes where it stopped.
Transcripts are kept forever; the audio is cleaned up after you confirm the
summary. See `_plans/2026-07-05-task-dashboard.md` for the full design.

## Stack

Next.js (App Router) + Tailwind, Neon Postgres + Drizzle, Vercel Blob,
OpenAI (gpt-4o-mini-transcribe + gpt-5.4-mini), deployed on Vercel Hobby.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in all five values:
   - `DATABASE_URL`: Neon Postgres connection string (Vercel Marketplace or neon.com free tier)
   - `OPENAI_API_KEY`: from platform.openai.com
   - `BLOB_READ_WRITE_TOKEN`: create a Blob store in the Vercel dashboard
   - `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `DASHBOARD_PASSCODE`: the passcode you will type on the login screen
3. `npm run db:push` to create the tables
4. `npm run dev`

## Deploy

Create a Vercel project, connect the repo, add the same five env vars, and
deploy. Production deploys from `main` through the normal pipeline only.

## Commands

- `npm run dev` - local dev server
- `npm test` - unit tests (Vitest)
- `npm run db:push` - sync schema to the database (prototyping)
- `npm run db:generate` / `npm run db:migrate` - versioned migrations

## Costs

Hosting, database, and file storage all fit free tiers. OpenAI is the only
recurring cost: about $0.18 per hour of meeting audio transcribed, and well
under a cent per summary. Realistic total: $2-8/month.
