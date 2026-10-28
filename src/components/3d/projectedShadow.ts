import { CanvasTexture, Vector3, type BufferGeometry, type Matrix4 } from 'three';

/*
 * Soft shadows for pieces far finer than the key light's shadow map can resolve (leaves, paper,
 * pins). Each caster is projected along the light onto the plane z = 0 of its parent's frame,
 * painted as a hard silhouette, then blurred onto a canvas whose alpha drives a multiply decal
 * (see shadowDecalMaterial).
 */

export interface Caster {
  geometry: BufferGeometry;
  /** Places the geometry in the frame whose z = 0 plane receives the shadow. */
  matrix?: Matrix4;
}

/** One blurred copy of the silhouette; several stack into a tight core with a soft halo. */
export interface ShadowLayer {
  /** Blur radius, world units. */
  blur: number;
  alpha: number;
}

interface Options {
  layers: ShadowLayer[];
  pxPerUnit: number;
  /** Fixed [minX, minY, maxX, maxY] for the decal; by default it fits the shadow. */
  bounds?: [number, number, number, number];
}

/** `light` points towards the light, in the receiving frame. */
export function paintProjectedShadow(casters: Caster[], light: Vector3, { layers, pxPerUnit: k, bounds }: Options) {
  const flat: Float32Array[] = [];
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const q = new Vector3();
  for (const { geometry, matrix } of casters) {
    const pos = geometry.attributes.position;
    const points = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      q.fromBufferAttribute(pos, i);
      if (matrix) q.applyMatrix4(matrix);
      const px = q.x - (light.x * q.z) / light.z;
      const py = q.y - (light.y * q.z) / light.z;
      points[i * 2] = px;
      points[i * 2 + 1] = py;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    flat.push(points);
  }
  if (bounds) [minX, minY, maxX, maxY] = bounds;
  else {
    const pad = Math.max(...layers.map((l) => l.blur)) * 3;
    [minX, minY, maxX, maxY] = [minX - pad, minY - pad, maxX + pad, maxY + pad];
  }
  const [w, h] = [Math.ceil((maxX - minX) * k), Math.ceil((maxY - minY) * k)];

  // Hard silhouette first, triangle by triangle so overlapping faces never cancel out.
  const shape = document.createElement('canvas');
  shape.width = w;
  shape.height = h;
  const sctx = shape.getContext('2d')!;
  sctx.fillStyle = sctx.strokeStyle = '#000';
  sctx.lineWidth = 0.8;
  casters.forEach(({ geometry }, g) => {
    const points = flat[g];
    const index = geometry.index;
    const count = index ? index.count : geometry.attributes.position.count;
    for (let t = 0; t < count; t += 3) {
      sctx.beginPath();
      for (let c = 0; c < 3; c++) {
        const v = index ? index.getX(t + c) : t + c;
        sctx.lineTo((points[v * 2] - minX) * k, (maxY - points[v * 2 + 1]) * k);
      }
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
    }
  });

  // Then blurred, via a canvas shadow (ctx.filter isn't supported everywhere): drawn off-canvas,
  // so only its offset shadow lands.
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (const { blur, alpha } of layers) {
    ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
    ctx.shadowBlur = blur * k;
    ctx.shadowOffsetX = w;
    ctx.drawImage(shape, -w, 0);
  }

  return {
    texture: new CanvasTexture(canvas),
    centre: [(minX + maxX) / 2, (minY + maxY) / 2] as [number, number],
    size: [maxX - minX, maxY - minY] as [number, number],
  };
}
