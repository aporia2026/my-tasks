# Multi-user portal (My Tasks v2): build plan

Date: 2026-07-06
Status: approved. Auth decision: Option A (extend existing session with magic
links). Defaults confirmed: admin = contact@wellnessbees.com (self-provisions
via ADMIN_EMAIL on first sign-in), Resend sandbox domain first then a verified
custom domain before real users, declined tasks shown to requesters in a
Declined group. Building Phase 1 first.

Progress:
- Phase 1 (auth foundation) code-complete 2026-07-06. Added email+password login
  alongside magic links (user request). users + auth_tokens tables, scrypt
  passwords, single-use emailed link tokens, session cookie now carries user id
  + role, proxy resolves a user, ADMIN_EMAIL self-provisions the owner,
  set-password in Settings. Green on typecheck, lint, 64 tests, and the
  production build. Not yet exercised end-to-end against a live database (infra
  not provisioned) or against real email delivery; the magic-link DB round-trip
  has no unit test (needs a database). Next: Phase 2 (per-user data isolation).
- Email transport: the owner does not control a domain, so Resend/Mailgun (which
  require domain verification) and free single-sender services (spam on
  unauthenticated free addresses) were ruled out. Switched to SMTP via
  Nodemailer, targeting a Gmail account with an app password (SMTP_* env vars).
  ~100 sends/day, far above need. Transport stays swappable if a domain appears
  later. Skipped when SMTP is unconfigured; prints the link to the dev console.
- Phase 2 (per-user data isolation) code-complete 2026-07-06. Added tasks.ownerId
  (FK users, no cascade) with a three-step migration (nullable, backfill admin,
  set not null) safe on empty or populated tables. New repository layer
  (src/lib/db/repo): a pure ownsOrAdmin rule plus getAccessibleTask /
  getAccessibleTaskDetail / getAccessibleAttachment gates and scoped list/create.
  Every task and attachment route now resolves the session and passes an
  ownership gate before touching a row; missing and not-yours both return 404 so
  ids cannot be probed. Export is scoped; the media sweep is admin-only. Green on
  typecheck, lint, 66 tests, and the build. Behavior for the admin (only user so
  far) is unchanged; the app is multi-tenant-safe underneath.
  Deferred to Phase 3 (no requester exists yet, so not exploitable): (a) settings
  GET/PUT is still global and not role-gated, so once requesters exist, restrict
  writes to admin and move per-user view/density prefs off the shared settings
  table; (b) the Blob upload-token route is session-gated only (no per-task
  scope) since no taskId is known at token time; the security-critical bind
  happens at attachment register, which is gated. Also Phase 3: gate the AI
  pipeline (process/confirm) behind admin approval so a requester cannot spend
  the OpenAI budget.
- Phase 3 (submissions + review queue) code-complete 2026-07-06. Backend: review
  state machine (src/lib/review.ts, tested), tasks.reviewState + declineReason +
  owner relation (migration 0003), createTaskForCaller sets pending for
  requesters and none for admin, approve+decline repo fns, the process route now
  refuses unless canProcess (AI cost gate closed), settings PUT is admin-only,
  the invite flow (users invite/list/remove-with-reassign), /api/auth/me, and a
  shared issueSignInLink helper used by request-link and invite. UI: a
  UserProvider exposes role to the client; dashboard, task detail, and settings
  each route by role. Requesters get a send-a-task form, their own tasks with
  plain-language statuses, a file-upload plus read-only-summary detail, and no
  pipeline controls. Admin gets a review queue with approve/decline, attribution
  on cards and detail, and a priority selector on the quick-add (closes the
  original priorities ask). Green on typecheck, lint, 72 tests, and the build.
  Still unverified against a live database or real accounts. Remaining: Phase 4
  comments, Phase 5 notification emails.
- Design pass 2026-07-06: implemented the Claude Design system (My Tasks (1).html)
  as theme tokens (light + dark) plus a component layer (.btn scale, .pill +
  variants, .tag, .avatar, .eyebrow, .brandmk) in globals.css, and adopted it on
  the built screens (requester status pills, People tags, header brand mark,
  accent eyebrow section labels). The mockup's comments-thread and email screens
  are handled by Phases 4 and 5.
- Phase 4 (comments) code-complete 2026-07-06. comments table (migration 0004,
  cascade on task and author delete), included in getAccessibleTaskDetail with
  the author projected to safe columns, addComment gated by task access, POST
  /api/tasks/[id]/comments, commentSchema, and a CommentThread component (design
  avatar + thread, own comments marked with a teal left border) rendered on both
  the requester and admin task detail. Comments load with the task and refresh on
  post; no live polling for new comments yet (acceptable at this scale). Green on
  typecheck, lint, 72 tests, and the build. Remaining: Phase 5 notification
  emails (submitted / accepted / declined / commented / summary-ready).
- Phase 5 (notification emails) code-complete 2026-07-06. Five on-brand templates
  in emails.ts (task submitted / accepted / declined / new comment / summary
  ready), with user-supplied text HTML-escaped. A notify.ts module resolves the
  recipient (submitted -> admin; accept/decline -> owner; comment -> the other
  party, never the commenter, self-skip when owner is admin; summary -> owner
  only if a requester). Wired into the tasks POST, approve, decline, comments,
  and process routes via next/server after(), so email runs after the response
  and a slow mailbox never blocks or hangs the request; sendEmail still no-ops
  and logs without SMTP. Green on typecheck, lint, 72 tests, and the build.
- Status: all five phases plus the design pass are code-complete. Nothing has
  been run against a live database, real accounts, or real SMTP yet (infra not
  provisioned) — that end-to-end verification is the outstanding work, along with
  the manual QA in the Phase 6 line below (golden path per role, mobile, empty
  and error states).

## Goal

Turn the single-user My Tasks tool into a small invite-only workspace. About ten
people I invite can sign in, send me tasks with files, watch progress, and talk
to me in a comment thread. I (the admin) see every task, approve or decline what
comes in, decide when the AI runs, comment back, and invite or remove people.
Email keeps both sides informed.

Success looks like: I send an invite, the person clicks a link in their email
and is in, they send me a task with a recording attached, I get an email, I
approve it and run the AI, they watch it go from "under review" to a finished
TLDR, and we settle the details in comments. Nobody but me can see anyone else's
tasks, ever.

## Constraints

- Fast delivery, no over-complication. This is an internal tool for ten people I
  know, not a consumer product. No onboarding funnels, no audit-trail machinery,
  no compliance tooling.
- Solo maintainer. Every piece stays boring, googleable, replaceable.
- Near-zero cost: Neon free (0.5GB), Vercel Blob free (1GB storage, 10GB
  transfer/month), Resend free (3,000 emails/month, 100/day). OpenAI stays the
  only real cost and must not be spendable by users.
- Next.js 16.2.10, React 19, Tailwind v4, Neon + Drizzle, Vercel Blob, OpenAI.
  Do not fight the stack; extend what already works.
- Security is first-class: per-user isolation enforced on the server, fail
  closed, no cross-tenant leakage.

## Requirements

In scope for v2:

- Accounts: users table, two roles (admin, requester). Invite-only. Passwordless
  magic-link login by email.
- Per-user data isolation: a requester sees only their own tasks, files,
  comments. The admin sees everything.
- Task submission by requesters: title, details, priority, file uploads. Lands
  in a review queue.
- Review queue: admin approves (task enters the normal flow) or declines (with
  an optional reason emailed to the requester).
- AI gating: the transcription/summary pipeline runs only after the admin
  approves and triggers it. A requester upload never spends OpenAI or Blob on
  its own.
- Comments: one thread per task, both roles, newest last.
- Email (Resend): magic-link sign-in, plus notifications (see Notifications).
- Priority on the admin quick-add (the one existing UI gap; the field and
  everything downstream already exist).

Out of scope for v2 (leave headroom, do not build):

- Public self-signup, teams/orgs, more than two roles, granular permissions.
- In-app real-time (comments refresh on poll or reload, same as the pipeline).
- Per-user notification preferences and unsubscribe flows.
- File sharing between requesters, @mentions, attachments on comments.

## Auth decision (this is the fork I need confirmed)

You chose Auth.js earlier. Since then I verified that Auth.js on Next.js 16 has a
live compatibility rough edge (peer-dependency blocking on v4, v5 beta needs
careful pinning, tracked as an open issue). Given that, here are the two honest
paths.

### Option A (recommended): extend the existing session with magic links

This repo already ships a careful, working auth core: HMAC-signed, expiring,
constant-time-compared session cookies over Web Crypto, plus a fail-closed
`proxy.ts` guard. The change is small and additive:

- Add a `users` table and an `auth_tokens` table (single-use magic-link tokens:
  random token hashed at rest, tied to an invited email, short expiry, consumed
  flag).
- Login: enter email. If the email is an invited/active user, mint a token,
  email a link via Resend. Clicking it verifies the token (unexpired, unconsumed,
  match), consumes it, and mints the existing session cookie with the user's id
  and role embedded in the signed payload.
- `proxy.ts` keeps guarding everything; it now resolves a user instead of a
  yes/no passcode.

Summary: no new auth dependency, no Next 16 compatibility risk, reuses code
that already works and is already tested. I own a simple, standard DB-token
flow, not any new cryptography.

Why recommended: it is the fastest and lowest-risk path for this specific
codebase and Next version, and it matches the "boring and replaceable"
constraint. The token pattern is textbook, not invention.

### Option B: Auth.js v5 (next-auth beta) + Drizzle adapter + Resend provider

The standard, batteries-included route: Auth.js owns sessions, CSRF, the magic
link, and the adapter tables (`users`, `accounts`, `sessions`,
`verificationTokens`). Resend is a first-class provider.

Cost: a beta dependency pinned against a Next 16 compatibility issue, a rewrite
of the existing `proxy.ts`/`auth.ts` to hand session control to the library, and
its schema conventions layered onto ours. More moving parts to get a result the
existing code already gets.

Recommendation: Option A. It is faster, has no version risk, and throws away
less working code. I will only reach for Option B if you specifically want the
library to own auth for the long term. Tell me which and I start Phase 1
accordingly.

## Data model changes

New tables:

- `users`: id (uuid pk), email (citext/unique, notNull), name (text),
  role (enum `admin` | `requester`, default `requester`),
  status (enum `invited` | `active`, default `invited`),
  createdAt, invitedBy (uuid, nullable).
- `auth_tokens` (Option A only): id, userId (fk), tokenHash (text), expiresAt,
  consumedAt (nullable), createdAt.
- `comments`: id (uuid pk), taskId (fk, cascade), authorId (fk users), body
  (text, validated length), createdAt.

Changes to `tasks`:

- `ownerId` uuid (fk users, notNull): the requester who submitted it, or me for
  my own tasks.
- `reviewState` enum (`none` | `pending` | `accepted` | `declined`, default
  `none`): requester submissions start `pending`; my own quick-add tasks are
  `none` and skip the queue. `declineReason` text (nullable).

The existing `status` (inbox/todo/in_progress/done) and the whole AI state
machine stay exactly as they are. `reviewState` is a separate gate in front of
that machine, so nothing about the pipeline changes.

Migration: add the tables and columns, backfill `ownerId` on any existing rows
to the admin user, then make it notNull. Use versioned drizzle migrations
(`db:generate` + `db:migrate`), not `db:push`, because production data exists.

## Per-user data isolation (the security core)

The current risk is that every route queries globally. The fix is structural,
not per-route vigilance:

- A `getCurrentUser()` helper resolves the session to `{ id, role }` or fails
  closed.
- A repository layer (`src/lib/db/repo/*`) is the only place that reads or writes
  tasks, attachments, and comments. Every function takes the caller as its first
  argument and scopes internally: requesters get `where ownerId = caller.id` (and
  for attachments/comments, a join back to an owned task); admin gets everything.
  Routes may not import `db` for these tables directly; they call the repo. This
  makes "forgot to scope" impossible to express, instead of merely discouraged.
- Ownership is checked on writes too (comment, upload, trigger AI): a requester
  can only act on their own task; only the admin can approve, decline, run the
  pipeline, confirm, or delete anyone's task.

Postgres row-level security is deliberately out of scope: with one app DB user
and ten accounts, the mandatory repository layer is enough. RLS is noted as
future hardening, not v2.

## Review queue and the AI gate

- Requester submits: task created `reviewState=pending`, files uploaded to Blob
  as today, but the processing route refuses to run while `reviewState != accepted`.
- Admin approves: `reviewState=accepted`; the task appears in my normal flow; I
  trigger the AI when I want. Decline: `reviewState=declined` plus an optional
  reason; the task leaves my active view and the requester is notified.
- This is the single cost control: strangers to my OpenAI bill cannot start the
  pipeline. The existing per-segment resumable pipeline is untouched.

## Comments

- `POST /api/tasks/[id]/comments` and it is included when loading a task.
- Server enforces: requester may comment only on their own task; admin on any.
- Rendered as sanitized text (never HTML), same policy as AI output.
- No realtime; the task page already polls during processing, and comments load
  on open and after posting.

## Notifications (Resend)

Fire-and-forget from server routes, wrapped in a tiny `sendEmail` helper that
no-ops with a logged warning if the key is missing (so local dev never breaks).
Events for v2:

- To me: a requester submitted a task; a requester commented.
- To the requester: task accepted; task declined (with reason); I commented;
  the AI summary is ready.

Templates: one plain on-brand layout (warm off-white, one white card, teal
button, Geist), rendered as a small function returning HTML + text. No batching,
no digest, no preferences in v2. Volume is a handful per day, far under the
100/day free cap.

## Cost check (verified live 2026-07-06)

- Resend: free 3,000/month, 100/day. Ten users and their notifications will not
  approach this.
- Auth (either option): free.
- OpenAI: unchanged and still the only real cost; now gated behind my approval,
  so exposure is bounded by what I choose to run.
- Blob: 1GB storage / 10GB transfer per month is the real thing to watch with
  ten people uploading recordings. Mitigated by the existing policy of deleting
  audio after confirmation and by client-side audio extraction. If it tightens,
  the lever is a per-user upload cap; not needed on day one.

## Security

- Sensitive data: business content in tasks/transcripts/comments, users' emails,
  the OpenAI and Resend keys, the auth secret.
- Isolation: enforced in the repository layer, server-side, fail closed. No
  client-trusted ownership.
- Auth: magic-link tokens are single-use, short-lived, hashed at rest, and
  bound to an invited email. Sessions carry role; role is re-checked on every
  privileged action, never inferred from the UI. Login attempts stay rate limited.
- Invite-only: an un-invited email gets a soft, non-enumerating response and no
  token is issued. Removing a user revokes access immediately; their tasks stay
  with me.
- Secrets: `AUTH_SECRET`, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`,
  `DATABASE_URL`, and the Resend key live in Vercel env only, never logged.
- Input validation: zod at every new boundary (invite, submit, comment). LLM and
  user text rendered as sanitized text, never HTML.
- Logging: ids, roles, statuses only. No email bodies, no comment/transcript
  content, no tokens.

## Testing

Vitest, matching the existing pattern of testing pure logic:

- Auth tokens: mint/verify, expiry honored, single-use (second use rejected),
  tampered token rejected, un-invited email issues nothing.
- Session payload: role and id round-trip, tampering rejected (extends existing
  auth tests).
- Isolation: repo functions scope correctly for requester vs admin; a requester
  cannot read or write another user's task/comment (unit tests against the repo).
- Review-state gate: pipeline refuses while not accepted; approve/decline
  transitions.
- Validation: invite/submit/comment schemas reject malformed input.
- Email: `sendEmail` no-ops without a key; correct event chooses correct template.

## Build sequence

Phase 0 (can run first, independent): provision infra and deploy the current
app. Neon + Blob via Vercel, set secrets, versioned migrate, verify the existing
single-user app live. This de-risks deployment before any rewrite.

Phase 1: auth foundation (chosen option). users table, invite-only magic link,
session carries id+role, `proxy.ts` resolves a user, seed my account as admin,
new email-link login screen. Tests. This is load-bearing; nothing else starts
until it is solid.

Phase 2: data isolation. ownerId + repository layer, retrofit every existing
task/attachment route through it, admin-sees-all. Tests. After this the app is
still single-admin in behavior but multi-tenant-safe underneath.

Phase 3: submissions + review queue. requester "Send a task" flow, reviewState,
admin approve/decline, AI gate, friendly requester statuses.

Phase 4: comments. table, API, thread UI, per-role rules.

Phase 5: email notifications. Resend helper, templates, wire the six events.

Phase 6: priority on the quick-add, then a full QA pass (golden path per role,
isolation probing, error and empty states, mobile).

Each phase ends with its own QA and tests before the next begins.

## Open questions

- Auth: Option A (recommended) or Option B? Blocks Phase 1.
- My admin account: which email is the owner/admin to seed? (Likely the
  contact address on file.)
- Sending domain for Resend: use a verified custom domain, or start on Resend's
  onboarding/sandbox domain for the first cut? Custom domain improves
  deliverability of magic links and is worth doing before real users.
- Declined tasks: do requesters keep seeing them in a "Declined" group, or do
  they disappear from their view? (Assumption: shown in a Declined group so the
  reason is visible.)
```
