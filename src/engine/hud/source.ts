import type { UiStrings } from '../../i18n';
import type { SceneData, SourceRef } from '../types';
import { el } from './text';

function describe(source: SourceRef): string {
  return [source.author, source.publisher, source.year].filter(Boolean).join(', ');
}

/** Only http(s) links are ever turned into anchors. */
function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function link(url: string, text: string): HTMLAnchorElement {
  const a = el('a', undefined, text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

/**
 * The "Burimi / Source" panel: the sources for the current scene's facts and
 * the credit and licence of its image. A side panel on wide screens, a sheet
 * from the bottom on phones. The picture stays visible beside it.
 */
export function createSourcePanel(root: HTMLElement, trigger: HTMLButtonElement, onToggle: (open: boolean) => void) {
  const body = root.querySelector<HTMLElement>('.source__body')!;
  const close = root.querySelector<HTMLButtonElement>('.source__close')!;
  const backdrop = root.querySelector<HTMLElement>('.source__backdrop')!;
  let open = false;
  let renderedKey = '';

  function setOpen(value: boolean, returnFocus = true) {
    if (value === open) return;
    open = value;
    onToggle(open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      root.hidden = false;
      requestAnimationFrame(() => {
        root.classList.add('is-open');
        close.focus({ preventScroll: true });
      });
    } else {
      root.classList.remove('is-open');
      window.setTimeout(() => {
        if (!open) root.hidden = true;
      }, 450);
      if (returnFocus) trigger.focus({ preventScroll: true });
    }
  }

  trigger.addEventListener('click', () => setOpen(!open));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  });

  return {
    render(scene: SceneData, ui: UiStrings, lang: string) {
      const key = `${scene.id}:${lang}`;
      if (key === renderedKey) return;
      renderedKey = key;
      body.textContent = '';

      body.append(el('h2', 'source__title', scene.title[lang as 'sq' | 'en']));

      body.append(el('h3', 'source__heading', ui.source.sources));
      if (scene.sources.length === 0) {
        body.append(el('p', 'source__empty', ui.source.none));
      } else {
        const list = el('ol', 'source__list');
        scene.sources.forEach((source, i) => {
          const item = el('li', 'source__item');
          item.append(el('span', 'source__num', String(i + 1)));
          const text = el('span', 'source__text');
          const url = safeUrl(source.url);
          text.append(url ? link(url, source.title) : el('span', 'source__name', source.title));
          const details = describe(source);
          if (details) text.append(el('span', 'source__details', details));
          if (source.note) text.append(el('span', 'source__note', source.note));
          item.append(text);
          list.append(item);
        });
        body.append(list);
      }

      body.append(el('h3', 'source__heading', ui.source.image));
      const facts = el('dl', 'source__facts');
      const credit = el('dd');
      const creditUrl = safeUrl(scene.imageSourceUrl);
      credit.append(creditUrl ? link(creditUrl, scene.imageCredit) : scene.imageCredit);
      const licence = scene.imageLicenseDetail ?? ui.license[scene.imageLicense];
      facts.append(
        el('dt', undefined, ui.source.credit),
        credit,
        el('dt', undefined, ui.source.license),
        el('dd', undefined, licence),
      );
      body.append(facts);
      if (scene.isIllustration) body.append(el('p', 'source__illustration', ui.source.illustration));
    },
    close: () => setOpen(false, false),
    isOpen: () => open,
  };
}

export type SourcePanel = ReturnType<typeof createSourcePanel>;
