/**
 * Depth maps for the 2.5D parallax.
 *
 * For every image in media-src/scenes/ that has no depth map yet, runs an
 * open depth-estimation model (Depth Anything V2, small) on this computer and
 * saves the result to media-src/depth/<id>.png (white = near, black = far).
 * Nothing is sent anywhere; the model is downloaded once and cached.
 *
 * This lives in its own folder with its own package.json so that the model
 * runtime (large) is never installed during a deploy. Run it with:
 *
 *   npm run depth                 every image without a depth map
 *   npm run depth -- --only <id>  one image
 *   npm run depth -- --force      redo all
 *
 * Then run "npm run images" to publish the results.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'media-src/scenes');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(ROOT, 'media-src/depth');
const MODEL = 'onnx-community/depth-anything-v2-small';

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

const files = (await readdir(SRC))
  .filter((f) => /\.(png|jpe?g|tiff?|webp)$/i.test(f))
  .filter((f) => !ONLY || f.replace(/\.[^.]+$/, '') === ONLY)
  .sort();

await mkdir(OUT, { recursive: true });

const todo = [];
for (const file of files) {
  const id = file.replace(/\.[^.]+$/, '');
  const out = path.join(OUT, `${id}.png`);
  if (FORCE || ONLY || !(await exists(out))) todo.push({ id, file, out });
}

if (todo.length === 0) {
  console.log('Every image already has a depth map.');
  process.exit(0);
}

console.log(`Loading ${MODEL} (downloaded once, then cached)...`);
const estimate = await pipeline('depth-estimation', MODEL);

for (const { id, file, out } of todo) {
  // The model wants a modest RGB image; a 1024px JPEG is plenty for parallax.
  const input = await sharp(path.join(SRC, file))
    .rotate()
    .resize({ width: 1024, withoutEnlargement: true })
    .removeAlpha()
    .jpeg({ quality: 90 })
    .toBuffer();
  const blob = new Blob([input], { type: 'image/jpeg' });
  const { depth } = await estimate(blob);
  // A slight blur hides stair-stepping at object edges when the image shifts.
  await sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: depth.channels } })
    .greyscale()
    .blur(2)
    .png()
    .toFile(out);
  console.log(`depth: ${id} (${depth.width}x${depth.height})`);
}
