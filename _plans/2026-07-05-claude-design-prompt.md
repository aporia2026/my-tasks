# Claude Design prompt: My Tasks dashboard

Paste everything below the line into Claude Design.

---

Design a personal task dashboard called "My Tasks" for exactly one user: a busy
professional who gets tasks thrown at him all day and wants to stop holding
them in his head. The core magic: he drops a recorded meeting, a screenshot,
or a PDF onto a task, and the app transcribes it, reads it, and writes back a
description of what the task involves plus a TLDR of exactly what he has to
do. Design for a lazy user: every screen must make sense in the first second,
with zero instructions.

## Product feel

Calm, focused, paper-like. This is a tool someone opens twenty times a day,
so it should feel like a well-organized desk, not a startup landing page.
Explicitly avoid the generic AI look: no purple-blue gradients, no
glassmorphism, no glowing orbs, no sparkle icons on every AI feature. The AI
is the plumbing, not the show. What gets celebrated visually is the OUTPUT:
the TLDR card is the hero element of the whole app.

## Visual direction

- Background: warm off-white (#faf9f7), cards in pure white with a 1px warm
  gray border (#e7e5e4) and very soft shadow. Dark mode: warm near-black
  (#131110) with #1c1917 surfaces.
- Single accent color: deep teal (#0f766e light mode, #2dd4bf dark mode).
  Used sparingly: primary buttons, the TLDR card frame, success states.
- Typography: Geist Sans. Tight, confident headings; relaxed 1.6 line height
  for AI-generated text since people actually read it. No decorative fonts.
- Generous whitespace, 16-24px paddings, rounded-2xl cards. Restrained
  motion: subtle fades and one pulsing dot for "working" states, nothing
  bouncy.
- Status colors: amber for "working", red for "failed", teal for "ready",
  green for "confirmed". Priority shown as a small colored dot, not a loud
  badge.

## Screens

1. Login: a single centered card. App name, one passcode field, one Unlock
   button. Nothing else exists.

2. Dashboard (home): max width ~900px. At the top, one big quick-add input
   with the placeholder "What landed on your plate?" and an Add button. Below
   it a toolbar: a search box on the left, and on the right two small
   segmented toggles, one for layout (List / Board) and one for density
   (Roomy / Compact). The chosen layout and density are remembered.

   The dashboard has two layouts the user switches between:

   - List: tasks grouped under collapsible status headers (Inbox, To do, In
     progress, Done) each showing a count. Done starts collapsed. This is the
     comfortable default and it stays readable at a hundred-plus tasks because
     most of them live in collapsed groups. Searching auto-expands the groups.

   - Board: four columns (Inbox, To do, In progress, Done), each showing its
     count, with cards you drag between columns to change status. The board
     scrolls horizontally. Dragging must feel smooth with a subtle lift and a
     soft highlight on the column you are hovering; a quick tap opens the task
     instead of dragging.

   A task card (used by both layouts): title with a small priority dot, and in
   Roomy density a 2-line TLDR preview (or "No summary yet." in italics) plus
   file count, with an AI status badge on the right. Compact density collapses
   the card to a single line. Empty state: a friendly two-liner telling him to
   add a task and drop a recording on it. When a search matches nothing, a
   quiet "No tasks match ..." line.

3. Task detail: back link, title, status and priority dropdowns, Delete
   tucked away as quiet text. Then a Files section: a large dashed dropzone
   saying "Drop a meeting recording, screenshot, or document here" with a
   one-line explanation of what happens to each type. Under it, uploaded
   files as compact rows with name, type, size, and a live status on the
   right ("Extracting audio 43%", "Uploading 2 of 12", "Transcribing part 3
   of 12", "Transcribed", or a red error with a Retry button). Then the AI
   summary section: the TLDR card first (accent border, label "WHAT YOU NEED
   TO DO"), then the full description card ("FULL PICTURE"). When the summary
   is ready, two actions: a primary "Looks right, confirm" and a secondary
   "Regenerate", with a small caption explaining that confirming cleans up
   the audio files and keeps the transcript.

4. Settings: one narrow column, three groups (AI, Files, Appearance), each a
   card of rows: label + one-line plain-language hint on the left, a select
   or toggle on the right. "Changes save automatically" with a quiet "Saved."
   confirmation. No Save button.

## States to design explicitly

- The waiting experience is the product: a 90-minute recording takes minutes
  to process. Show honest, specific progress at every step, and a note that
  he can leave the page and come back.
- Failure: a clear red row saying exactly which part failed and a Retry
  button right there. Never a dead spinner.
- Empty states for: no tasks, a filter with no tasks, a task with no files,
  a task with files but no summary yet.

## Layout and platforms

Responsive single-column design that works from 360px phones to desktop. On
mobile the dropzone becomes a tap-to-pick button. Touch targets 44px+. WCAG
AA contrast in both themes. The whole app is keyboard navigable.
