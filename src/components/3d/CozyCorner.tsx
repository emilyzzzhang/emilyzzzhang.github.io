import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DoubleSide,
  BackSide,
  ExtrudeGeometry,
  Euler,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type InstancedMesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ContactShadow } from './ContactShadow';
import { boucle } from './materials';
import { surfaces, tiled } from './surfaces';
import { seededRandom, useCanvasTexture } from './textures';

/*
 * Three soft things on the floor in the front-left corner: a wicker basket with a plaid blanket
 * spilling over its rim, a plush strawberry leaning against it, and a pair of fluffy slippers.
 * Each is sculpted from one continuous surface (turned, swept or deformed), not stacked primitives,
 * and the plush pieces share the room's bouclé texture so they read as fuzzy fabric.
 */

const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Averages normals across vertices that share a position, hiding the seams of wrapped surfaces. */
function weldNormals(geometry: BufferGeometry) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const list = groups.get(key);
    if (list) list.push(i);
    else groups.set(key, [i]);
  }
  const n = new Vector3();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.add(new Vector3(nor.getX(i), nor.getY(i), nor.getZ(i)));
    n.normalize();
    for (const i of list) nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
  return geometry;
}

/** A grid surface (u across, v along), wrapped closed in u when `closed`. */
function gridGeometry(nu: number, nv: number, point: (u: number, v: number) => { p: Vector3; uv?: [number, number]; color?: Color }) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const { p, uv = [i / nu, j / nv], color } = point(i / nu, j / nv);
      positions.push(p.x, p.y, p.z);
      uvs.push(uv[0], uv[1]);
      if (color) colors.push(color.r, color.g, color.b);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + nu + 1;
      // Wound so that, for a wall wrapped counter-clockwise (seen from above) as v rises, faces point outwards.
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (colors.length) geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return weldNormals(geometry);
}

/** A tube twisted round a centre line: rope, for the basket's rim and handles. */
function rope(centre: (t: number) => Vector3, frame: (t: number) => [Vector3, Vector3], { turns, offset, radius, closed, samples = 400 }: { turns: number; offset: number; radius: number; closed: boolean; samples?: number }) {
  return [0, Math.PI].map((phase) => {
    const points: Vector3[] = [];
    const count = closed ? samples : samples + 1;
    for (let k = 0; k < count; k++) {
      const t = k / samples;
      const [a, b] = frame(t);
      const angle = t * turns * TAU + phase;
      points.push(centre(t).addScaledVector(a, Math.cos(angle) * offset).addScaledVector(b, Math.sin(angle) * offset));
    }
    return new TubeGeometry(new CatmullRomCurve3(points, closed), samples * 2, radius, 6, closed);
  });
}

function useInstances(mesh: RefObject<InstancedMesh | null>, matrices: Matrix4[]) {
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [mesh, matrices]);
}

function InstancedPieces({ geometry, material, matrices }: { geometry: BufferGeometry; material: MeshStandardMaterial; matrices: Matrix4[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useInstances(mesh, matrices);
  return <instancedMesh ref={mesh} args={[geometry, material, matrices.length]} />;
}

// ---------------------------------------------------------------------------------------------
// Wicker basket

const BASKET = { height: 0.5, bottom: 0.34, top: 0.42, rows: 13, stakes: 26 };
const HONEY = new Color('#C99257');

/** Radius of the basket's outer wall at height fraction v: flaring out, gently bellied, tucked in at the foot. */
const basketRadius = (v: number) => BASKET.bottom + (BASKET.top - BASKET.bottom) * v + 0.025 * Math.sin(Math.PI * v) - 0.03 * (1 - smoothstep(0, 0.08, v));

/**
 * The woven wall: rounded horizontal strands, each passing over and under the upright stakes in
 * turn (alternating row by row), with a faint twist along each strand. Grooves are shaded darker.
 */
function basketWall() {
  const rand = seededRandom(4);
  const rowTint = Array.from({ length: BASKET.rows + 1 }, () => 0.9 + rand() * 0.16);
  const tint = new Color();
  return gridGeometry(200, 130, (u, v) => {
    const w = v * BASKET.rows;
    const row = Math.min(BASKET.rows, Math.floor(w));
    const ridge = Math.sqrt(Math.max(0, 1 - (2 * (w - row) - 1) ** 2));
    const over = Math.cos(TAU * u * (BASKET.stakes / 2) + Math.PI * row);
    const twist = Math.sin(TAU * (u * BASKET.stakes * 2 + w * 1.5));
    const r = basketRadius(v) + 0.011 * ridge + 0.005 * over * ridge + 0.0015 * twist;
    const shade = (0.5 + 0.5 * ridge * (0.86 + 0.14 * over)) * rowTint[row];
    return {
      p: new Vector3(Math.cos(u * TAU) * r, v * BASKET.height, Math.sin(u * TAU) * r),
      color: tint.copy(HONEY).multiplyScalar(shade).clone(),
    };
  });
}

const RIM_R = BASKET.top + 0.012;
const RIM_Y = BASKET.height + 0.012;

const BASKET_PARTS = (() => {
  const wall = basketWall();
  const inner = new LatheGeometry([new Vector2(BASKET.bottom - 0.035, 0.03), new Vector2(BASKET.top - 0.012, BASKET.height)], 48);
  const floor = new CircleGeometry(BASKET.bottom - 0.03, 40).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
  const base = new CircleGeometry(BASKET.bottom - 0.03, 40).rotateX(Math.PI / 2).translate(0, 0.002, 0);
  // A braided rim: two strands twisting round the top edge.
  const rim = rope(
    (t) => new Vector3(Math.cos(t * TAU) * RIM_R, RIM_Y, Math.sin(t * TAU) * RIM_R),
    (t) => [new Vector3(Math.cos(t * TAU), 0, Math.sin(t * TAU)), UP],
    { turns: 46, offset: 0.013, radius: 0.012, closed: true, samples: 700 },
  );
  // Rope handles rising in a soft arch at each side (local ±z).
  const handles = [Math.PI / 2, -Math.PI / 2].flatMap((at) => {
    const arc = new CatmullRomCurve3(
      Array.from({ length: 21 }, (_, k) => {
        const s = k / 20;
        const a = at + (s - 0.5) * 0.75;
        return new Vector3(Math.cos(a) * RIM_R, RIM_Y + 0.15 * Math.sin(Math.PI * s), Math.sin(a) * RIM_R);
      }),
    );
    const frames = arc.computeFrenetFrames(200, false);
    return rope(
      (t) => arc.getPointAt(t),
      (t) => {
        const k = Math.min(200, Math.round(t * 200));
        return [frames.normals[k], frames.binormals[k]];
      },
      { turns: 9, offset: 0.01, radius: 0.0095, closed: false, samples: 200 },
    );
  });
  return { wall, inner, floor, base, rim, handles };
})();

const wickerWall = new MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.82 });
const wickerRope = new MeshStandardMaterial({ color: '#C38B55', roughness: 0.8 });
const wickerInside = new MeshStandardMaterial({ color: '#A8763F', roughness: 0.9, side: BackSide });
const wickerFloor = new MeshStandardMaterial({ color: '#A8763F', roughness: 0.9 });

/** Cream-and-blush plaid, soft and slightly irregular, like a woven throw. */
function drawPlaid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#FBF1E9';
  ctx.fillRect(0, 0, w, h);
  const band = (horizontal: boolean, at: number, width: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (horizontal) ctx.fillRect(0, at, w, width);
    else ctx.fillRect(at, 0, width, h);
  };
  for (const horizontal of [true, false]) {
    band(horizontal, 18, 54, '#F5C3CD', 0.55);
    band(horizontal, 92, 6, '#EEA5B5', 0.6);
    band(horizontal, 160, 30, '#F7D2D9', 0.5);
    band(horizontal, 214, 4, '#EEA5B5', 0.5);
  }
  ctx.globalAlpha = 1;
}

const BLANKET_WIDTH = 0.46;
/** Plaid repeats every this many world units. */
const PLAID_TILE = 0.3;

/**
 * The throw, in the basket's frame: bunched up inside, then over the front rim (+x) and down the
 * outside, wrapping round the wall as it falls, with soft folds that deepen towards the fringe.
 */
const BLANKET = (() => {
  const H = BASKET.height;
  const path = new CatmullRomCurve3(
    [
      [-0.24, H - 0.08],
      [-0.1, H + 0.05],
      [0.1, H + 0.08],
      [0.3, H + 0.06],
      [BASKET.top - 0.01, H + 0.055],
      [BASKET.top + 0.04, H + 0.03],
      [BASKET.top + 0.055, H - 0.06],
      [basketRadius(0.7) + 0.04, H * 0.7],
      [basketRadius(0.4) + 0.04, H * 0.4],
      [basketRadius(0.16) + 0.045, 0.08],
    ].map(([x, y]) => new Vector3(x, y, 0)),
  );
  const length = path.getLength();
  const hangFrom = 0.48;
  const geometry = gridGeometry(44, 110, (u, v) => {
    const c = path.getPointAt(v);
    const hang = smoothstep(hangFrom - 0.05, 1, v);
    const lateral = (u - 0.5) * BLANKET_WIDTH * (1 + 0.15 * hang);
    // Inside, the fabric heaps in soft lumps; outside it falls in folds that deepen towards the hem.
    const lump = (1 - smoothstep(0.35, 0.5, v)) * 0.035 * Math.sin(u * TAU * 1.5 + 1) * Math.sin(v * 13);
    const fold = smoothstep(0.45, 0.6, v) * (0.006 + 0.02 * hang) * Math.sin(TAU * 2.5 * u + v * 2.2);
    const radial = c.x + fold;
    // Planar while over the basket's middle, wrapped round the wall once it reaches the rim.
    const wrap = smoothstep(0.2, 0.36, c.x);
    const flat = new Vector3(radial, c.y + lump, lateral);
    const angle = lateral / Math.max(radial, 0.3);
    const wrapped = new Vector3(Math.cos(angle) * radial, c.y, Math.sin(angle) * radial);
    return { p: flat.lerp(wrapped, wrap), uv: [(u * BLANKET_WIDTH) / PLAID_TILE, (v * length) / PLAID_TILE] };
  });
  // Fringe: little tassels along the hem.
  const tassels: Matrix4[] = [];
  const pos = geometry.attributes.position;
  const lastRow = 110 * 45;
  for (let i = 0; i <= 44; i += 2) {
    const p = new Vector3().fromBufferAttribute(pos, lastRow + i);
    tassels.push(new Matrix4().compose(p.add(new Vector3(0, -0.028, 0)), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (i % 4) * 0.05 - 0.05), new Vector3(1, 1, 1)));
  }
  return { geometry, tassels };
})();
const TASSEL = new CapsuleGeometry(0.0045, 0.045, 3, 6);
const tasselMaterial = new MeshStandardMaterial({ color: '#FBF1E9', roughness: 0.95 });
/** A loosely folded heap filling the basket's mouth, rumpled into soft lumps, so the inside never looks hollow. */
const HEAP = (() => {
  const geometry = new SphereGeometry(1, 48, 24);
  const pos = geometry.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const lumps = p.y > 0 ? 1 + 0.45 * Math.sin(p.x * 4.1 + 0.6) * Math.sin(p.z * 3.7 + 1.9) + 0.25 * Math.sin(p.x * 9 + p.z * 7) : 1;
    pos.setXYZ(i, p.x * 0.34, p.y * 0.09 * lumps, p.z * 0.34);
  }
  geometry.computeVertexNormals();
  return weldNormals(geometry).translate(-0.02, BASKET.height - 0.02, 0);
})();

function useBlanketMaterial() {
  const plaid = useCanvasTexture(drawPlaid, 256, 256);
  return useMemo(() => {
    plaid.wrapS = plaid.wrapT = RepeatWrapping;
    plaid.needsUpdate = true;
    const weave = tiled(surfaces.linen, 6, 6);
    return new MeshStandardMaterial({ map: plaid, roughness: 0.95, normalMap: weave.normalMap, normalScale: new Vector2(0.35, 0.35), side: DoubleSide });
  }, [plaid]);
}

function Basket() {
  const blanket = useBlanketMaterial();
  const p = BASKET_PARTS;
  return (
    <group>
      <mesh geometry={p.wall} material={wickerWall} />
      <mesh geometry={p.inner} material={wickerInside} />
      <mesh geometry={p.floor} material={wickerFloor} />
      <mesh geometry={p.base} material={wickerFloor} />
      {[...p.rim, ...p.handles].map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={wickerRope} />
      ))}
      <mesh geometry={HEAP} material={blanket} />
      {/* a thin double-sided sheet this close to the wicker would shade itself into acne */}
      <mesh geometry={BLANKET.geometry} material={blanket} userData={{ noShadow: true }} />
      <InstancedPieces geometry={TASSEL} material={tasselMaterial} matrices={BLANKET.tassels} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Strawberry plush

const BERRY = { radius: 0.27, height: 0.3 };

/** Profile from the bottom tip to the top centre: widest above the middle, a soft rounded point below, a flattish top. */
function berryPoint(a: number) {
  const y = -Math.cos(a);
  const body = 0.6 + 0.4 * smoothstep(-1, 0.35, y);
  return new Vector2(Math.max(Math.sin(a) ** 0.85 * body * BERRY.radius, 1e-4), (y > 0 ? y * 0.72 : y * 1.08) * BERRY.height);
}

/** Leaning back on its side a little, resting on its lower curve. */
const BERRY_TILT = new Quaternion().setFromEuler(new Euler(-0.1, 0, 0.38));

const STRAWBERRY = (() => {
  const steps = 48;
  const profile = Array.from({ length: steps + 1 }, (_, i) => berryPoint((i / steps) * Math.PI));
  const body = new LatheGeometry(profile, 56);
  // Squish: flatten where it presses on the floor, as a stuffed toy does.
  const down = new Vector3(0, -1, 0).applyQuaternion(BERRY_TILT.clone().invert());
  const pos = body.attributes.position;
  const p = new Vector3();
  let deepest = -Infinity;
  for (let i = 0; i < pos.count; i++) deepest = Math.max(deepest, p.fromBufferAttribute(pos, i).dot(down));
  const press = 0.025;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const over = p.dot(down) - (deepest - press);
    if (over > 0) {
      p.addScaledVector(down, -over * 0.8);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
  const rest = deepest - press * 0.8;

  // Embroidered seeds in staggered rows, each lying along the berry's curve towards the top.
  const seeds: Matrix4[] = [];
  for (let row = 0; row < 6; row++) {
    const a = Math.PI * (0.17 + row * 0.11);
    const at = berryPoint(a);
    const ahead = berryPoint(a + 0.01);
    const along2 = new Vector2(ahead.x - at.x, ahead.y - at.y).normalize();
    const count = Math.round((TAU * at.x) / 0.1);
    for (let k = 0; k < count; k++) {
      const theta = ((k + (row % 2) * 0.5) / count) * TAU;
      const [c, s] = [Math.cos(theta), Math.sin(theta)];
      const along = new Vector3(along2.x * c, along2.y, along2.x * s);
      const normal = new Vector3(along2.y * c, -along2.x, along2.y * s).normalize();
      const point = new Vector3(at.x * c, at.y, at.x * s).addScaledVector(normal, 0.002);
      if (point.dot(down) > rest - 0.04) continue; // hidden where it presses on the floor
      const side = new Vector3().crossVectors(along, normal).normalize();
      seeds.push(new Matrix4().makeBasis(side.multiplyScalar(0.0095), along.multiplyScalar(0.016), normal.multiplyScalar(0.005)).setPosition(point));
    }
  }

  // Calyx: six puffy felt leaves fanning from the top, drooping over the shoulders.
  const top = berryPoint(Math.PI).y;
  const leafShape = new Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.06, 0.06, 0.165, 0);
  leafShape.quadraticCurveTo(0.06, -0.06, 0, 0);
  const leaf = new ExtrudeGeometry(leafShape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.011, bevelSize: 0.011, bevelSegments: 3, curveSegments: 14 });
  leaf.rotateX(-Math.PI / 2);
  const lp = leaf.attributes.position;
  for (let i = 0; i < lp.count; i++) lp.setY(i, lp.getY(i) - 2.4 * Math.max(0, lp.getX(i)) ** 2);
  leaf.computeVertexNormals();
  const rand = seededRandom(9);
  const calyx = mergeGeometries(
    Array.from({ length: 6 }, (_, i) =>
      leaf
        .clone()
        .rotateZ(0.12)
        .rotateY((i / 6) * TAU + rand() * 0.3)
        .translate(0, top - 0.004, 0),
    ),
  );
  // A curly little stem looping up from the middle.
  const stem = new TubeGeometry(
    new CatmullRomCurve3([[0, -0.01, 0], [0, 0.04, 0], [0.012, 0.08, 0], [0.045, 0.088, 0.004], [0.06, 0.062, 0.008], [0.042, 0.046, 0.01]].map(([x, y, z]) => new Vector3(x, top + y, z))),
    40,
    0.013,
    8,
    false,
  );
  const crown = new SphereGeometry(1, 20, 12).scale(0.04, 0.018, 0.04).translate(0, top + 0.004, 0);
  return { body, seeds, calyx, stem, crown, rest };
})();

const berryFabric = boucle('#EE8E9A', [TAU * BERRY.radius, 0.8], true);
const leafFelt = boucle('#9DB07F');
const seedThread = new MeshStandardMaterial({ color: '#FFF3E4', roughness: 0.75 });
const SEED = new SphereGeometry(1, 10, 8);

function Strawberry() {
  const s = STRAWBERRY;
  return (
    <group position-y={s.rest} quaternion={BERRY_TILT}>
      <mesh geometry={s.body} material={berryFabric} />
      <InstancedPieces geometry={SEED} material={seedThread} matrices={s.seeds} />
      <mesh geometry={s.calyx} material={leafFelt} />
      <mesh geometry={s.crown} material={leafFelt} />
      <mesh geometry={s.stem} material={leafFelt} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Fluffy slippers: a plump moccasin shape under layered fur shells, like the rug's pile, so the
// outline is genuinely fuzzy. Fur is longest on the rolled collar, plush over the sides and toe,
// short inside the pink lining, and absent on the sole.

const SLIPPER = { half: [0.12, 0.095, 0.26] as [number, number, number] };
const FUR = { layers: 18, length: 0.026 };
const CREAM = new Color('#FFF8F0');
const LINING = new Color('#F7C3CE');
const SOLE = new Color('#EAD3C8');

/** The base surface, toe towards +z: rest positions, normals, colours and how long the fur grows at each point. */
function slipperBase() {
  // Seam turned to the heel, where it's least seen.
  const sphere = new SphereGeometry(1, 72, 44).rotateY(-Math.PI / 2);
  const pos = sphere.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const fur = new Float32Array(pos.count);
  const p = new Vector3();
  const color = new Color();
  const [hx, hy, hz] = SLIPPER.half;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let { x, y } = p;
    let length = 1;
    color.copy(CREAM);
    // Plump, softly bulging sides.
    x *= 1 + 0.1 * (1 - p.y * p.y);
    if (y > 0) {
      const d = (p.x / 0.6) ** 2 + ((p.z + 0.26) / 0.62) ** 2;
      if (d < 1) {
        // A big oval opening dipping into a pink-lined hollow.
        const inside = smoothstep(0, 0.25, 1 - d);
        y += (-0.3 - y) * inside;
        color.lerp(LINING, smoothstep(0, 0.1, 1 - d));
        length = 1 - 0.55 * inside;
      }
      // The rolled collar: a plump ridge of extra-long fluff round the opening.
      const collar = Math.exp(-(((d - 1) / 0.24) ** 2)) * smoothstep(0, 0.35, p.y);
      y += 0.22 * collar;
      length += 0.7 * collar;
      // A round, slightly lower toe box.
      y *= 1 - 0.22 * smoothstep(0.15, 1, p.z);
    }
    if (y < -0.58) {
      y = -0.58 + (y + 0.58) * 0.12;
      color.copy(SOLE);
    }
    length *= smoothstep(-0.62, -0.42, y);
    pos.setXYZ(i, x * hx, y * hy, p.z * hz);
    colors.set([color.r, color.g, color.b], i * 3);
    fur[i] = length;
  }
  sphere.setAttribute('color', new Float32BufferAttribute(colors, 3));
  sphere.setAttribute('aFur', new Float32BufferAttribute(fur, 1));
  sphere.translate(0, 0.59 * hy, 0);
  sphere.computeVertexNormals();
  return weldNormals(sphere);
}

const SLIPPER_BASE = slipperBase();

/** The fur: copies of the base pushed out along its normals, one per layer, merged into one draw call. */
const SLIPPER_FUR = (() => {
  const { position, normal, color, aFur } = SLIPPER_BASE.attributes;
  const index = SLIPPER_BASE.getIndex()!;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const rest: number[] = [];
  const layer: number[] = [];
  const indices: number[] = [];
  for (let l = 1; l <= FUR.layers; l++) {
    const h = l / FUR.layers;
    const offset = positions.length / 3;
    for (let i = 0; i < position.count; i++) {
      const reach = h * FUR.length * aFur.getX(i);
      positions.push(position.getX(i) + normal.getX(i) * reach, position.getY(i) + normal.getY(i) * reach - h * h * 0.004, position.getZ(i) + normal.getZ(i) * reach);
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      colors.push(color.getX(i), color.getY(i), color.getZ(i));
      rest.push(position.getX(i), position.getY(i), position.getZ(i));
      layer.push(aFur.getX(i) > 0.02 ? h : 2);
    }
    for (let k = 0; k < index.count; k++) indices.push(offset + index.getX(k));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aRest', new Float32BufferAttribute(rest, 3));
  geometry.setAttribute('aLayer', new Float32BufferAttribute(layer, 1));
  geometry.setIndex(indices);
  return geometry;
})();

/** Soft fur: fibres thin out towards their tips, with a velvety sheen and darker roots. */
function slipperFurMaterial() {
  const material = new MeshPhysicalMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new Color('#FFF4EE') });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest;\nattribute float aLayer;\nvarying vec3 vRest;\nvarying float vLayer;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest;\nvLayer = aLayer;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        varying float vLayer;
        float fluffHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float fluffNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(fluffHash(i), fluffHash(i + vec3(1, 0, 0)), u.x), mix(fluffHash(i + vec3(0, 1, 0)), fluffHash(i + vec3(1, 1, 0)), u.x), u.y),
            mix(mix(fluffHash(i + vec3(0, 0, 1)), fluffHash(i + vec3(1, 0, 1)), u.x), mix(fluffHash(i + vec3(0, 1, 1)), fluffHash(i + vec3(1, 1, 1)), u.x), u.y),
            u.z);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (vLayer > 1.0) discard;
        // Fine fibres and soft clumps: fewer survive towards the tips, so the edge melts into fuzz.
        float fibre = fluffNoise(vRest * 420.0) * 0.6 + fluffNoise(vRest * 140.0 + 3.0) * 0.4;
        if (fibre < 0.28 + vLayer * 0.62) discard;
        diffuseColor.rgb *= mix(0.8, 1.04, vLayer);`,
      );
  };
  return material;
}

const slipperFur = slipperFurMaterial();
/** The felted surface beneath the fur, which also casts the slipper's shadow (the shells can't). */
const slipperFelt = (() => {
  const m = boucle('#FFFFFF', [TAU * 0.18, 0.55], true);
  m.vertexColors = true;
  return m;
})();

/** Where the bow sits: the top of the toe box, lifted onto the fluff, and the surface's normal there. */
const BOW_POSE = (() => {
  const { position, normal } = SLIPPER_BASE.attributes;
  let best = -1;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getX(i)) < 0.015 && Math.abs(position.getZ(i) - 0.175) < 0.02 && (best < 0 || position.getY(i) > position.getY(best))) best = i;
  }
  const n = new Vector3().fromBufferAttribute(normal, best);
  const at = new Vector3().fromBufferAttribute(position, best).addScaledVector(n, FUR.length * 0.9);
  return { position: at, quaternion: new Quaternion().setFromUnitVectors(UP, n) };
})();

/** A soft yarn bow lying on the toe: two loops either side of a knot and two short tails towards the toe. */
const BOW_YARN = (() => {
  const curve = (points: [number, number, number][]) => new TubeGeometry(new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z))), 32, 0.0065, 8, false);
  const parts = [-1, 1].flatMap((s) => [
    curve([[0, 0.002, 0], [s * 0.016, 0.006, -0.012], [s * 0.036, 0.006, -0.008], [s * 0.04, 0.004, 0.004], [s * 0.022, 0.003, 0.009], [0, 0.002, 0.001]]),
    curve([[0, 0.001, 0.004], [s * 0.008, 0, 0.02], [s * 0.016, -0.002, 0.036]]),
  ]);
  const knot = new SphereGeometry(0.009, 12, 10).scale(1, 0.8, 1).translate(0, 0.004, 0.002);
  return mergeGeometries([...parts, knot]);
})();
const bowYarn = boucle('#EE9DB1');

function Slipper({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh geometry={SLIPPER_BASE} material={slipperFelt} />
      {/* Shells cut fibres with discard, which the shadow pass can't see, so only the base casts. */}
      <mesh geometry={SLIPPER_FUR} material={slipperFur} userData={{ noShadow: true }} raycast={() => null} />
      <mesh geometry={BOW_YARN} material={bowYarn} position={BOW_POSE.position} quaternion={BOW_POSE.quaternion} scale={1.35} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------

/**
 * The cozy corner, in its own frame on the floor. The basket's blanket side (+x) is turned
 * towards the overview camera; the strawberry leans against it and the slippers sit in front.
 */
export function CozyCorner({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <group position={[-0.42, 0, -0.12]} rotation-y={-Math.PI / 4}>
        <ContactShadow position={[0, 0, 0]} size={[0.95, 0.95]} spread={0.14} strength={0.5} shape="round" />
        <Basket />
      </group>
      <group position={[0.2, 0, 0.32]} rotation-y={0.5}>
        <ContactShadow position={[0, 0, 0]} size={[0.5, 0.42]} spread={0.12} strength={0.48} shape="round" />
        <Strawberry />
      </group>
      <group position={[0.78, 0, 0.62]} scale={1.25}>
        <ContactShadow position={[-0.18, 0, 0.04]} size={[0.3, 0.56]} spread={0.08} strength={0.42} shape="round" rotationY={0.6} />
        <ContactShadow position={[0.19, 0, -0.08]} size={[0.3, 0.56]} spread={0.08} strength={0.42} shape="round" rotationY={0.9} />
        <Slipper position={[-0.18, 0, 0.04]} rotationY={0.6} />
        <Slipper position={[0.19, 0, -0.08]} rotationY={0.9} />
      </group>
    </group>
  );
}
