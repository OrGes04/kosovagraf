/**
 * Generates engine test scenes: a synthetic landscape "test card" image, an
 * exact matching depth map, and a scene JSON file, one per entry below.
 *
 * These carry no historical content. They exist so the engine (shader, scroll,
 * timeline, captions) can be built and reviewed before real, sourced scenes
 * are approved. Each is marked "placeholder": true and labelled on screen.
 *
 *   node scripts/placeholders.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const W = 2560;
const H = 1440;

interface TestScene {
  n: number;
  era: string;
  year: number;
  hue: number;
  dateStamp?: string;
  treatment?: string;
}

/**
 * Only eras without real scenes keep test cards. Remove an era's entries here
 * when its real scenes are drafted (test-01 … test-10 are gone: eras I–VII).
 */
const SCENES: TestScene[] = [
  { n: 11, era: '08-1999-2008', year: 2003, hue: 172 },
  { n: 12, era: '09-2008-today', year: 2008, hue: 48, treatment: 'digital' },
  { n: 13, era: '09-2008-today', year: 2026, hue: 205 },
];

/** Small deterministic random generator, so reruns give identical images. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A ridge line from left to right, closed along the bottom edge. */
function ridge(rand: () => number, baseY: number, roughness: number, steps: number): string {
  let y = baseY;
  const pts: string[] = [`M0,${H}`, `L0,${baseY}`];
  for (let i = 1; i <= steps; i++) {
    y += (rand() - 0.5) * roughness;
    y = Math.max(baseY - roughness * 1.6, Math.min(baseY + roughness * 1.2, y));
    pts.push(`L${Math.round((i / steps) * W)},${Math.round(y)}`);
  }
  pts.push(`L${W},${H}`, 'Z');
  return pts.join(' ');
}

function build(scene: TestScene) {
  const rand = rng(scene.n * 7919);
  const far = ridge(rand, H * 0.5, 150, 26);
  const mid = ridge(rand, H * 0.64, 100, 18);
  const near = ridge(rand, H * 0.82, 60, 12);
  const towerX = Math.round(W * (0.16 + rand() * 0.12));
  const towerY = Math.round(H * 0.5);
  const towerW = 150;
  const towerH = Math.round(H * 0.36);
  const sunX = Math.round(W * (0.6 + rand() * 0.25));
  const sunY = Math.round(H * (0.2 + rand() * 0.1));
  const h = scene.hue;
  const label = String(scene.n).padStart(2, '0');

  const tower = `
    <rect x="${towerX}" y="${towerY}" width="${towerW}" height="${towerH}" />
    <polygon points="${towerX - 18},${towerY} ${towerX + towerW / 2},${towerY - 70} ${towerX + towerW + 18},${towerY}" />`;

  const color = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${h}, 55%, 42%)" />
        <stop offset="0.6" stop-color="hsl(${(h + 30) % 360}, 70%, 72%)" />
        <stop offset="1" stop-color="hsl(${(h + 45) % 360}, 80%, 86%)" />
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)" />
    <circle cx="${sunX}" cy="${sunY}" r="110" fill="hsl(${(h + 40) % 360}, 95%, 90%)" />
    <path d="${far}" fill="hsl(${(h + 200) % 360}, 28%, 52%)" />
    <path d="${mid}" fill="hsl(${(h + 150) % 360}, 34%, 36%)" />
    <g fill="hsl(${(h + 170) % 360}, 30%, 20%)">${tower}</g>
    <g fill="hsl(${h}, 60%, 70%)">
      <rect x="${towerX + 55}" y="${towerY + 70}" width="40" height="60" />
      <rect x="${towerX + 55}" y="${towerY + 220}" width="40" height="60" />
    </g>
    <path d="${near}" fill="hsl(${(h + 120) % 360}, 36%, 22%)" />
    <g font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff" fill-opacity="0.82" text-anchor="middle">
      <text x="${W / 2}" y="${H * 0.43}" font-size="150" letter-spacing="14">PROVË · TEST ${label}</text>
      <text x="${W / 2}" y="${H * 0.43 + 90}" font-size="50" font-weight="400" letter-spacing="6">KOSOVOGRAF · NOT A REAL IMAGE</text>
    </g>
  </svg>`;

  // Depth: white = near the camera, black = far away.
  const depth = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#000000" />
    <path d="${far}" fill="#3c3c3c" />
    <path d="${mid}" fill="#787878" />
    <g fill="#b4b4b4">${tower}</g>
    <path d="${near}" fill="#f0f0f0" />
  </svg>`;

  return { color, depth, label };
}

const TREATMENT_BY_ERA: Record<string, string> = {
  '01-antiquity': 'parchment',
  '02-middle-ages': 'parchment',
  '03-ottoman': 'fadedPhoto',
  '04-1912-1945': 'film',
  '05-1945-1989': 'crt',
  '06-1989-1998': 'vhs',
  '07-1998-1999': 'vhs',
  '08-1999-2008': 'vhsFading',
  '09-2008-today': 'clean',
};

async function main() {
  await mkdir(path.join(ROOT, 'media-src/scenes'), { recursive: true });
  await mkdir(path.join(ROOT, 'media-src/depth'), { recursive: true });

  for (const scene of SCENES) {
    const { color, depth, label } = build(scene);
    const id = `test-${label}`;

    await sharp(Buffer.from(color)).png().toFile(path.join(ROOT, `media-src/scenes/${id}.png`));
    await sharp(Buffer.from(depth))
      .blur(6)
      .greyscale()
      .png()
      .toFile(path.join(ROOT, `media-src/depth/${id}.png`));

    const treatment = scene.treatment ?? TREATMENT_BY_ERA[scene.era];
    const yearSq = scene.year < 0 ? `${-scene.year} p.e.s.` : String(scene.year);
    const yearEn = scene.year < 0 ? `${-scene.year} BC` : String(scene.year);
    const json: Record<string, unknown> = {
      era: scene.era,
      year: scene.year,
      ...(scene.dateStamp ? { dateStamp: scene.dateStamp } : {}),
      ...(scene.treatment ? { treatment: scene.treatment } : {}),
      title: { sq: `Skenë prove ${label}`, en: `Test scene ${label}` },
      subtitles: {
        sq: [
          'Kjo është një skenë prove për motorin e Kosovografit.',
          `Trajtimi vizual: «${treatment}». Viti në vijën kohore: ${yearSq}.`,
          'Përmbajtja e vërtetë shtohet pasi të shqyrtohen burimet.',
        ],
        en: [
          'This is a test scene for the Kosovograf engine.',
          `Visual treatment: “${treatment}”. Year on the timeline: ${yearEn}.`,
          'Real content is added once the sources have been reviewed.',
        ],
      },
      image: id,
      imageAlt: {
        sq: 'Peizazh i vizatuar me kompjuter, i përdorur vetëm për prova.',
        en: 'A computer-drawn landscape used only for testing.',
      },
      imageCredit: 'Kosovograf (test card)',
      imageLicense: 'own-work',
      isIllustration: true,
      depthMap: true,
      placeholder: true,
    };

    const dir = path.join(ROOT, 'src/content/scenes', scene.era);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify(json, null, 2) + '\n');
    console.log(`wrote ${id}`);
  }
}

await main();
