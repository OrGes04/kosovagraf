import { getCollection } from 'astro:content';
import media from '../data/media.json';
import { ui } from '../i18n';
import type { EraData, MediaInfo, SceneData, StoryData } from '../engine/types';
import { DEFAULT_CHANNEL, DEFAULT_STORY, type Channel, type Locale } from './constants';

const manifest = media as Record<string, MediaInfo>;
const DEFAULT_FRAMING: SceneData['framing'] = { focus: [0.5, 0.5], fitLandscape: 0, fitPortrait: 0 };

/**
 * Loads one story on one channel, in timeline order. The channel knob and
 * regional chapters (roadmap) are just other arguments to this function.
 */
export async function getStory(
  locale: Locale,
  story: string = DEFAULT_STORY,
  channel: Channel = DEFAULT_CHANNEL,
): Promise<StoryData> {
  const eraEntries = await getCollection('eras');
  const eras: EraData[] = eraEntries
    .map((e) => ({ id: e.id, ...e.data }))
    .sort((a, b) => a.number - b.number);
  const eraById = new Map(eras.map((e) => [e.id, e]));

  const sceneEntries = await getCollection(
    'scenes',
    (s) => s.data.story === story && s.data.channel === channel,
  );

  const scenes: SceneData[] = sceneEntries
    .map((entry) => {
      const d = entry.data;
      const era = eraById.get(d.era.id);
      if (!era) throw new Error(`Scene "${entry.id}" refers to unknown era "${d.era.id}".`);
      const info = manifest[d.image];
      if (!info) {
        throw new Error(
          `Scene "${entry.id}" uses image "${d.image}", which is not in the media manifest. ` +
            'Add it to media-src/scenes/ and run "npm run images".',
        );
      }
      if (d.depthMap && !info.depth) {
        throw new Error(`Scene "${entry.id}" says it has a depth map, but none exists for "${d.image}".`);
      }
      return {
        id: entry.id,
        story: d.story,
        channel: d.channel,
        era: era.id,
        year: d.year,
        yearEnd: d.yearEnd,
        yearApprox: d.yearApprox,
        dateStamp: d.dateStamp,
        title: d.title,
        subtitles: d.subtitles,
        image: d.image,
        media: { ...info, depth: info.depth && d.depthMap },
        // The schema fills this in, but a stale dev-server cache can hand over entries without it.
        framing: d.framing ?? DEFAULT_FRAMING,
        imageAlt: d.imageAlt,
        imageCredit: d.imageCredit,
        imageLicense: d.imageLicense,
        imageLicenseDetail: d.imageLicenseDetail,
        imageSourceUrl: d.imageSourceUrl,
        isIllustration: d.isIllustration,
        treatment: d.treatment ?? era.treatment,
        sources: d.sources,
        placeholder: d.placeholder,
        _order: d.order,
        _era: era.number,
      };
    })
    .sort((a, b) => a.year - b.year || a._era - b._era || a._order - b._order || a.id.localeCompare(b.id))
    .map(({ _order, _era, ...scene }) => scene);

  if (scenes.length === 0) throw new Error(`Story "${story}" has no scenes on channel "${channel}".`);

  return { story, channel, locale, eras, scenes, ui };
}
