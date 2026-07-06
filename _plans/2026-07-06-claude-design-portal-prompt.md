# Claude Design update prompt: shared workspace (accounts, submissions, comments)

Paste everything below the line into the existing "My Tasks" design in Claude
Design to update it. It assumes the current design already exists: warm
off-white background (#faf9f7), white cards with a soft 1px warm-gray border
(#e7e5e4), a single deep-teal accent (#0f766e light, #2dd4bf dark), Geist type,
rounded-2xl cards, the quick-add input, the List and Board layouts, the task
detail screen, and Settings.

---

Update My Tasks. Keep the exact visual language you already have (warm off-white
background, white cards with a soft 1px warm-gray border, single deep-teal
accent, Geist type, generous whitespace, small colored priority dots, the
amber/red/teal/green status colors, and no AI-generic gradients, glassmorphism,
or sparkle icons). The change is a shift in what the app is: it was a private
tool for one person, and now it becomes a small shared workspace where about ten
people I invite can send tasks to me and follow them, while I see and run
everything.

Keep it plain. These are ten people I already know, not the public, so their
side needs no marketing, no onboarding tour, no sign-up funnel. Every screen
should still make sense in the first second.

## Two roles, one app

- Requester: someone I invited. Signs in, sees only their own tasks, sends me
  new ones, watches progress, and talks to me in comments.
- Admin (me): sees every task from everyone, approves or declines what comes in,
  runs the AI, comments back, and invites people.

The role is decided by the account, so the same login leads to two slightly
different homes.

## Login (replaces the passcode screen)

A single centered card, same calm feel as before. One email field and one
button, "Email me a link." No password anywhere. After they submit, the card
swaps to a quiet confirmation: "Check your email for a link to sign in," with a
plain "Use a different email" link back. If someone who was never invited tries,
show a soft, non-technical line: "This email isn't on the list. Ask the owner
for an invite." Nothing scary, and nothing that reveals whether an address
already exists.

## Requester home

Their own tasks only, as a calm single column reusing the existing card and the
List grouping (no Board for them, they do not need a kanban). At the top, one
clear primary button, "Send a new task." The status groups are worded for
someone waiting on me, not managing a pipeline: Submitted, Accepted, In
progress, Done. A task still waiting for me to look at it shows an "Under review"
pill in muted amber.

Empty state: one friendly line, "Nothing here yet. Send your first task," with
the same button under it.

## Send a task (requester)

A focused form on its own screen or a large modal, not a tiny input. Fields: a
title ("What do you need?"), a details box, a small priority selector shown as
the three colored dots with labels (Low, Medium, High, with Medium preselected),
and the existing dashed dropzone for files ("Add screenshots, documents, or a
recording"). One primary button, "Send." On submit, land back on their home with
the new task at the top marked Under review, and a quiet toast, "Sent. The owner
has been notified."

## Task detail (shared, adapts by role)

Reuse the current task detail layout (title, status, files, AI summary) and add
a comment thread under it. What differs by role:

- Requester sees the status, their own files, the TLDR and description once I
  have run and shared them, and the comments. Hide the raw pipeline mechanics
  from them: no segment-by-segment transcription rows, no Confirm or Regenerate.
  Replace all of that with a single honest status line like "Working on it" or
  "Waiting for review."
- Admin sees everything that exists today (the full file rows with live
  per-part progress, Confirm, Regenerate), plus who submitted the task and when,
  plus Approve and Decline while it is still under review, plus the same
  comments.

## Comments (shared component)

A simple vertical thread at the bottom of the task detail. Each entry is a small
row: the person's name, a light timestamp, and the message in relaxed line
height. My messages and theirs are gently distinguished, for example a faint
teal left border on mine, never chat bubbles and never an AI-generic look. One
text box and a "Comment" button underneath. Empty state: a quiet "No comments
yet." This is where the requester and I talk about a task, so it should read like
a calm note thread, not a chat app.

## Admin additions

- Review queue: a distinct section at the top of my home, above my normal task
  groups, headed "Needs review" with a count. Each pending task is a card
  showing the submitter's name, the title, the priority dot, the file count, and
  the time, with two quiet actions, Approve and Decline. Approving drops the task
  into my normal flow. Declining asks for an optional one-line reason that goes
  to the requester. When the queue is empty it collapses to nothing so my screen
  stays calm.
- Attribution: every task card in my views now carries a small "from [name]"
  label so I always know whose task it is.
- Invite people: a minimal screen reachable from Settings. A single email field
  and an "Invite" button, and below it the list of people with their email,
  status (Invited or Active), and a quiet "Remove" on each. No roles to
  configure, no bulk tools. Removing someone should note plainly that their
  tasks stay with me.

## Priority on the quick-add (my side)

My existing quick-add input gains a small priority selector to its right, the
same three colored dots with labels, Medium preselected, so I can set priority
as I type instead of opening the task afterward.

## Notification emails

Design a plain, on-brand transactional email that matches the app: warm
off-white body, one white card, the teal accent only on the single button,
Geist, no images beyond a small wordmark. One template with a heading, a line of
context, and one button. Show the variants as copy only: "sign in to My Tasks"
(the magic link), "[name] sent you a new task," "your task was accepted,"
"your task was declined," "the owner commented on your task," and "your summary
is ready." Keep them short and human.

## States to show

- Login: the email-sent confirmation, and the "not invited" soft refusal.
- A requester task under review, and one being worked on ("Working on it").
- The admin review queue with two or three pending cards, and the empty
  (collapsed) queue.
- A comment thread with a few messages, and the empty thread.
- Declining a task: the small optional-reason prompt.

## Platforms

Everything works from a 360px phone to desktop, since people will send tasks
from their phones. The send-a-task form and the comment thread must be
comfortable one-handed on mobile. Touch targets stay at least 44px. Keep WCAG AA
contrast in both light and dark themes, and keep the whole thing keyboard
navigable.
