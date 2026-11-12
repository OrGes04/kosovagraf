/**
 * Image pipeline. Turns the originals in media-src/ into what the site serves:
 *
 *   media-src/scenes/<id>.(png|jpg|jpeg|tif|tiff|webp)
 *     -> public/media/scenes/<id>/<width>.avif and <width>.webp, plus thumb.webp
 *   media-src/depth/<id>.png   (white = near, black = far)
 *     -> public/media/scenes/<id>/depth.webp
 *
 * and writes src/data/media.json, the manifest the engine reads.
 * Outputs are committed, so deploys never need to re-encode images.
 *
 * Photos awaiting their owner's permission go in media-local/scenes/ instead. They are
 * encoded to public/media-local/ with their own manifest, src/data/media-local.json.
 * All three are git-ignored, so they are never committed or deployed, and the site
 * only uses them in local development (see src/lib/story.ts).
 *
 *   node scripts/images.ts          only what is missing or out of date
 *   node scripts/images.ts --force  everything
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { DEPTH_WIDTH, IMAGE_WIDTHS } from '../src/lib/constants.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = {
  src: path.join(ROOT, 'media-src/scenes'),
  depth: path.join(ROOT, 'media-src/depth'),
  out: path.join(ROOT, 'public/media/scenes'),
  manifest: path.join(ROOT, 'src/data/media.json'),
};
const LOCAL = {
  src: path.join(ROOT, 'media-local/scenes'),
  depth: path.join(ROOT, 'media-local/depth'),
  out: path.join(ROOT, 'public/media-local'),
  manifest: path.join(ROOT, 'src/data/media-local.json'),
};
const FORCE = process.argv.includes('--force');
const THUMB_WIDTH = 320;

interface MediaEntry {
  width: number;
  height: number;
  widths: number[];
  depth: boolean;
}

async function mtime(file: string): Promise<number> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

async function upToDate(src: string, out: string): Promise<boolean> {
  if (FORCE) return false;
  const o = await mtime(out);
  return o > 0 && o >= (await mtime(src));
}

async function exists(dir: string): Promise<boolean> {
  return (await mtime(dir)) > 0;
}

async function processSet(set: typeof PUBLIC, label: string) {
  const { src: SRC, depth: DEPTH_SRC, out: OUT, manifest: MANIFEST } = set;
  const files = (await readdir(SRC)).filter((f) => /\.(png|jpe?g|tiff?|webp)$/i.test(f)).sort();
  const manifest: Record<string, MediaEntry> = {};
  let encoded = 0;

  for (const file of files) {
    const id = file.replace(/\.[^.]+$/, '');
    const src = path.join(SRC, file);
    const outDir = path.join(OUT, id);
    await mkdir(outDir, { recursive: true });

    const meta = await sharp(src).metadata();
    const width = meta.width;
    const height = meta.height;
    // Never upscale: skip sizes larger than the original, but always keep at least one.
    const widths = IMAGE_WIDTHS.filter((w) => w <= width);
    if (widths.length === 0) widths.push(IMAGE_WIDTHS[0]);

    for (const w of widths) {
      const resized = () => sharp(src).rotate().resize({ width: w, withoutEnlargement: true });
      const avif = path.join(outDir, `${w}.avif`);
      const webp = path.join(outDir, `${w}.webp`);
      if (!(await upToDate(src, avif))) {
        await resized().avif({ quality: 55, effort: 5 }).toFile(avif);
        encoded++;
      }
      if (!(await upToDate(src, webp))) {
        await resized().webp({ quality: 78 }).toFile(webp);
        encoded++;
      }
    }

    const thumb = path.join(outDir, 'thumb.webp');
    if (!(await upToDate(src, thumb))) {
      await sharp(src).rotate().resize({ width: THUMB_WIDTH }).webp({ quality: 70 }).toFile(thumb);
      encoded++;
    }

    const depthSrc = path.join(DEPTH_SRC, `${id}.png`);
    const hasDepth = (await mtime(depthSrc)) > 0;
    if (hasDepth) {
      const depthOut = path.join(outDir, 'depth.webp');
      if (!(await upToDate(depthSrc, depthOut))) {
        await sharp(depthSrc).resize({ width: DEPTH_WIDTH }).greyscale().webp({ quality: 80 }).toFile(depthOut);
        encoded++;
      }
    }

    manifest[id] = { width, height, widths: [...widths], depth: hasDepth };
  }

  await mkdir(path.dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${label}: ${files.length} image(s), ${encoded} file(s) encoded, manifest written.`);
}

await processSet(PUBLIC, 'public');
if (await exists(LOCAL.src)) await processSet(LOCAL, 'local preview (never published)');
