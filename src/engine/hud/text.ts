import type { UiStrings } from '../../i18n';

/** Looks up "group.key" in a UI strings file. */
export function lookup(strings: UiStrings, key: string): string {
  const [group, name] = key.split('.') as [keyof UiStrings, string];
  const value = (strings[group] as Record<string, string> | undefined)?.[name];
  return value ?? key;
}

/**
 * Fills every element marked data-i18n="group.key" (text) or
 * data-i18n-label="group.key" (aria-label) inside root.
 */
export function applyI18n(root: ParentNode, strings: UiStrings): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = lookup(strings, el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((el) => {
    el.setAttribute('aria-label', lookup(strings, el.dataset.i18nLabel!));
  });
}

export function formatYear(year: number, strings: UiStrings): string {
  const y = Math.round(year);
  return y < 0 ? `${-y} ${strings.timeline.bc}` : String(y);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Camcorder-style stamp: "1998-03-05" becomes "MAR 05 1998". */
export function formatStamp(dateStamp: string | undefined, year: number): string {
  if (!dateStamp) return String(year);
  const [y, m, d] = dateStamp.split('-');
  const month = m ? MONTHS[Number(m) - 1] : undefined;
  return [month, d, y].filter(Boolean).join(' ');
}

/** Creates an element with a class and optional text. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
