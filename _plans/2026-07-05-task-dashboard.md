# Task Dashboard: plan

Date: 2026-07-05
Status: approved (architecture and media policy confirmed by Yoav)

## Goal

A personal task management dashboard for one user. Tasks arrive faster than they can be tracked, and each task often comes with evidence: a recorded meeting, screenshots, PDFs, documents. The system ingests those files, transcribes recordings, reads images and documents, and uses OpenAI to write two things per task:

1. A full description of what the task actually requires.
2. A short TLDR of exactly what the user needs to do.

Success looks like: drop a 90-minute meeting recording on a task, walk away, come back to a clear TLDR of your action items, without ever thinking about file formats, storage, or pipelines.

## Constraints

- Single user (Yoav), personal tool. No team features, no multi-tenancy.
- Hosted on Vercel Hobby (free tier). Vercel Blob free tier: 1GB storage, 10GB transfer per month. Neon Postgres free tier: 0.5GB storage, 100 compute hours per month.
- Total budget under $20/month. Realistic spend lands at $2-8/month, OpenAI only.
- OpenAI API is a hard requirement (user's explicit choice).
- Built and maintained by one person. Every component must be boring, googleable, and replaceable.
- UI bar: a lazy user gets it instantly. Polished, intuitive, effortless.

## Verified pricing (checked live 2026-07-05)

- Transcription: gpt-4o-mini-transcribe ~$0.003/min ($0.18 per audio hour), gpt-4o-transcribe ~$0.006/min ($0.36 per audio hour). Source: developers.openai.com/api/docs/pricing and costgoat.com/pricing/openai-transcription.
- Summaries: gpt-5.4-nano $0.20 input / $1.25 output per 1M tokens; gpt-5.4-mini $0.75 / $4.50. A task summary costs well under one cent.
- Vercel Blob free tier: 1GB storage + 10GB transfer/month. Source: vercel.com/docs/vercel-blob/usage-and-pricing.
- Neon free plan: 0.5GB storage, 100 CU-hours/month. Source: neon.com/pricing.
- The OpenAI transcription endpoint caps uploads at 25MB per file. Verify the exact current number against OpenAI docs during implementation; the chunking design does not depend on the precise value.

## Requirements

In scope for v1:

- Task CRUD: title, status (inbox, todo, in progress, done), priority, due date, notes.
- Dashboard views: task list with filters, task detail with files, transcript, description, TLDR.
- File upload per task: audio, video, images, PDFs, text documents. Drag and drop plus file picker.
- Recording pipeline: browser extracts and compresses the audio track from video, splits it into ~10 minute chunks, uploads only the chunks. Original video never leaves the machine.
- Chunked transcription: each segment is a row in Postgres with its own status. Retry skips finished segments. The pipeline is resumable by construction.
- AI output: full description plus TLDR, generated from transcripts, images, and documents together.
- Confirm step: the user reviews the AI output. On confirmation the source audio blobs are deleted (media policy: rarely or never replayed, confirmed by user). Transcripts are kept forever.
- Transcript export: one-click JSON/Markdown export of all tasks and transcripts.
- Auth: single passcode, signed session cookie, middleware enforced.
- Settings page (see Settings section).

Out of scope for v1 (deliberately deferred, schema leaves headroom):

- Semantic search over transcripts (pgvector).
- In-browser meeting recording.
- Weekly digest emails, calendar or email integrations.
- Mobile-native app. The web UI must be responsive, but ffmpeg.wasm extraction is desktop-first; on mobile the fallback path (upload audio file directly) is the expected route.

## Chosen approach

Stack: Next.js (App Router, TypeScript) + Tailwind + Neon Postgres + Drizzle ORM + Vercel Blob + OpenAI via AI SDK. Deployed on Vercel Hobby.

Pipeline, end to end:

1. User drops a file on a task.
2. Video/audio: a web worker running ffmpeg.wasm extracts the audio track, re-encodes to compressed mono audio, and splits it into ~10 minute segments. Progress is shown per step. If extraction fails (low RAM, mobile, unsupported codec), the UI says so plainly and offers the fallback: upload an audio file directly, which the server splits if needed, or proceed without transcription.
3. Segments upload straight from the browser to Vercel Blob (client upload tokens, bypassing the serverless body limit). Images and documents upload as-is.
4. The client calls the processing route. It picks up pending segments, transcribes them one at a time with gpt-4o-mini-transcribe, and writes each transcript to its segment row as it lands. The route processes as many segments as fit safely inside the 300s window, then returns; the client polls status and re-invokes until everything is done. A crash or timeout loses at most one segment of work.
5. When all inputs are ready, a summarization call (gpt-5.4-mini by default, configurable) reads the stitched transcript plus images plus document text and produces the description and the TLDR.
6. The user reviews. Confirm deletes the audio segment blobs and marks the task summarized. Reject regenerates or lets the user edit. Audio is never deleted before confirmation, so a garbled transcript can always be re-run.

State machine (per attachment): uploaded -> extracting -> transcribing -> summarizing -> ready -> confirmed (media cleaned) | failed (with reason and a Retry button). All state lives in Postgres, never in function memory.

## Alternatives rejected and why

- Keep every original file on Vercel Pro ($20/mo): spends the entire budget storing videos the user confirmed he almost never rewatches. Storage of raw media is a cost center; the transcript is the asset.
- Upload full video then delete after transcription: burns the 10GB/month free transfer cap after roughly 10-20 hours of video, and the failure mode (uploads silently failing mid-month) is invisible until it happens.
- AI for images/docs only, no transcription: loses the headline feature.
- Vercel Workflow/Queues for the pipeline: a second system to learn and debug; the per-segment status column already provides resumability.
- Clerk or another auth provider: a dependency, a dashboard, and a pricing page for a userbase of one. A passcode and a signed cookie is the whole problem.
- Local app or VPS instead of Vercel: erases the storage and timeout constraints, but loses any-device access, which the user chose deliberately.

## Security

- Sensitive data: meeting transcripts and summaries (business content), the OpenAI API key, the passcode.
- Attack surface: a public Vercel URL. Every route and every Blob upload token issuance sits behind the auth middleware; fail closed.
- Auth: passcode compared in constant time against an env var hash, session as an HMAC-signed httpOnly secure cookie with expiry. Rate limit passcode attempts.
- Secrets: OPENAI_API_KEY, AUTH_SECRET, PASSCODE_HASH, DATABASE_URL, BLOB_READ_WRITE_TOKEN live in Vercel env vars only. Never in code, never logged, .env.local gitignored.
- Blob access: uploads via short-lived client tokens scoped to a path; blob URLs are unguessable and rows track them so cleanup cannot strand files.
- Input validation: file type and size checked client and server side (zod schemas at every API boundary). LLM output is rendered as text/sanitized markdown, never as HTML.
- Logging: no transcript bodies, no credentials, no cookie values in logs. IDs and statuses only.

## Observability

- Client: namespaced console.info at every pipeline step with real values, e.g. [upload extract], [upload blob], [pipeline poll], [auth session]. Booleans and counts logged with values.
- Server: a small logger wrapper (level, namespace, JSON details) mirroring the same namespaces: [api process], [api transcribe], [api summarize], [api cleanup], [db].
- Every attachment and segment row carries status, error text, and timestamps, so the UI itself is a diagnostic surface: the task detail page shows exactly which segment failed and why.
- Vercel function logs capture the server side; the console captures the client side. A silent failure should be locatable from either alone.

## Settings

Settings live in a settings table (key/value) with a dedicated, plainly worded settings page. v1 controls:

- AI: summary model (gpt-5.4-mini default, gpt-5.4-nano as the cheap option), transcription model (gpt-4o-mini-transcribe default), TLDR tone/length (short default).
- Media: auto-delete audio after confirmation (on by default, per user's answer), with keep 30 days and keep forever as options.
- Behavior: auto-start processing on upload (on), confirm before regenerate (on).
- Appearance: theme (system/light/dark), density (comfortable/compact).

Intentionally not exposed: chunk length, polling interval, prompt text (internal tuning knobs; exposing them would violate the one-obvious-knob rule).

## Testing

Framework: Vitest. Unit tests cover the pure logic, which is where the pipeline correctness lives:

- Segment planner: durations to chunk boundaries, edge cases (0 length, exactly 10 min, 2h+).
- State machine transitions: legal and illegal moves, retry-skips-done behavior.
- Auth: cookie signing/verification, tampered cookie rejected, expiry honored, constant-time compare.
- Transcript stitching: ordering, gaps from failed segments, unicode.
- Retention policy: which blobs are eligible for deletion under each setting.
- Cost estimator shown in the UI: minutes to dollars.
- Zod schemas: malformed API inputs rejected.

Integration (mocked OpenAI/Blob): the process route resumes correctly after a simulated mid-run failure. Out of scope: live end-to-end against real OpenAI/Blob (needs real keys; done manually at deploy time), visual regression.

## Deploy

- Git: local repo, main branch. This project has no remote yet; nothing is pushed anywhere without explicit approval per standing rules.
- Flow once a remote exists: feature branches -> PR -> merge to main -> Vercel auto-deploys production. Previews come from PR branches. No manual promotions.
- Rollback: Vercel instant rollback to the previous deployment.
- Env setup at first deploy: provision Neon via Vercel Marketplace, create a Blob store, set the four secrets, run drizzle migrations.

## Open questions

- Exact current OpenAI per-file upload cap and PDF input support in the Responses API: verify against live docs during implementation.
- ffmpeg.wasm bundle size (~30MB wasm) is acceptable for a desktop-first personal tool, loaded lazily only when a video is dropped; revisit if it annoys in practice.
- Neon 0.5GB holds years of transcripts, but if the corpus grows past that, the export path plus a paid tier decision comes back to the table.
