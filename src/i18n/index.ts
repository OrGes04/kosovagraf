import { DEFAULT_LOCALE, LOCALES, type Locale } from '../lib/constants';
import sq from './sq.json';
import en from './en.json';

/** The Albanian file defines the shape; every other language must match it. */
export type UiStrings = typeof sq;

export const ui: Record<Locale, UiStrings> = { sq, en };

export { DEFAULT_LOCALE, LOCALES, type Locale };

/** URL path for a language: Albanian lives at "/", others at "/<code>/". */
export function localePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '/' : `/${locale}/`;
}
