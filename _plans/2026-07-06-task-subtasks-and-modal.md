# Sub-tasks (AI + manual) and a task workspace modal

Date: 2026-07-06
Status: Implemented. Typecheck, lint, production build, and the 75-test suite
all pass. Requires the Drizzle migration (0005) to be applied before use.

## Goal

Give each task a checklist of sub-tasks that the admin can work through:
mark items done, mark the one item they are currently on, add items by hand,
and have the AI propose the checklist automatically. Opening a task should feel
instant: a big modal over the board rather than a full-page navigation.

## Decisions locked with the user

1. **AI todos: auto + editable.** The AI fills the checklist as part of the
   existing "Generate with AI" summary step. Items are fully editable (add,
   rename, delete, check, set-current) and can be regenerated on demand.
2. **Visibility: requesters see progress (read-only).** The admin owns and edits
   the checklist. A requester viewing their own task sees the items and their
   done/current state, but cannot change them.
3. **Modal + keep the deep link.** Clicking a card opens a modal over the board.
   The `/tasks/[id]` page stays as a shareable link. Both render one shared
   `TaskWorkspace` component so they never drift apart.

## Data model

New enum and table (Drizzle, `src/lib/db/schema.ts`):

```
todo_status: "pending" | "doing" | "done"

todos
  id         uuid pk
  task_id    uuid not null -> tasks.id (on delete cascade)
  title      text not null
  status     todo_status not null default "pending"
  position   integer not null default 0     // stable ordering within a task
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

Why a three-state enum instead of a `done` boolean plus a separate "current"
flag: it captures both asks in one field. `done` = completed, `doing` = the one
you are currently on, `pending` = not started. The "only one current per task"
rule is enforced in the repo (setting a todo to `doing` clears any sibling that
was `doing`), so there is no circular foreign key between tasks and todos.

`tasks` relation gains `todos: many(todos)`. No column added to `tasks`.

## AI change (one call, not two)

`generateSummary` in `src/lib/ai.ts` today returns `{ description, tldr }` from a
single Responses API call. Extend it to `{ description, tldr, todos: string[] }`:

- Prompt gains a third instruction: return `todos` as a JSON array of 3-8 short,
  concrete, imperative sub-tasks.
- `parseSummaryResponse` also reads `todos`, defaulting to `[]` if the model
  omits or malforms it (summary must still succeed without a checklist).
- The pipeline (`process` route) persists `summary.todos` **only when the task
  has no todos yet**, so re-running the summary never clobbers an edited list.
- The stateless draft endpoint (`/api/ai/draft`) returns `todos` too, which the
  manual "New task" form uses to prefill its checklist before the task exists.

"Regenerate checklist" (explicit button) reruns generation and replaces only the
**not-done** items, keeping anything already checked off. It asks for confirm
first because it discards unchecked edits.

## API

- `POST /api/tasks/[id]/todos` — add one item `{ title }`. Admin only.
- `POST /api/tasks/[id]/todos/generate` — regenerate from task content. Admin
  only, and only on tasks the admin may process (same cost gate as the pipeline).
- `POST /api/tasks/[id]/todos/reorder` — `{ ids: string[] }`, the full ordered
  list of the task's todo ids. Server reassigns `position` 0..n atomically and
  rejects any id that is not one of the task's todos. Admin only.
- `PATCH /api/todos/[id]` — `{ title?, status? }`. Setting `status:"doing"` clears
  the sibling that was `doing`. Admin only.
- `DELETE /api/todos/[id]` — remove. Admin only.

Ownership: `/api/todos/[id]` looks up the parent task and runs the existing
`getAccessibleTask` gate, returning 404 (never 403) so ids cannot be probed.
Requesters get todos read-only via the task detail payload; every write route
checks `session.role === "admin"` and returns 403 otherwise.

Task detail (`GET /api/tasks/[id]`) and the list (`GET /api/tasks`) start
including `todos` (ordered by `position`) so the modal and the board card can
render them.

## Manual "New task" form

Add a "Sub-tasks" section under the summary:

- A list of editable rows with add / delete.
- "Generate with AI" already drafts the TLDR + description; it now also fills the
  checklist from the same response (no extra call).
- On create, the todos travel with the task. `taskCreateSchema` gains an optional
  `todos: string[]` (bounded), and `createTaskForCaller` inserts them (admin only)
  in order after the task row.

## Modal / workspace refactor

- Extract the current `/tasks/[id]` page body into `TaskWorkspace`
  (`src/components/task-workspace.tsx`), taking `taskId`, optional `initialTask`
  (for instant paint from the already-loaded board list), and optional `onClose`
  / `onChanged`. It keeps every existing behavior: load, poll during processing,
  editable fields, the processing loop, files, summary, comments, review,
  delete, plus the new checklist. It renders the admin or requester variant from
  `useUser`, exactly as today.
- `/tasks/[id]/page.tsx` becomes a thin wrapper: `<TaskWorkspace taskId={id} />`
  with a back link. Deep links keep working.
- New `TaskModal` (`src/components/task-modal.tsx`): fixed overlay, backdrop,
  centered panel (`max-w-3xl`, `max-h-[90vh]`, scrolls inside), a close button,
  Escape to close, backdrop click to close, focus moved in and restored on close,
  body scroll locked, a short fade/scale transition. Full-screen sheet on mobile.
  It renders `<TaskWorkspace ... onClose onChanged />`.
- `TaskBoardView` and `TaskListView` take `onOpenTask(id)` instead of navigating.
  `AdminDashboard` owns `openTaskId`, renders `<TaskModal>` when set, and reloads
  its task list on `onChanged` so the board reflects edits made in the modal.
- Instant open: the board passes the task it already has as `initialTask`, so the
  modal paints immediately and swaps in full detail (comments, segments, todos)
  when the fetch lands.

The requester dashboard keeps its existing page-link navigation for now (out of
scope for this ask); it still benefits from the shared `TaskWorkspace`.

## Board card

`TaskCard` shows a small progress line when a task has sub-tasks: `2/5 done`, and
the current item's title when one is set. Comes free from the todos now included
in the list payload.

## Files

New: `repo/todos.ts`, `api/tasks/[id]/todos/route.ts`,
`api/tasks/[id]/todos/generate/route.ts`, `api/todos/[id]/route.ts`,
`components/task-workspace.tsx`, `components/task-modal.tsx`,
`components/todo-checklist.tsx`, one generated Drizzle migration.

Modified: `schema.ts`, `types.ts`, `validation.ts`, `ai.ts`, `repo/tasks.ts`,
`api/tasks/[id]/process/route.ts`, `api/ai/draft/route.ts`,
`tasks/[id]/page.tsx`, `manual-task-form.tsx`, `admin-dashboard.tsx`,
`task-board-view.tsx`, `task-list-view.tsx`, `task-card.tsx`.

## Security (rule 13)

- Every todo write route is admin-only and passes through the same ownership gate
  as tasks; 404 masks existence, 403 masks capability.
- Requester access to todos is strictly read, and only for tasks they own.
- The AI regenerate route reuses the `canProcess` cost gate, so a requester can
  never spend the OpenAI budget through it.
- All inputs validated with Zod at the boundary: title length, array size, status
  enum. Nothing from the client is trusted.
- `position` is server-assigned; clients cannot inject arbitrary ordering values
  that break rendering.

## Cost (rule 8)

- Auto-generating todos adds a few short strings to the **existing** summary call.
  Same provider (OpenAI), same model already configured in Settings, no new API
  call, no new subscription. Marginal output-token cost only.
- "Regenerate checklist" is a new call, but only when the admin clicks it, and
  gated to admin. No new paid service is introduced.

## Lazy-user walkthrough (rule 10)

- Create a task, hit "Generate with AI": TLDR, description, and a ready-made
  checklist all appear. Nothing else to learn.
- Open a task from the board: a modal pops instantly, the checklist is right
  there. Check items off; click one to mark it "current" and it highlights.
- Board card shows `2/5 done` so progress is visible without opening anything.
- Escape or click-away closes the modal; the board updates in place.

## Alternatives rejected

- **Intercepting routes for the modal** (Next parallel/intercepting routes). More
  "correct" URL behavior, but heavier and riskier on this modified Next 16, and
  the deep-link page already covers shareable URLs. Rejected for a pure client
  modal.
- **`done` boolean + `currentTodoId` on tasks.** Needs a circular FK or extra
  invariant juggling; the three-state enum is simpler and mirrors the app's
  existing enum style.
- **Separate second AI call for todos.** Doubles latency and cost for no gain; a
  single call already has all the context.

## Resolved with the user

- "Currently on" is **per task**: each task has its own current item.
- **Drag-to-reorder is in v1.** The checklist is a sortable list using
  `@dnd-kit/sortable` (10.0.0, peers `@dnd-kit/core ^6.3.0`; we have 6.3.1), the
  same ecosystem the board already uses. Keyboard-accessible via the existing
  sensor pattern. Dropping persists the new order through the reorder endpoint;
  the list updates optimistically and rolls back on failure.

## Apply / migration note

I generate the Drizzle migration; you apply it to Neon with `npm run db:migrate`
(or `npm run db:push`). I cannot run it against your database.
