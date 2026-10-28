import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  NoColorSpace,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ContactShadow } from './ContactShadow';
import { materials } from './materials';
import { seededRandom } from './textures';

/*
 * A stylised Monstera deliciosa built from real geometry, not painted cards.
 *
 * Each half-blade is parameterised by (y0, a): y0 is where a lateral vein leaves the midrib
 * (0 = petiole, 1 = tip) and a runs along that vein from the midrib (0) to the margin (1).
 * Splits and holes are gaps in y0 whose width varies with a, so they follow the veins' curves,
 * open and close softly, and leave clean, smooth edges. The blade is arched, cupped, grooved
 * along the midrib and rippled in 3D; (a, y0) doubles as its UVs, so the surface texture's
 * fine veins run parallel to the lateral veins on every leaf.
 */

// ---------------------------------------------------------------------------------------------
// Leaf outline (leaf space: x across, y along the midrib from the petiole at 0 to the tip at 1).

const BASE_Y = -0.2;

interface Gap {
  centre: number;
  /** Half-width (in y0) at position a along the vein. */
  width: (a: number) => number;
  /** Splits reach the margin, so the lobes either side get rounded corners. */
  reachesMargin: boolean;
}

interface LeafShape {
  width: number;
  arch: number;
  cup: number;
  wave: number;
  phase: number;
  sides: [Gap[], Gap[]];
}

/** Half-width of the blade at height y: rounded basal lobes, widest below the middle, a soft point. */
function halfWidth(y: number, shape: LeafShape) {
  const s = Math.min(1, Math.max(0, (y - BASE_Y) / (1 - BASE_Y)));
  return shape.width * 0.56 * Math.sin(Math.PI * (0.1 + 0.9 * s)) ** 0.62 * (1 - 0.22 * s);
}

/** Where the vein leaving the midrib at y0 meets the margin: back towards the base for the basal lobes, towards the tip above. */
const veinEnd = (y0: number) => y0 + 0.12 * Math.sin(Math.PI * y0) + BASE_Y * (1 - y0) ** 3;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type LeafKind = 'mature' | 'split' | 'young';

/** A few soft, curved splits per side (and on mature leaves, maybe one small hole). */
function sideGaps(kind: LeafKind, rand: () => number): Gap[] {
  if (kind === 'young') return [];
  const count = kind === 'mature' ? 3 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);
  const gaps: Gap[] = [];
  const span = 0.72 / count;
  for (let i = 0; i < count; i++) {
    const centre = 0.16 + span * (i + 0.5) + (rand() - 0.5) * span * 0.3;
    const inner = kind === 'mature' ? 0.18 + rand() * 0.18 : 0.45 + rand() * 0.15;
    const w = Math.min(span * 0.2, 0.016 + rand() * 0.012);
    // Hairline at a rounded inner end, easing wider out to the margin: a soft wedge, not a slot.
    gaps.push({ centre, width: (a) => w * smoothstep(inner, 1, a) ** 0.7, reachesMargin: true });
  }
  for (let i = 0; kind === 'mature' && i < count - 1; i++) {
    if (rand() < 0.45) continue;
    const centre = (gaps[i].centre + gaps[i + 1].centre) / 2;
    const a0 = 0.1 + rand() * 0.05;
    const a1 = a0 + 0.14;
    const w = 0.009;
    gaps.push({ centre, width: (a) => (a > a0 && a < a1 ? w * Math.sin((Math.PI * (a - a0)) / (a1 - a0)) : 0), reachesMargin: false });
  }
  return gaps.sort((p, q) => p.centre - q.centre);
}

function leafShape(kind: LeafKind, seed: number): LeafShape {
  const rand = seededRandom(seed);
  return {
    width: kind === 'young' ? 0.92 + rand() * 0.1 : 1.0 + rand() * 0.1,
    arch: 0.16 + rand() * 0.12,
    cup: 0.2 + rand() * 0.08,
    wave: 0.015 + rand() * 0.015,
    phase: rand() * 6,
    sides: [sideGaps(kind, rand), sideGaps(kind, rand)],
  };
}

/** Blade surface height at leaf-space (x, y): arch, cup, a shallow groove down the midrib, and a margin ripple. */
function bladeZ(x: number, y: number, side: number, shape: LeafShape) {
  const groove = -0.012 * Math.exp(-((x / 0.025) ** 2)) * (1 - smoothstep(0.2, 0.95, y));
  return -shape.arch * y * y - shape.cup * Math.abs(x) ** 1.2 + groove + shape.wave * x * x * 4 * Math.sin(9 * y + shape.phase + side * 1.3);
}

const MIDRIB = new Color('#B9D3A1');

/** One leaf's blade as a smooth, welded mesh with vertex colours and (a, y0) UVs. Each seed gives a different leaf. */
function leafGeometry(kind: LeafKind, seed: number, base: Color) {
  const shape = leafShape(kind, seed);
  const A = 16;
  const COLUMNS = 60;
  const parts: BufferGeometry[] = [];
  const colour = new Color();

  shape.sides.forEach((gaps, sideIndex) => {
    const side = sideIndex === 0 ? 1 : -1;
    // Lateral veins run down the middle of each lobe (between consecutive splits).
    const bounds = [0, ...gaps.filter((g) => g.reachesMargin).map((g) => g.centre), 1];
    const veins = bounds.slice(0, -1).map((b, i) => (b + bounds[i + 1]) / 2);

    // Strips of blade between consecutive gaps (and the two ends of the y0 range).
    const edges: Gap[] = [{ centre: 0, width: () => 0, reachesMargin: false }, ...gaps, { centre: 1, width: () => 0, reachesMargin: false }];
    for (let k = 0; k < edges.length - 1; k++) {
      const lo = edges[k];
      const hi = edges[k + 1];
      const B = Math.max(2, Math.round(COLUMNS * (hi.centre - lo.centre)));
      const positions: number[] = [];
      const colours: number[] = [];
      const uvs: number[] = [];
      for (let i = 0; i <= A; i++) {
        const a = i / A;
        const left = lo.centre + lo.width(a);
        const right = hi.centre - hi.width(a);
        for (let j = 0; j <= B; j++) {
          const b = j / B;
          const y0 = left + (right - left) * b;
          // Round off the lobe corners either side of a split, out at the margin.
          const nearLo = lo.reachesMargin ? Math.max(0, 1 - b * 2.2) ** 2 : 0;
          const nearHi = hi.reachesMargin ? Math.max(0, 1 - (1 - b) * 2.2) ** 2 : 0;
          const ae = a * (1 - 0.24 * Math.max(nearLo, nearHi) * a * a);
          const y = y0 + (veinEnd(y0) - y0) * ae ** 1.25;
          const x = side * ae ** 0.95 * halfWidth(y, shape);
          // Lateral veins are faintly raised along their length.
          const vein = Math.max(...veins.map((v) => Math.exp(-(((y0 - v) / 0.014) ** 2)))) * smoothstep(0.04, 0.3, a) * (1 - 0.6 * a);
          positions.push(x, y, bladeZ(x, y, side, shape) + 0.0015 * vein);
          uvs.push(a, y0);

          const rib = Math.exp(-((x / 0.022) ** 2));
          const shade = 1 - 0.08 * a * a - 0.05 * (1 - smoothstep(0, 0.3, y0)) + 0.03 * vein;
          colour.copy(base).multiplyScalar(shade).lerp(MIDRIB, 0.35 * rib);
          colours.push(colour.r, colour.g, colour.b);
        }
      }
      const index: number[] = [];
      for (let i = 0; i < A; i++) {
        for (let j = 0; j < B; j++) {
          const p = i * (B + 1) + j;
          const q = p + B + 1;
          // Mirror the winding on the left half so both halves face the same way.
          if (side > 0) index.push(p, q, p + 1, p + 1, q, q + 1);
          else index.push(p, p + 1, q, p + 1, q + 1, q);
        }
      }
      const strip = new BufferGeometry();
      strip.setAttribute('position', new Float32BufferAttribute(positions, 3));
      strip.setAttribute('color', new Float32BufferAttribute(colours, 3));
      strip.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      strip.setIndex(index);
      parts.push(strip);
    }
  });
  // Weld strips along the midrib and wherever gaps close, so normals are smooth across the blade.
  const geometry = mergeVertices(mergeGeometries(parts), 1e-5);
  geometry.computeVertexNormals();
  return { geometry, shape };
}

// ---------------------------------------------------------------------------------------------
// Leaf surface texture. In UV space u runs out along the veins and v across them, so the fine
// parallel veins between the laterals are horizontal lines here.

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Bump: fine parallel veins (slightly wavy, occasionally branching) over a soft, uneven surface. */
function leafBump() {
  const w = 256;
  const h = 1024;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const rand = seededRandom(41);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const g = 110 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgba(${g}, ${g}, ${g}, 0.25)`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 3 + rand() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 36; i++) {
    const y = (i + rand() * 0.6) * (h / 36);
    ctx.strokeStyle = `rgba(150, 150, 150, ${0.25 + rand() * 0.15})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2 + (x / w) * 6);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = NoColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Colour: near-white with faint mottling and paler fine veins; it multiplies each leaf's vertex colours. */
function leafTint() {
  const w = 256;
  const h = 1024;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const rand = seededRandom(43);
  ctx.fillStyle = '#F4F4F4';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const g = 225 + Math.floor(rand() * 30);
    ctx.fillStyle = `rgba(${g}, ${g + 5 > 255 ? 255 : g + 5}, ${g - 8}, 0.35)`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 10 + rand() * 30, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(255, 255, 240, 0.22)';
  const rv = seededRandom(41);
  for (let i = 0; i < 36; i++) {
    const y = (i + rv() * 0.6) * (h / 36);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2 + (x / w) * 6);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------------------------
// Arrangement.

interface Leaf {
  kind: LeafKind;
  size: number;
  /** Direction the leaf faces, radians round the pot (0 = +x; the overview camera is at about −1). */
  azimuth: number;
  /** Blade angle from horizontal: negative leans the tip down and out. */
  lift: number;
  /** Twist about the blade's own axis, to turn some leaves sideways. */
  roll: number;
  /** Where the petiole meets the blade: distance out from the pot's centre and height above the floor. */
  reach: number;
  height: number;
  color: string;
  seed: number;
}

// Grown, not fanned: big leaves low and out, some turned to the camera, some sideways, a couple
// leaning down; young unsplit leaves up top. Kept short towards the back wall (≈ +π/2) and desk (≈ π).
const LEAVES: Leaf[] = [
  { kind: 'mature', size: 0.62, azimuth: -1.2, lift: -0.12, roll: 0.15, reach: 0.18, height: 2.3, color: '#6F9A5E', seed: 11 },
  { kind: 'mature', size: 0.58, azimuth: 0.1, lift: -0.22, roll: -0.25, reach: 0.55, height: 1.95, color: '#5E8550', seed: 12 },
  { kind: 'mature', size: 0.56, azimuth: -2.3, lift: -0.28, roll: 0.3, reach: 0.55, height: 1.7, color: '#729C61', seed: 13 },
  { kind: 'mature', size: 0.54, azimuth: -0.55, lift: -0.18, roll: -0.2, reach: 0.45, height: 1.6, color: '#6B955A', seed: 22 },
  { kind: 'split', size: 0.48, azimuth: 1.0, lift: -0.2, roll: 0.35, reach: 0.3, height: 2.05, color: '#62854F', seed: 15 },
  { kind: 'split', size: 0.46, azimuth: -1.75, lift: -0.15, roll: -0.15, reach: 0.4, height: 1.42, color: '#7BA36A', seed: 14 },
  { kind: 'split', size: 0.44, azimuth: 2.6, lift: -0.25, roll: -0.3, reach: 0.4, height: 1.88, color: '#6E9A5C', seed: 23 },
  { kind: 'young', size: 0.38, azimuth: -0.95, lift: 0.0, roll: 0.25, reach: 0.32, height: 1.15, color: '#78A066', seed: 20 },
  { kind: 'young', size: 0.36, azimuth: 0.6, lift: -0.1, roll: 0.2, reach: 0.3, height: 1.25, color: '#83AA70', seed: 19 },
  { kind: 'young', size: 0.32, azimuth: -2.8, lift: 0.1, roll: 0.1, reach: 0.25, height: 1.05, color: '#86AE73', seed: 17 },
  { kind: 'young', size: 0.28, azimuth: 1.7, lift: 0.2, roll: -0.25, reach: 0.12, height: 2.2, color: '#7BA669', seed: 18 },
];

/** A round ball pot: flat little foot, full sphere-like body, and a small rolled opening. */
const POT = { radius: 0.37, centre: 0.33, foot: 0.21, opening: 0.21, lip: 0.03 };
const POT_TOP = POT.centre + Math.sqrt(POT.radius ** 2 - POT.opening ** 2);
const SOIL_Y = POT_TOP - 0.03;
/** Stems carry a vertex-colour gradient: darker at the soil, fresher green up at the leaf. */
const stemMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
const STEM_BASE = new Color('#4F7444');
const STEM_TOP = new Color('#6E9A5E');
const soilMaterial = new MeshStandardMaterial({ color: '#4E3A2E', roughness: 1 });

/** The round pot, lathed: up from a flat foot round the ball to the opening, over a rolled lip, down to the soil. */
function potGeometry() {
  const { radius, centre, foot, opening, lip } = POT;
  const pts: Vector2[] = [new Vector2(0, 0), new Vector2(foot, 0)];
  const start = Math.asin(-centre / radius);
  const end = Math.acos(opening / radius);
  for (let k = 0; k <= 24; k++) {
    const a = start + ((end - start) * k) / 24;
    pts.push(new Vector2(radius * Math.cos(a), centre + radius * Math.sin(a)));
  }
  for (let k = 1; k <= 8; k++) {
    const a = (Math.PI * k) / 8;
    pts.push(new Vector2(opening - lip + lip * Math.cos(a), POT_TOP + lip * Math.sin(a) * 0.8));
  }
  pts.push(new Vector2(opening - lip * 2.2, SOIL_Y - 0.02));
  return new LatheGeometry(pts, 48);
}

const POT_GEOMETRY = potGeometry();
const UP = new Vector3(0, 1, 0);

/** A tube along `curve` whose radius follows `radius(t)`, coloured from `from` to `to` along its length. */
function shapedTube(curve: CatmullRomCurve3, radius: (t: number) => number, from: Color, to: Color, segments = 36) {
  const radial = 8;
  const tube = new TubeGeometry(curve, segments, 1, radial, false);
  const pos = tube.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const v = new Vector3();
  const c = new Color();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const centre = curve.getPointAt(t);
    const r = radius(t);
    c.copy(from).lerp(to, t);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(r).add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
      colours.set([c.r, c.g, c.b], k * 3);
    }
  }
  tube.setAttribute('color', new Float32BufferAttribute(colours, 3));
  tube.computeVertexNormals();
  return tube;
}

interface Built {
  leaf: BufferGeometry;
  stem: BufferGeometry;
  position: Vector3;
  quaternion: Quaternion;
  size: number;
}

/**
 * Each leaf's petiole is one continuous tube: up out of the soil, arching over, then running on
 * under the blade as its raised midrib and thinning out towards the tip, so stem and leaf read as
 * one piece. A gentle swelling (the geniculum) sits just below the blade.
 */
function buildPlant(): Built[] {
  const rand = seededRandom(23);
  return LEAVES.map((leaf) => {
    const { azimuth, lift, roll, reach, height, size } = leaf;
    const out = new Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    const forward = out.clone().multiplyScalar(Math.cos(lift)).addScaledVector(UP, Math.sin(lift)).normalize();
    const across = new Vector3().crossVectors(UP, forward).normalize().applyAxisAngle(forward, roll);
    let normal = new Vector3().crossVectors(across, forward).normalize();
    if (normal.y < 0) {
      across.negate();
      normal = normal.negate();
    }
    const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, forward, normal));
    const attach = out.clone().multiplyScalar(reach).setY(height);
    const { geometry, shape } = leafGeometry(leaf.kind, leaf.seed, new Color(leaf.color));

    // Midrib path under the blade, in world space: follows the blade's arching surface, just beneath it.
    const toWorld = new Matrix4().compose(attach, quaternion, new Vector3(size, size, size));
    const rib = [0.06, 0.2, 0.38, 0.58, 0.78].map((y) => new Vector3(0, y, bladeZ(0, y, 1, shape) - 0.018).applyMatrix4(toWorld));

    // Up from the soil, bowing its own way, then turning to approach the blade along its midrib.
    const rootAngle = azimuth + (rand() - 0.5) * 1.4;
    const rootR = 0.02 + rand() * 0.07;
    const root = new Vector3(Math.cos(rootAngle) * rootR, SOIL_Y - 0.04, -Math.sin(rootAngle) * rootR);
    const join = attach.clone().addScaledVector(normal, -0.012 * size);
    const lead = 0.1 + size * 0.12;
    const bow = new Vector3(Math.cos(rootAngle + 1.5), 0, -Math.sin(rootAngle + 1.5)).multiplyScalar((rand() - 0.5) * 0.12);
    const approach = join.clone().addScaledVector(forward, -lead).addScaledVector(normal, -0.035);
    const points = [
      root,
      root.clone().lerp(approach, 0.45).add(bow).setY(SOIL_Y + (approach.y - SOIL_Y) * 0.55),
      approach,
      join.clone().addScaledVector(forward, -lead * 0.4).addScaledVector(normal, -0.014),
      join,
      ...rib,
    ];
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    // Where along the tube the blade begins (by arc length), to place the swelling and the taper.
    const lengths = curve.getLengths(400);
    const total = lengths[lengths.length - 1];
    const joinT = (() => {
      const head = new CatmullRomCurve3(points.slice(0, 5), false, 'centripetal').getLength();
      return Math.min(0.95, head / total);
    })();
    const r = 0.008 + size * 0.008;
    const radius = (t: number) => {
      if (t <= joinT) {
        const swell = Math.exp(-(((t - joinT + 0.03) / 0.04) ** 2)) * 0.35;
        return r * (1.15 - 0.25 * (t / joinT) + swell);
      }
      // Under the blade the midrib thins steadily to nothing near the tip.
      return r * 0.9 * (1 - (t - joinT) / (1 - joinT)) ** 0.8 + 0.0008;
    };
    return {
      leaf: geometry,
      stem: shapedTube(curve, radius, STEM_BASE, STEM_TOP),
      position: attach,
      quaternion,
      size,
    };
  });
}

/** A stylised Monstera in a cream pot. Origin: floor under the pot. */
export function Monstera() {
  const plant = useMemo(buildPlant, []);
  const leafMaterial = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, map: leafTint(), bumpMap: leafBump(), bumpScale: 0.45, roughness: 0.46, side: DoubleSide }),
    [],
  );
  useEffect(
    () => () => {
      for (const { leaf, stem } of plant) {
        leaf.dispose();
        stem.dispose();
      }
      leafMaterial.map?.dispose();
      leafMaterial.bumpMap?.dispose();
      leafMaterial.dispose();
    },
    [plant, leafMaterial],
  );
  return (
    <group>
      <ContactShadow position={[0, 0, 0]} size={[0.6, 0.6]} spread={0.26} strength={0.5} shape="round" />
      <mesh geometry={POT_GEOMETRY} material={materials.potMatte} />
      {/* a thin rose band round the pot's widest point */}
      <mesh position-y={POT.centre} rotation-x={Math.PI / 2} material={materials.ceramicRose}>
        <torusGeometry args={[POT.radius - 0.002, 0.01, 8, 56]} />
      </mesh>
      {/* soil, slightly mounded, with a few crumbs */}
      <mesh position-y={SOIL_Y - 0.02} scale={[1, 0.18, 1]} material={soilMaterial}>
        <sphereGeometry args={[POT.opening - POT.lip * 1.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[
        [0.09, 0.05],
        [-0.07, 0.08],
        [0.03, -0.1],
        [-0.1, -0.04],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, SOIL_Y + 0.005, z]} material={soilMaterial}>
          <sphereGeometry args={[0.018, 6, 5]} />
        </mesh>
      ))}

      {plant.map(({ leaf, stem, position, quaternion, size }, i) => (
        <group key={i}>
          <mesh geometry={stem} material={stemMaterial} />
          <mesh geometry={leaf} position={position} quaternion={quaternion} scale={size} material={leafMaterial} />
        </group>
      ))}
    </group>
  );
}
