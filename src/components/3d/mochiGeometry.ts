import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, LatheGeometry, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MOCHI } from '../../config/mochi';

/*
 * Mochi's sculpted geometry. The body and head are each one smooth surface: a sphere whose
 * vertices are pushed out along their rays onto the boundary of a smooth union of soft blobs
 * (a signed-distance "sculpt"), so shoulders, hips, cheeks and muzzle blend with no seams.
 * Fur markings are vertex colours with soft, slightly irregular edges.
 */

const { colors, markings } = MOCHI;

type Sdf = (p: Vector3) => number;

/** Approximate signed distance to an ellipsoid. */
function ellipsoid(c: Vector3, r: Vector3): Sdf {
  const k = Math.min(r.x, r.y, r.z);
  return (p) => (Math.hypot((p.x - c.x) / r.x, (p.y - c.y) / r.y, (p.z - c.z) / r.z) - 1) * k;
}

/** Polynomial smooth minimum: blends two shapes with a soft fillet of size k. */
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** Smooth maximum (soft intersection). */
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Cheap smooth pseudo-noise in [-1, 1], for organic marking edges and gentle fur unevenness. */
const wobble = (p: Vector3, f: number) => Math.sin(p.x * f + 1.3) * Math.sin(p.y * f * 1.3 + 0.7) * Math.sin(p.z * f * 0.9 + 2.1);

/**
 * Sculpts a closed surface: rays from `centre` through a sphere's vertices are walked out until
 * they leave the shape. Returns the welded geometry (ready for vertex colours and normals).
 */
function sculpt(sdf: Sdf, centre: Vector3, maxT: number, widthSegments: number, heightSegments: number) {
  const sphere = new SphereGeometry(1, widthSegments, heightSegments);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const geometry = mergeVertices(sphere);
  const pos = geometry.attributes.position;
  const dir = new Vector3();
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    // March out to the first point outside, then bisect for the surface.
    let lo = 0;
    let hi = maxT;
    for (let t = 0.004; t <= maxT; t += 0.004) {
      if (sdf(p.copy(centre).addScaledVector(dir, t)) > 0) {
        hi = t;
        lo = t - 0.004;
        break;
      }
    }
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if (sdf(p.copy(centre).addScaledVector(dir, mid)) > 0) hi = mid;
      else lo = mid;
    }
    p.copy(centre).addScaledVector(dir, (lo + hi) / 2);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  return geometry;
}

function paint(geometry: BufferGeometry, colourAt: (p: Vector3, out: Color) => void) {
  const pos = geometry.attributes.position;
  const data = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    colourAt(p.fromBufferAttribute(pos, i), c);
    data.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
}

const BASE = new Color(colors.furBase);
const SECONDARY = new Color(colors.furSecondary);
const FACE = new Color(colors.faceMarking);
const PAWS = new Color(colors.paws);
const TAIL = new Color(colors.tail);
const TAIL_TIP = new Color(markings.tailTip ? colors.tailTip : colors.tail);

// ---------------------------------------------------------------------------------------------
// Body (cat-local, before the cat's overall scale: x towards the head, z towards the front).

/**
 * One curled-up sleeping body: rounded hips at the back, a softly sloping back, shoulders, and a
 * chest rising towards the head (which rests just above it), all blended; flat where it lies.
 */
export function bodyGeometry() {
  const hips = ellipsoid(new Vector3(-0.15, 0.15, -0.02), new Vector3(0.2, 0.16, 0.21));
  const back = ellipsoid(new Vector3(-0.01, 0.165, -0.07), new Vector3(0.21, 0.155, 0.18));
  const shoulders = ellipsoid(new Vector3(0.12, 0.13, 0.0), new Vector3(0.15, 0.13, 0.18));
  const chest = ellipsoid(new Vector3(0.18, 0.1, 0.11), new Vector3(0.11, 0.1, 0.11));
  const haunch = ellipsoid(new Vector3(-0.17, 0.09, 0.12), new Vector3(0.13, 0.09, 0.1));
  const sdf: Sdf = (p) => {
    let d = smin(hips(p), back(p), 0.09);
    d = smin(d, shoulders(p), 0.08);
    d = smin(d, chest(p), 0.07);
    d = smin(d, haunch(p), 0.06);
    // Settled into the cushion: a softly rounded flat underside.
    return smax(d, 0.012 - p.y, 0.04);
  };
  const geometry = sculpt(sdf, new Vector3(-0.02, 0.13, -0.01), 0.6, 72, 52);
  // A whisper of fur unevenness so the silhouette isn't machine-smooth.
  const pos = geometry.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (p.y > 0.03) p.y += 0.003 * wobble(p, 38);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  paint(geometry, (q, out) => {
    // A soft saddle over the back and hips; cream on the chest, belly and the front of the curl.
    let patch = 0;
    if (markings.backPatch) {
      const edge = q.y - 0.17 + 0.05 * Math.max(0, q.x - 0.02) - 0.07 * Math.max(0, -q.z - 0.02) + 0.025 * wobble(q, 14);
      patch = smoothstep(-0.03, 0.025, edge);
    }
    if (markings.tabbyStripes) patch = Math.max(patch * 0.85, smoothstep(0.6, 0.9, Math.sin(q.x * 40)) * smoothstep(0.17, 0.24, q.y) * 0.8);
    out.copy(BASE).lerp(SECONDARY, patch);
  });
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// Head (head-local; R is the head radius the face features are placed against).

/** Skull, full cheeks, a little muzzle and a nape that tucks down towards the shoulders. */
export function headGeometry(R: number) {
  const skull = ellipsoid(new Vector3(0, 0, 0), new Vector3(R * 1.08, R * 0.92, R * 0.98));
  const cheeks = [-1, 1].map((s) => ellipsoid(new Vector3(s * R * 0.5, -R * 0.28, R * 0.32), new Vector3(R * 0.55, R * 0.46, R * 0.5)));
  const muzzle = ellipsoid(new Vector3(0, -R * 0.32, R * 0.62), new Vector3(R * 0.5, R * 0.32, R * 0.32));
  const nape = ellipsoid(new Vector3(0, -R * 0.38, -R * 0.5), new Vector3(R * 0.72, R * 0.55, R * 0.6));
  const sdf: Sdf = (p) => {
    let d = smin(skull(p), cheeks[0](p), R * 0.25);
    d = smin(d, cheeks[1](p), R * 0.25);
    d = smin(d, muzzle(p), R * 0.2);
    return smin(d, nape(p), R * 0.3);
  };
  const geometry = sculpt(sdf, new Vector3(0, -R * 0.1, 0), R * 2.2, 56, 40);
  // Soft cheek fluff: a few gentle tufts along the lower sides of the face.
  const pos = geometry.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const side = Math.abs(p.x) / R;
    const fluff = smoothstep(0.75, 1.05, side) * smoothstep(0.1, -0.35, p.y / R) * smoothstep(-0.4, 0.2, p.z / R);
    const tuft = 0.5 + 0.5 * Math.sin(Math.atan2(p.y, p.z) * 9);
    const out = 1 + 0.06 * fluff * tuft;
    pos.setXYZ(i, p.x * out, p.y, p.z);
  }
  paint(geometry, (q, out) => {
    const x = q.x / R;
    const y = q.y / R;
    const z = q.z / R;
    // Orange cap over the crown and back of the head, fading out above the eyes.
    const cap = markings.headCap ? smoothstep(-0.05, 0.22, y + 0.12 * (1 - z) - 0.4 + 0.08 * wobble(q, 40)) : 0;
    // Cream muzzle and chin, blended softly into the cheeks.
    const muzzle = 1 - smoothstep(0.35, 0.75, Math.hypot(x / 1.3, (y + 0.32) / 0.75, (z - 0.65) / 0.8));
    out.copy(BASE).lerp(SECONDARY, cap).lerp(FACE, muzzle * 0.9);
  });
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// Ears, tail, paws.

/** A rounded, slightly cupped ear whose base flares out so it grows from the head. Base at the origin, pointing +y. */
export function earGeometry(width: number, height: number, flare: number) {
  const pts: Vector2[] = [];
  const steps = 14;
  for (let k = 0; k <= steps; k++) {
    const h = k / steps;
    const r = width * (1 - h) ** 0.85 + flare * width * (1 - smoothstep(0, 0.3, h));
    pts.push(new Vector2(Math.max(r, 0.0001), h * height));
  }
  // round the tip
  pts.push(new Vector2(0, height * 1.03));
  const geometry = new LatheGeometry(pts.reverse(), 18).scale(1, 1, 0.5);
  geometry.computeVertexNormals();
  return geometry;
}

/** The tail: thick at the root, swelling a touch, then tapering to a soft rounded tip, with a gently fluffy surface. */
export function tailGeometry(curve: CatmullRomCurve3, radius: number) {
  const segments = 48;
  const radial = 14;
  const tube = new TubeGeometry(curve, segments, 1, radial, false);
  const pos = tube.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const v = new Vector3();
  const c = new Color();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const centre = curve.getPointAt(t);
    const tip = t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1;
    const base = radius * (0.85 + 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * tip + 0.0005;
    c.copy(TAIL).lerp(TAIL_TIP, smoothstep(0.78, 0.9, t));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const fluff = 1 + 0.06 * Math.sin((j / radial) * Math.PI * 2 * 5 + t * 30);
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(base * fluff).add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
      colours.set([c.r, c.g, c.b], k * 3);
    }
  }
  tube.setAttribute('color', new Float32BufferAttribute(colours, 3));
  tube.computeVertexNormals();
  return tube;
}

/** A soft paw: a rounded bean, flat underneath, with gentle toe bumps at the front. */
export function pawGeometry() {
  const sphere = new SphereGeometry(1, 22, 16);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const geometry = mergeVertices(sphere);
  const pos = geometry.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (p.y < 0) p.y *= 0.45;
    const front = smoothstep(0.3, 0.9, p.z);
    p.y += 0.12 * front * Math.max(0, Math.cos(p.x * Math.PI * 1.5)) * smoothstep(-0.2, 0.4, p.y);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  paint(geometry, (_, out) => out.copy(PAWS));
  geometry.computeVertexNormals();
  return geometry;
}
