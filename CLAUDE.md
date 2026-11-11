# Project: "Kosovograf" (Kosovo Through Time)

## The vision
We're building a cinematic, scroll-driven interactive history of Kosovo, from ancient
Dardania to today. It should feel like scrolling through a documentary, not reading a
website. The audience: young Kosovars, the diaspora (Germany, Switzerland, etc.), and
international visitors who know little about Kosovo. Nothing like this exists for Kosovo.
It must be beautiful, modern, fast, and above all historically accurate and trustworthy.

First, save this brief as CLAUDE.md in the project root so every future session knows
the vision, rules and roadmap. Then propose a plan and folder structure before writing code.

## The core design idea: the screen ages with the story
A WebGL shader applies a visual treatment to the images that changes by era, as if each
period were filmed on the technology of its time. Effects blend gradually while scrolling;
they never switch abruptly:

- Antiquity / Middle Ages: no photos existed, so engravings, old maps and illustrations on
  parchment texture, with a subtle candlelight flicker at the edges
- Ottoman era to 1912: faded photographs, heavy grain, dust, worn edges
- 1912-1945: old film: sepia, scratches, frame jitter, choppy ~18fps feel
- 1945-1989: black-and-white CRT TV: scanlines, curved screen edges, RGB fringing
- 1990s: VHS: tracking lines, colour bleed, date stamp in the corner (e.g. "MAR 05 1998")
- 1999 to today: effects fade out one by one until the image is clean, sharp, full colour

The shader applies ONLY to the image layer. Text always stays crisp and readable.

## Version 1 scope
1. Opening sequence: black screen with soft TV static; a "Turn on sound for the full
   experience" prompt; "CH 01" flickering in the corner; a dial click; then a large year
   counter rolling backward like an odometer (2026 to 1000 BC), accelerating, until the
   static clears into ancient Dardania and the title fades in, with a "scroll to travel
   through time" hint.
2. Persistent top timeline: a thin horizontal ruler of years that slides with scroll.
   Current year centred, large, odometer-style rolling digits. Era colour bands.
   Event dots: hover shows a preview, click jumps there.
3. Persistent UI: top left, current chapter name (e.g. "III · Nën Perandorinë Osmane").
   Top right: sound on/off, language switch (SQ/EN), effects on/off.
4. Full-screen scenes: each image covers the whole viewport, with a slow scroll-driven
   zoom. Subtitles at the bottom like film captions, revealed line by line.
5. Depth effect: each photo gets an AI-generated depth map; the shader uses it for a
   subtle 2.5D parallax as you scroll or move the mouse.
6. Source tab: every scene has a small "Burimi / Source" tab that slides up showing the
   sources for its facts and the credit and licence for its image.
7. Simple map transitions between eras: an SVG map of the Balkans where borders morph
   (1878, 1913, 1941, 1945, 1999, 2008) with Kosovo's outline glowing.
8. Ending: arriving at today, the screen switches off with the classic CRT
   "shrink to a white dot" effect, then shows a short closing screen.
9. Sound: projector click, TV hum, VHS whirr, crossfading between eras. Muted by default
   until the user opts in.

Eras for v1 (~40 scenes total):
I Antiquity (Dardania, Romans, Ulpiana) · II Middle Ages · III Ottoman era (incl. the
League of Prizren, 1878) · IV 1912-1945 (Balkan Wars, the Kaçak movement, WWII) ·
V 1945-1989 (Yugoslav era, 1968, the 1974 constitution, the University of Prishtina, 1981) ·
VI 1989-1998 (autonomy revoked, the parallel system, the 1991 referendum) ·
VII 1998-1999 (war, NATO intervention) · VIII 1999-2008 (UNMIK) ·
IX 2008-today (independence)

## Tech stack
- Astro + TypeScript (content-heavy site with interactive islands; fast loading)
- GSAP + ScrollTrigger for all scroll-driven animation; SplitText for subtitles;
  MorphSVG for map border morphs (GSAP and all its plugins are now free)
- Lenis for smooth, weighted scrolling
- One WebGL shader (OGL or Three.js) with uniforms driven by scroll position:
  grain, scanlines, chromatic aberration, jitter, vignette, saturation, sepia,
  CRT curvature, VHS tracking, depth-map parallax
- Howler.js for sound
- Content lives in data files (JSON or MDX), one per scene, with a typed schema:
  id, era, year, title, subtitle text (sq + en), image, imageCredit, imageLicense,
  isIllustration, depthMap, sources[], and a "channel" field (see roadmap)
- Albanian is the default language; English second. Structure i18n so German can be added.

## Quality requirements
- 60fps scrolling on a mid-range laptop and recent phones
- Mobile layout: the timeline collapses to a thin progress bar with the year
- prefers-reduced-motion: tone effects down, fade between scenes instead of zooming
- Optimised images (AVIF/WebP, responsive sizes, lazy loading, preloading the next scene)
- Works in Chrome, Safari, Firefox, including iOS Safari

## Content rules (very important)
- Accuracy first. Kosovo's history is contested online. Use reputable sources
  (academic works, encyclopedias, HRW, ICTY records, official archives), cross-check
  claims, and flag for me any place where sources disagree. Never invent facts,
  quotes, dates or numbers.
- Every scene lists its sources. Every image records its credit and licence.
  Use only images with a clear usage licence (e.g. Wikimedia Commons, Europeana,
  public domain). Never use copyrighted images.
- AI-generated illustrations are allowed only for eras or scenes with no photos,
  and must be visibly labelled "Ilustrim / Illustration".
- NEVER create AI-generated fake "photos" of real events, especially the war.
- Tone: factual, respectful and calm. For war scenes, no dramatic music or flashy
  effects; restraint matters more than spectacle.
- Draft content in both Albanian and English. I'll review all Albanian text myself.

## Future roadmap (don't build yet, but design the architecture so these fit later)
- TV channel knob: switch "channels" while staying in the same year:
  CH1 Politics (v1 main story), CH2 Daily life, CH3 Culture, CH4 Women.
  The scene schema needs the "channel" field from day one.
- Drenica regional chapter, "100 Years in One Scroll": one fixed camera view of the
  Drenica valley that ages over a century as you scroll (seasons, village growth,
  destruction, rebuilding), with the same kulla tower in the foreground throughout.
  Chapters from the Kaçak movement (Azem and Shote Galica) to today. The 1998 chapter
  drops all effects and sound: a silent dark map where villages light up one by one,
  sourced only from published records. Later, other regions follow the same pattern.
- Interactive scene hotspots (click a person or building to learn about it)
- Then-and-now: press and hold to see the same place today
- End-of-era mini quizzes
- "Pasaporta e fshatit": enter your village, see every state, name, school language
  and currency it had through history
- "Viti": a daily guess-the-year game with shareable results
- German language

## How to work
- Start with the plan and folder structure; wait for my approval.
- Milestone 1: the engine. Opening sequence, the era shader with all treatments,
  timeline, subtitles, scene system, with two eras of real content (I and IV)
  to prove the effect. Then stop so I can review it in the browser.
- Milestone 2: all v1 eras and scenes, map transitions, sound, ending.
- Milestone 3: mobile, performance, accessibility, deploy.
- Use a task list, commit after each working step, and ask me before making any
  decision about sensitive historical content.

---

# Conventions and decisions (added during the build; the brief above is unchanged)

## Repository and deploy
- GitHub: https://github.com/OrGes04/kosovagraf.git, branch `main`. Every commit is pushed.
- Cloudflare deploys automatically on every push to `main` (Git integration, connected in
  the Cloudflare dashboard). Build command `npm run build`, output `dist`.
- Pages carry `noindex` until the owner says the site is ready to launch.

## Architecture (approved plan, 2026-11-11)
- One page, one fixed stage, one scroll track. Lenis + a single GSAP ScrollTrigger produce
  one master progress value; everything derives from it.
- WebGL canvas (OGL) renders images only. All text is DOM above the canvas.
- Era treatments are weight presets in `src/engine/shader/presets.ts`, interpolated along
  the scroll track. "Effects off" and reduced motion are multipliers on the same weights.
- Scenes are JSON files in `src/content/scenes/<era>/`, validated by a Zod schema. Fields
  `channel` and `story` exist from day one for the channel knob and regional chapters.
- Text fields are `{ sq, en }`. Albanian at `/`, English at `/en/`.
- Offline scripts in `scripts/`: image optimisation, depth maps, content validator.
- Licence allow-list for images: public domain, CC0, CC BY, CC BY-SA. No NC or ND.

## Content workflow
- Before drafting an era, send the owner a sourcing note: proposed scenes, sources per
  fact, and every point where sources disagree. The owner decides, then SQ and EN drafts
  follow. The owner reviews all Albanian text.
- AI illustrations are proposed per scene for a yes/no, only where no photo could exist.
