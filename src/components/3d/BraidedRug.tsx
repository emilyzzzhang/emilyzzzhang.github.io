import { useEffect, useMemo } from 'react';
import { LatheGeometry, MeshStandardMaterial, Vector2 } from 'three';
import { RUG } from '../../config/sceneLayout';
import { weldNormals } from './geometry';
import { seededRandom, useCanvasTexture } from './textures';

/*
 * A round braided rug: a low padded disc with a softly rolled rim, coiled from rings of braid in
 * cream, oat and blush, finished with a pink border. The braid is painted top-down and reused as
 * the bump map, so each strand catches the light. One mesh and one cheap material, where the old
 * sheepskin drew nineteen layers of fur.
 */

const { radius: R, thickness: T } = RUG;

/** The faintest wobble, so the circle reads as handmade rather than cut by machine. */
const wobble = (theta: number) => 1 + 0.01 * Math.sin(3 * theta + 0.6) + 0.006 * Math.sin(7 * theta + 2.1);

/** Ring colours from the centre outwards; each ring is one turn of braid. */
const RINGS = [
  '#F6EDE6', '#F6EDE6', '#EFE2D6', '#F6EDE6', '#F6EDE6', '#F3D7DC', '#F6EDE6', '#F6EDE6',
  '#EADBCB', '#F6EDE6', '#F6EDE6', '#F3D7DC', '#F6EDE6', '#F6EDE6', '#EDB4C1', '#E496A9',
];

/** The braid, top-down: canvas centre is the rug's centre, its edge the rug's rim. */
function drawBraid(ctx: CanvasRenderingContext2D, w: number) {
  const rand = seededRandom(19);
  const c = w / 2;
  const ringW = c / RINGS.length;
  ctx.fillStyle = RINGS[RINGS.length - 1];
  ctx.fillRect(0, 0, w, w);
  const shade = (hex: string, k: number) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s: number) => Math.round(Math.min(255, ((n >> s) & 255) * k));
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
  };
  RINGS.forEach((color, i) => {
    const inner = i * ringW;
    const mid = inner + ringW / 2;
    // The shadowed gaps between strands first, then the strands over them.
    ctx.fillStyle = shade(color, 0.91);
    ctx.beginPath();
    ctx.arc(c, c, inner + ringW, 0, Math.PI * 2);
    ctx.arc(c, c, Math.max(0, inner), 0, Math.PI * 2, true);
    ctx.fill();
    // Loops leaning alternately left and right round the ring read as a three-strand braid.
    const step = ringW * 0.5;
    const count = Math.max(6, Math.round((Math.PI * 2 * Math.max(mid, ringW * 0.6)) / step));
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + i * 0.37;
      const lean = k % 2 ? 0.65 : -0.65;
      const x = c + Math.cos(a) * mid;
      const y = c + Math.sin(a) * mid;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2 + lean);
      ctx.fillStyle = shade(color, 0.97 + rand() * 0.06);
      ctx.beginPath();
      ctx.ellipse(0, 0, ringW * 0.46, ringW * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // A soft highlight along each strand's crown.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, -ringW * 0.05, ringW * 0.3, ringW * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

const draw = (ctx: CanvasRenderingContext2D, w: number) => drawBraid(ctx, w);

/**
 * The padded disc: a slightly puffed top easing over a rolled rim to the floor. UVs are planar
 * (top-down), taken before the wobble so the rings follow the rug's outline.
 */
function rugGeometry() {
  const profile: Vector2[] = [new Vector2(R, 0)];
  for (let i = 1; i <= 8; i++) {
    const phi = (i / 8) * (Math.PI / 2);
    profile.push(new Vector2(R - T + Math.cos(phi) * T, Math.sin(phi) * T));
  }
  profile.push(new Vector2(R * 0.6, T + 0.002), new Vector2(R * 0.25, T + 0.003), new Vector2(0, T + 0.003));
  const geometry = new LatheGeometry(profile, 160);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv.setXY(i, 0.5 + x / (2 * R), 0.5 - z / (2 * R));
    const f = wobble(Math.atan2(z, x));
    pos.setXYZ(i, x * f, y, z * f);
  }
  geometry.computeVertexNormals();
  return weldNormals(geometry);
}

const RUG_GEOMETRY = rugGeometry();

/** Round braided rug. Origin: the rug's centre on the floor. */
export function BraidedRug() {
  const map = useCanvasTexture(draw, 1536, 1536);
  const material = useMemo(() => new MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.4, roughness: 0.95 }), [map]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={RUG_GEOMETRY} material={material} raycast={() => null} />;
}
