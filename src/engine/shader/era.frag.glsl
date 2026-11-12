// The era shader: one pass that can make an image look like parchment, a faded
// photograph, old film, a black-and-white CRT, or VHS tape. Every effect is
// scaled by a weight (0 = off), so treatments blend into each other and all
// weights at zero leave the image untouched.

precision highp float;

varying vec2 vUv;

uniform sampler2D tA;      // current scene
uniform sampler2D tB;      // next scene
uniform sampler2D tDepthA; // white = near, black = far
uniform sampler2D tDepthB;
uniform vec2 uSizeA;       // image sizes in pixels
uniform vec2 uSizeB;
uniform float uHasDepthA;
uniform float uHasDepthB;

uniform vec2 uRes;         // canvas size in device pixels
uniform float uDpr;
uniform float uMix;        // crossfade A -> B
uniform float uZoomA;
uniform float uZoomB;
uniform vec2 uFocusA;      // the part of the image to keep in frame, in texture uv
uniform vec2 uFocusB;
uniform float uFitA;       // 0 = fill the screen (crop), 1 = show the whole image
uniform float uFitB;
uniform vec2 uPointer;     // parallax direction, each axis -1..1
uniform float uParallax;   // parallax strength
uniform float uTime;       // seconds
uniform float uFrame;      // time in whole steps (for anything that should "tick")
uniform float uStatic;     // TV static over everything
uniform float uBlack;      // fade to black

uniform float wParchment;
uniform float wFlicker;
uniform float wFade;
uniform float wGrain;
uniform float wDust;
uniform float wScratches;
uniform float wEdgeWear;
uniform float wSepia;
uniform float wDesaturate;
uniform float wJitter;
uniform float wScanlines;
uniform float wCurvature;
uniform float wFringe;
uniform float wTracking;
uniform float wBleed;
uniform float wVignette;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// Maps screen uv to image uv. fit 0 fills the screen like CSS object-fit: cover,
// fit 1 shows the whole image like contain; focus keeps that point of the
// image in frame when the image is cropped.
vec2 fitUv(vec2 uv, vec2 size, float zoom, vec2 focus, float fit) {
  float screen = uRes.x / uRes.y;
  float image = size.x / size.y;
  vec2 cover = screen > image ? vec2(1.0, image / screen) : vec2(screen / image, 1.0);
  vec2 contain = screen > image ? vec2(screen / image, 1.0) : vec2(1.0, image / screen);
  vec2 scale = mix(cover, contain, fit) / zoom;
  vec2 lo = min(scale * 0.5, vec2(0.5));
  return (uv - 0.5) * scale + clamp(focus, lo, 1.0 - lo);
}

// Outside a whole-image fit, the empty space shows a darkened, blurred copy of the picture.
vec3 sampleImage(sampler2D t, vec2 p, vec2 back) {
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) {
    vec3 s = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      vec2 o = vec2(float(i - (i / 3) * 3) - 1.0, float(i / 3) - 1.0) * 0.04;
      s += texture2D(t, back + o).rgb;
    }
    return s / 9.0 * 0.3;
  }
  return texture2D(t, p).rgb;
}

vec3 pick(vec2 ua, vec2 ub, vec2 backA, vec2 backB, vec2 offset) {
  vec3 a = sampleImage(tA, ua + offset, backA);
  if (uMix > 0.001) {
    vec3 b = sampleImage(tB, ub + offset, backB);
    a = mix(a, b, uMix);
  }
  return a;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 centred = uv - 0.5;

  // --- Geometry -----------------------------------------------------------

  // CRT glass: barrel distortion, with the picture ending in soft dark corners.
  float bulge = wCurvature * 0.16;
  uv = 0.5 + centred * (1.0 + bulge * dot(centred, centred) * 4.0) / (1.0 + bulge * 0.5);
  vec2 edge = smoothstep(vec2(0.0), vec2(0.012), uv) * smoothstep(vec2(0.0), vec2(0.012), 1.0 - uv);
  float screenMask = mix(1.0, edge.x * edge.y, step(0.001, wCurvature));

  // Film gate weave: the whole frame shifts a little on every tick.
  uv.y += wJitter * 0.0035 * (hash11(uFrame + 1.0) - 0.5);
  uv.x += wJitter * 0.0012 * (hash11(uFrame + 7.0) - 0.5);
  uv.y += wJitter * 0.012 * step(0.985, hash11(uFrame + 3.0));

  // VHS tracking: a noisy bar that drifts up the picture, plus head-switching
  // noise along the bottom edge.
  float lineNoise = hash12(vec2(floor(uv.y * uRes.y / (2.0 * uDpr)), uFrame));
  float bar = fract(uTime * 0.045);
  float inBar = smoothstep(0.07, 0.0, abs(uv.y - bar));
  float bottom = smoothstep(0.035, 0.0, uv.y);
  float tear = wTracking * (inBar * 0.5 + bottom);
  uv.x += tear * (lineNoise - 0.5) * 0.05;
  uv.x += wTracking * 0.0009 * sin(uv.y * 700.0 + uTime * 24.0);

  // --- Image --------------------------------------------------------------

  vec2 ua = fitUv(uv, uSizeA, uZoomA, uFocusA, uFitA);
  vec2 ub = fitUv(uv, uSizeB, uZoomB, uFocusB, uFitB);
  vec2 backA = fitUv(uv, uSizeA, uZoomA, uFocusA, 0.0);
  vec2 backB = fitUv(uv, uSizeB, uZoomB, uFocusB, 0.0);

  // 2.5D parallax: near things (bright in the depth map) move further.
  if (uParallax > 0.0) {
    if (uHasDepthA > 0.5) ua += (texture2D(tDepthA, ua).r - 0.5) * uPointer * uParallax;
    if (uHasDepthB > 0.5 && uMix > 0.001) ub += (texture2D(tDepthB, ub).r - 0.5) * uPointer * uParallax;
  }

  vec3 col = pick(ua, ub, backA, backB, vec2(0.0));

  // RGB fringing, growing towards the edges of the tube.
  float fringe = wFringe * (0.0012 + 0.006 * dot(centred, centred));
  if (fringe > 0.00005) {
    col.r = pick(ua, ub, backA, backB, vec2(fringe, 0.0)).r;
    col.b = pick(ua, ub, backA, backB, vec2(-fringe, 0.0)).b;
  }

  // VHS colour bleed: colour smears sideways while brightness stays put.
  if (wBleed > 0.001) {
    float y0 = luma(col);
    vec3 smear = pick(ua, ub, backA, backB, vec2(-0.006, 0.0)) + pick(ua, ub, backA, backB, vec2(-0.013, 0.0));
    smear = (smear + col) / 3.0;
    vec3 chroma = smear - luma(smear);
    col = mix(col, vec3(y0) + chroma * 1.15, wBleed);
  }

  // --- Colour -------------------------------------------------------------

  col = mix(col, vec3(luma(col)), wDesaturate);

  // Faded print: blacks lift, contrast drops.
  col = mix(col, col * 0.7 + 0.2, wFade);

  float l = luma(col);
  col = mix(col, vec3(l) * vec3(1.08, 0.93, 0.72) + vec3(0.02, 0.01, 0.0), wSepia);

  // Parchment: the image becomes brown ink on a mottled, fibrous sheet.
  if (wParchment > 0.001) {
    vec2 pp = vUv * vec2(aspect, 1.0);
    float mottling = fbm(pp * 3.0);
    float fibres = vnoise(pp * vec2(90.0, 14.0)) * 0.5 + vnoise(pp * 260.0) * 0.5;
    vec3 paper = vec3(0.87, 0.77, 0.58) * (0.78 + 0.34 * mottling) * (0.94 + 0.1 * fibres);
    float tone = smoothstep(0.02, 0.92, luma(col));
    vec3 ink = mix(vec3(0.17, 0.1, 0.05), vec3(1.0), tone);
    vec3 printed = paper * mix(ink, ink * (0.6 + 0.6 * col), 0.45);
    col = mix(col, printed, wParchment);
  }

  // --- Texture and damage ---------------------------------------------------

  // Grain, in clumps of about 1.5 CSS pixels, new on every tick.
  vec2 grainCell = floor(gl_FragCoord.xy / (1.5 * uDpr));
  col += (hash12(grainCell + uFrame * vec2(37.0, 17.0)) - 0.5) * wGrain * 0.26;

  // Dust on a print: specks and blotches that stay where they are.
  if (wDust > 0.001) {
    vec2 g = vUv * vec2(aspect, 1.0) * 16.0;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float present = step(1.0 - 0.14 * wDust, hash12(id + 0.37));
    vec2 centre = vec2(hash12(id + 3.1), hash12(id + 7.7));
    float radius = 0.02 + 0.07 * hash12(id + 9.3);
    float speck = present * smoothstep(radius, radius * 0.3, length(f - centre));
    float light = step(0.5, hash12(id + 5.5));
    col = mix(col, mix(vec3(0.08, 0.06, 0.05), vec3(0.95, 0.92, 0.85), light), speck * 0.75);
    col *= 1.0 - 0.18 * wDust * smoothstep(0.55, 0.8, fbm(vUv * vec2(aspect, 1.0) * 2.4 + 11.0));
  }

  // Film scratches and flying specks, different on every tick.
  if (wScratches > 0.001) {
    float sx = vUv.x * 46.0;
    float column = floor(sx);
    float lit = step(1.0 - 0.07 * wScratches, hash12(vec2(column, floor(uFrame / 4.0))));
    float wobble = hash11(column + uFrame) * 0.8 + 0.1;
    float scratch = lit * smoothstep(0.05, 0.0, abs(fract(sx) - wobble));
    col += scratch * 0.3 * (0.6 + 0.4 * hash12(vec2(column, vUv.y * 9.0)));

    vec2 g = vUv * vec2(aspect, 1.0) * 9.0;
    vec2 id = floor(g);
    float present = step(1.0 - 0.035 * wScratches, hash12(id + uFrame * 1.7));
    vec2 centre = vec2(hash12(id + uFrame + 2.0), hash12(id + uFrame + 5.0));
    float speck = present * smoothstep(0.07, 0.01, length(fract(g) - centre));
    col = mix(col, vec3(0.06), speck * 0.8);
  }

  // Exposure flicker of a hand-cranked projector.
  col *= 1.0 + wJitter * 0.09 * (hash11(uFrame + 11.0) - 0.5);

  // Scanlines, one pair every 3 CSS pixels, with a slow rolling brightness band.
  if (wScanlines > 0.001) {
    float lines = uRes.y / (3.0 * uDpr);
    float s = 0.5 + 0.5 * sin(uv.y * lines * 6.28318);
    col *= 1.0 - wScanlines * 0.38 * s;
    col *= 1.0 + wScanlines * 0.05 * sin((uv.y + uTime * 0.12) * 6.28318);
  }

  // Snow inside the VHS tracking bar and along the bottom edge.
  col = mix(col, vec3(lineNoise * 0.9 + 0.1), clamp(tear, 0.0, 1.0) * 0.45 * step(0.55, lineNoise));

  // --- Edges ----------------------------------------------------------------

  float dist = length(centred * vec2(1.0, 1.0)) * 1.25;
  col *= 1.0 - wVignette * 0.85 * smoothstep(0.38, 1.0, dist);

  // Candlelight: the dark closes in from the edges and breathes unevenly.
  if (wFlicker > 0.001) {
    float flame = vnoise(vec2(uTime * 2.3, 1.0)) * 0.6 + vnoise(vec2(uTime * 7.1, 5.0)) * 0.4;
    float rim = smoothstep(0.3, 0.95, dist);
    col *= 1.0 - wFlicker * rim * (0.3 + 0.35 * flame);
    col += wFlicker * rim * vec3(0.09, 0.045, 0.0) * (1.0 - flame) * 0.6;
  }

  // Worn borders: the picture breaks up irregularly towards the frame.
  if (wEdgeWear > 0.001) {
    float border = min(min(vUv.x, 1.0 - vUv.x) * aspect, min(vUv.y, 1.0 - vUv.y));
    float rough = fbm(vUv * vec2(aspect, 1.0) * 9.0);
    float keep = smoothstep(0.0, 0.035, border - rough * 0.07 * wEdgeWear);
    col = mix(vec3(0.07, 0.055, 0.04), col, mix(1.0, keep, wEdgeWear));
  }

  // --- Whole-screen states ----------------------------------------------------

  // Soft TV static.
  if (uStatic > 0.001) {
    vec2 cell = floor(gl_FragCoord.xy / (2.0 * uDpr));
    float n = hash12(cell + uFrame * vec2(13.0, 71.0));
    float band = 0.85 + 0.15 * sin((vUv.y + uTime * 0.31) * 9.0);
    vec3 snow = vec3(0.04 + 0.3 * n * n) * band;
    col = mix(col, snow, uStatic);
  }

  col *= screenMask;
  col *= 1.0 - uBlack;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
