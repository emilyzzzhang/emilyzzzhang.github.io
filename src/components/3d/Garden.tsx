import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { RoundedBox } from '@react-three/drei';
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  NoColorSpace,
  Quaternion,
  RGBAFormat,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DIORAMA, LAWN_SPAN, PLINTH_SPAN } from '../../config/sceneLayout';
import { sceneColors as c } from '../../config/theme';
import { ContactShadow } from './ContactShadow';
import { grassTurf, materials } from './materials';
import { seededRandom } from './textures';

const { slab, plinth, lawn } = DIORAMA;
const ignoreRaycast = () => null;

/**
 * Cream plinth under the floor slab and the lawn it stands on, planted along its visible edges
 * with beds of roses, tulips, leaf plants and daisies around smooth stones, in a cover of low
 * leafy sprigs over turf that is darker and lusher around the beds.
 */
export function Garden() {
  return (
    <group>
      <Plinth />
      <Lawn />
      <GroundCover />
      <Plantings />
    </group>
  );
}

function Plinth() {
  const [a, b] = PLINTH_SPAN;
  const size = b - a;
  return (
    <RoundedBox
      args={[size, plinth.height, size]}
      radius={0.08}
      smoothness={3}
      position={[(a + b) / 2, -slab - plinth.height / 2, (a + b) / 2]}
      material={materials.plinth}
      raycast={ignoreRaycast}
    />
  );
}

const [lawnMin, lawnMax] = LAWN_SPAN;
const LAWN_CENTRE = (lawnMin + lawnMax) / 2;
const LAWN_HALF = (lawnMax - lawnMin) / 2;
/** Superellipse exponent of the outline (|x|ⁿ + |z|ⁿ = 1): a rounded square. */
const LAWN_ROUNDNESS = 2 / 0.45;
const lawnWobble = (phi: number) => 1 + 0.025 * Math.sin(3 * phi + 0.7) + 0.015 * Math.sin(7 * phi + 2.1);

/**
 * The lawn's outline: a rounded square (superellipse) with a gentle wobble so it reads as an
 * organic patch rather than a tile. Returned in lawn-shape coordinates (x, −z); `inset` pulls it in.
 */
function lawnShape(inset = 0, points = 120) {
  const centre = LAWN_CENTRE;
  const half = LAWN_HALF - inset;
  const shape = new Shape();
  for (let i = 0; i < points; i++) {
    const phi = (i / points) * Math.PI * 2;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const wobble = lawnWobble(phi);
    const x = centre + half * wobble * Math.sign(cos) * Math.abs(cos) ** (2 / LAWN_ROUNDNESS);
    const z = centre + half * wobble * Math.sign(sin) * Math.abs(sin) ** (2 / LAWN_ROUNDNESS);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  shape.closePath();
  return shape;
}

/** True when (x, z) lies inside the lawn's outline, shrunk by `margin` (0–1) to keep clear of its rim. */
function onLawn(x: number, z: number, margin: number) {
  const dx = (x - LAWN_CENTRE) / LAWN_HALF;
  const dz = (z - LAWN_CENTRE) / LAWN_HALF;
  const scale = lawnWobble(Math.atan2(dz, dx)) * (1 - margin);
  return Math.abs(dx / scale) ** LAWN_ROUNDNESS + Math.abs(dz / scale) ** LAWN_ROUNDNESS < 1;
}

const turfDepth = lawn.thickness - lawn.bevel * 2;
// The turf's rounded rim overhangs the soil slightly, like cut turf laid on a base.
const turfGeometry = new ExtrudeGeometry(lawnShape(), {
  depth: turfDepth,
  bevelEnabled: true,
  bevelThickness: lawn.bevel,
  bevelSize: 0.05,
  bevelSegments: 3,
}).rotateX(-Math.PI / 2);
const soilGeometry = new ExtrudeGeometry(lawnShape(0.06), {
  depth: lawn.soil - 0.03,
  bevelEnabled: true,
  bevelThickness: 0.03,
  bevelSize: 0.03,
  bevelSegments: 2,
}).rotateX(-Math.PI / 2);
function Lawn() {
  const turfBottom = lawn.top - lawn.thickness;
  return (
    <group>
      <mesh geometry={turfGeometry} material={turfMaterial} position-y={turfBottom + lawn.bevel} raycast={ignoreRaycast} />
      <mesh geometry={soilGeometry} material={materials.earth} position-y={turfBottom - lawn.soil + 0.03 + 0.005} raycast={ignoreRaycast} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Shared pieces. Every flower, leaf, stone and sprig in the garden is an instance of one of these.

interface Instance {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  color: Color;
}

interface Spot {
  x: number;
  z: number;
  r: number;
}

const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);
const tints = (...hex: string[]) => hex.map((h) => new Color(h));

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Welds a sphere's UV seam (rocks and leaves need no UVs) so normals come out smooth all round. */
function seamless(geometry: BufferGeometry) {
  geometry.deleteAttribute('uv');
  return mergeVertices(geometry);
}

/** Gives a geometry one flat vertex colour, so it can be merged with differently coloured parts. */
function paint(geometry: BufferGeometry, color: Color) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** A stylised rose: a bud wrapped in three rings of cupped petals, merged into one geometry (base at the origin). */
function roseGeometry() {
  const parts: BufferGeometry[] = [];
  const bud = new SphereGeometry(0.5, 10, 8).scale(0.4, 0.55, 0.4).translate(0, 0.16, 0);
  parts.push(bud);
  const ring = (count: number, radius: number, [w, h, d]: [number, number, number], lean: number, y: number, twist: number) => {
    for (let k = 0; k < count; k++) {
      const petal = new SphereGeometry(0.5, 8, 6)
        .scale(w, h, d)
        .translate(0, h / 2, 0)
        .rotateX(lean)
        .translate(0, y, radius)
        .rotateY(twist + (k / count) * Math.PI * 2);
      parts.push(petal);
    }
  };
  ring(5, 0.12, [0.42, 0.5, 0.14], 0.35, 0, 0);
  ring(6, 0.22, [0.5, 0.46, 0.14], 0.8, -0.03, 0.5);
  ring(7, 0.3, [0.52, 0.36, 0.14], 1.15, -0.07, 0.2);
  return mergeGeometries(parts);
}

/** A tulip cup: three outer petals overlapping three inner ones, flaring a touch at the lip (base at the origin). */
function tulipGeometry() {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const inner = k >= 3;
    parts.push(
      new SphereGeometry(0.5, 10, 8)
        .scale(0.36, 0.62, 0.2)
        .translate(0, 0.31, inner ? 0.04 : 0.1)
        .rotateX(inner ? 0.04 : 0.12)
        .rotateY(((k % 3) / 3) * TAU + (inner ? Math.PI / 3 : 0)),
    );
  }
  return mergeGeometries(parts);
}

const DAISY_EYE = new Color('#F3CC76');
const DAISY_PETAL = new Color('#FFFFFF');

/** A small daisy facing +y: a domed golden eye ringed by eight soft petals that cup upwards. */
function daisyGeometry() {
  const parts = [paint(new SphereGeometry(0.5, 10, 6).scale(0.34, 0.2, 0.34).translate(0, 0.05, 0), DAISY_EYE)];
  for (let k = 0; k < 8; k++) {
    const petal = new SphereGeometry(0.5, 6, 4).scale(0.24, 0.06, 0.5).translate(0, 0.02, 0.3).rotateX(-0.2).rotateY((k / 8) * TAU);
    parts.push(paint(petal, DAISY_PETAL));
  }
  return mergeGeometries(parts);
}

/** A low patch of clover: a handful of trefoils on short stalks at different heights. */
function cloverGeometry() {
  const rand = seededRandom(12);
  const parts: BufferGeometry[] = [];
  for (let p = 0; p < 6; p++) {
    const h = 0.03 + rand() * 0.05;
    const a = rand() * TAU;
    const d = p === 0 ? 0 : 0.07 + rand() * 0.1;
    const [px, pz] = [Math.cos(a) * d, Math.sin(a) * d];
    const yaw = rand() * TAU;
    for (let k = 0; k < 3; k++) {
      parts.push(
        new SphereGeometry(0.5, 8, 6)
          .scale(0.11, 0.03, 0.12)
          .translate(0, 0, 0.06)
          .rotateX(-0.25)
          .rotateY(yaw + (k / 3) * TAU)
          .translate(px, h, pz),
      );
    }
    parts.push(new CylinderGeometry(0.007, 0.009, h, 4, 1, true).translate(px, h / 2, pz));
  }
  // Stalks are open cylinders without some of the sphere's attributes; keep only what both share.
  for (const part of parts) part.deleteAttribute('uv');
  return mergeGeometries(parts);
}

const ROSE = roseGeometry();
const TULIP = tulipGeometry();
const DAISY = daisyGeometry();
const CLOVER = cloverGeometry();
/** A leaf lying along +z from its base at the origin. */
const LEAF = new SphereGeometry(0.5, 8, 6).scale(0.28, 0.06, 0.55).translate(0, 0, 0.27);
const BLOB = new SphereGeometry(0.5, 14, 10);
/** A unit stem rising from its root at the origin; instances scale its length and thickness. */
const STEM = new CylinderGeometry(0.4, 0.5, 1, 6, 1, true).translate(0, 0.5, 0);

const PETAL_TINTS = tints(c.pink, c.rose, c.roseDeep, '#F4B5C7');
const BUD_TINTS = tints(c.roseDeep, '#DE8CA6');
const TULIP_TINTS = tints('#F3A9BE', '#F6BCCB', '#EE9DB4', '#F9CBD6');
const DAISY_TINTS = tints('#FFFFFF', '#FFF8EE', '#FCEFEA', '#FBE3E6');
const FOLIAGE_TINTS = tints('#8DB27C', '#7AA36D', '#9CBD86', '#6E9963');
const FOLIAGE_DEEP = new Color('#7AA26C');
const CLOVER_TINTS = tints('#8FB97A', '#7FAE6E', '#9FC487');

// ---------------------------------------------------------------------------------------------
// Smooth stones: soft cream pebbles, sunk a little into the lawn and shaded darker towards the ground.

const ROCK_FOOT = new Color('#D6CCC2');
const ROCK_CROWN = new Color('#FAF6F1');
const ROCK_TINTS = tints('#FFFFFF', '#F8F1E9', '#F1E7DC');

function rockGeometry(seed: number) {
  const rand = seededRandom(seed);
  const [k0, k1, k2] = [rand() * 10, rand() * 10, rand() * 10];
  const geometry = seamless(new SphereGeometry(0.5, 24, 16));
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const tint = new Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    p.multiplyScalar(1 + 0.05 * Math.sin(p.x * 5 + k0) * Math.sin(p.z * 4 + k1) + 0.03 * Math.sin(p.y * 7 + k2));
    // A flat underside, so the stone sits on the lawn instead of balancing on it.
    if (p.y < -0.15) p.y = -0.15 + (p.y + 0.15) * 0.3;
    pos.setXYZ(i, p.x, p.y, p.z);
    tint.copy(ROCK_FOOT).lerp(ROCK_CROWN, smoothstep(-0.18, 0.4, p.y));
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const ROCK_SHAPES = [rockGeometry(5), rockGeometry(8), rockGeometry(13)];

// ---------------------------------------------------------------------------------------------
// Leaf plants: broad, rounded, paddle-shaped leaves fanning out from one root.

const LEAF_BASE = new Color('#5C9159');
const LEAF_TIP = new Color('#A8CF8A');

/** One paddle leaf, 1 unit tall: widest below the middle, a soft point, curling back a little; darker at its root. */
function paddleLeaf(width = 0.62) {
  const geometry = seamless(new SphereGeometry(0.5, 12, 14));
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const tint = new Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const t = p.y + 0.5;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.6 * (1 - 0.25 * t);
    pos.setXYZ(i, p.x * width * w, t, p.z * 0.15 * w + 0.2 * t * t);
    tint.copy(LEAF_BASE).lerp(LEAF_TIP, smoothstep(0.1, 0.9, t));
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A fan of leaves of different heights from one root, splaying outwards like a hosta. */
function leafPlantGeometry(seed: number, count: number) {
  const rand = seededRandom(seed);
  const leaf = paddleLeaf();
  const leaves: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    // The inner leaves stand tall; the outer ones lean out and lower.
    const outer = k >= 3;
    const h = outer ? 0.55 + rand() * 0.25 : 0.8 + rand() * 0.25;
    leaves.push(
      leaf
        .clone()
        .scale(h, h, h)
        .rotateX(-(outer ? 0.8 + rand() * 0.3 : 0.3 + rand() * 0.25))
        .rotateY((k / count) * TAU + rand() * 0.6)
        .translate((rand() - 0.5) * 0.08, 0, (rand() - 0.5) * 0.08),
    );
  }
  return mergeGeometries(leaves);
}

const PLANT_SHAPES = [leafPlantGeometry(3, 5), leafPlantGeometry(4, 6), leafPlantGeometry(6, 7)];
const PLANT_TINTS = tints('#FFFFFF', '#EAF3E2', '#F4F8E8', '#DDEBD2');
/** Narrow strap leaves for the tulips. */
const STRAP_LEAF = paddleLeaf(0.3);

// ---------------------------------------------------------------------------------------------
// Planting plan. Plants gather in beds along the two edges the camera sees, with open lawn between,
// so the garden reads as grown rather than scattered. Each bed has a feature (roses, tulips or a big
// leaf plant), often a stone beside it, leafy backing towards the plinth and low daisies and clover
// spilling out towards the lawn's edge.

type Feature = 'roses' | 'tulips' | 'leafy';

interface Bed {
  x: number;
  z: number;
  /** Overall scale; 1 ≈ a bed 1.2 units across. */
  size: number;
  feature: Feature;
  /** Half-width of the stone beside the feature, if it has one. */
  rock?: number;
}

const [plinthMin, plinthMax] = PLINTH_SPAN;
/** Middle of the visible lawn bands, between the plinth and the lawn's edge. */
const band = (plinthMax + lawnMax) / 2;

const BEDS: Bed[] = [
  { x: -4.3, z: band, size: 0.8, feature: 'leafy', rock: 0.24 },
  { x: -2.6, z: band, size: 0.9, feature: 'tulips', rock: 0.4 },
  { x: -0.9, z: band, size: 1.05, feature: 'roses' },
  { x: 1.0, z: band, size: 0.85, feature: 'leafy', rock: 0.32 },
  { x: 2.7, z: band, size: 0.9, feature: 'tulips' },
  { x: 4.55, z: 4.55, size: 1.2, feature: 'roses', rock: 0.28 },
  { x: band, z: 2.6, size: 0.9, feature: 'leafy', rock: 0.42 },
  { x: band, z: 0.8, size: 1, feature: 'roses' },
  { x: band, z: -1.0, size: 0.85, feature: 'tulips', rock: 0.25 },
  { x: band, z: -2.8, size: 0.95, feature: 'roses', rock: 0.36 },
  { x: band, z: -4.4, size: 0.75, feature: 'leafy' },
];

/** True inside the plinth's footprint grown by `r`. */
const underPlinth = (x: number, z: number, r: number) => x > plinthMin - r && x < plinthMax + r && z > plinthMin - r && z < plinthMax + r;
const inside = (x: number, z: number, spots: Spot[], reach: number) => spots.some((s) => (x - s.x) ** 2 + (z - s.z) ** 2 < (s.r * reach) ** 2);

interface Shadow {
  x: number;
  z: number;
  size: number;
  strength: number;
}

function plantGarden() {
  const rand = seededRandom(31);
  const range = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const uniform = (s: number) => new Vector3(s, s, s);
  const align = new Quaternion();
  const spin = new Quaternion();

  const rocks: Instance[][] = ROCK_SHAPES.map(() => []);
  const plants: Instance[][] = PLANT_SHAPES.map(() => []);
  const cores: Instance[] = [];
  const leaves: Instance[] = [];
  const stems: Instance[] = [];
  const roses: Instance[] = [];
  const tulips: Instance[] = [];
  const straps: Instance[] = [];
  const daisies: Instance[] = [];
  const clover: Instance[] = [];
  const petals: Instance[] = [];
  const shadows: Shadow[] = [];
  /** Footprints of everything big enough that nothing else should grow through it. */
  const solid: Spot[] = [];

  /** Claims room for something `r` across near (x, z), nudging it about a little if needed. */
  const settle = (x: number, z: number, r: number, jitter = 0.12): [number, number] | null => {
    for (let i = 0; i < 10; i++) {
      const px = x + (i ? range(-jitter, jitter) : 0);
      const pz = z + (i ? range(-jitter, jitter) : 0);
      const crowded = solid.some((s) => (px - s.x) ** 2 + (pz - s.z) ** 2 < (r + s.r) ** 2 * 0.75);
      if (onLawn(px, pz, 0.05) && !underPlinth(px, pz, r * 0.9) && !crowded) {
        solid.push({ x: px, z: pz, r });
        return [px, pz];
      }
    }
    return null;
  };
  /** Whether a small plant can grow at (x, z): on the lawn, and not inside anything solid. */
  const free = (x: number, z: number) => onLawn(x, z, 0.03) && !underPlinth(x, z, 0.05) && !inside(x, z, solid, 0.8);

  /** A thin stem from `root` along `dir`; returns its tip. */
  const stem = (root: Vector3, dir: Vector3, length: number, thickness: number) => {
    align.setFromUnitVectors(UP, dir);
    stems.push({ position: root, rotation: new Euler().setFromQuaternion(align), scale: new Vector3(thickness, length, thickness), color: pick(FOLIAGE_TINTS) });
    return root.clone().addScaledVector(dir, length);
  };
  /** A flower head at `tip`, facing `dir` and spun about it. */
  const bloom = (list: Instance[], tip: Vector3, dir: Vector3, size: number, palette: Color[]) => {
    align.setFromUnitVectors(UP, dir.clone().normalize());
    spin.setFromAxisAngle(UP, rand() * TAU);
    list.push({ position: tip, rotation: new Euler().setFromQuaternion(align.clone().multiply(spin)), scale: uniform(size), color: pick(palette) });
  };

  let rockCount = 0;
  const rock = (x: number, z: number, size: number) => {
    const at = settle(x, z, size * 0.9, 0.08);
    if (!at) return;
    const height = size * 2 * range(0.55, 0.72);
    rocks[rockCount++ % rocks.length].push({
      // Sunk a little, so it looks bedded into the soil rather than set down on the grass.
      position: new Vector3(at[0], lawn.top + height * 0.07, at[1]),
      rotation: new Euler(range(-0.06, 0.06), rand() * TAU, range(-0.08, 0.08)),
      scale: new Vector3(size * 2 * range(1.05, 1.25), height, size * 2 * range(0.9, 1)),
      color: pick(ROCK_TINTS),
    });
    if (size > 0.15) shadows.push({ x: at[0], z: at[1], size: size * 2.1, strength: 0.42 });
  };

  /** A rounded mound of leaves with roses nestled into it and a couple standing proud on stems. */
  const roseBush = (x: number, z: number, size: number) => {
    const r = 0.38 * size;
    const at = settle(x, z, r * 1.1);
    if (!at) return;
    const [cx, cz] = at;
    cores.push({ position: new Vector3(cx, lawn.top + r * 0.25, cz), rotation: new Euler(0, rand() * TAU, 0), scale: new Vector3(r * 1.35, r * 0.95, r * 1.35), color: FOLIAGE_DEEP });
    const onDome = (a: number, e: number, lift = 0) =>
      new Vector3(cx + Math.cos(e) * Math.sin(a) * r * 0.8, lawn.top + 0.03 + Math.sin(e) * r * 0.9 + lift, cz + Math.cos(e) * Math.cos(a) * r * 0.8);
    for (let i = Math.round(48 * size); i > 0; i--) {
      const a = rand() * TAU;
      const e = range(-0.05, 1.35);
      leaves.push({ position: onDome(a, e), rotation: new Euler(0.25 - e * 0.6, a, range(-0.3, 0.3), 'YXZ'), scale: uniform(range(0.14, 0.2) * size), color: pick(FOLIAGE_TINTS) });
    }
    const count = Math.round(3 + 4 * size);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + range(-0.4, 0.4);
      const e = range(0.45, 1.3);
      const lift = i < 2 ? range(0.1, 0.2) * size : 0;
      const pos = onDome(a, e, lift);
      if (lift) stem(pos.clone().setY(pos.y - lift - 0.05), UP, lift + 0.05, 0.022);
      // Half-way between straight up and out of the bush, so the open faces show.
      const facing = new Vector3(Math.sin(a), 1 + Math.sin(e), Math.cos(a));
      bloom(roses, pos, facing, range(0.17, 0.22) * size, PETAL_TINTS);
    }
    for (let i = 0; i < 2; i++) bloom(roses, onDome(rand() * TAU, range(0.3, 1)), UP.clone(), 0.08 * size, BUD_TINTS);
    shadows.push({ x: cx, z: cz, size: r * 2.6, strength: 0.45 });
    // A few dropped petals on the grass around it.
    for (let i = 0; i < 4; i++) {
      const a = rand() * TAU;
      const d = r * range(1.2, 2.2);
      const [px, pz] = [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
      if (!free(px, pz)) continue;
      petals.push({ position: new Vector3(px, lawn.top + 0.004, pz), rotation: new Euler(range(-0.2, 0.2), rand() * TAU, 0), scale: new Vector3(0.045, 0.01, 0.035), color: pick(PETAL_TINTS) });
    }
  };

  /** A little group of tulips on tall stems, each with a pair of strap leaves. */
  const tulipGroup = (x: number, z: number, size: number, count: number) => {
    const at = settle(x, z, 0.2 * size);
    if (!at) return;
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const d = i ? range(0.06, 0.15) * size : 0;
      const root = new Vector3(at[0] + Math.cos(a) * d, lawn.top - 0.01, at[1] + Math.sin(a) * d);
      const length = range(0.38, 0.58) * size;
      const dir = new Vector3(range(-0.15, 0.15), 1, range(-0.15, 0.15)).normalize();
      const tip = stem(root, dir, length, 0.022);
      bloom(tulips, tip.addScaledVector(dir, -0.01), dir, range(0.3, 0.36) * size, TULIP_TINTS);
      for (let k = 0; k < 2; k++) {
        straps.push({ position: root, rotation: new Euler(range(0.25, 0.55), a + k * Math.PI + range(-0.5, 0.5), 0, 'YXZ'), scale: uniform(length * range(0.6, 0.8)), color: pick(PLANT_TINTS) });
      }
    }
    shadows.push({ x: at[0], z: at[1], size: 0.4 * size, strength: 0.32 });
  };

  const leafPlant = (x: number, z: number, size: number) => {
    const at = settle(x, z, size * 0.38);
    if (!at) return;
    plants[Math.floor(rand() * plants.length)].push({
      position: new Vector3(at[0], lawn.top - 0.02, at[1]),
      rotation: new Euler(0, rand() * TAU, 0),
      scale: new Vector3(size, size * range(0.9, 1.15), size),
      color: pick(PLANT_TINTS),
    });
    shadows.push({ x: at[0], z: at[1], size: size * 0.8, strength: 0.32 });
  };

  /** A loose clump of daisies on short stems, nodding a little towards the camera. */
  const daisyClump = (x: number, z: number, count: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      const [px, pz] = [x + range(-spread, spread), z + range(-spread, spread)];
      if (!free(px, pz)) continue;
      const dir = new Vector3(range(-0.25, 0.25), 1, range(-0.25, 0.25)).normalize();
      const root = new Vector3(px, lawn.top - 0.01, pz);
      const tip = stem(root, dir, range(0.1, 0.24), 0.014);
      bloom(daisies, tip, dir.clone().add(new Vector3(0.25, 0, 0.25)), range(0.1, 0.13), DAISY_TINTS);
      leaves.push({ position: root, rotation: new Euler(range(0.3, 0.7), rand() * TAU, 0, 'YXZ'), scale: uniform(range(0.08, 0.11)), color: pick(FOLIAGE_TINTS) });
    }
  };

  const cloverPatch = (x: number, z: number) => {
    if (!free(x, z)) return;
    clover.push({ position: new Vector3(x, lawn.top - 0.005, z), rotation: new Euler(0, rand() * TAU, 0), scale: uniform(range(0.95, 1.3)), color: pick(CLOVER_TINTS) });
  };

  for (const { x, z, size, feature, rock: stone } of BEDS) {
    // Work in the bed's own frame: `out` points away from the plinth, `along` runs beside it.
    const nx = x > plinthMax ? 1 : 0;
    const nz = z > plinthMax ? 1 : 0;
    const nl = Math.hypot(nx, nz);
    const spot = (along: number, out: number): [number, number] => [x - (nz / nl) * along + (nx / nl) * out, z + (nx / nl) * along + (nz / nl) * out];
    const side = rand() < 0.5 ? -1 : 1;

    if (stone) {
      rock(...spot(side * 0.3 * size, 0.08), stone);
      // A pebble or two beside the stone.
      for (let i = rand() < 0.6 ? 2 : 1; i > 0; i--) rock(...spot(side * (0.3 * size + stone + range(0.02, 0.12)), range(0.05, 0.3)), range(0.06, 0.12));
    }
    const centre = stone ? -side * 0.25 * size : 0;
    if (feature === 'roses') roseBush(...spot(centre, -0.12), size);
    else if (feature === 'tulips') tulipGroup(...spot(centre, -0.1), size, 3 + Math.floor(rand() * 3));
    else leafPlant(...spot(centre, -0.15), range(0.8, 0.95) * size);

    // Leafy backing: taller plants towards the plinth, so the bed steps down towards the camera.
    leafPlant(...spot(range(-0.6, 0.6) * size, -0.25), range(0.5, 0.65) * size);
    if (size > 0.85) leafPlant(...spot(range(-0.7, 0.7) * size, range(-0.2, 0.1)), range(0.4, 0.52) * size);
    if (feature !== 'tulips' && rand() < 0.5) tulipGroup(...spot(range(-0.6, 0.6) * size, range(-0.1, 0.15)), 0.8, 2);

    // Low daisies and clover spill out in front.
    for (let i = 0; i < 2; i++) daisyClump(...spot(range(-0.7, 0.7) * size, range(0.12, 0.45)), 3 + Math.floor(rand() * 3), 0.14);
    for (let i = 0; i < 3; i++) cloverPatch(...spot(range(-0.8, 0.8) * size, range(0.15, 0.5)));
  }

  // A few strays out in the open lawn, so the beds feel seeded rather than placed.
  for (let i = 0; i < 40; i++) {
    const along = range(lawnMin + 0.3, lawnMax - 0.3);
    const out = range(plinthMax + 0.15, lawnMax - 0.2);
    const [x, z] = rand() < 0.5 ? [along, out] : [out, along];
    if (rand() < 0.6) daisyClump(x, z, 1 + Math.floor(rand() * 2), 0.08);
    else cloverPatch(x, z);
  }

  // Planted last, so everything above keeps its place: small leaf plants at the beds' fringes and
  // drifts of daisies straying out of them, so the beds melt into the lawn.
  for (const { x, z, size } of BEDS) {
    const away = (d: number): [number, number] => [x + (x > plinthMax ? d : range(-0.8, 0.8) * size), z + (z > plinthMax ? d : range(-0.8, 0.8) * size)];
    if (rand() < 0.75) leafPlant(...away(range(0.25, 0.45)), range(0.28, 0.4));
    daisyClump(...away(range(0.3, 0.55)), 2 + Math.floor(rand() * 2), 0.18);
  }
  for (let i = 0; i < 30; i++) {
    const along = range(lawnMin + 0.3, lawnMax - 0.3);
    const out = range(plinthMax + 0.15, lawnMax - 0.2);
    const [x, z] = rand() < 0.5 ? [along, out] : [out, along];
    daisyClump(x, z, 1, 0.05);
  }

  return { rocks, plants, cores, leaves, stems, roses, tulips, straps, daisies, clover, petals, shadows, solid };
}

// Planted once at module load, so the grass can grow up around everything.
const GARDEN = plantGarden();

/** 1 in the heart of a bed, falling to 0 out in the open lawn: the grass grows taller and darker there. */
function lushness(x: number, z: number) {
  let lush = 0;
  for (const bed of BEDS) {
    const d = Math.hypot(x - bed.x, z - bed.z);
    lush = Math.max(lush, 1 - smoothstep(0.3 * bed.size, 1.1 * bed.size, d));
  }
  return lush;
}

// ---------------------------------------------------------------------------------------------
// Lawn colour: soft drifts painted across the whole lawn, deeper and lusher around the beds and
// paler out in the open, so the turf's tiled blades never read as one flat colour.

/** Lawn-wide tint, as a multiplier on the turf's own colour (0.5 in the texture = unchanged). */
function lawnTint() {
  const size = 256;
  const span = lawnMax - lawnMin;
  const open = [1.07, 1.05, 0.97];
  const deep = [0.84, 0.91, 0.83];
  const factors = new Float32Array(size * size * 3);
  const mean = [0, 0, 0];
  let counted = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = lawnMin + ((i + 0.5) / size) * span;
      const z = lawnMin + ((j + 0.5) / size) * span;
      // The same lushness the beds use, plus slow drifts across the open lawn so it never looks mown.
      const drift = 0.5 + 0.5 * Math.sin(x * 1.7 + 1.3) * Math.sin(z * 1.9 + 0.4);
      const lush = Math.max(lushness(x, z), drift * 0.45);
      const mottle = 1 + 0.035 * Math.sin(x * 4.3 + z * 1.1) * Math.sin(z * 3.9 - x * 0.7) + 0.02 * Math.sin(x * 11.7 + 2) * Math.sin(z * 10.3);
      for (let ch = 0; ch < 3; ch++) {
        const f = (open[ch] + (deep[ch] - open[ch]) * lush) * mottle;
        factors[(j * size + i) * 3 + ch] = f;
        if (onLawn(x, z, 0) && !underPlinth(x, z, 0)) mean[ch] += f;
      }
      if (onLawn(x, z, 0) && !underPlinth(x, z, 0)) counted++;
    }
  }
  // Normalised over the visible lawn, so the drifts vary the turf without shifting its average colour.
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < size * size; k++) {
    for (let ch = 0; ch < 3; ch++) data[k * 4 + ch] = Math.round(Math.min(1, (factors[k * 3 + ch] / (mean[ch] / counted)) * 0.5) * 255);
    data[k * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = NoColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** The turf: tiled blades (extrude UVs are world units on the caps, like RoundedBox) under the lawn-wide tint. */
const turfMaterial = (() => {
  const material = grassTurf(c.grass);
  const tint = lawnTint();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.lawnTint = { value: tint };
    shader.uniforms.lawnOrigin = { value: new Vector2(lawnMin, lawnMin) };
    shader.uniforms.lawnSpan = { value: lawnMax - lawnMin };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLawn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLawn = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D lawnTint;\nuniform vec2 lawnOrigin;\nuniform float lawnSpan;\nvarying vec2 vLawn;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(lawnTint, (vLawn - lawnOrigin) / lawnSpan).rgb * 2.0;');
  };
  return material;
})();

// ---------------------------------------------------------------------------------------------
// Ground cover: little sprigs of leaves scattered over the lawn, thickest around the beds, so it
// reads as a living lawn, not paint. Each leaf is a pointed blade folded along its midrib, 8
// triangles, so hundreds of sprigs cost less than a few flowers.

/** One leaf, 1 unit long along +z from its root, `width` across, folded up along its midrib. */
function sprigLeaf(width: number) {
  const w = width / 2;
  // Root, a row of three across a third of the way out, three more two thirds out, and the tip.
  const points = [0, 0, 0, -w, 0, 0.3, 0, 0.035, 0.3, w, 0, 0.3, -w * 0.75, 0, 0.66, 0, 0.03, 0.66, w * 0.75, 0, 0.66, 0, 0, 1];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  // Wound to face up, so the leaves show from above.
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 4, 7, 5, 5, 7, 6]);
  geometry.computeVertexNormals();
  return geometry;
}

/** A sprig of `count` leaves from one root, tilted up between `lift` radians and a little more. */
function sprigGeometry(seed: number, count: number, width: number, [liftMin, liftMax]: [number, number]) {
  const rand = seededRandom(seed);
  const leaves: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    const length = 0.75 + rand() * 0.35;
    leaves.push(
      sprigLeaf(width)
        .scale(length, length, length)
        .rotateX(-(liftMin + rand() * (liftMax - liftMin)))
        .rotateY((k / count) * TAU + rand() * 0.5),
    );
  }
  return mergeGeometries(leaves);
}

/** Low, spreading rosettes, and younger shoots standing more upright. */
const SPRIG_LOW = sprigGeometry(41, 5, 0.42, [0.2, 0.45]);
const SPRIG_UP = sprigGeometry(42, 4, 0.28, [0.75, 1.05]);
const SPRIG_COUNT = 480;
const OPEN_TINTS = tints('#B2CC93', '#A8C68A', '#BBD39C', '#A0C084');
const LUSH_TINTS = tints('#8EB476', '#81AA6C', '#98BB7F', '#A3C389');

function GroundCover() {
  const [low, up] = useMemo(() => {
    const rand = seededRandom(17);
    const low: Instance[] = [];
    const up: Instance[] = [];
    let guard = 0;
    while (low.length + up.length < SPRIG_COUNT && guard++ < SPRIG_COUNT * 40) {
      const x = lawnMin + rand() * (lawnMax - lawnMin);
      const z = lawnMin + rand() * (lawnMax - lawnMin);
      if (underPlinth(x, z, 0.01)) continue;
      // Sprigs grow up against the bases of stones and plants, hiding where they meet the lawn.
      if (!onLawn(x, z, 0.015) || inside(x, z, GARDEN.solid, 0.85)) continue;
      const drift = 0.5 + 0.5 * Math.sin(x * 1.7 + 1.3) * Math.sin(z * 1.9 + 0.4);
      const lush = Math.max(lushness(x, z), drift * 0.45);
      // Thicker around the beds, sparse out in the open.
      if (rand() > 0.25 + 0.75 * lush) continue;
      const s = 0.07 + lush * 0.04 + rand() * 0.04;
      (rand() < 0.35 + lush * 0.3 ? up : low).push({
        position: new Vector3(x, lawn.top - 0.004, z),
        rotation: new Euler(0, rand() * TAU, 0),
        scale: new Vector3(s, s * (0.8 + lush * 0.4), s),
        color: (rand() < lush ? LUSH_TINTS : OPEN_TINTS)[Math.floor(rand() * 4)],
      });
    }
    return [low, up];
  }, []);
  // Too small to cast a meaningful shadow; skipping the shadow pass keeps hundreds of sprigs cheap.
  return (
    <>
      <InstancedGroup geometry={SPRIG_LOW} instances={low} material={materials.foliage} noShadow />
      <InstancedGroup geometry={SPRIG_UP} instances={up} material={materials.foliage} noShadow />
    </>
  );
}

function Plantings() {
  const g = GARDEN;
  return (
    <group>
      {ROCK_SHAPES.map((geometry, i) => (
        <InstancedGroup key={`rock${i}`} geometry={geometry} instances={g.rocks[i]} material={materials.rock} />
      ))}
      {PLANT_SHAPES.map((geometry, i) => (
        <InstancedGroup key={`plant${i}`} geometry={geometry} instances={g.plants[i]} material={materials.plant} />
      ))}
      <InstancedGroup geometry={BLOB} instances={g.cores} material={materials.foliage} />
      <InstancedGroup geometry={LEAF} instances={g.leaves} material={materials.foliage} />
      <InstancedGroup geometry={STEM} instances={g.stems} material={materials.foliage} />
      <InstancedGroup geometry={ROSE} instances={g.roses} material={materials.petal} />
      <InstancedGroup geometry={TULIP} instances={g.tulips} material={materials.petal} />
      <InstancedGroup geometry={STRAP_LEAF} instances={g.straps} material={materials.plant} />
      <InstancedGroup geometry={DAISY} instances={g.daisies} material={materials.plant} noShadow />
      <InstancedGroup geometry={CLOVER} instances={g.clover} material={materials.foliage} noShadow />
      <InstancedGroup geometry={BLOB} instances={g.petals} material={materials.petal} noShadow />
      {g.shadows.map(({ x, z, size, strength }) => (
        <ContactShadow key={`${x},${z}`} position={[x, lawn.top, z]} size={[size, size * 0.92]} spread={0.14} strength={strength} shape="round" />
      ))}
    </group>
  );
}

/** Applies instance transforms and tints once; the garden never moves. */
function useInstances(mesh: RefObject<InstancedMesh | null>, instances: Instance[]) {
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new Matrix4();
    const q = new Quaternion();
    instances.forEach(({ position, rotation, scale, color }, i) => {
      m.setMatrixAt(i, matrix.compose(position, q.setFromEuler(rotation), scale));
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [mesh, instances]);
}

function InstancedGroup({ geometry, instances, material, noShadow = false }: { geometry: BufferGeometry; instances: Instance[]; material: Material; noShadow?: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  useInstances(mesh, instances);
  return <instancedMesh ref={mesh} args={[geometry, material, instances.length]} raycast={ignoreRaycast} userData={{ noShadow }} />;
}
