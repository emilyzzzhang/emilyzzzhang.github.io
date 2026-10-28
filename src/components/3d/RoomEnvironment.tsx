import { useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, Float32BufferAttribute, MathUtils, Matrix4, ShapeUtils, SphereGeometry, TubeGeometry, Vector2, Vector3, type MeshBasicMaterial } from 'three';
import { RoundedBox } from '@react-three/drei';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANCHORS, DIORAMA, ROOM, RUG } from '../../config/sceneLayout';
import { useDayNight } from './dayNight';
import { ContactShadow } from './ContactShadow';
import { Garden } from './Garden';
import { BraidedRug } from './BraidedRug';
import { linen, materials } from './materials';
import { StringLights } from './StringLights';
import { worldBoxUVs } from './surfaces';
import { drawDaySky, drawNightSky, seededRandom, useCanvasTexture } from './textures';

const { half, wallHeight, wallThickness: t, wainscotHeight } = ROOM;
const SLAB = DIORAMA.slab;
const OUTER = half * 2 + t;
const WALL_H = wallHeight + SLAB;

export function RoomEnvironment() {
  return (
    <group>
      <Garden />
      <Floor />
      <Walls />
      <Window />
      <Rug />
      <FairyLights />
    </group>
  );
}

function Floor() {
  return (
    <group>
      <RoundedBox args={[OUTER, SLAB, OUTER]} radius={0.1} position={[-t / 2, -SLAB / 2, -t / 2]} material={materials.slab} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} material={materials.floor}>
        <planeGeometry args={[half * 2, half * 2]} />
      </mesh>
    </group>
  );
}

/**
 * A Roman entablature in three slim layers, in cream, with soft curved profiles. The architrave (two
 * fasciae joined by a rounded step, crowned by an ovolo) rests on the pilasters' capitals and breaks
 * forward over each one; a short plain frieze runs above it; then the cornice: a gilded astragal, a
 * row of dentils, an ovolo, the corona and a cyma recta lip. Every layer wraps the inside corner in
 * mitres and returns round each open end.
 */
const CORNICE = {
  /** How far the entablature's base sits below the wall top, hiding the wall's rounded edge. */
  sleeve: 0.1,
  height: 0.58,
};
const POST = 0.12;

/** Each layer's heights above the entablature's base, and reaches past the wall face. */
const ARCHITRAVE = { top: 0.13 };
const FRIEZE = { top: 0.235, reach: 0.1 };
const ASTRAGAL = { bottom: 0.235, top: 0.265, reach: 0.127 };
const DENTIL_BAND = { bottom: 0.275, top: 0.365, reach: 0.12, spacing: 0.11, width: 0.06, depth: 0.06 };
/** How far the architrave breaks forward over each pilaster, so the capitals visibly carry it. */
const RESSAUT = 0.04;

/** A profile as [reach past the wall face, height above the entablature's base] pairs. */
type Profile = [number, number][];

/** Adds points round an arc centred at (ce, cy) from angle a0 to a1, leaving out a0's point (the profile is already there). */
function arc(p: Profile, ce: number, cy: number, r: number, a0: number, a1: number, steps = 5) {
  for (let k = 1; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    p.push([ce + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}

/** The architrave's profile from the wall face at its foot to its top, pushed forward by `shift`. */
function architraveProfile(shift = 0): Profile {
  const p: Profile = [[0, 0], [0.1 + shift, 0], [0.1 + shift, 0.05]];
  arc(p, 0.1 + shift, 0.065, 0.015, -Math.PI / 2, 0);
  p.push([0.115 + shift, 0.11]);
  arc(p, 0.115 + shift, 0.125, 0.015, -Math.PI / 2, 0);
  p.push([0.13 + shift, ARCHITRAVE.top]);
  return p;
}

/** The entablature's room-side profile, from the wall face at its foot up and back to the wall's centreline on top. */
function entablatureProfile(): Profile {
  const p = architraveProfile();
  p.push([FRIEZE.reach, ARCHITRAVE.top], [FRIEZE.reach, FRIEZE.top]);
  // Behind the astragal, then the dentils' backing and a fillet over them.
  const d = DENTIL_BAND;
  p.push([0.115, FRIEZE.top], [0.115, d.bottom - 0.005], [d.reach, d.bottom - 0.005], [d.reach, d.top + 0.005], [0.19, d.top + 0.005], [0.19, 0.38]);
  // An ovolo swelling out over the dentils to the corona's soffit.
  arc(p, 0.19, 0.42, 0.04, -Math.PI / 2, 0, 7);
  p.push([0.27, 0.42], [0.27, 0.49]);
  // The cyma recta: hollow below, round above, under a softened top edge.
  arc(p, 0.29, 0.49, 0.02, Math.PI, Math.PI / 2, 4);
  arc(p, 0.29, 0.53, 0.02, -Math.PI / 2, 0, 4);
  p.push([0.31, 0.57]);
  arc(p, 0.3, 0.57, 0.01, 0, Math.PI / 2, 3);
  p.push([-t / 2, CORNICE.height]);
  return p;
}

/** The architrave pushed forward by RESSAUT, closing back to the wall face along its top. */
function ressautProfile(): Profile {
  return [...architraveProfile(RESSAUT), [0, ARCHITRAVE.top]];
}

/** The gilded astragal's cross-section: a half-round bead, closed against the frieze, anticlockwise. */
const ASTRAGAL_PROFILE: Profile = (() => {
  const { bottom, top, reach } = ASTRAGAL;
  const r = (top - bottom) / 2;
  const p: Profile = [[FRIEZE.reach - 0.004, bottom], [reach - r, bottom]];
  arc(p, reach - r, bottom + r, r, -Math.PI / 2, Math.PI / 2, 8);
  p.push([FRIEZE.reach - 0.004, top]);
  return p;
})();

/**
 * A straight run of molding: where each profile point lands at the run's two ends (mitred or square),
 * and the direction a positive reach points. `caps` closes square ends with the profile's outline.
 */
interface Run {
  at: (end: 0 | 1, e: number, y: number) => Vector3;
  out: Vector3;
  caps?: [boolean, boolean];
}

/**
 * A profile swept along a run, as a non-indexed geometry. Each triangle is turned to face away from
 * the molding, so runs in any direction and with either mitre come out right.
 */
function sweep(profile: Profile, { at, out, caps = [false, false] }: Run, closed = false) {
  const positions: number[] = [];
  const up = new Vector3(0, 1, 0);
  const tri = (a: Vector3, b: Vector3, c: Vector3, facing: Vector3) => {
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    const [q, r] = n.dot(facing) < 0 ? [c, b] : [b, c];
    positions.push(a.x, a.y, a.z, q.x, q.y, q.z, r.x, r.y, r.z);
  };
  const edges = closed ? profile.length : profile.length - 1;
  for (let i = 0; i < edges; i++) {
    const [e0, y0] = profile[i];
    const [e1, y1] = profile[(i + 1) % profile.length];
    // Outward is to the right of travel along the profile, in (reach, height).
    const facing = out.clone().multiplyScalar(y1 - y0).addScaledVector(up, e0 - e1);
    const [a, b, c, d] = [at(0, e0, y0), at(1, e0, y0), at(0, e1, y1), at(1, e1, y1)];
    tri(a, b, c, facing);
    tri(b, d, c, facing);
  }
  const contour = profile.map(([e, y]) => new Vector2(e, y));
  for (const end of [0, 1] as const) {
    if (!caps[end]) continue;
    const along = at(1, 0, 0).sub(at(0, 0, 0)).multiplyScalar(end === 0 ? -1 : 1);
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, [])) tri(at(end, ...profile[i]), at(end, ...profile[j]), at(end, ...profile[k]), along);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  // Smooth through the hollows and lips, crisp at the steps, mitres and caps.
  return toCreasedNormals(geometry, 0.6);
}

/** Evenly spaced centres along [from, to]: about one per `spacing`, with half a pitch at each end. */
function spaced(from: number, to: number, spacing: number) {
  const n = Math.max(1, Math.round(Math.abs(to - from) / spacing));
  return Array.from({ length: n }, (_, k) => from + ((k + 0.5) / n) * (to - from));
}

/**
 * One wall's entablature, wall-local (x along the wall, the inner face at z = 0, +z into the room).
 * `corner` is the end that meets the other wall; the other end returns round the post's outer face.
 * Returns the molding, its carving (dentils, egg-and-dart, paterae) and the gilding, one geometry each.
 */
function entablatureGeometry(halfLength: number, corner: -1 | 1) {
  const free = -corner;
  const face = halfLength + POST - 0.02;
  // How far each capital's abacus reaches: from the pilaster's centre, and from the wall's end.
  const capitalHalf = (PILASTER.width + PILASTER.abacusOver) / 2;
  const capitalReach = PILASTER.width / 2 + capitalHalf;
  const inner = (x0: (e: number) => number, x1: (e: number) => number, caps?: [boolean, boolean]): Run => ({
    at: (end, e, y) => new Vector3(end === 0 ? x0(e) : x1(e), y, e),
    out: new Vector3(0, 0, 1),
    caps,
  });
  const endFace = (z0: (e: number) => number, z1: (e: number) => number, caps?: [boolean, boolean]): Run => ({
    at: (end, e, y) => new Vector3(free * (face + e), y, end === 0 ? z0(e) : z1(e)),
    out: new Vector3(free, 0, 0),
    caps,
  });
  // Mitres: into the corner (the inside face shortens with reach), and round the open end (it lengthens).
  const toCorner = (e: number) => corner * (halfLength - e);
  const roundEnd = (e: number) => free * (face + e);
  const mainInner = inner(toCorner, roundEnd);
  const mainReturn = endFace((e) => e, (e) => -t - e);
  const mainOuter: Run = {
    at: (end, e, y) => new Vector3(end === 0 ? corner * (halfLength + t + e) : roundEnd(e), y, -t - e),
    out: new Vector3(0, 0, -1),
  };

  const profile = entablatureProfile();
  const ressaut = ressautProfile();
  const molding = mergeGeometries([
    sweep(profile, mainInner),
    sweep(profile, mainReturn),
    sweep(profile, mainOuter),
    // Breaks over the corner pilaster, the inner end pilaster, and the pilaster on the end face.
    sweep(ressaut, inner(toCorner, () => corner * (halfLength - capitalReach), [false, true])),
    sweep(ressaut, inner(() => free * (halfLength - capitalReach), roundEnd, [true, false])),
    sweep(ressaut, endFace((e) => e, () => -t / 2 - capitalHalf, [false, true])),
  ]);

  const carving: BufferGeometry[] = [];
  const gilding = mergeGeometries([sweep(ASTRAGAL_PROFILE, mainInner, true), sweep(ASTRAGAL_PROFILE, endFace((e) => e, (e) => -t - e, [false, true]), true)]);

  // Dentils, with a square block on each corner where the runs meet. Plain boxes: at this size a
  // bevel doesn't show, and there are a couple of hundred of them.
  const dentil = (w: number, h: number, depth: number, x: number, y: number, z: number) => new BoxGeometry(w, h, depth).translate(x, y, z).toNonIndexed();
  const d = DENTIL_BAND;
  const dentilH = d.top - d.bottom;
  const dy = d.bottom + dentilH / 2;
  const dz = d.reach + d.depth / 2;
  const endX = free * (face + d.reach + d.depth / 2);
  for (const x of spaced(corner * (halfLength - d.reach - d.depth), free * (face + d.reach), d.spacing)) carving.push(dentil(d.width, dentilH, d.depth, x, dy, dz));
  for (const z of spaced(d.reach, -t - d.reach, d.spacing)) carving.push(dentil(d.depth, dentilH, d.width, endX, dy, z));
  carving.push(dentil(d.depth, dentilH, d.depth, endX, dy, dz), dentil(d.depth, dentilH, d.depth, endX, dy, -t - dz));
  // The inside corner's block is shared by both walls, so only the back wall lays it.
  if (corner === -1) carving.push(dentil(d.depth, dentilH, d.depth, corner * (halfLength - dz), dy, dz));

  return { molding, carving: mergeGeometries(carving), gilding };
}

// ---------------------------------------------------------------------------------------------
// Roman wall molding: fluted pilasters with Corinthian capitals at the corner and the open ends,
// raised panel frames along the wainscot, and a chair rail with a thin gold line. Wall-local, like
// Wall: x along the wall, the inner face at z = 0, +z into the room.

/** Width and depth of a pilaster's shaft; the base, capital and abacus step out around it. */
const PILASTER = { width: 0.34, proud: 0.12, base: 0.3, capital: 0.5, abacus: 0.07, abacusOver: 0.22, flutes: 5 };
/** Raised panel frames on the wainscot, between the pilasters. */
const PANEL = { count: 5, bottom: 0.4, top: wainscotHeight - 0.22, bar: 0.05, proud: 0.03, gap: 0.24, margin: 0.2 };
const WAINSCOT_FACE = 0.05;

/** A rounded box centred at (x, y, z). Already non-indexed, so it merges with the non-indexed carving. */
const block = (w: number, h: number, d: number, x: number, y: number, z: number, r = 0.02) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)).translate(x, y, z);

const smoothstep = (a: number, b: number, x: number) => {
  const k = MathUtils.clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * One acanthus leaf rooted at the origin, rising up +y and curling out towards +z: a lobed blade,
 * cupped across with a raised midrib, whose tip rolls outward and over. It has front and back
 * faces, since the curl shows the underside.
 */
function acanthusLeaf(length: number, width: number, curl: number) {
  const nu = 12;
  const nv = 6;
  // The midrib: a spine bending further outward the higher it goes.
  const spine: [number, number, number][] = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i <= nu; i++) {
    const phi = 0.12 + curl * Math.pow(smoothstep(0.4, 1, i / nu), 1.4);
    spine.push([y, z, phi]);
    y += (Math.cos(phi) * length) / nu;
    z += (Math.sin(phi) * length) / nu;
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const [sy, sz, phi] = spine[i];
      // Broad near the root, tapering to a point, with lobes scalloping the edge.
      const outline = Math.pow(Math.sin(Math.PI * (0.12 + (0.88 * Math.min(u, 0.95)) / 0.95)), 0.6);
      const halfWidth = (width / 2) * outline * (0.78 + 0.22 * Math.abs(Math.cos(2.5 * Math.PI * u)));
      for (let j = 0; j <= nv; j++) {
        const v = -1 + (2 * j) / nv;
        // The edges lift forward (cupped) and ripple with the lobes; the midrib stands proud. The back face sits just behind.
        const off = width * 0.22 * v * v + 0.006 * Math.sin(5 * Math.PI * u) * v * v + 0.008 * Math.max(0, 1 - Math.abs(v) * 3) - (side < 0 ? 0.005 : 0);
        positions.push(v * halfWidth, sy - Math.sin(phi) * off, sz + Math.cos(phi) * off);
        uvs.push(u, (v + 1) / 2);
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = base + i * (nv + 1) + j;
        const b = a + 1;
        const c = a + nv + 1;
        const d = c + 1;
        if (side > 0) index.push(a, b, c, b, d, c);
        else index.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry.toNonIndexed();
}

/**
 * A volute in the xy plane, centred on its eye: a scroll that sweeps up from its inner end, out over
 * the top and down, then spirals in. `side` 1 rolls it towards +x, −1 towards −x.
 */
function volute(radius: number, tube: number, side: 1 | -1) {
  const turns = 2.3 * Math.PI;
  const points = Array.from({ length: 40 }, (_, k) => {
    const th = (k / 39) * turns;
    const r = radius * (1 - 0.8 * (th / turns));
    const a = Math.PI - th;
    return new Vector3(side * r * Math.cos(a), r * Math.sin(a), 0);
  });
  return [new TubeGeometry(new CatmullRomCurve3(points), 64, tube, 6, false).toNonIndexed(), new SphereGeometry(tube * 1.5, 8, 6).toNonIndexed()];
}

/**
 * A Corinthian capital for a pilaster `w` wide and `proud` deep, from `bottom` up to `top`, facing
 * +z: an astragal ring; a bell flaring in a soft curve under two rows of curling acanthus leaves;
 * volutes on stalks rolling out under the abacus corners, with a smaller pair under its centre; and
 * a moulded abacus with a fleuron, which the architrave rests on.
 */
function corinthianCapital(w: number, proud: number, bottom: number, top: number): BufferGeometry[] {
  const { abacus, abacusOver } = PILASTER;
  const ring = 0.04;
  const bellBottom = bottom + ring;
  const bellTop = top - abacus;
  const bellH = bellTop - bellBottom;
  const flare = (f: number) => Math.pow(f, 1.6);
  const widthAt = (f: number) => MathUtils.lerp(w + 0.02, w + 0.14, flare(f));
  const front = (f: number) => MathUtils.lerp(proud + 0.02, proud + 0.09, flare(f));
  const parts: BufferGeometry[] = [block(w + 0.05, ring, proud + 0.05, 0, bottom + ring / 2, (proud + 0.05) / 2, 0.019)];
  // The bell: a box flaring wider and further forward towards the top, flush with the wall behind.
  const bell = new BoxGeometry(1, 1, 1, 1, 6, 1).toNonIndexed();
  const pos = bell.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = pos.getY(i) + 0.5;
    pos.setXYZ(i, pos.getX(i) * widthAt(f), bellBottom + f * bellH, (pos.getZ(i) + 0.5) * front(f));
  }
  bell.computeVertexNormals();
  parts.push(bell);
  const leaf = (x: number, f: number, angle: number, length: number, width: number, curl: number) =>
    parts.push(acanthusLeaf(length, width, curl).rotateY(angle).translate(x, bellBottom + f * bellH, front(f) - 0.01));
  // The lower row: a leaf at the centre and one wrapping each front corner.
  leaf(0, 0, 0, bellH * 0.5, 0.12, 1.5);
  for (const s of [-1, 1]) leaf(s * (widthAt(0) / 2 - 0.01), 0, (s * Math.PI) / 4, bellH * 0.48, 0.12, 1.5);
  // The upper row: taller leaves between them, curling further.
  for (const s of [-1, 1]) leaf(s * 0.075, 0.28, 0, bellH * 0.62, 0.11, 1.9);
  // Volutes rolling out under each corner of the abacus, turned a little to face outward, on stalks
  // rising from among the upper leaves; and a smaller pair curling in towards the centre.
  const R = 0.07;
  for (const s of [-1, 1] as const) {
    const turn = new Matrix4().makeRotationY(s * 0.55).setPosition(s * (w / 2 + 0.02), bellTop - R * 0.95, front(0.9) + 0.015);
    parts.push(...volute(R, 0.016, s).map((g) => g.applyMatrix4(turn)));
    const scrollStart = new Vector3(-s * R, 0, 0).applyMatrix4(turn);
    const stalk = new CatmullRomCurve3([
      new Vector3(s * 0.07, bellBottom + bellH * 0.45, front(0.45) + 0.02),
      new Vector3(s * 0.1, bellBottom + bellH * 0.68, front(0.68) + 0.03),
      scrollStart,
    ]);
    parts.push(new TubeGeometry(stalk, 16, 0.012, 6, false).toNonIndexed());
    const centre = new Matrix4().setPosition(s * 0.045, bellTop - 0.04, front(0.92) + 0.01);
    parts.push(...volute(0.032, 0.009, -s as 1 | -1).map((g) => g.applyMatrix4(centre)));
  }
  // The abacus: a slim ovolo under a moulded slab, with a small five-petalled fleuron at its centre.
  const slab = abacus - 0.025;
  parts.push(
    block(w + abacusOver - 0.06, 0.025, proud + 0.09, 0, bellTop + 0.0125, (proud + 0.09) / 2, 0.012),
    block(w + abacusOver, slab, proud + 0.12, 0, top - slab / 2, (proud + 0.12) / 2, 0.015),
  );
  // Sized to stay within the slab's height, clear of the architrave above.
  const fleuronY = top - slab / 2 - 0.003;
  for (let i = 0; i < 5; i++) {
    parts.push(new SphereGeometry(1, 8, 6).scale(0.012, 0.016, 0.01).translate(0, 0.012, 0).rotateZ((i / 5) * Math.PI * 2).translate(0, fleuronY, proud + 0.125).toNonIndexed());
  }
  parts.push(new SphereGeometry(0.011, 8, 6).translate(0, fleuronY, proud + 0.13).toNonIndexed());
  return parts;
}

/**
 * One pilaster from `bottom` up to the entablature, facing +z: an Attic base (plinth and two
 * rolls), a fluted shaft, and a Corinthian capital, all in cream.
 */
function pilasterGeometry(bottom: number, top: number, proud = PILASTER.proud) {
  const { width: w, base, capital, flutes } = PILASTER;
  const shaftBottom = bottom + base;
  const shaftTop = top - capital;
  const parts: BufferGeometry[] = [
    block(w + 0.12, 0.12, proud + 0.08, 0, bottom + 0.06, (proud + 0.08) / 2, 0.015),
    block(w + 0.08, 0.1, proud + 0.06, 0, bottom + 0.17, (proud + 0.06) / 2, 0.045),
    block(w + 0.03, 0.07, proud + 0.03, 0, bottom + 0.255, (proud + 0.03) / 2, 0.03),
    block(w, shaftTop - shaftBottom, proud, 0, (shaftBottom + shaftTop) / 2, proud / 2),
  ];
  // Raised reeds read as fluting from across the room, and catch the light better than grooves.
  for (let i = 0; i < flutes; i++) {
    const x = (i - (flutes - 1) / 2) * ((w - 0.08) / (flutes - 1));
    const length = shaftTop - shaftBottom - 0.14;
    parts.push(new CylinderGeometry(0.017, 0.017, length, 8).translate(x, (shaftBottom + shaftTop) / 2, proud).toNonIndexed());
  }
  parts.push(...corinthianCapital(w, proud, shaftTop, top));
  return mergeGeometries(parts);
}

/** Pilasters on the wall's inner face run from the floor; those on the open ends from the slab's foot. */
const INNER_PILASTER = pilasterGeometry(0, wallHeight - CORNICE.sleeve);
const END_PILASTER = pilasterGeometry(-SLAB, wallHeight - CORNICE.sleeve, 0.08);

/** The wainscot's raised panel frames, spaced evenly between the pilasters, as one geometry. */
function panelFramesGeometry(length: number) {
  const { count, bottom, top, bar, proud, gap, margin } = PANEL;
  const span = length - 2 * (PILASTER.width + margin);
  const width = (span - gap * (count - 1)) / count;
  const height = top - bottom;
  const z = WAINSCOT_FACE + proud / 2;
  const bars: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const x = -span / 2 + width / 2 + i * (width + gap);
    bars.push(
      block(width, bar, proud, x, top - bar / 2, z, 0.012),
      block(width, bar, proud, x, bottom + bar / 2, z, 0.012),
      block(bar, height, proud, x - width / 2 + bar / 2, (top + bottom) / 2, z, 0.012),
      block(bar, height, proud, x + width / 2 - bar / 2, (top + bottom) / 2, z, 0.012),
    );
  }
  return mergeGeometries(bars);
}

const PANEL_FRAMES = panelFramesGeometry(half * 2);

interface WallProps {
  length: number;
  /** Which end (local −x or +x) meets the other wall; the opposite end is exposed and gets a post. */
  corner: -1 | 1;
  /** How far the wall body runs past its length at the corner (the back wall wraps the corner). */
  cornerReach: number;
}

/**
 * One wall plus its cream wainscot with panel molding, chair rail and skirting board, built along
 * local +x with its inner face at local z = 0, so thickness grows outward. Finished with the
 * entablature resting on Corinthian pilasters at both ends, and a post with its own pilaster at
 * the open end, which the entablature returns round.
 */
function Wall({ length, corner, cornerReach }: WallProps) {
  const halfLength = length / 2;
  const free = -corner;
  const entablature = useMemo(() => entablatureGeometry(halfLength, corner), [corner, halfLength]);
  const base = wallHeight - CORNICE.sleeve;
  return (
    <group>
      <RoundedBox args={[length + cornerReach, WALL_H, t]} radius={0.1} position={[(corner * cornerReach) / 2, WALL_H / 2 - SLAB, -t / 2]} material={materials.wallUpper} />
      <group position-y={base}>
        <mesh geometry={entablature.molding} material={materials.molding} />
        <mesh geometry={entablature.carving} material={materials.molding} />
        <mesh geometry={entablature.gilding} material={materials.gold} />
      </group>
      <RoundedBox
        args={[POST, WALL_H - CORNICE.sleeve, t + 0.1]}
        radius={0.05}
        smoothness={4}
        position={[free * (halfLength + POST / 2 - 0.02), (WALL_H - CORNICE.sleeve) / 2 - SLAB, -t / 2]}
        material={materials.molding}
      />
      <mesh geometry={END_PILASTER} position={[free * (halfLength + POST - 0.02), 0, -t / 2]} rotation-y={(free * Math.PI) / 2} material={materials.molding} />
      <mesh geometry={INNER_PILASTER} position={[free * (halfLength - PILASTER.width / 2), 0, 0]} material={materials.molding} />
      <mesh geometry={INNER_PILASTER} position={[corner * (halfLength - PILASTER.width / 2), 0, 0]} material={materials.molding} />
      <mesh position={[0, wainscotHeight / 2, WAINSCOT_FACE / 2]} material={materials.wallLower}>
        <boxGeometry ref={worldBoxUVs} args={[length, wainscotHeight, WAINSCOT_FACE]} />
      </mesh>
      <mesh geometry={PANEL_FRAMES} material={materials.molding} />
      <RoundedBox args={[length, 0.08, 0.1]} radius={0.035} position={[0, wainscotHeight, 0.05]} material={materials.molding} />
      <RoundedBox args={[length, 0.02, 0.02]} radius={0.009} smoothness={2} position={[0, wainscotHeight - 0.07, WAINSCOT_FACE + 0.01]} material={materials.gold} />
      <RoundedBox args={[length, 0.2, 0.08]} radius={0.035} position={[0, 0.1, 0.06]} material={materials.white} />
    </group>
  );
}

/**
 * The back wall wraps the corner; the left wall stops flush against it, and the two entablatures
 * meet in a mitre. The left wall is turned +90°, which sends its local −x to the front of the room.
 */
function Walls() {
  return (
    <group>
      <group position={[0, 0, -half]}>
        <Wall length={half * 2} corner={-1} cornerReach={t} />
      </group>
      <group position={[-half, 0, 0]} rotation-y={Math.PI / 2}>
        <Wall length={half * 2} corner={1} cornerReach={0} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Curtains: pale blush linen panels drawn to each side, leaving the view clear, hung by rings from
// a wooden rod. Each panel is one sheet of cloth whose folds are tight and regular where the rings gather
// it, then relax and wander as it falls, ending in a softly waved hem.

interface DrapeOptions {
  width: number;
  length: number;
  /** How many folds run across the panel. */
  folds: number;
  /** Fold depth (front to back) at the hem. */
  depth: number;
  /** How much wider the panel spreads at the hem than at the rings. */
  flare: number;
  seed: number;
}

/** One cloth panel, hanging from its top edge at y = 0 and centred on x = 0. UVs are in world units. */
function drapeGeometry({ width, length, folds, depth, flare, seed }: DrapeOptions) {
  const rand = seededRandom(seed);
  const [k0, k1, k2] = [rand() * 6, rand() * 6, rand() * 6];
  const cols = folds * 10;
  const rows = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    // Below the heading the folds deepen and drift just slightly, so they stay even but not mechanical.
    const loose = MathUtils.smoothstep(v, 0, 0.3);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const wander = 0.08 * Math.sin(u * 4.6 + k0 + v * 2.2) + 0.04 * Math.sin(u * 11.3 + k1 - v * 3.4);
      const phase = (u * folds + wander * loose) * Math.PI * 2;
      const swell = 0.92 + 0.08 * Math.sin(u * 6.1 + k2 + v * 1.3);
      const amp = depth * (0.45 + 0.55 * loose) * (0.75 + 0.25 * v) * swell;
      const z = amp * Math.sin(phase);
      const x = (u - 0.5) * width * (1 + flare * v * v);
      // The hem lifts a touch where folds swing forward, so it curves softly instead of cutting straight.
      const hem = MathUtils.smoothstep(v, 0.94, 1) * 0.03 * (1 + Math.sin(phase));
      positions.push(x, -v * length + hem, z);
      uvs.push(u * width * 1.6, v * length);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + cols + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

const CURTAIN = { width: 0.56, length: 2.32, folds: 4 };
/** Rings per curtain, along its heading. */
const RINGS = 6;
/** `out` keeps the folds clear of the window sill, which reaches 0.34 from the wall. */
const ROD = { half: 1.38, radius: 0.028, drop: 0.24, out: 0.46 };

/** A paler, softer blush than the furniture, so the curtains frame the window without weighing on it. */
const curtainLinen = linen('#FBD6E7', [1, 1]);
curtainLinen.side = DoubleSide;
const PANELS = [-1, 1].map((side) => ({
  side,
  curtain: drapeGeometry({ ...CURTAIN, depth: 0.07, flare: 0.2, seed: side > 0 ? 3 : 8 }),
}));

/** The wooden rod: rings along it, a round finial at each end and a bracket into the wall near each. */
function CurtainRod({ y }: { y: number }) {
  const { half: rh, radius: r, out } = ROD;
  const rings: number[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < RINGS; k++) rings.push(side * (rh - 0.1 - (k + 0.5) * (CURTAIN.width / RINGS)));
  }
  return (
    <group position={[0, y, out]}>
      <mesh rotation-z={Math.PI / 2} material={materials.oak}>
        <cylinderGeometry args={[r, r, rh * 2 - 0.1, 16]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* finial: a little collar, then a wooden ball */}
          <mesh position-x={side * (rh - 0.04)} rotation-z={Math.PI / 2} material={materials.oak}>
            <cylinderGeometry args={[r * 1.5, r * 1.5, 0.03, 16]} />
          </mesh>
          <mesh position-x={side * (rh + 0.02)} material={materials.oak}>
            <sphereGeometry args={[0.06, 20, 16]} />
          </mesh>
          {/* bracket: a round plate on the wall and an arm out to a cradle under the rod */}
          <group position-x={side * (rh - 0.2)}>
            <mesh position-z={-out + 0.01} rotation-x={Math.PI / 2} material={materials.oak}>
              <cylinderGeometry args={[0.045, 0.05, 0.02, 20]} />
            </mesh>
            <mesh position={[0, -0.02, -out / 2]} rotation-x={Math.PI / 2} material={materials.oak}>
              <cylinderGeometry args={[0.014, 0.016, out, 10]} />
            </mesh>
          </group>
        </group>
      ))}
      {rings.map((x) => (
        <mesh key={x} position-x={x} rotation-y={Math.PI / 2} material={materials.oak}>
          <torusGeometry args={[r + 0.018, 0.008, 8, 20]} />
        </mesh>
      ))}
    </group>
  );
}

function Curtains({ top }: { top: number }) {
  const rodY = top + ROD.drop;
  return (
    <group>
      <CurtainRod y={rodY} />
      {/* drawn aside, just covering the frame's edge so the view stays open */}
      {PANELS.map(({ side, curtain }) => (
        <mesh key={side} geometry={curtain} material={curtainLinen} position={[side * (ROD.half - 0.1 - CURTAIN.width / 2), rodY - 0.05, ROD.out]} />
      ))}
    </group>
  );
}

/** Window with a sky that crossfades from a pastel day to a moonlit night. */
function Window() {
  const daySky = useCanvasTexture(drawDaySky, 512, 512);
  const nightSky = useCanvasTexture(drawNightSky, 512, 512);
  const night = useRef<MeshBasicMaterial>(null);
  const w = 1.9;
  const h = 1.7;
  const frame = 0.12;

  useDayNight((blend) => {
    if (night.current) night.current.opacity = blend;
  });

  return (
    <group position={ANCHORS.window}>
      <mesh position-z={0.012}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={daySky} toneMapped={false} />
      </mesh>
      <mesh position-z={0.014}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={night} map={nightSky} toneMapped={false} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* frame */}
      {[h / 2, -h / 2].map((y) => (
        <RoundedBox key={`h${y}`} args={[w + frame * 2, frame, 0.16]} radius={0.04} position={[0, y, 0.08]} material={materials.white} />
      ))}
      {[-w / 2, w / 2].map((x) => (
        <RoundedBox key={`v${x}`} args={[frame, h, 0.16]} radius={0.04} position={[x, 0, 0.08]} material={materials.white} />
      ))}
      {/* glazing bars */}
      <RoundedBox args={[0.05, h, 0.05]} radius={0.016} smoothness={2} position={[0, 0, 0.05]} material={materials.white} />
      <RoundedBox args={[w, 0.05, 0.05]} radius={0.016} smoothness={2} position={[0, 0.15, 0.05]} material={materials.white} />
      {/* sill with a little potted plant */}
      <RoundedBox args={[w + 0.45, 0.08, 0.34]} radius={0.035} position={[0, -h / 2 - 0.08, 0.17]} material={materials.white} />
      <ContactShadow position={[0.55, -h / 2 - 0.04, 0.18]} size={[0.16, 0.16]} spread={0.07} strength={0.45} shape="round" />
      <group position={[0.55, -h / 2 - 0.04, 0.18]}>
        <mesh position-y={0.1} material={materials.ceramicPink}>
          <cylinderGeometry args={[0.1, 0.08, 0.2, 20]} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.3) * 0.05, 0.28, Math.sin(i * 1.3) * 0.05]} rotation={[Math.sin(i) * 0.4, i, Math.cos(i) * 0.4]} scale={[0.05, 0.14, 0.035]} material={materials.leaf}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        ))}
      </group>
      <Curtains top={h / 2} />
    </group>
  );
}

/** The braided rug, with a soft shadow where its rolled edge meets the boards. */
function Rug() {
  return (
    <group position={ANCHORS.rug}>
      <ContactShadow position={[0, 0, 0]} size={[RUG.radius * 2, RUG.radius * 2]} spread={0.1} strength={0.3} shape="round" />
      <BraidedRug />
    </group>
  );
}

const BULB_COUNT = 26;

/** The string lights swagged along the back wall, above the window and the desk. */
const WALL_LIGHTS = Array.from({ length: BULB_COUNT }, (_, i) => {
  const u = i / (BULB_COUNT - 1);
  const sag = Math.abs(Math.sin(u * Math.PI * 3)) * 0.28;
  // Strung between the pilasters, so the ends stay clear of their capitals.
  return new Vector3(-half + 0.6 + u * (half * 2 - 1.2), wallHeight - 0.35 - sag, -half + 0.08);
});

function FairyLights() {
  return <StringLights path={WALL_LIGHTS} bulbs={BULB_COUNT} />;
}
