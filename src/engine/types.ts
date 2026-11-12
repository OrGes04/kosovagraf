import type { Channel, License, Locale, Treatment } from '../lib/constants';
import type { UiStrings } from '../i18n';

export type Localized = Record<Locale, string>;

export interface SourceRef {
  title: string;
  author?: string;
  publisher?: string;
  year?: number | string;
  url?: string;
  note?: string;
}

export interface EraData {
  id: string;
  number: number;
  roman: string;
  title: Localized;
  years?: string;
  treatment: Treatment;
  color: string;
}

export interface MediaInfo {
  width: number;
  height: number;
  widths: number[];
  depth: boolean;
}

export interface SceneData {
  id: string;
  story: string;
  channel: Channel;
  /** Era id, e.g. "04-1912-1945". */
  era: string;
  year: number;
  yearEnd?: number;
  yearApprox: boolean;
  dateStamp?: string;
  title: Localized;
  subtitles: Record<Locale, string[]>;
  image: string;
  media: MediaInfo;
  imageAlt: Localized;
  imageCredit: string;
  imageLicense: License;
  imageLicenseDetail?: string;
  imageSourceUrl?: string;
  isIllustration: boolean;
  /** Resolved: the scene's own treatment, or its era's. */
  treatment: Treatment;
  sources: SourceRef[];
  placeholder: boolean;
}

/** Everything the client needs, serialised into the page as JSON. */
export interface StoryData {
  story: string;
  channel: Channel;
  locale: Locale;
  eras: EraData[];
  scenes: SceneData[];
  ui: Record<Locale, UiStrings>;
}
