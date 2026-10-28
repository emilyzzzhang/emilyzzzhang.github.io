import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { weldNormals } from './geometry';
import { seededRandom } from './textures';

/*
 * The floating wall shelf's pieces, in the shelf's own frame: the wall is the plane z = 0, the
 * shelf faces +z and its board is centred on y = 0. Kept free of React so the arrangement can be
 * checked for clipping and loose leaves in tests.
 *
 * The trailing pothos grows from its soil as a few tapered vines on smooth curves. Every leaf
 * hangs from a vine node on a short petiole, so nothing floats; the blades are heart-shaped,
 * cupped, arched and slightly asymmetric, each one generated from its own seed.
 */

export const SHELF = { width: 1.0, thickness: 0.07, depth: 0.3, radius: 0.02, gap: 0.005 } as const;
export const SHELF_TOP = SHELF.thickness / 2;
export const SHELF_FRONT = SHELF.gap + SHELF.depth;

/** Where the planter and the bud vase stand on the shelf (centre of their bases). */
export const POT_AT = new Vector3(-0.2, SHELF_TOP, 0.155);
export const VASE_AT = new Vector3(0.25, SHELF_TOP, 0.15);

const UP = new Vector3(0, 1, 0);
const OUT = new Vector3(0, 0, 1);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const v2 = (pairs: [number, number][]) => pairs.map(([r, y]) => new Vector2(r, y));

/** A rounded lip of radius `r` centred at (cr, cy): outer side, over the top, inner side. */
const lip = (cr: number, cy: number, r: number, steps = 6) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI;
    return new Vector2(cr + Math.cos(a) * r, cy + Math.sin(a) * r);
  });

// ---------------------------------------------------------------------------------------------
// Planter: a small tapered pot with a softly rolled rim, a rounded foot and a gentle wobble, as
// if thrown by hand. Origin at the centre of its base.

/** Outer wall, base to rim, as (radius, height). */
export const POT_OUTER = v2([
  [0, 0],
  [0.072, 0],
  [0.079, 0.003],
  [0.082, 0.009],
  [0.086, 0.04],
  [0.094, 0.09],
  [0.102, 0.14],
  [0.108, 0.175],
  [0.112, 0.193],
]);
export const POT_RIM = 0.2005;
export const SOIL_Y = 0.172;

const POT_PROFILE = [
  ...POT_OUTER,
  ...lip(0.1045, 0.193, 0.0075).slice(1),
  ...v2([
    [0.096, 0.18],
    [0.094, 0.16],
    [0.09, 0.13],
  ]),
];

/** The thrown look: a slightly irregular round, the same at every height so walls stay even. */
const wobble = (angle: number, y: number) => 1 + 0.013 * Math.sin(3 * angle + 0.7) + 0.006 * Math.sin(5 * angle + 2.3 + y * 24);

function handmade(geometry: BufferGeometry, rimY: number) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const angle = Math.atan2(z, x);
    const f = wobble(angle, y);
    // The rim rises and dips a touch around the pot.
    const dy = 0.0025 * Math.sin(2 * angle + 1.1) * smooth(rimY - 0.03, rimY, y);
    pos.setXYZ(i, x * f, y + dy, z * f);
  }
  geometry.computeVertexNormals();
  return weldNormals(geometry);
}

export const POT = handmade(new LatheGeometry(POT_PROFILE, 56), POT_RIM);

/** Loose, slightly lumpy soil just below the rim, tucked into the inner wall (edge to centre, facing up). */
export const SOIL = (() => {
  const geometry = new LatheGeometry(
    v2([
      [0.098, SOIL_Y - 0.002],
      [0.085, SOIL_Y],
      [0.06, SOIL_Y + 0.003],
      [0.03, SOIL_Y + 0.005],
      [0, SOIL_Y + 0.006],
    ]),
    40,
  );
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const angle = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const lumps = 0.0018 * Math.sin(angle * 7 + r * 90) * Math.sin(r * 140 + angle * 3);
    pos.setXYZ(i, x * wobble(angle, y), y + lumps, z * wobble(angle, y));
  }
  geometry.computeVertexNormals();
  return weldNormals(geometry);
})();

/** A few pale perlite flecks scattered on the soil. */
export const PERLITE = (() => {
  const rand = seededRandom(31);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.02 + rand() * 0.065;
    const s = 0.0028 + rand() * 0.0018;
    parts.push(new IcosahedronGeometry(s, 0).scale(1, 0.7, 1).translate(Math.cos(a) * r, SOIL_Y + 0.004, Math.sin(a) * r));
  }
  return mergeGeometries(parts);
})();

// ---------------------------------------------------------------------------------------------
// Bud vase: a small cream bottle with a round belly, a slim neck and a rolled lip, holding one daisy.

export const VASE_OUTER = v2([
  [0, 0],
  [0.036, 0],
  [0.042, 0.004],
  [0.046, 0.014],
  [0.049, 0.035],
  [0.046, 0.06],
  [0.036, 0.08],
  [0.022, 0.097],
  [0.0145, 0.112],
  [0.0135, 0.128],
  [0.016, 0.139],
]);
export const VASE_TOP = 0.1425;

export const VASE = handmade(
  new LatheGeometry(
    [
      ...VASE_OUTER,
      ...lip(0.0125, 0.139, 0.0035, 4).slice(1),
      ...v2([
        [0.0095, 0.125],
        [0.011, 0.11],
      ]),
    ],
    40,
  ),
  VASE_TOP,
);

const DAISY_PETAL = new Color('#FFFDF7');
const DAISY_BLUSH = new Color('#F6E3DE');
const DAISY_EYE = new Color('#F2C35E');

function paint(geometry: BufferGeometry, colour: (p: Vector3) => Color) {
  const pos = geometry.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) colour(p.fromBufferAttribute(pos, i)).toArray(colours, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return geometry;
}

/** One daisy facing +y: a domed golden eye ringed by slender petals that cup upwards, blushing towards the centre. */
function daisyHead() {
  const rand = seededRandom(7);
  const parts = [paint(new SphereGeometry(0.0085, 14, 8).scale(1, 0.55, 1).translate(0, 0.002, 0), () => DAISY_EYE)];
  const tint = new Color();
  const count = 14;
  for (let k = 0; k < count; k++) {
    const length = 0.017 + rand() * 0.003;
    const petal = new SphereGeometry(1, 10, 5)
      .scale(0.0048, 0.0011, length)
      .translate(0, 0, length + 0.005)
      .rotateX(-0.22 - rand() * 0.12)
      .rotateY((k / count) * Math.PI * 2 + rand() * 0.12);
    parts.push(paint(petal, (p) => tint.lerpColors(DAISY_BLUSH, DAISY_PETAL, smooth(0.008, 0.016, Math.hypot(p.x, p.z)))));
  }
  return mergeGeometries(parts);
}

const DAISY_STEM = [
  [0, 0.105, 0],
  [0.002, 0.16, 0.003],
  [-0.006, 0.225, 0.014],
  [-0.016, 0.262, 0.03],
].map(([x, y, z]) => new Vector3(x, y, z).add(VASE_AT));

/** The daisy, already in place in the vase: its stem (part of the stems geometry) and its head. */
function daisy() {
  const curve = new CatmullRomCurve3(DAISY_STEM);
  const stem = new TubeGeometry(curve, 24, 0.0022, 5, false);
  const tip = curve.getPointAt(1);
  // Nodding gently forward and towards the room, as cut flowers do.
  const facing = curve.getTangentAt(1).multiplyScalar(0.5).add(new Vector3(-0.25, 0.25, 0.7)).normalize();
  const x = new Vector3().crossVectors(facing, OUT).normalize();
  const z = new Vector3().crossVectors(x, facing);
  const head = daisyHead().applyMatrix4(new Matrix4().makeBasis(x, facing, z).setPosition(tip));
  return { stem, head };
}

// ---------------------------------------------------------------------------------------------
// Pothos leaf (leaf space: the petiole joins at the origin, the midrib runs up +y to the tip at
// y = 1, and the blade's face looks along +z).

const RIB = new Color('#C9DDB0');
const FRESH = new Color('#B9D59B');

const bezier = (t: number, a: number, b: number, c: number, d: number) => {
  const s = 1 - t;
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
};

/**
 * One heart-shaped blade: shallow rounded lobes either side of the petiole, widest a third of the
 * way up, narrowing to a soft point. It cups along the midrib, arches back towards the tip and
 * ripples faintly at the margin; `young` brightens it towards fresh lime, as at a vine's tip.
 */
function leafBlade(rand: () => number, base: Color, young: number) {
  const NT = 16;
  const NU = 5;
  const width = 1.18 + rand() * 0.16;
  const asym = (rand() - 0.5) * 0.14;
  const bend = (rand() - 0.5) * 0.18;
  const cup = 0.06 + rand() * 0.05;
  const arch = 0.1 + rand() * 0.12;
  const ripple = 0.008 + rand() * 0.01;
  const phase = rand() * 6;
  const tone = base.clone().lerp(FRESH, young * 0.45);
  const colour = new Color();
  const parts: BufferGeometry[] = [];

  for (const side of [1, -1]) {
    const positions: number[] = [];
    const colours: number[] = [];
    for (let i = 0; i <= NT; i++) {
      const t = i / NT;
      // Half the outline, from the notch at the petiole round the lobe to the tip.
      const ox = bezier(t, 0, 0.5, 0.36, 0) * width * (1 + side * asym) * (1 - 0.28 * smooth(0.72, 1, t));
      const oy = bezier(t, 0, -0.42, 0.74, 1);
      const my = Math.min(1, Math.max(0, oy));
      for (let j = 0; j <= NU; j++) {
        const u = j / NU;
        const x = side * ox * u;
        const y = my + (oy - my) * u;
        const groove = -0.012 * Math.exp(-((x / 0.03) ** 2)) * (1 - y) * smooth(0, 0.15, y);
        const z = -arch * y * y - cup * (Math.abs(x) / 0.4) ** 1.5 + groove + ripple * u * u * Math.sin(9 * t + phase + side);
        positions.push(x + bend * y * y, y, z);
        const shade = 1 - 0.07 * u * u + 0.04 * (1 - t);
        colour.copy(tone).multiplyScalar(shade).lerp(RIB, 0.5 * Math.exp(-((u * 4.5) ** 2)));
        colours.push(colour.r, colour.g, colour.b);
      }
    }
    const index: number[] = [];
    for (let i = 0; i < NT; i++) {
      for (let j = 0; j < NU; j++) {
        const a = i * (NU + 1) + j;
        const b = a + NU + 1;
        // Mirror the winding on the left half so both halves face +z.
        if (side > 0) index.push(a, a + 1, b, a + 1, b + 1, b);
        else index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const half = new BufferGeometry();
    half.setAttribute('position', new Float32BufferAttribute(positions, 3));
    half.setAttribute('color', new Float32BufferAttribute(colours, 3));
    half.setIndex(index);
    parts.push(half);
  }
  // Weld the halves along the midrib so the blade shades smoothly across it.
  const geometry = mergeVertices(mergeGeometries(parts), 1e-6);
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// Vines.

/** Sage and botanical greens; each leaf picks one and drifts a little from it. */
const LEAF_GREENS = ['#8DB38A', '#7FA67F', '#9DBB9E', '#A6C49A', '#6F9873', '#93B987'].map((c) => new Color(c));

interface VineSpec {
  points: [number, number, number][];
  radius: number;
  /** Arc length from the soil to the first leaf node. */
  leafFrom: number;
  spacing: number;
  /** Size of the largest leaves (leaf length in units); leaves shrink towards the tip. */
  size: number;
  seed: number;
}

const p = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

/**
 * Three trailing vines and a short upright shoot, rooted below the soil. The long one spills
 * over the pot's front rim and falls well down the wall; one creeps left along the shelf and over
 * its corner; a short one wanders right towards the vase before dipping over the edge.
 */
const VINES: VineSpec[] = [
  {
    points: [
      p(-0.215, 0.19, 0.17),
      p(-0.22, 0.236, 0.22),
      p(-0.228, 0.243, 0.272),
      p(-0.236, 0.2, 0.31),
      p(-0.245, 0.09, 0.325),
      p(-0.25, 0.02, 0.33),
      p(-0.27, -0.15, 0.322),
      p(-0.24, -0.38, 0.305),
      p(-0.29, -0.6, 0.29),
      p(-0.27, -0.82, 0.275),
      p(-0.31, -0.98, 0.27),
    ],
    radius: 0.0062,
    leafFrom: 0.1,
    spacing: 0.074,
    size: 0.105,
    seed: 11,
  },
  {
    points: [
      p(-0.235, 0.19, 0.14),
      p(-0.27, 0.234, 0.13),
      p(-0.316, 0.243, 0.14),
      p(-0.345, 0.17, 0.165),
      p(-0.385, 0.06, 0.2),
      p(-0.43, 0.047, 0.25),
      p(-0.465, 0.035, 0.322),
      p(-0.48, -0.08, 0.33),
      p(-0.46, -0.24, 0.318),
      p(-0.5, -0.4, 0.305),
      p(-0.49, -0.52, 0.295),
    ],
    radius: 0.0058,
    leafFrom: 0.1,
    spacing: 0.076,
    size: 0.095,
    seed: 23,
  },
  {
    points: [
      p(-0.18, 0.19, 0.15),
      p(-0.14, 0.236, 0.175),
      p(-0.098, 0.243, 0.222),
      p(-0.06, 0.15, 0.245),
      p(-0.02, 0.048, 0.255),
      p(0.04, 0.043, 0.275),
      p(0.085, 0.03, 0.325),
      p(0.095, -0.08, 0.332),
      p(0.08, -0.2, 0.318),
      p(0.1, -0.3, 0.31),
    ],
    radius: 0.0055,
    leafFrom: 0.1,
    spacing: 0.08,
    size: 0.09,
    seed: 37,
  },
  {
    points: [p(-0.195, 0.19, 0.13), p(-0.19, 0.24, 0.12), p(-0.175, 0.275, 0.115)],
    radius: 0.005,
    leafFrom: Infinity,
    spacing: 1,
    size: 0.11,
    seed: 41,
  },
];

const potAxis = new Vector2(POT_AT.x, POT_AT.z);

/** True over the planter's open top, where shoots stand up rather than hang. */
const overPot = (q: Vector3) => q.y > POT_AT.y + 0.15 && new Vector2(q.x, q.z).distanceTo(potAxis) < 0.15;
/** True where a vine lies along the shelf's top. */
const onShelf = (q: Vector3) => q.y < SHELF_TOP + 0.05 && q.z < SHELF_FRONT - 0.01;

export interface LeafNode {
  /** Where the petiole leaves the vine (on the vine's axis). */
  node: Vector3;
  /** Where the blade joins the petiole. */
  base: Vector3;
}

/**
 * Places one leaf at `node` on a vine running along `tangent`: a short, slightly arched petiole
 * reaching out from the vine (`side` picks which way; 0 for the tip leaf, which carries on along
 * the vine), then the blade. Leaves over the pot stand up and out, those along the shelf lie
 * almost flat, and hanging ones turn their faces out from the wall as their tips droop.
 */
function placeLeaf(node: Vector3, tangent: Vector3, side: number, size: number, rand: () => number, young: number) {
  const jitter = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5);
  const across = new Vector3().crossVectors(tangent, OUT);
  if (across.lengthSq() < 1e-4) across.set(1, 0, 0);
  across.normalize().multiplyScalar(side || 1);
  const radial = new Vector3(node.x - POT_AT.x, 0, node.z - POT_AT.z).normalize();
  // Beside the pot, leaves reach away from it rather than into its wall.
  const besidePot = node.y < POT_AT.y + POT_RIM && new Vector2(node.x, node.z).distanceTo(potAxis) < 0.22;
  if (besidePot && across.dot(radial) < 0) across.negate();

  let reach: Vector3;
  let along: Vector3;
  let facing: Vector3;
  if (overPot(node)) {
    reach = side ? across.clone().multiplyScalar(0.7).addScaledVector(radial, 0.6).addScaledVector(UP, 0.5) : tangent.clone();
    along = UP.clone().multiplyScalar(0.55).addScaledVector(radial, 0.8).addScaledVector(OUT, 0.3);
    facing = UP.clone().addScaledVector(radial, 0.5).addScaledVector(OUT, 0.5);
  } else if (onShelf(node)) {
    reach = across.clone().setY(0).normalize().addScaledVector(OUT, 0.3).addScaledVector(UP, 0.35);
    along = reach.clone().setY(0).normalize().addScaledVector(UP, 0.35);
    facing = UP.clone().addScaledVector(OUT, 0.35);
  } else if (side) {
    reach = across.clone().multiplyScalar(0.85).addScaledVector(OUT, 0.55).addScaledVector(UP, 0.25);
    if (besidePot) reach.addScaledVector(radial, 0.6);
    along = reach.clone().multiplyScalar(0.55).add(new Vector3(0, -0.8, 0));
    facing = OUT.clone().addScaledVector(UP, 0.35).addScaledVector(across, 0.25 * (rand() - 0.3));
  } else {
    reach = tangent.clone().addScaledVector(OUT, 0.3);
    along = tangent.clone().addScaledVector(OUT, 0.2);
    facing = OUT.clone().addScaledVector(UP, 0.3);
  }
  reach.addScaledVector(jitter, 0.2).normalize();
  along.addScaledVector(jitter, 0.25).normalize();

  const length = size * (0.38 + rand() * 0.1);
  const base = node.clone().addScaledVector(reach, length);
  // A petiole arches a little before the blade, rather than running dead straight.
  const bow = node.clone().addScaledVector(reach, length * 0.5).addScaledVector(UP, length * 0.15);
  const petiole = new TubeGeometry(new CatmullRomCurve3([node, bow, base]), 8, 0.0024, 5, false);

  const x = new Vector3().crossVectors(along, facing.normalize()).normalize();
  const z = new Vector3().crossVectors(x, along);
  const tone = LEAF_GREENS[Math.floor(rand() * LEAF_GREENS.length)].clone().offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.04);
  const blade = leafBlade(rand, tone, young).applyMatrix4(new Matrix4().makeBasis(x, along, z).scale(new Vector3(size, size, size)).setPosition(base));
  return { petiole, blade, base };
}

/** A tube whose radius eases from `radius` at the root to 60% at the tip. */
function taperedTube(curve: CatmullRomCurve3, radius: number) {
  const segments = Math.ceil(curve.getLength() / 0.012);
  const tube = new TubeGeometry(curve, segments, radius, 6, false);
  const pos = tube.attributes.position;
  const centre = new Vector3();
  const q = new Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, centre);
    const taper = 1 - 0.4 * (i / segments);
    for (let j = 0; j <= 6; j++) {
      const k = i * 7 + j;
      q.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
      pos.setXYZ(k, q.x, q.y, q.z);
    }
  }
  return tube;
}

function buildPothos() {
  const stems: BufferGeometry[] = [];
  const blades: BufferGeometry[] = [];
  const leaves: LeafNode[] = [];

  for (const spec of VINES) {
    const rand = seededRandom(spec.seed);
    const curve = new CatmullRomCurve3(spec.points.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
    const length = curve.getLength();
    stems.push(taperedTube(curve, spec.radius));
    // A rounded end, under the tip leaf.
    stems.push(new SphereGeometry(spec.radius * 0.6, 8, 6).translate(...curve.getPointAt(1).toArray()));

    const stations: number[] = [];
    for (let s = spec.leafFrom; s < length - spec.spacing * 0.6; s += spec.spacing * (0.8 + rand() * 0.4)) stations.push(s);
    stations.push(length);

    stations.forEach((s, i) => {
      const u = s / length;
      const node = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      const fromTip = length - s;
      const tip = i === stations.length - 1;
      // Leaves are largest near the pot and smaller towards the growing tip.
      const size = spec.size * (0.55 + 0.45 * smooth(0, 0.5, fromTip)) * (0.88 + rand() * 0.24);
      const side = tip ? 0 : i % 2 ? 1 : -1;
      const { petiole, blade, base } = placeLeaf(node, tangent, side, size, rand, 1 - smooth(0, 0.3, fromTip));
      stems.push(petiole);
      // A slight swelling at the node, where the petiole joins the vine.
      if (!tip) stems.push(new SphereGeometry(spec.radius * 1.15, 6, 4).translate(node.x, node.y, node.z));
      blades.push(blade);
      leaves.push({ node, base });
    });
  }

  const { stem, head } = daisy();
  stems.push(stem);
  return { stems: mergeGeometries(stems), leaves: mergeGeometries(blades), daisy: head, nodes: leaves };
}

export const POTHOS = buildPothos();
