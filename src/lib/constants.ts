/**
 * Shared constants. Plain TypeScript with no imports, so that both the Astro
 * site and the Node scripts in /scripts can use it.
 */

/** Languages. Albanian is the default. To add German: add 'de' here and src/i18n/de.json. */
export const LOCALES = ['sq', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'sq';

/** TV channels (roadmap). v1 only ships "politics", but every scene carries the field. */
export const CHANNELS = ['politics', 'daily-life', 'culture', 'women'] as const;
export type Channel = (typeof CHANNELS)[number];
export const DEFAULT_CHANNEL: Channel = 'politics';

/** Stories. "main" is the v1 story; regional chapters (e.g. "drenica") come later. */
export const DEFAULT_STORY = 'main';

/**
 * Image licences we accept. Anything else (NC, ND, "all rights reserved",
 * unknown) must not be used. "own-work" covers images made for this project,
 * e.g. generated test cards and labelled illustrations. "permission" is a
 * photo its owner has allowed us to use in writing; the scene records who and
 * when in imageLicenseDetail, and the permission itself is kept in docs/permissions/.
 */
export const LICENSES = ['public-domain', 'cc0', 'cc-by', 'cc-by-sa', 'own-work', 'permission'] as const;
export type License = (typeof LICENSES)[number];

/** Era treatments, i.e. named shader presets (see src/engine/shader/presets.ts). */
export const TREATMENTS = [
  'parchment',
  'fadedPhoto',
  'film',
  'crt',
  'vhs',
  'vhsQuiet',
  'vhsFading',
  'digital',
  'clean',
] as const;
export type Treatment = (typeof TREATMENTS)[number];

/** Output widths for scene images, in pixels. */
export const IMAGE_WIDTHS = [960, 1600, 2560] as const;
export const DEPTH_WIDTH = 512;

/** The year the opening counter rolls back to, and where the title sits. */
export const TITLE_YEAR = -1000;
