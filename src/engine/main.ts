/**
 * The engine's entry point. Reads the story data embedded in the page, sets
 * up scrolling, the renderer and the on-screen interface, then runs one loop:
 * scroll position in, everything else out. Interface spec: docs/design/ui.md.
 */
import gsap from 'gsap';
import { localePath } from '../i18n';
import type { Locale } from '../lib/constants';
import type { Debug } from './debug';
import { createCaptions } from './hud/captions';
import { createChapterCard } from './hud/chapter';
import { createMiniTimeline } from './hud/mini';
import { createOpening, type Overlay } from './hud/opening';
import { createOverview } from './hud/overview';
import { createScrubber } from './hud/scrubber';
import { createSourcePanel } from './hud/source';
import { applyI18n, formatStamp, formatYear } from './hud/text';
import { FallbackRenderer } from './renderer/fallback';
import { GLRenderer, webglAvailable } from './renderer/gl';
import type { Frame, SceneRenderer } from './renderer/types';
import { createScroll } from './scroll';
import { buildItems, captionAt, crossfade, smoothstep, treatmentMix, type Position } from './sequence';
import { PRESETS, applyPreferences, lerpWeights, zeroWeights } from './shader/presets';
import { createStore } from './store';
import type { StoryData } from './types';

const BASE_ZOOM = 1.03;
const ZOOM_TRAVEL = 0.1;
const PARALLAX = 0.02;
const IDLE_AFTER = 2500;
/** Where a jump lands inside a scene: just after its start, so the first caption shows. */
const LAND = 0.08;

function $<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing element: ${selector}`);
  return node;
}

function boot() {
  const data = JSON.parse($('#story-data').textContent!) as StoryData;
  const { scenes, eras } = data;
  const eraById = new Map(eras.map((e) => [e.id, e]));
  const items = buildItems(scenes);
  const store = createStore(data.locale);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const params = new URLSearchParams(location.search);
  const strings = () => data.ui[store.get('lang')];
  const lang = () => store.get('lang');

  const stage = $('#stage');
  const track = $('#track');
  const sections = Array.from(track.querySelectorAll<HTMLElement>('[data-item]'));
  const scroll = createScroll(track, sections, { smooth: !reducedMotion });

  // --- Renderer -------------------------------------------------------------
  let renderer: SceneRenderer;
  if (webglAvailable()) {
    try {
      renderer = new GLRenderer($<HTMLCanvasElement>('#gl'));
    } catch {
      renderer = new FallbackRenderer($('#fallback'));
    }
  } else {
    renderer = new FallbackRenderer($('#fallback'));
  }
  stage.dataset.renderer = renderer.kind;

  // --- Interface --------------------------------------------------------------
  const overlay: Overlay = { staticAmount: 0, black: 0 };
  const captions = createCaptions($('#captions'), { reducedMotion });
  const mini = createMiniTimeline($('#mini'), scenes);
  const chapterCard = createChapterCard($('#chapter-card'), { reducedMotion });
  const scrubber = createScrubber($('#scrub'), { scroll, items, scenes, eras, ui: strings, lang, land: LAND });
  const sourcePanel = createSourcePanel($('#source'), $<HTMLButtonElement>('#btn-source'), wake);
  const overview = createOverview($('#overview'), {
    scroll,
    items,
    scenes,
    eras,
    ui: strings,
    lang,
    onPick: (index) => jumpToItem(index),
    onToggle: (open) => {
      scrubber.setEnabled(!open);
      wake();
    },
  });

  const title = $('#title');
  const captionBlock = $('#caption-block');
  const metaRoman = $('#meta-roman');
  const metaYear = $('#meta-year');
  const metaName = $('#meta-name');
  const stamp = $('#stamp');
  const badge = $('#badge');
  const soundButton = $<HTMLButtonElement>('#btn-sound');
  const effectsButton = $<HTMLButtonElement>('#btn-effects');
  const langButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.lang [data-lang]'));

  let hudItem = -1;

  function renderLanguage() {
    const ui = strings();
    const current = lang();
    document.documentElement.lang = current;
    document.title = `${ui.site.title} · ${ui.site.tagline}`;
    applyI18n(document, ui);
    langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === current)));
    // The readable copy of the story (for screen readers and search engines).
    sections.forEach((section) => {
      const scene = scenes[Number(section.dataset.scene)];
      if (!scene || section.dataset.item !== 'scene') return;
      section.querySelector('.scene__title')!.textContent = scene.title[current];
      section.querySelector('.scene__year')!.textContent = formatYear(scene.year, ui);
      section.querySelector('.scene__alt')!.textContent = scene.imageAlt[current];
      const lines = section.querySelector('.scene__lines')!;
      lines.textContent = '';
      for (const text of scene.subtitles[current]) {
        const p = document.createElement('p');
        p.textContent = text;
        lines.append(p);
      }
    });
    overview.rebuild();
    scrubber.refreshText();
    hudItem = -1; // redraw the per-scene interface in the new language
  }

  function renderToggles() {
    soundButton.setAttribute('aria-pressed', String(store.get('sound')));
    effectsButton.setAttribute('aria-pressed', String(store.get('effects')));
  }

  soundButton.addEventListener('click', () => store.set('sound', !store.get('sound')));
  effectsButton.addEventListener('click', () => store.set('effects', !store.get('effects')));
  langButtons.forEach((b) => b.addEventListener('click', () => store.set('lang', b.dataset.lang as Locale)));
  $<HTMLButtonElement>('#btn-overview').addEventListener('click', () => overview.toggle(shownItem));
  store.on('sound', renderToggles);
  store.on('effects', renderToggles);
  store.on('lang', (next) => {
    renderLanguage();
    history.replaceState(null, '', localePath(next) + location.search + location.hash);
  });
  renderLanguage();
  renderToggles();

  // --- Jumps (overview, deep links) -----------------------------------------
  let jumping: gsap.core.Timeline | null = null;

  /** Like changing channel: a burst of static, the jump, then the picture settles. */
  function jumpToItem(index: number) {
    sourcePanel.close();
    jumping?.kill();
    const key = reducedMotion ? 'black' : 'staticAmount';
    jumping = gsap
      .timeline()
      .to(overlay, { [key]: 1, duration: 0.22, ease: 'power1.in' })
      .call(() => scroll.jumpTo(index, index === 0 ? 0 : LAND))
      .to(overlay, { [key]: 0, duration: 0.55, ease: 'power2.out' }, '+=0.12');
  }

  const hashScene = items.findIndex((it) => it.kind === 'scene' && scenes[it.scene]!.id === location.hash.slice(1));
  if (hashScene > 0) {
    // Fonts and images change the layout after load; land again on each
    // re-measure until the visitor moves on their own.
    let landing = true;
    const stop = () => (landing = false);
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, stop, { once: true, passive: true });
    scroll.onMeasure(() => {
      if (landing) scroll.jumpTo(hashScene, LAND);
    });
    // The browser also scrolls to the matching anchor itself once loading ends.
    const reland = () => window.setTimeout(() => landing && scroll.jumpTo(hashScene, LAND), 0);
    if (document.readyState === 'complete') reland();
    else window.addEventListener('load', reland, { once: true });
    scroll.jumpTo(hashScene, LAND);
  }

  // --- Opening ----------------------------------------------------------------
  const opening = createOpening($('#opening'), stage, {
    scroll,
    overlay,
    reducedMotion,
    bcLabel: () => strings().timeline.bc,
    onSoundChoice: (sound) => store.set('sound', sound),
  });
  const skipOpening = params.has('skip') || params.has('debug') || hashScene > 0 || window.scrollY > 10;
  if (!skipOpening) opening.start();

  // --- Debug panel --------------------------------------------------------------
  let debug: Debug | null = null;
  if (params.has('debug')) {
    import('./debug').then((m) => {
      debug = m.createDebug();
    });
  }

  // --- Idle controls (mouse devices) ----------------------------------------------
  let idleTimer = 0;
  function wake() {
    if (!hasMouse) return;
    stage.classList.remove('is-idle');
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      const busy = sourcePanel.isOpen() || overview.isOpen() || $('#controls').contains(document.activeElement);
      if (!busy) stage.classList.add('is-idle');
    }, IDLE_AFTER);
  }
  wake();

  // --- Keyboard ---------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    wake();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    if (!opening.isDone() && !skipOpening) return;
    if (overview.isOpen() || sourcePanel.isOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.max(0, Math.min(items.length - 1, shownItem + (e.key === 'ArrowRight' ? 1 : -1)));
      scroll.scrollToItem(next, next === 0 ? 0 : LAND);
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      overview.toggle(shownItem);
    }
  });

  // --- Pointer (parallax, idle) -------------------------------------------------------
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      wake();
      pointer.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.targetY = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  window.addEventListener('resize', () => renderer.resize());

  // --- The loop -------------------------------------------------------------------
  const blended = zeroWeights();
  const weights = zeroWeights();
  const frame: Frame = {
    a: scenes[0]!,
    b: null,
    mix: 0,
    zoomA: BASE_ZOOM,
    zoomB: BASE_ZOOM,
    weights,
    pointerX: 0,
    pointerY: 0,
    parallax: 0,
    time: 0,
    tick: 0,
    staticAmount: 0,
    black: 0,
  };
  let lastIndex = -1;
  let lastHeld = -1;
  let lastSignature = '';
  let lastHash = location.hash;
  /** The item whose picture is mostly on screen. */
  let shownItem = 0;
  /** The chapter last announced; '' until the first scene settles. */
  let shownEra = '';
  let shownYear = 0;

  // Slow device guard: if frames keep arriving late, render at a lower
  // resolution rather than stutter. Checked over two-second windows.
  const pace = { since: 0, frames: 0, slowWindows: 0, quality: 1, fpsBefore: 0, enabled: !params.has('debug') };
  function watchPace(time: number) {
    if (!pace.enabled || document.hidden) return;
    if (pace.since === 0) pace.since = time;
    pace.frames++;
    const elapsed = time - pace.since;
    if (elapsed < 2) return;
    const fps = pace.frames / elapsed;
    pace.since = time;
    pace.frames = 0;
    // If the last step down bought nothing, the screen itself is slow (a 30Hz
    // display, battery saver): go back to full sharpness and stop trying.
    if (pace.fpsBefore > 0) {
      if (fps < pace.fpsBefore * 1.15) {
        pace.quality = 1;
        pace.enabled = false;
        renderer.setQuality(1);
        return;
      }
      pace.fpsBefore = 0;
    }
    // Two slow windows in a row, so one hiccup (a tab switch, an image decode) is ignored.
    pace.slowWindows = fps < 42 ? pace.slowWindows + 1 : 0;
    if (pace.slowWindows >= 2) {
      pace.slowWindows = 0;
      if (pace.quality <= 0.5) {
        pace.enabled = false;
        return;
      }
      pace.fpsBefore = fps;
      pace.quality -= 0.25;
      renderer.setQuality(pace.quality);
    }
  }

  function zoomFor(pos: Position, offset: number): number {
    if (reducedMotion) return BASE_ZOOM;
    const item = items[pos.index + offset];
    const t = pos.t - offset;
    // The title pulls back slowly; scenes push in. They meet at BASE_ZOOM.
    if (item?.kind === 'title') return BASE_ZOOM + 0.04 * (1 - t);
    return BASE_ZOOM + ZOOM_TRAVEL * t;
  }

  function updateInterface(now: number, pos: Position, mix: number) {
    const item = items[pos.index]!;
    const next = items[pos.index + 1];
    const ui = strings();
    const current = lang();
    shownItem = mix > 0.5 && next ? pos.index + 1 : pos.index;
    const shown = items[shownItem]!;
    const scene = scenes[shown.scene]!;
    const onTitle = shown.kind === 'title';

    // Captions belong to the item being scrolled through; the title has none.
    const lines = item.kind === 'scene' ? scenes[item.scene]!.subtitles[current] : [];
    const caption = captionAt(pos.t, lines.length);
    captions.set(caption >= 0 ? lines[caption]! : '');
    captionBlock.classList.toggle('is-hidden', onTitle);

    if (shownItem !== hudItem) {
      hudItem = shownItem;
      const era = eraById.get(scene.era)!;
      metaRoman.textContent = era.roman;
      metaYear.textContent = formatYear(scene.year, ui);
      metaName.textContent = era.title[current];
      mini.set(onTitle ? -1 : shown.scene);
      sourcePanel.render(scene, ui, current);
      badge.textContent = scene.placeholder ? ui.placeholder.badge : ui.source.illustration;
      badge.classList.toggle('is-visible', scene.isIllustration && !onTitle);
    }

    // Chapter change: announced once the picture belongs to a new chapter,
    // but not while dragging through many chapters at once.
    if (onTitle) {
      shownEra = scene.era;
      shownYear = scene.year;
    } else if (scene.era !== shownEra && !scrubber.isDragging() && !scroll.isLocked()) {
      if (shownEra !== '') chapterCard.show(eraById.get(scene.era)!, scene.year, shownYear, ui, current);
      shownEra = scene.era;
      shownYear = scene.year;
    } else if (scene.era === shownEra) {
      shownYear = scene.year;
    }

    const titleOpacity = item.kind === 'title' ? 1 - smoothstep(0.08, 0.7, pos.t) : 0;
    title.style.opacity = titleOpacity.toFixed(3);
    title.style.visibility = titleOpacity > 0.001 ? 'visible' : 'hidden';

    scrubber.update(now, scroll.progress(), shownItem);

    // Keep the address shareable: #scene-id for scenes, nothing for the title.
    const hash = item.kind === 'scene' ? `#${scenes[item.scene]!.id}` : '';
    if (hash !== lastHash && !scroll.isLocked()) {
      lastHash = hash;
      history.replaceState(null, '', location.pathname + location.search + hash);
    }
  }

  gsap.ticker.add((time) => {
    watchPace(time);
    const pos = scroll.position();
    const item = items[pos.index]!;
    const next = items[pos.index + 1];
    const sceneA = scenes[item.scene]!;
    const sceneB = next ? scenes[next.scene]! : null;
    // The title and the first scene share an image: nothing to crossfade.
    const sameImage = sceneB?.image === sceneA.image;
    const mix = sceneB && !sameImage ? crossfade(pos.t) : 0;

    if (pos.index !== lastIndex) {
      lastIndex = pos.index;
      const nearby = [-1, 0, 1, 2]
        .map((d) => items[pos.index + d])
        .filter((it) => it !== undefined)
        .map((it) => scenes[it.scene]!);
      renderer.keepOnly(nearby);
    }
    renderer.preload(sceneA);
    if (sceneB) renderer.preload(sceneB);
    const afterNext = items[pos.index + 2];
    if (afterNext && pos.t > 0.5) renderer.preload(scenes[afterNext.scene]!);

    // Treatment: this scene's weights, blending towards the next scene's.
    const from = PRESETS[sceneA.treatment];
    const to = sceneB ? PRESETS[sceneB.treatment] : from;
    lerpWeights(from, to, treatmentMix(pos.t), blended);
    const forced = debug?.weights();
    applyPreferences(forced ?? blended, { effects: store.get('effects'), reducedMotion }, weights);
    debug?.show(blended);

    pointer.x += (pointer.targetX - pointer.x) * 0.06;
    pointer.y += (pointer.targetY - pointer.y) * 0.06;

    // Old film runs at about 18 frames a second: hold the picture between frames.
    const fps = 60 - 42 * weights.stutter;
    if (weights.stutter < 0.05 || time - lastHeld >= 1 / fps) {
      lastHeld = time;
      frame.a = sceneA;
      frame.b = mix > 0 ? sceneB : null;
      frame.mix = mix;
      frame.zoomA = zoomFor(pos, 0);
      frame.zoomB = zoomFor(pos, 1);
      frame.pointerX = -pointer.x;
      frame.pointerY = pointer.y + (pos.t - 0.5) * 0.8;
    }
    frame.parallax = reducedMotion ? 0 : PARALLAX;
    frame.time = time;
    frame.tick = reducedMotion ? 0 : Math.floor(time * (24 - 6 * weights.stutter));
    frame.staticAmount = overlay.staticAmount;
    frame.black = overlay.black;

    // The camcorder date belongs to whichever scene brings the VHS look.
    const stampScene = sceneB && PRESETS[sceneB.treatment].stamp > PRESETS[sceneA.treatment].stamp ? sceneB : sceneA;
    const stampText = formatStamp(stampScene.dateStamp, stampScene.year);
    if (stamp.textContent !== stampText) stamp.textContent = stampText;
    stamp.style.opacity = weights.stamp.toFixed(3);
    updateInterface(performance.now(), pos, mix);

    // A clean, still picture does not need redrawing every frame.
    const animated =
      weights.grain + weights.flicker + weights.scratches + weights.jitter + weights.tracking + weights.scanlines +
      frame.staticAmount;
    if (animated < 0.001 && !renderer.busy()) {
      const ready = renderer.isReady(frame.a) && (!frame.b || renderer.isReady(frame.b));
      const signature = `${frame.a.image}|${frame.b?.image}|${frame.mix.toFixed(4)}|${frame.zoomA.toFixed(5)}|${frame.pointerX.toFixed(4)}|${frame.pointerY.toFixed(4)}|${frame.black.toFixed(3)}|${ready}|${window.innerWidth}x${window.innerHeight}|${JSON.stringify(weights)}`;
      if (signature === lastSignature) return;
      lastSignature = signature;
    } else {
      lastSignature = '';
    }
    renderer.render(frame);
  });
}

boot();
