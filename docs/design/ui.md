# Interface design

Agreed with the owner on 2026-11-12, after several rounds of sketches. This replaces
v1 scope item 2 of the brief (the persistent top ruler) and the first build's top bar.
Build to this document; change it only with the owner's agreement.

## Principles

1. **Phone first, held upright.** Most visitors arrive from a link shared on social media.
   Desktop is the adaptation.
2. **Design for reading, not for jumping.** While someone reads, almost nothing sits on the
   picture. Bigger controls appear only while moving.
3. **Time is felt in transitions,** not in a permanent widget: the year takes over the
   screen at each chapter change.
4. **Trust is visible.** Sources are always one tap away. (Later: tappable names and
   per-sentence source marks, once real content exists.)
5. **Calm.** Nothing decorative, nothing that competes with archive photographs.
   War chapters get no extra flourish.

## Visual language

| Token | Value | Use |
|---|---|---|
| Accent | ivory `#EDE6D6` | Current position, active states, links. The interface is essentially monochrome so it sits well on every era's treatment. No orange, no flag colours. |
| Text | `#F2EFE8`, dim `rgba(242,239,232,.6)` | |
| Surface | `rgba(12,12,12,.74)` pills, `#121212` panels | Solid dark, small blur only on small elements. No glassmorphism on large areas (cost of blurring a moving WebGL picture). |
| Serif | Instrument Serif | Captions, titles, the big chapter year. The documentary voice. |
| Sans | Geist | Interface labels. |
| Mono | Geist Mono | Years, numerals, chapter numbers. |
| VHS | VT323 | Only the diegetic camcorder date stamp. |

Shapes: pills and fully rounded controls; panels with 16–20px corners. No square boxes,
no hairline frames around text.

## Components

**Control pill** (top right): one dark rounded pill holding overview, sound, effects and an
SQ/EN segmented switch. Icon buttons with a background, active state in ivory.
On devices with a mouse it fades out about 2.5 s after the mouse stops, and comes back on
any movement.

**Caption block** (bottom left, a column about 26rem wide; full width minus the rail on phones):
- the caption in the serif, revealed line by line;
- a meta line: chapter numeral (ivory, mono), year (mono), chapter name (dim sans), and a
  "Burimi / Source" button;
- the **mini timeline**: one tick per scene, a gap between chapters, a taller tick where each
  chapter starts, past scenes brighter, the current scene a tall ivory tick. Spaced by scene,
  never by year.

**Time scrubber** (right edge): a thin vertical track with a notch at each chapter start and
small marks per scene, and an ivory handle.
- Hidden at rest. Appears while scrolling, when the mouse nears the right edge, or on focus,
  and fades about a second after.
- Drag the handle (or click/tap the track) to scrub. A bubble beside the handle shows the
  scene's thumbnail, year and chapter. The handle widens while held.
- On release it settles on the nearest scene. Phones get a tiny vibration per scene while
  dragging, where the browser allows it.
- Vertical on purpose: it moves in the same direction as scrolling.

**Chapter change**: when the visible scene enters a new chapter, the screen dims slightly and
the year appears very large in the serif with the chapter numeral and name, then fades.
Reduced motion: a plain fade, no rolling.

**Overview** (grid button, or the O key): a full-screen sheet with one row per chapter
(numeral, name, years) and the scene thumbnails in order; the current scene outlined in ivory;
title on hover/focus; click to go there. Esc or the close button returns.

**Source panel**: a side panel on the right on desktop, a bottom sheet on phones. Sources as
numbered rows, then the image credit and licence. The picture stays visible beside it.

**Keyboard**: ← / → previous and next scene, O overview, Esc closes anything open.
Small hints bottom right on desktop, hidden with the control pill.

**Kept from the first build**: the opening sequence (restyled to this palette and type), the
illustration badge (as a small pill), the VHS date stamp, the era shader, the plain-image
fallback and the no-JavaScript article.

## Not yet built (needs real content first)

- Tappable names and places opening a card; per-sentence source marks.
- A real phone test with archive photographs; the test cards hide layout problems.
