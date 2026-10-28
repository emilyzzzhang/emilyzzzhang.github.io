import { BoxGeometry, Color, DataTexture, EquirectangularReflectionMapping, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, type ColorSpace } from 'three';
import { seededRandom } from './textures';

/**
 * Procedural surface detail baked once into small, seamlessly tiling DataTextures, so the room
 * still needs no image assets. Albedo maps are multipliers on a material's colour; materials.ts
 * divides that colour by the map's mean so textures add variation without shifting the palette.
 */
export interface Surface {
  /** Albedo multiplier (sRGB); absent when the surface only adds relief and roughness. */
  map?: DataTexture;
  roughnessMap: DataTexture;
  normalMap: DataTexture;
  /** Mean linear value of `map` per channel. */
  albedoMean: [number, number, number];
  /** Mean value of `roughnessMap`. */
  roughnessMean: number;
}

type Field = Float32Array;

// ---------------------------------------------------------------------------------------------
// Noise. Every lattice wraps at u, v = 0 and 1, which is what makes the textures seamless.

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const wrap = (n: number, period: number) => {
  const m = n % period;
  return m < 0 ? m + period : m;
};

/** Smooth value noise in [0, 1] on a px × py lattice spanning one tile. */
function noise(u: number, v: number, px: number, py: number, seed: number) {
  const x = u * px;
  const y = v * py;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const xa = wrap(x0, px);
  const xb = xa + 1 === px ? 0 : xa + 1;
  const ya = wrap(y0, py);
  const yb = ya + 1 === py ? 0 : ya + 1;
  const a = hash(xa, ya, seed);
  const b = hash(xb, ya, seed);
  const c = hash(xa, yb, seed);
  const d = hash(xb, yb, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, px: number, py: number, octaves: number, seed: number) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(u, v, px << o, py << o, seed + o * 101);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Raises a round bump into `height` (wrapping at the edges), keeping the higher value where bumps overlap. */
function stamp(height: Field, size: number, cx: number, cy: number, reach: number, profile: (dist: number) => number) {
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const value = profile(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2));
      if (value <= 0) continue;
      const i = wrap(y, size) * size + wrap(x, size);
      if (value > height[i]) height[i] = value;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Encoding.

function dataTexture(data: Uint8Array, size: number, colorSpace: ColorSpace, width = size) {
  const texture = new DataTexture(data, width, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Linear → 8-bit sRGB through a lookup table; millions of pow() calls would dominate baking. */
const SRGB_LUT = Uint8Array.from({ length: 4097 }, (_, i) => {
  const c = i / 4096;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
});
const toSRGB = (c: number) => SRGB_LUT[Math.round(c * 4096)];

/** Linear RGB triplets → sRGB texture, plus their per-channel mean. */
function albedoTexture(rgb: Float32Array, size: number, width = size) {
  const data = new Uint8Array(width * size * 4);
  const mean: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < width * size; i++) {
    for (let ch = 0; ch < 3; ch++) {
      const value = Math.min(1, Math.max(0, rgb[i * 3 + ch]));
      data[i * 4 + ch] = toSRGB(value);
      mean[ch] += value;
    }
    data[i * 4 + 3] = 255;
  }
  return { texture: dataTexture(data, size, SRGBColorSpace, width), mean: mean.map((m) => m / (width * size)) as [number, number, number] };
}

function roughnessTexture(values: Field, size: number) {
  const data = new Uint8Array(size * size * 4);
  let sum = 0;
  for (let i = 0; i < size * size; i++) {
    const value = Math.min(1, Math.max(0, values[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(value * 255);
    data[i * 4 + 3] = 255;
    sum += value;
  }
  return { texture: dataTexture(data, size, NoColorSpace), mean: sum / (size * size) };
}

/** Tangent-space normal map from a height field; `strength` is height units per texel of slope. */
function normalTexture(height: Field, size: number, strength: number) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const up = wrap(y + 1, size) * size;
    const down = wrap(y - 1, size) * size;
    for (let x = 0; x < size; x++) {
      const nx = (height[y * size + wrap(x - 1, size)] - height[y * size + wrap(x + 1, size)]) * strength;
      const ny = (height[down + x] - height[up + x]) * strength;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * size + x) * 4;
      data[o] = Math.round((nx / len * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return dataTexture(data, size, NoColorSpace);
}

interface Bake {
  size: number;
  tint?: Float32Array;
  roughness: Field;
  height: Field;
  relief: number;
}

function bake({ size, tint, roughness, height, relief }: Bake): Surface {
  const albedo = tint && albedoTexture(tint, size);
  const rough = roughnessTexture(roughness, size);
  return {
    map: albedo?.texture,
    albedoMean: albedo?.mean ?? [1, 1, 1],
    roughnessMap: rough.texture,
    roughnessMean: rough.mean,
    normalMap: normalTexture(height, size, relief),
  };
}

/** Runs `fn` for every texel with tile coordinates in [0, 1). */
function eachTexel(size: number, fn: (u: number, v: number, i: number) => void) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) fn(x / size, y / size, y * size + x);
  }
}

// ---------------------------------------------------------------------------------------------
// Surfaces.

interface Grain {
  streak: number;
  line: number;
  pore: number;
  /** Broad, gentle tone drift. */
  mottle: number;
}

/** Fine oak grain running along u. `scale` is how many 2-unit wood tiles fit in one texture tile. */
function grain(u: number, v: number, scale: number): Grain {
  const warp = fbm(u, v, 2 * scale, 3 * scale, 2, 11);
  const streak = fbm(u, v + warp * 0.08 / scale, 3 * scale, 40 * scale, 3, 12);
  const ring = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * 48 * scale + warp * 1.5));
  const line = smoothstep(0.72, 0.98, ring) * (0.6 + 0.4 * streak);
  const pore = smoothstep(0.72, 0.9, noise(u, v, 12 * scale, 192 * scale, 13));
  const mottle = noise(u, v, 3 * scale, 3 * scale, 31);
  return { streak, line, pore, mottle };
}

type GrainRow = { [K in keyof Grain]: Float32Array };
const GRAIN_STEP = 4;

const grainRow = (size: number): GrainRow => ({
  streak: new Float32Array(size),
  line: new Float32Array(size),
  pore: new Float32Array(size),
  mottle: new Float32Array(size),
});

/**
 * Fills texels [from, to) of one row with grain. Grain barely changes along u, so it is sampled
 * every GRAIN_STEP texels and interpolated, which keeps baking fast.
 */
function fillGrainRow(row: GrainRow, size: number, y: number, from: number, to: number, scale: number, ou = 0, ov = 0) {
  const v = y / size + ov;
  let x0 = from;
  let a = grain(x0 / size + ou, v, scale);
  while (x0 < to) {
    const b = grain((x0 + GRAIN_STEP) / size + ou, v, scale);
    for (let x = x0; x < Math.min(x0 + GRAIN_STEP, to); x++) {
      const t = (x - x0) / GRAIN_STEP;
      row.streak[x] = a.streak + (b.streak - a.streak) * t;
      row.line[x] = a.line + (b.line - a.line) * t;
      row.pore[x] = a.pore + (b.pore - a.pore) * t;
      row.mottle[x] = a.mottle + (b.mottle - a.mottle) * t;
    }
    a = b;
    x0 += GRAIN_STEP;
  }
}

/** How much grain darkens the wood at texel x; red, green and blue get 0.8×, 1× and 1.3× so lines read warm. */
const grainShade = (row: GrainRow, x: number) =>
  0.03 + 0.07 * row.line[x] + 0.06 * (row.streak[x] - 0.5) + 0.03 * row.pore[x] - 0.05 * (row.mottle[x] - 0.5);
const WARMTH = [0.8, 1, 1.3];

function woodSurface(size: number): Surface {
  const tint = new Float32Array(size * size * 3);
  const roughness = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  const row = grainRow(size);
  for (let y = 0; y < size; y++) {
    fillGrainRow(row, size, y, 0, size, 1);
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const shade = grainShade(row, x);
      for (let ch = 0; ch < 3; ch++) tint[i * 3 + ch] = 1 - shade * WARMTH[ch];
      roughness[i] = 0.84 + 0.1 * row.line[x] + 0.05 * row.streak[x] + 0.03 * row.pore[x];
      height[i] = 0.5 * row.streak[x] - 0.5 * row.line[x] - 0.25 * row.pore[x];
    }
  }
  return bake({ size, tint, roughness, height, relief: 6 });
}

const FLOOR_TONES = ['#DDBE9F', '#D6B594', '#E2C5A8', '#D9B998', '#D2AF8D'].map((hex) => new Color(hex));

/**
 * The whole floor as one non-repeating texture: staggered planks with restrained tone changes,
 * fine grain, softly bevelled edges and slightly rougher seams. Planks run along u.
 * `grainMean` (the wood surface's albedo mean) keeps grain from darkening the plank tones.
 */
function floorSurface(size: number, rows: number, tilesAcross: number, grainMean: [number, number, number]): Surface {
  const rand = seededRandom(7);
  const rowH = size / rows;
  const px = size / 1024;
  const boards = Array.from({ length: rows }, () => {
    const row = [];
    let x = Math.round(-rand() * 300 * px);
    while (x < size) {
      const len = Math.round((260 + rand() * 260) * px);
      row.push({ start: x, end: x + len, tone: FLOOR_TONES[Math.floor(rand() * FLOOR_TONES.length)], ou: rand(), ov: rand(), rough: (rand() - 0.5) * 0.08 });
      x += len;
    }
    return row;
  });

  const tint = new Float32Array(size * size * 3);
  const roughness = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  const g = grainRow(size);
  for (let y = 0; y < size; y++) {
    const r = Math.min(rows - 1, Math.floor(y / rowH));
    const toRowEdge = Math.min(y + 0.5 - r * rowH, (r + 1) * rowH - y - 0.5);
    for (const board of boards[r]) {
      const from = Math.max(0, board.start);
      const to = Math.min(size, board.end);
      if (from >= to) continue;
      fillGrainRow(g, size, y, from, to, tilesAcross, board.ou, board.ov);
      const tone = [board.tone.r, board.tone.g, board.tone.b];
      for (let x = from; x < to; x++) {
        const edge = Math.min(toRowEdge, x + 0.5 - board.start, board.end - x - 0.5);
        const groove = 1 - smoothstep(0.6, 2.2, edge);
        const bevel = smoothstep(0, 5 * px, edge);
        const shade = grainShade(g, x);
        const i = y * size + x;
        for (let ch = 0; ch < 3; ch++) tint[i * 3 + ch] = tone[ch] * ((1 - shade * WARMTH[ch]) / grainMean[ch]) * (1 - 0.3 * groove);
        roughness[i] = 0.82 + board.rough + 0.1 * g.line[x] + 0.05 * g.streak[x] + 0.15 * groove;
        height[i] = 0.7 * bevel + 0.12 * g.streak[x] - 0.12 * g.line[x] - 0.06 * g.pore[x];
      }
    }
  }
  return bake({ size, tint, roughness, height, relief: 4 });
}

/** Painted plaster: broad, faint trowel mottling plus a fine stipple. Deliberately almost invisible. */
function plasterSurface(size: number): Surface {
  const tint = new Float32Array(size * size * 3);
  const roughness = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  eachTexel(size, (u, v, i) => {
    const low = fbm(u, v, 3, 3, 3, 41);
    const fine = fbm(u, v, 96, 96, 2, 42);
    const trowel = fbm(u, v, 5, 5, 2, 43);
    tint.fill(1 - 0.022 * low - 0.012 * fine, i * 3, i * 3 + 3);
    roughness[i] = 0.88 + 0.12 * trowel;
    height[i] = 0.5 * low + 0.5 * fine;
  });
  return bake({ size, tint, roughness, height, relief: 3 });
}

/** Bouclé: a tangle of small yarn loops and nubs over a soft fibrous base. */
function boucleSurface(size: number): Surface {
  const rand = seededRandom(52);
  const height = new Float32Array(size * size);
  eachTexel(size, (u, v, i) => (height[i] = 0.22 * fbm(u, v, 32, 32, 2, 51)));
  const scale = size / 256;
  for (let n = 0; n < 1100; n++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = (2.2 + rand() * 2) * scale;
    const amp = 0.6 + rand() * 0.4;
    if (rand() < 0.4) {
      const w = 1.4 * scale;
      stamp(height, size, cx, cy, r + w, (d) => {
        const t = (d - r) / w;
        return t * t < 1 ? (1 - t * t) * amp : 0;
      });
    } else {
      stamp(height, size, cx, cy, r, (d) => (d < r ? Math.sqrt(1 - (d / r) ** 2) * amp : 0));
    }
  }
  const tint = new Float32Array(size * size * 3);
  const roughness = new Float32Array(size * size);
  height.forEach((h, i) => {
    tint.fill(0.88 + 0.12 * h, i * 3, i * 3 + 3);
    roughness[i] = 0.92 + 0.08 * h;
  });
  return bake({ size, tint, roughness, height, relief: 2.2 });
}

/** Plain-weave linen with slubby threads; threads run along both u and v. */
function linenSurface(size: number, threads: number): Surface {
  const tint = new Float32Array(size * size * 3);
  const roughness = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  eachTexel(size, (u, v, i) => {
    const over = (Math.floor(u * threads) + Math.floor(v * threads)) % 2 === 0;
    const warp = Math.abs(Math.sin(Math.PI * threads * u)) * (0.8 + 0.4 * fbm(u, v, threads, 6, 2, 91));
    const weft = Math.abs(Math.sin(Math.PI * threads * v)) * (0.8 + 0.4 * fbm(u, v, 6, threads, 2, 92));
    const h = (over ? warp : weft) * 0.85;
    tint.fill(0.93 + 0.07 * h, i * 3, i * 3 + 3);
    roughness[i] = 0.94 + 0.06 * h;
    height[i] = h;
  });
  return bake({ size, tint, roughness, height, relief: 1.6 });
}

/** Glaze: a soft orange-peel undulation, a few iron speckles and patchy gloss. */
function glazeSurface(size: number): Surface {
  const tint = new Float32Array(size * size * 3);
  const roughness = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  eachTexel(size, (u, v, i) => {
    const speck = smoothstep(0.88, 0.97, noise(u, v, 90, 90, 72));
    tint[i * 3] = 1 - 0.14 * speck;
    tint[i * 3 + 1] = 1 - 0.18 * speck;
    tint[i * 3 + 2] = 1 - 0.22 * speck;
    roughness[i] = 0.62 + 0.38 * fbm(u, v, 5, 5, 3, 73);
    height[i] = fbm(u, v, 6, 6, 3, 71);
  });
  return bake({ size, tint, roughness, height, relief: 3 });
}

/** Paper tooth for prints, posters and the envelope: relief and roughness only, no tint. */
function paperSurface(size: number): Surface {
  const roughness = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  eachTexel(size, (u, v, i) => {
    const fibres = 0.6 * fbm(u, v, 40, 40, 3, 81) + 0.4 * fbm(u, v, 6, 90, 2, 82);
    roughness[i] = 0.88 + 0.12 * fibres;
    height[i] = fibres;
  });
  return bake({ size, roughness, height, relief: 2.5 });
}

/**
 * Short-cut lawn seen from above: thousands of short blades in mixed greens, rooted dark and
 * lightening (sometimes a little yellow) towards their tips, over darker, clumpy undergrowth.
 * The tint is a multiplier, normalised like the others so the material colour stays the average.
 */
function grassSurface(size: number): Surface {
  const rand = seededRandom(73);
  const n = size * size;
  const tint = new Float32Array(n * 3);
  const height = new Float32Array(n);
  const roughness = new Float32Array(n);
  const ground: [number, number, number] = [0.52, 0.62, 0.5];
  const lush: [number, number, number] = [0.8, 0.9, 0.76];
  eachTexel(size, (u, v, i) => {
    const clump = smoothstep(0.25, 0.75, fbm(u, v, 5, 5, 3, 74));
    for (let ch = 0; ch < 3; ch++) tint[i * 3 + ch] = ground[ch] + (lush[ch] - ground[ch]) * clump;
    height[i] = 0.25 * clump;
  });

  const root: [number, number, number] = [0.6, 0.7, 0.58];
  const tips: [number, number, number][] = [
    [0.96, 1, 0.9],
    [1, 1, 0.8],
    [0.84, 0.93, 0.82],
    [0.9, 0.98, 0.86],
  ];
  const scale = size / 512;
  const blades = Math.round(n / 34);
  for (let b = 0; b < blades; b++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const angle = rand() * Math.PI * 2;
    const length = (12 + rand() * 12) * scale;
    const tip = tips[Math.floor(rand() * tips.length)];
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let step = 0; step <= length; step += 0.5) {
      const t = step / length;
      const px = Math.round(x0 + dx * step);
      const py = Math.round(y0 + dy * step);
      // Blades taper: three texels wide at the root, one at the tip.
      for (let w = 0; w < (t < 0.4 ? 3 : t < 0.75 ? 2 : 1); w++) {
        const i = wrap(py + Math.round(dx * w), size) * size + wrap(px - Math.round(dy * w), size);
        const h = 0.35 + 0.65 * t;
        if (h < height[i]) continue;
        height[i] = h;
        for (let ch = 0; ch < 3; ch++) tint[i * 3 + ch] = root[ch] + (tip[ch] - root[ch]) * t;
      }
    }
  }
  height.forEach((h, i) => (roughness[i] = 0.9 + 0.1 * (1 - h)));
  return bake({ size, tint, roughness, height, relief: 3 });
}

const wood = woodSurface(512);

/** Shared, baked once. Tile sizes (world units per texture tile) are applied in materials.ts. */
export const surfaces = {
  wood,
  /** 8 × 8 units, one tile for the whole floor (4 wood tiles across so grain matches the furniture). */
  floor: floorSurface(1024, 9, 4, wood.albedoMean),
  plaster: plasterSurface(256),
  boucle: boucleSurface(256),
  linen: linenSurface(256, 20),
  glaze: glazeSurface(256),
  paper: paperSurface(256),
  grass: grassSurface(512),
};

/**
 * The same surface with its own repeat. Clones share the texture's source, so the GPU stores
 * each image once however many tilings use it.
 */
export function tiled(surface: Surface, repeatU: number, repeatV: number): Surface {
  const tile = <T extends DataTexture | undefined>(texture: T): T => {
    if (!texture) return texture;
    const copy = texture.clone();
    copy.repeat.set(repeatU, repeatV);
    return copy as T;
  };
  return { ...surface, map: tile(surface.map), roughnessMap: tile(surface.roughnessMap), normalMap: tile(surface.normalMap) };
}

/**
 * A soft, painted panorama of the room (ceiling, walls, floor, the window and a fill-light
 * panel) for glazed ceramics and the screen to reflect. Low-res on purpose: it is only ever
 * seen blurred or faint.
 */
function roomReflection(): DataTexture {
  const width = 128;
  const height = 64;
  const ceiling = new Color('#FFFBF8');
  const wallHigh = new Color('#F8F3EE');
  const wallLow = new Color('#FFDCE4');
  const floor = new Color('#D9B998');
  const panel = new Color('#FFF6EA');
  const softBox = (u: number, v: number, cu: number, cv: number, hu: number, hv: number) =>
    (1 - smoothstep(hu * 0.6, hu, Math.abs(u - cu))) * (1 - smoothstep(hv * 0.6, hv, Math.abs(v - cv)));

  const rgb = new Float32Array(width * height * 3);
  const c = new Color();
  for (let y = 0; y < height; y++) {
    // Equirect rows run bottom (straight down) to top (straight up).
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      c.copy(floor).lerp(wallLow, smoothstep(0.44, 0.5, v)).lerp(wallHigh, smoothstep(0.54, 0.6, v)).lerp(ceiling, smoothstep(0.66, 0.74, v));
      c.multiplyScalar(0.7);
      // The window sits behind the desk (−z); the fill light is up and to the front-right.
      c.lerp(panel, Math.max(softBox(u, v, 0.25, 0.6, 0.07, 0.09), 0.8 * softBox(u, v, 0.59, 0.72, 0.09, 0.07)));
      rgb.set([c.r, c.g, c.b], (y * width + x) * 3);
    }
  }
  const { texture } = albedoTexture(rgb, height, width);
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}

export const reflection = roomReflection();

/** Box UVs for <boxGeometry ref={worldBoxUVs} />: one UV unit per world unit, so shared textures don't stretch. */
export function worldBoxUVs(geometry: BoxGeometry | null) {
  if (!geometry || geometry.userData.worldUVs) return;
  const { width: w, height: h, depth: d } = geometry.parameters;
  // Face order: +x, −x, +y, −y, +z, −z; four vertices each.
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = spans[Math.floor(i / 4)];
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  geometry.userData.worldUVs = true;
}
