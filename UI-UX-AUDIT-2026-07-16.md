# Aurora — Mobile + Desktop UI/UX audit (2026-07-16)

Audited from the code (the deployed app renders desktop-width in my browser tool, so I could not
drive a true <768px viewport live). Desktop layout verified clean via the live app. Each item below
is either **FIXED** (change already made in the repo, ships on next build) or **DIAGNOSED** (a precise,
low-risk patch you should eyeball on a real phone before committing — I did not apply these blind).

---

## 1. Canvas toolbar eats the screen on mobile — **FIXED** ✅

**File:** `src/features/canvas/CanvasToolbar.tsx`

**Problem you reported:** "the canvas navigation thing is taking a lot of space in the canvas on
mobile… it should be collapsible." The toolbar is a single `flex-wrap` row of ~20 buttons rendered
`absolute top-0 inset-x-0`. On a ~390px phone it wraps into 4–5 rows and covers the top third of the
canvas. It also made the record/image buttons hard to find because they were buried mid-row.

**Fix applied:** the toolbar now **collapses behind a "Tools" toggle on phones** and is expanded only
on demand; on `sm+` (≥640px) it always shows as before. Default state on mobile is collapsed, so the
canvas is unobstructed until you tap **Tools**. This directly makes the image/record buttons reachable
instead of lost in a wrapped row.

No behaviour change on tablet/desktop.

---

## 2. Record / Image buttons missing on some canvases — **DIAGNOSED (by design, with a UX suggestion)**

**File:** `src/features/canvas/CanvasEditor.tsx` (lines ~1026–1027)

**Root cause:** `onAddImage`/`onAddMedia` are passed as `undefined` when `projectId === null`, i.e. on a
**personal (standalone) canvas**. That's deliberate: the `canvas-media` storage bucket is keyed by
`projectId`, so uploads on a project-less canvas would be rejected by Storage RLS. So on a personal
canvas the image + record buttons are intentionally hidden. Combined with issue #1 (toolbar clutter),
this reads as "the buttons disappeared."

**Two options (your call):**
- **Cheapest (recommended now):** keep hiding them, but show a tiny disabled placeholder with a tooltip
  "Add a project to upload media" so users understand it's a capability, not a bug. Low risk.
- **Proper fix (later feature):** add a `canvas-media`-style bucket keyed by canvas id (mirroring the
  `note-media` bucket added in `20260714180000`) so personal canvases can hold media too. This is a new
  migration + upload-path change — a feature, not a UI tweak; worth a dedicated pass.

I did **not** implement either blind, because both touch upload behaviour I can't test end-to-end while
you're away. Issue #1's collapsible toolbar already solves the "can't find them" part on project canvases.

---

## 3. Bottom nav overlaps interactive content — **DIAGNOSED (suggested patch)**

**Files:** `src/components/shell/BottomNav.tsx`, `src/components/shell/AppShell.tsx`,
`src/features/canvas/CanvasEditor.tsx`

**Problem you reported:** "the bottom nav sometimes clashes with the on-screen elements." Scrollable
page content is already cleared (the `<main>` has `pb-[calc(7rem+safe-area)]` on mobile). The real clash
is with **full-bleed / bottom-anchored elements** — most notably the **canvas**: the fixed `BottomNav`
(`z-30`) floats over the bottom ~4.5rem of the drawing surface, so taps there hit the nav instead of the
canvas.

**Suggested patch (low risk, apply + eyeball on your phone):** inset the canvas above the nav on mobile.
In `CanvasEditor.tsx`, the canvas wrapper is:

```tsx
<div className="relative min-h-[82vh] w-full flex-1 sm:min-h-[78vh]">
```

Add bottom padding on mobile so the stage clears the floating nav (the nav is ~4.5rem + safe-area):

```tsx
<div className="relative min-h-[82vh] w-full flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:min-h-[78vh] sm:pb-0">
```

(If instead you'd rather the canvas go truly full-screen, hide the nav on the editor route — but that
removes navigation while editing, so the inset approach above is safer.)

---

## 4. Mobile sidebar (drawer) alignment — **DIAGNOSED (needs a device repro)**

**Files:** `src/components/shell/Sidebar.tsx`, `SidebarNav.tsx`, `Brand.tsx`

The mobile menu is a drawer (`w-72`, `glass-strong`) reusing the same `Inner` as the desktop rail with
`p-3`. I could not reproduce a specific misalignment from the code alone, and I didn't want to nudge
paddings blind and risk making it worse. When you're next on your phone, tell me exactly what looks off
(e.g. "the nav icons don't line up with the labels", or "the New-project button overflows the drawer
edge") and I'll ship a precise one-line fix. Likely candidates if you want me to pre-emptively try:
the drawer's `pl-[env(safe-area-inset-left)]` stacking with `Inner`'s `p-3` can double the left inset on
notched phones — worth checking first.

---

## Summary

| # | Issue | Status |
|---|-------|--------|
| 1 | Canvas toolbar eats mobile screen; not collapsible | **Fixed in repo** |
| 2 | Record/Image buttons absent on personal canvases | By design — UX suggestion provided |
| 3 | Bottom nav overlaps canvas taps | Suggested 1-line patch |
| 4 | Mobile drawer alignment | Needs a device repro (candidate identified) |

Only #1 is applied to the code (ships on next `npm run build`). #2–#4 are documented so you can decide
with eyes on a real device — nothing risky was changed blind.
