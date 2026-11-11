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
 * The "Burimi / Source" tab: a small tab that slides up a panel with the
 * sources for the current scene's facts and the credit and licence of its image.
 */
export function createSourceTab(root: HTMLElement) {
  const tab = root.querySelector<HTMLButtonElement>('.source__tab')!;
  const panel = root.querySelector<HTMLElement>('.source__panel')!;
  const body = root.querySelector<HTMLElement>('.source__body')!;
  const close = root.querySelector<HTMLButtonElement>('.source__close')!;
  let open = false;
  let renderedKey = '';

  function setOpen(value: boolean) {
    open = value;
    root.classList.toggle('is-open', open);
    tab.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    if (open) close.focus({ preventScroll: true });
  }

  tab.addEventListener('click', () => setOpen(!open));
  close.addEventListener('click', () => {
    setOpen(false);
    tab.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      tab.focus({ preventScroll: true });
    }
  });
  setOpen(false);

  return {
    render(scene: SceneData, ui: UiStrings, lang: string) {
      const key = `${scene.id}:${lang}`;
      if (key === renderedKey) return;
      renderedKey = key;
      body.textContent = '';

      body.append(el('h3', 'source__heading', ui.source.sources));
      if (scene.sources.length === 0) {
        body.append(el('p', 'source__empty', ui.source.none));
      } else {
        const list = el('ol', 'source__list');
        for (const source of scene.sources) {
          const item = el('li');
          const url = safeUrl(source.url);
          item.append(url ? link(url, source.title) : el('span', 'source__title', source.title));
          const details = describe(source);
          if (details) item.append(el('span', 'source__details', details));
          if (source.note) item.append(el('span', 'source__note', source.note));
          list.append(item);
        }
        body.append(list);
      }

      body.append(el('h3', 'source__heading', ui.source.image));
      const facts = el('dl', 'source__facts');
      const credit = el('dd');
      const creditUrl = safeUrl(scene.imageSourceUrl);
      credit.append(creditUrl ? link(creditUrl, scene.imageCredit) : scene.imageCredit);
      const licence = scene.imageLicenseDetail ?? ui.license[scene.imageLicense];
      facts.append(el('dt', undefined, ui.source.credit), credit, el('dt', undefined, ui.source.license), el('dd', undefined, licence));
      body.append(facts);
      if (scene.isIllustration) body.append(el('p', 'source__illustration', ui.source.illustration));
    },
    close() {
      if (open) setOpen(false);
    },
  };
}

export type SourceTab = ReturnType<typeof createSourceTab>;
