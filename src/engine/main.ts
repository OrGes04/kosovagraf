/**
 * The engine's entry point. Reads the story data embedded in the page, sets
 * up scrolling, the renderer and the on-screen interface, then runs one loop:
 * scroll position in, everything else out.
 */
import gsap from 'gsap';
import { localePath } from '../i18n';
import { LOCALES, type Locale } from '../lib/constants';
import type { Debug } from './debug';
import { createCaptions } from './hud/captions';
import { createOdometer } from './hud/odometer';
import { createOpening, type Overlay } from './hud/opening';
import { createSourceTab } from './hud/source';
import { applyI18n, formatStamp, formatYear } from './hud/text';
import { createTimeline } from './hud/timeline';
import { FallbackRenderer } from './renderer/fallback';
import { GLRenderer, webglAvailable } from './renderer/gl';
import type { Frame, SceneRenderer } from './renderer/types';
import { createScroll } from './scroll';
import {
  buildItems,
  captionAt,
  crossfade,
  rulerAt,
  smoothstep,
  treatmentMix,
  yearAt,
  type Position,
} from './sequence';
import { PRESETS, applyPreferences, lerpWeights, zeroWeights } from './shader/presets';
import { createStore } from './store';
import type { SceneData, StoryData } from './types';

const BASE_ZOOM = 1.03;
const ZOOM_TRAVEL = 0.1;
const PARALLAX = 0.02;

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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);

  const stage = $('#stage');
  const track = $('#track');
  const sections = Array.from(track.querySelectorAll<HTMLElement>('[data-item]'));
  const scroll = createScroll(track, sections, { smooth: !reducedMotion.matches });

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
  const yearDisplay = createOdometer($('#year'));
  const captions = createCaptions($('#captions'), { reducedMotion: reducedMotion.matches });
  const sourceTab = createSourceTab($('#source'));
  const timeline = createTimeline($('#timeline'), items, scenes, eras, jumpToItem);
  const chapterNumber = $('#chapter-number');
  const chapterTitle = $('#chapter-title');
  const title = $('#title');
  const stamp = $('#stamp');
  const badge = $('#badge');
  const soundButton = $<HTMLButtonElement>('#btn-sound');
  const effectsButton = $<HTMLButtonElement>('#btn-effects');
  const langButton = $<HTMLButtonElement>('#btn-lang');

  const strings = () => data.ui[store.get('lang')];
  let hudScene: SceneData | null = null;
  let hudEra = '';

  function renderLanguage() {
    const lang = store.get('lang');
    const ui = strings();
    document.documentElement.lang = lang;
    document.title = `${ui.site.title} · ${ui.site.tagline}`;
    applyI18n(document, ui);
    timeline.setLanguage(lang, ui);
    langButton.querySelectorAll<HTMLElement>('[data-lang]').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.lang === lang);
    });
    // The readable copy of the story (for screen readers and search engines).
    sections.forEach((section) => {
      const scene = scenes[Number(section.dataset.scene)];
      if (!scene || section.dataset.item !== 'scene') return;
      section.querySelector('.scene__title')!.textContent = scene.title[lang];
      section.querySelector('.scene__year')!.textContent = formatYear(scene.year, ui);
      section.querySelector('.scene__alt')!.textContent = scene.imageAlt[lang];
      const lines = section.querySelector('.scene__lines')!;
      lines.textContent = '';
      for (const text of scene.subtitles[lang]) {
        const p = document.createElement('p');
        p.textContent = text;
        lines.append(p);
      }
    });
    // Force the per-scene interface to redraw in the new language.
    hudScene = null;
    hudEra = '';
  }

  function renderToggles() {
    soundButton.setAttribute('aria-pressed', String(store.get('sound')));
    effectsButton.setAttribute('aria-pressed', String(store.get('effects')));
  }

  soundButton.addEventListener('click', () => store.set('sound', !store.get('sound')));
  effectsButton.addEventListener('click', () => store.set('effects', !store.get('effects')));
  langButton.addEventListener('click', () => {
    const next = LOCALES[(LOCALES.indexOf(store.get('lang')) + 1) % LOCALES.length] as Locale;
    store.set('lang', next);
  });
  store.on('sound', renderToggles);
  store.on('effects', renderToggles);
  store.on('lang', (lang) => {
    renderLanguage();
    history.replaceState(null, '', localePath(lang) + location.search + location.hash);
  });
  renderLanguage();
  renderToggles();

  // --- Jumps (timeline dots, deep links) --------------------------------------
  let jumping: gsap.core.Timeline | null = null;

  /** Like changing channel: a burst of static, the jump, then the picture settles. */
  function jumpToItem(index: number) {
    sourceTab.close();
    jumping?.kill();
    const key = reducedMotion.matches ? 'black' : 'staticAmount';
    jumping = gsap
      .timeline()
      .to(overlay, { [key]: 1, duration: 0.22, ease: 'power1.in' })
      .call(() => scroll.jumpTo(index, 0.02))
      .to(overlay, { [key]: 0, duration: 0.55, ease: 'power2.out' }, '+=0.12');
  }

  const hashScene = items.findIndex((it) => it.kind === 'scene' && scenes[it.scene]!.id === location.hash.slice(1));
  if (hashScene > 0) scroll.jumpTo(hashScene, 0.02);

  // --- Opening ----------------------------------------------------------------
  const opening = createOpening($('#opening'), stage, {
    scroll,
    overlay,
    reducedMotion: reducedMotion.matches,
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

  // --- Pointer (parallax) -------------------------------------------------------
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
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

  function zoomFor(pos: Position, offset: number): number {
    if (reducedMotion.matches) return BASE_ZOOM;
    const item = items[pos.index + offset];
    const t = pos.t - offset;
    // The title pulls back slowly; scenes push in. They meet at BASE_ZOOM.
    if (item?.kind === 'title') return BASE_ZOOM + 0.04 * (1 - t);
    return BASE_ZOOM + ZOOM_TRAVEL * t;
  }

  function updateInterface(pos: Position, mix: number) {
    const item = items[pos.index]!;
    const next = items[pos.index + 1];
    const scene = scenes[item.scene]!;
    const ui = strings();
    const lang = store.get('lang');

    yearDisplay.set(yearAt(items, pos), ui.timeline.bc);
    timeline.update(rulerAt(pos, items.length), mix > 0.5 && next ? pos.index + 1 : pos.index);

    // Captions belong to the scene on screen; the title has none.
    const lines = item.kind === 'scene' ? scene.subtitles[lang] : [];
    const caption = captionAt(pos.t, lines.length);
    captions.set(caption >= 0 ? lines[caption]! : '');

    // The rest follows whichever scene is more visible.
    const shown = mix > 0.5 && next ? scenes[next.scene]! : scene;
    if (shown !== hudScene) {
      hudScene = shown;
      sourceTab.render(shown, ui, lang);
      stamp.textContent = formatStamp(shown.dateStamp, shown.year);
      badge.textContent = shown.placeholder ? ui.placeholder.badge : ui.source.illustration;
      badge.classList.toggle('is-visible', shown.isIllustration);
      if (shown.era !== hudEra) {
        hudEra = shown.era;
        const era = eraById.get(shown.era)!;
        chapterNumber.textContent = era.roman;
        chapterTitle.textContent = era.title[lang];
      }
    }

    const titleOpacity = item.kind === 'title' ? 1 - smoothstep(0.08, 0.7, pos.t) : 0;
    title.style.opacity = titleOpacity.toFixed(3);
    title.style.visibility = titleOpacity > 0.001 ? 'visible' : 'hidden';

    // Keep the address shareable: #scene-id for scenes, nothing for the title.
    const hash = item.kind === 'scene' ? `#${scene.id}` : '';
    if (hash !== lastHash && !scroll.isLocked()) {
      lastHash = hash;
      history.replaceState(null, '', location.pathname + location.search + hash);
    }
  }

  gsap.ticker.add((time) => {
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
    applyPreferences(forced ?? blended, { effects: store.get('effects'), reducedMotion: reducedMotion.matches }, weights);
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
    frame.parallax = reducedMotion.matches ? 0 : PARALLAX;
    frame.time = time;
    frame.tick = reducedMotion.matches ? 0 : Math.floor(time * (24 - 6 * weights.stutter));
    frame.staticAmount = overlay.staticAmount;
    frame.black = overlay.black;

    stamp.style.opacity = weights.stamp.toFixed(3);
    updateInterface(pos, mix);

    // A clean, still picture does not need redrawing every frame.
    const animated =
      weights.grain + weights.flicker + weights.scratches + weights.jitter + weights.tracking + weights.scanlines +
      frame.staticAmount;
    if (animated < 0.001) {
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
