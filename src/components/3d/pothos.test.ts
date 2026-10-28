import { describe, expect, it } from 'vitest';
import { Vector3, type BufferGeometry, type Vector2 } from 'three';
import { POT_AT, POT_OUTER, POT_RIM, POTHOS, SHELF, SHELF_FRONT, SHELF_TOP, SOIL_Y, VASE_AT, VASE_OUTER, VASE_TOP } from './pothos';

/** Radius of a lathe profile at height y (linear between profile points). */
function radiusAt(profile: Vector2[], y: number) {
  for (let i = 1; i < profile.length; i++) {
    const [a, b] = [profile[i - 1], profile[i]];
    if (y >= a.y && y <= b.y) return b.y === a.y ? Math.max(a.x, b.x) : a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return 0;
}

/** Why a point is inside something solid, or null. `tol` shrinks every solid a touch. */
function collision(q: Vector3, tol = 0.001): string | null {
  if (q.z < SHELF.gap + tol) return 'wall';
  const inShelf =
    Math.abs(q.x) < SHELF.width / 2 - tol && Math.abs(q.y) < SHELF_TOP - tol && q.z > SHELF.gap + tol && q.z < SHELF_FRONT - tol;
  if (inShelf) return 'shelf';

  const py = q.y - POT_AT.y;
  const pr = Math.hypot(q.x - POT_AT.x, q.z - POT_AT.z);
  // The pot's wobble is ±2%: test against a slightly shrunk wall, and treat everything below the soil as solid.
  if (py > tol && py < POT_RIM - tol && pr < radiusAt(POT_OUTER, py) * 0.98 - tol && (py < SOIL_Y || pr > 0.098)) return 'pot';

  const vy = q.y - VASE_AT.y;
  const vr = Math.hypot(q.x - VASE_AT.x, q.z - VASE_AT.z);
  if (vy > tol && vy < VASE_TOP - tol && vr < radiusAt(VASE_OUTER, vy) * 0.98 - tol && vr > 0.012) return 'vase';
  return null;
}

function vertices(geometry: BufferGeometry) {
  const pos = geometry.attributes.position;
  return Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i));
}

describe('floating shelf pothos', () => {
  it('keeps every leaf clear of the wall, shelf, pot and vase', () => {
    const hits = vertices(POTHOS.leaves)
      .map((q) => [collision(q), q.toArray().map((n) => n.toFixed(3)).join(', ')])
      .filter(([hit]) => hit);
    expect(hits).toEqual([]);
  });

  it('keeps the vines clear of everything once they leave the soil', () => {
    const hits = vertices(POTHOS.stems)
      .filter((q) => q.y > POT_AT.y + SOIL_Y + 0.01 || Math.hypot(q.x - POT_AT.x, q.z - POT_AT.z) > 0.1)
      .map((q) => [collision(q), q.toArray().map((n) => n.toFixed(3)).join(', ')])
      .filter(([hit]) => hit);
    expect(hits).toEqual([]);
  });

  it('attaches every blade to a petiole that leaves a vine', () => {
    const stems = vertices(POTHOS.stems);
    const blades = vertices(POTHOS.leaves);
    for (const { base, node } of POTHOS.nodes) {
      // The petiole tube ends round the blade's base, and the blade's own base vertex sits on it.
      expect(Math.min(...stems.map((q) => q.distanceTo(base)))).toBeLessThan(0.004);
      expect(Math.min(...blades.map((q) => q.distanceTo(base)))).toBeLessThan(1e-4);
      expect(Math.min(...stems.map((q) => q.distanceTo(node)))).toBeLessThan(0.008);
    }
  });

  it('stays light', () => {
    const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    expect(triangles(POTHOS.leaves) + triangles(POTHOS.stems) + triangles(POTHOS.daisy)).toBeLessThan(30000);
  });
});
