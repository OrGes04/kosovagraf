import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CHANNELS, DEFAULT_CHANNEL, DEFAULT_STORY, LICENSES, TREATMENTS } from './lib/constants';

/** Text in every supported language. German becomes required here once it is added. */
const localized = z.object({
  sq: z.string().min(1),
  en: z.string().min(1),
});

const localizedLines = z.object({
  sq: z.array(z.string().min(1)).min(1),
  en: z.array(z.string().min(1)).min(1),
});

const source = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  publisher: z.string().optional(),
  year: z.union([z.number().int(), z.string()]).optional(),
  url: z.url().optional(),
  /** Page numbers, which claim this supports, or where sources disagree. */
  note: z.string().optional(),
});

const eras = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/eras' }),
  schema: z.object({
    number: z.number().int().min(1),
    roman: z.string().min(1),
    title: localized,
    /** Display label for the period, only where the brief or sources fix it. */
    years: z.string().optional(),
    treatment: z.enum(TREATMENTS),
    /** Colour of this era's band on the timeline. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
});

const scenes = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/scenes',
    // Scene id = file name, independent of the era folder it sits in.
    generateId: ({ entry }) => entry.split('/').pop()!.replace(/\.json$/, ''),
  }),
  schema: z
    .object({
      story: z.string().default(DEFAULT_STORY),
      channel: z.enum(CHANNELS).default(DEFAULT_CHANNEL),
      era: reference('eras'),
      /** Negative = BC. */
      year: z.number().int(),
      yearEnd: z.number().int().optional(),
      /** Shown as "c. 300 BC" / "rreth 300 p.e.s.": the year places the scene, it does not date an event. */
      yearApprox: z.boolean().default(false),
      /** Tie-break for scenes in the same year. */
      order: z.number().default(0),
      /** ISO date shown as the camcorder stamp in VHS-era scenes, e.g. "1998-03-05". */
      dateStamp: z
        .string()
        .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
        .optional(),
      title: localized,
      /** Film-style captions, shown one after another. */
      subtitles: localizedLines,

      /** Image id: a file in media-src/scenes/, without extension. */
      image: z.string().min(1),
      imageAlt: localized,
      imageCredit: z.string().min(1),
      imageLicense: z.enum(LICENSES),
      /** Exact licence wording, e.g. "CC BY-SA 4.0". */
      imageLicenseDetail: z.string().optional(),
      imageSourceUrl: z.url().optional(),
      /** True for anything that is not a real photograph or historical artwork. */
      isIllustration: z.boolean().default(false),
      /** Whether a depth map exists for the 2.5D parallax. */
      depthMap: z.boolean().default(false),
      /**
       * How the image sits on screen. focus: the point to keep in frame, as
       * [x, y] from the top left (0–1). fitLandscape / fitPortrait: 0 fills the
       * screen (cropping), 1 shows the whole image over a blurred copy of itself.
       */
      framing: z
        .object({
          focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).default([0.5, 0.5]),
          fitLandscape: z.number().min(0).max(1).default(0),
          fitPortrait: z.number().min(0).max(1).default(0),
        })
        .default({ focus: [0.5, 0.5], fitLandscape: 0, fitPortrait: 0 }),
      /** Overrides the era's treatment for this scene. */
      treatment: z.enum(TREATMENTS).optional(),

      sources: z.array(source).default([]),
      /** Open questions for the owner, e.g. "sources disagree on the number". */
      flags: z.array(z.string()).default([]),
      /** Engine test scene with no historical content. Never ships in a launch build. */
      placeholder: z.boolean().default(false),
    })
    .superRefine((scene, ctx) => {
      if (scene.placeholder) return;
      if (scene.sources.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['sources'], message: 'Every scene must list its sources.' });
      }
      if (scene.imageLicense !== 'own-work' && !scene.imageSourceUrl) {
        ctx.addIssue({
          code: 'custom',
          path: ['imageSourceUrl'],
          message: 'Images from elsewhere must record where they came from.',
        });
      }
      if (scene.imageLicense === 'own-work' && !scene.isIllustration) {
        ctx.addIssue({
          code: 'custom',
          path: ['isIllustration'],
          message: 'Images made for this project must be labelled as illustrations.',
        });
      }
    }),
});

export const collections = { eras, scenes };
