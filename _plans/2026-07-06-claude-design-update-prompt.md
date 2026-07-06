# Claude Design update prompt: two layouts

Paste everything below the line into the existing "My Tasks" design in Claude
Design to update it. It assumes the current design already exists (warm
off-white background, white cards, single teal accent, Geist typography, the
quick-add input and task cards).

---

Update the My Tasks dashboard. Keep the exact visual language you already have
(warm off-white background, white cards with a soft 1px warm-gray border,
single deep-teal accent, Geist type, generous whitespace, no AI-generic
gradients or glassmorphism). The change is structural: a flat list of cards
does not scale past about fifteen tasks, so the dashboard now has two layouts
the user switches between, and the switch is remembered.

## New toolbar (sits directly under the quick-add input)

A thin toolbar with a search box on the left and two small segmented toggles on
the right. The first toggle is layout: List or Board. The second is density:
Roomy or Compact. Keep these visually quiet, not competing with the quick-add
input or the task cards. The active segment is filled with the dark foreground
color, inactive segments are muted text. The toolbar only appears once at least
one task exists.

## Layout 1: List (the default)

Tasks are grouped under collapsible status headers, in this order: Inbox, To
do, In progress, Done. Each header is a small uppercase muted label with a
count beside it and a chevron that rotates when open. Done starts collapsed.
The point is that a person with a hundred tasks still sees a short, calm screen
because most tasks live inside collapsed groups. When the user types in search,
every group expands so no match is hidden.

## Layout 2: Board

A horizontal kanban. Four columns, one per status (Inbox, To do, In progress,
Done), each with its title and a count. Cards sit stacked in their column and
the user drags a card from one column to another to change its status. The
whole board scrolls sideways when it runs out of width. Design the drag feel
with care: the picked-up card lifts slightly with a soft shadow and a small
tilt, and the column under the cursor gets a gentle teal-tinted highlight so
the drop target is obvious. A quick tap or click on a card opens the task; only
a deliberate drag moves it. Empty columns show a quiet dashed "Nothing here"
placeholder so the board never looks broken.

## The task card (shared by both layouts)

Same card in both views, driven by the density toggle:
- Roomy: title with a small colored priority dot on the left, a two-line TLDR
  preview in muted text underneath (or "No summary yet." in italics when there
  is none), the file count at the bottom, and the AI status badge on the right.
- Compact: a single line, just the priority dot, title, and AI status badge.
  No preview, no file count. This is what lets a long list stay scannable.

## States to show

- Searching with no results: a quiet centered "No tasks match ..." line, not an
  empty scary void.
- No tasks at all: the existing friendly two-line empty state.
- The board mid-drag: show the lifted card and the highlighted target column.

## Settings addition

In the Settings screen, under Appearance, add two rows that mirror the toolbar
toggles: "Default layout" (List or Board) and "Task density" (Roomy or
Compact), each with a one-line plain-language hint. These are the same
preference as the toolbar; changing either place changes both.

## Platforms

Both layouts must work from a 360px phone up to desktop. On a phone the board
becomes a set of columns you swipe through horizontally, and a quick swipe
scrolls a column while a press-and-hold picks up a card. Touch targets stay at
least 44px. Keep WCAG AA contrast in light and dark themes.
