import { describe, expect, it } from 'vitest';
import { BoxGeometry, type DataTexture } from 'three';
import { surfaces, worldBoxUVs } from './surfaces';

const { floor, ...tiling } = surfaces;
// Grass is meant to be bold (clumps and blades read from the overview camera); it gets its own bound below.
const { grass, ...subtle } = tiling;

/** Mean absolute difference between texel columns a and b (red channel). */
function columnGap(texture: DataTexture, a: number, b: number) {
  const { data, width, height } = texture.image as { data: Uint8Array; width: number; height: number };
  let sum = 0;
  for (let y = 0; y < height; y++) sum += Math.abs(data[(y * width + a) * 4] - data[(y * width + b) * 4]);
  return sum / height;
}

describe('procedural surfaces', () => {
  it.each(Object.entries(tiling))('%s tiles without a visible seam', (_, surface) => {
    for (const texture of [surface.map, surface.roughnessMap, surface.normalMap]) {
      if (!texture) continue;
      const size = texture.image.width;
      const interior = Math.max(...Array.from({ length: size - 1 }, (_, x) => columnGap(texture, x, x + 1)));
      expect(columnGap(texture, size - 1, 0)).toBeLessThanOrEqual(interior);
    }
  });

  it.each(Object.entries(subtle))('%s keeps detail subtle around the base colour', (_, surface) => {
    for (const mean of surface.albedoMean) expect(mean).toBeGreaterThan(0.85);
    expect(surface.roughnessMean).toBeGreaterThan(0.6);
    expect(surface.roughnessMean).toBeLessThanOrEqual(1);
  });

  it('keeps grass varied but not murky', () => {
    for (const mean of grass.albedoMean) expect(mean).toBeGreaterThan(0.6);
    expect(grass.roughnessMean).toBeGreaterThan(0.85);
  });

  it('keeps the floor in its pale honey plank palette', () => {
    const [r, g, b] = floor.albedoMean;
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(0.6);
    expect(r).toBeLessThan(0.9);
  });
});

describe('worldBoxUVs', () => {
  it('scales each face to world units once', () => {
    const box = new BoxGeometry(4, 2, 1);
    worldBoxUVs(box);
    worldBoxUVs(box);
    const uv = box.attributes.uv;
    const front = Array.from({ length: 4 }, (_, i) => [uv.getX(16 + i), uv.getY(16 + i)]);
    expect(Math.max(...front.map(([u]) => u))).toBe(4);
    expect(Math.max(...front.map(([, v]) => v))).toBe(2);
  });
});
