import { useLayoutEffect, useMemo, useRef } from 'react';
import { Instance, Instances, RoundedBox, RoundedBoxGeometry } from '@react-three/drei';
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
} from 'three';
import { sceneColors as c } from '../../config/theme';
import { ContactShadow, type ContactShadowProps } from './ContactShadow';
import { materials, paperFinish } from './materials';
import { seededRandom, useCanvasTexture } from './textures';

/*
 * A warm oak bookshelf: thick, softly rounded boards under an overhanging top, a recessed plinth
 * and a back of vertical planks. Books are mixed in size and colour, upright and in small stacks,
 * never evenly spaced, and share the shelves with a ceramic cat, a framed print and small plants;
 * a pothos trails over the top. Bookshelf-local: x across, y up, z out of the front.
 */

const WIDTH = 2.2;
const HEIGHT = 3.6;
const DEPTH = 0.7;
const SIDE = 0.1;
const BOARD = 0.085;
const TOP = 0.1;
/** Centre heights of the shelves, bottom to top; the top itself sits above them. */
const SHELVES = [0.22, 1.08, 1.94, 2.8];
const INNER = WIDTH / 2 - SIDE;
const BACK_Z = -DEPTH / 2 + 0.03;
/** Where book spines line up, a little back from the shelves' front edge. */
const SPINE_Z = DEPTH / 2 - 0.08;

const shelfTop = (shelf: number) => SHELVES[shelf] + BOARD / 2;
const CLEAR = SHELVES[1] - SHELVES[0] - BOARD;

// ---------------------------------------------------------------------------------------------
// Books

const BOOK_COLORS = ['#F2B8C6', '#E9A5B8', '#F6C5CF', '#CDB8E6', '#BBA8DD', '#B9CDB0', '#A3BF9A', '#B4CBD2', '#F3E6D3', '#F4C9AE', '#F7D9C4', '#E7C9D9', '#C8E0D0'];
const BAND_COLORS = ['#FBF3E6', '#E8CF9A', '#FFFFFF'];

interface Piece {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  color: string;
}

interface Layout {
  books: Piece[];
  bands: Piece[];
  shadows: ContactShadowProps[];
}

function layoutBooks(): Layout {
  const rand = seededRandom(42);
  const range = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const books: Piece[] = [];
  const bands: Piece[] = [];
  const shadows: ContactShadowProps[] = [];

  /** A book of size [w, h, d] (w across its spine) centred at `centre`, with a band or two on its spine. */
  const book = (centre: Vector3, [w, h, d]: [number, number, number], rotation: Euler, color: string, banded = rand() < 0.55) => {
    books.push({ position: centre, rotation, scale: new Vector3(w, h, d), color });
    if (!banded) return;
    const bandColor = pick(BAND_COLORS);
    const at = rand() < 0.5 ? [0.78] : [0.2, 0.8];
    for (const f of at) {
      const offset = new Vector3(0, (f - 0.5) * h, d / 2 + 0.002).applyEuler(rotation);
      bands.push({ position: centre.clone().add(offset), rotation, scale: new Vector3(w * 1.01, range(0.018, 0.03), 0.006), color: bandColor });
    }
  };

  /** Upright books from `from` to `to`, in uneven runs: the odd gap, a short series, maybe one leaning at the end. */
  const row = (shelf: number, from: number, to: number, [hMin, hMax]: [number, number], lean = false) => {
    const base = shelfTop(shelf);
    let x = from;
    let last = { right: from, h: 0 };
    while (true) {
      // Now and then a series: two or three matching volumes.
      const series = rand() < 0.22 ? 2 + Math.floor(rand() * 2) : 1;
      const color = pick(BOOK_COLORS);
      const h = range(hMin, hMax) * CLEAR;
      const d = range(0.36, 0.48);
      const w = range(0.06, 0.12);
      if (x + w * series > to) break;
      for (let i = 0; i < series; i++) {
        book(new Vector3(x + w / 2, base + h / 2, SPINE_Z - d / 2 + range(-0.015, 0.01)), [w, h, d], new Euler(), color, series > 1 || undefined);
        last = { right: x + w, h };
        x += w + range(0.002, 0.008);
      }
      if (rand() < 0.15) x += range(0.02, 0.05);
    }
    if (lean) {
      // Leaning left against the last book, standing on its bottom-left corner.
      const angle = range(0.22, 0.32);
      const w = range(0.07, 0.1);
      const h = Math.max(last.h / Math.cos(angle) + 0.02, range(0.6, 0.72) * CLEAR);
      const px = last.right + last.h * 0.92 * Math.tan(angle);
      const d = range(0.38, 0.46);
      const centre = new Vector3(px + (w / 2) * Math.cos(angle) - (h / 2) * Math.sin(angle), base + (w / 2) * Math.sin(angle) + (h / 2) * Math.cos(angle), SPINE_Z - d / 2);
      book(centre, [w, h, d], new Euler(0, 0, angle), pick(BOOK_COLORS));
      x = px + w;
    }
    shadows.push({ position: [(from + x) / 2, base, SPINE_Z - 0.22], size: [x - from + 0.04, 0.46], spread: 0.06, strength: 0.42 });
  };

  /** Books lying flat, spines out, each a little smaller and turned a touch differently. Returns the stack's top. */
  const stack = (shelf: number, x: number, count: number, length = 0.5) => {
    let y = shelfTop(shelf);
    for (let i = 0; i < count; i++) {
      const t = range(0.055, 0.09);
      const l = length - i * range(0.02, 0.05);
      const d = range(0.32, 0.4);
      const centre = new Vector3(x + range(-0.03, 0.03), y + t / 2, SPINE_Z - d / 2 + range(-0.02, 0.01));
      books.push({ position: centre, rotation: new Euler(0, range(-0.08, 0.08), 0), scale: new Vector3(l, t, d), color: pick(BOOK_COLORS) });
      y += t;
    }
    shadows.push({ position: [x, shelfTop(shelf), SPINE_Z - 0.18], size: [length + 0.04, 0.4], spread: 0.06, strength: 0.42 });
    return y;
  };

  row(0, -INNER + 0.02, 0.18, [0.62, 0.86], true);
  const bottomStack = stack(0, 0.62, 3, 0.52);
  row(1, -INNER + 0.02, -0.34, [0.56, 0.78]);
  const vaseStack = stack(2, -0.68, 2, 0.46);
  row(2, -0.3, INNER - 0.04, [0.58, 0.84], false);
  row(3, -INNER + 0.02, -0.28, [0.6, 0.82], true);
  const candleStack = stack(3, 0.34, 3, 0.48);
  STACK_TOPS.bottom = bottomStack;
  STACK_TOPS.vase = vaseStack;
  STACK_TOPS.candle = candleStack;
  return { books, bands, shadows };
}

/** Heights of the stacks' tops, so decor can sit on them; filled in by layoutBooks. */
const STACK_TOPS = { bottom: 0, vase: 0, candle: 0 };
const LAYOUT = layoutBooks();

function Books() {
  return (
    <>
      {/* Unit box scaled per book, so the rounding scales too: soft spines and slightly rounder page edges. */}
      <Instances limit={LAYOUT.books.length}>
        <RoundedBoxGeometry args={[1, 1, 1]} radius={0.08} smoothness={2} bevelSegments={2} />
        <meshStandardMaterial {...paperFinish(0.8)} />
        {LAYOUT.books.map((b, i) => (
          <Instance key={i} position={b.position} rotation={b.rotation} scale={b.scale} color={b.color} />
        ))}
      </Instances>
      <Instances limit={LAYOUT.bands.length}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.55} />
        {LAYOUT.bands.map((b, i) => (
          <Instance key={i} position={b.position} rotation={b.rotation} scale={b.scale} color={b.color} />
        ))}
      </Instances>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Carcass

function Carcass() {
  const sideHeight = HEIGHT - TOP + 0.02;
  return (
    <group>
      {/* sides are built lying down and stood up, so the grain runs along their height */}
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[sideHeight, SIDE, DEPTH]}
          radius={0.04}
          smoothness={4}
          position={[side * (WIDTH / 2 - SIDE / 2), sideHeight / 2, 0]}
          rotation-z={Math.PI / 2}
          material={materials.oak}
        />
      ))}
      {/* the top overhangs a little at the front and sides, with a generous round-over */}
      <RoundedBox args={[WIDTH + 0.08, TOP, DEPTH + 0.05]} radius={0.045} smoothness={5} position={[0, HEIGHT - TOP / 2, 0.02]} material={materials.oak} />
      {SHELVES.map((y) => (
        <RoundedBox key={y} args={[WIDTH - SIDE * 2 + 0.02, BOARD, DEPTH - 0.04]} radius={0.03} smoothness={4} position={[0, y, 0.015]} material={materials.oak} />
      ))}
      {/* recessed plinth under the bottom shelf */}
      <RoundedBox args={[WIDTH - SIDE * 2 + 0.02, SHELVES[0] - BOARD / 2, 0.05]} radius={0.015} smoothness={2} position={[0, (SHELVES[0] - BOARD / 2) / 2, DEPTH / 2 - 0.07]} material={materials.oakBack} />
      {/* back of four vertical planks, with hairline gaps between them */}
      {[0, 1, 2, 3].map((i) => {
        const pw = (WIDTH - SIDE * 2) / 4;
        return (
          <RoundedBox
            key={i}
            args={[sideHeight - 0.02, pw - 0.008, 0.03]}
            radius={0.008}
            smoothness={2}
            position={[-INNER + pw * (i + 0.5), sideHeight / 2, BACK_Z]}
            rotation-z={Math.PI / 2}
            material={materials.oakBack}
          />
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Decor

/** A turned profile with a softly rounded foot and lip, for pots and vases. */
function vessel(points: [number, number][]) {
  return new LatheGeometry(
    points.map(([x, y]) => new Vector2(x, y)),
    32,
  );
}

const POT = vessel([
  [0, 0],
  [0.075, 0],
  [0.088, 0.012],
  [0.1, 0.1],
  [0.112, 0.17],
  [0.118, 0.19],
  [0.11, 0.195],
  [0.104, 0.18],
  [0, 0.18],
]);
const SMALL_POT = POT.clone().scale(0.72, 0.62, 0.72);
const BUD_VASE = vessel([
  [0, 0],
  [0.045, 0],
  [0.062, 0.03],
  [0.064, 0.07],
  [0.04, 0.12],
  [0.022, 0.16],
  [0.028, 0.185],
  [0.02, 0.19],
  [0, 0.17],
]);

/** A heart-shaped pothos leaf, 1 unit long: base at the origin, tip along +y, facing +z, gently cupped and arched. */
function pothosLeaf() {
  const shape = new Shape();
  shape.moveTo(0, 0.04);
  shape.bezierCurveTo(0.18, -0.1, 0.48, 0.12, 0.38, 0.45);
  shape.bezierCurveTo(0.3, 0.72, 0.08, 0.86, 0, 1);
  shape.bezierCurveTo(-0.08, 0.86, -0.3, 0.72, -0.38, 0.45);
  shape.bezierCurveTo(-0.48, 0.12, -0.18, -0.1, 0, 0.04);
  const geometry: BufferGeometry = new ShapeGeometry(shape, 8);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new Color('#4F8A4A');
  const light = new Color('#9CC77E');
  const tint = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -0.35 * x * x + 0.12 * y * (1 - y) - 0.08 * y * y);
    // Paler along the midrib and towards the tip, like a marbled pothos.
    tint.copy(dark).lerp(light, Math.max(0, 1 - Math.abs(x) * 4) * 0.55 + y * 0.25);
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const LEAF = pothosLeaf();
const leafMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: DoubleSide });
const vineMaterial = new MeshStandardMaterial({ color: '#6E9A5A', roughness: 0.7 });
const LEAF_TINTS = ['#FFFFFF', '#F1F8EA', '#E2EFD8', '#F7FBEF'].map((h) => new Color(h));

/** A leaf at `base`, its tip heading along `tip`, its face turned towards `facing`. */
function leafMatrix(base: Vector3, tip: Vector3, facing: Vector3, size: number) {
  const y = tip.clone().normalize();
  const x = new Vector3().crossVectors(y, facing).normalize();
  const z = new Vector3().crossVectors(x, y);
  return new Matrix4().makeBasis(x.multiplyScalar(size), y.multiplyScalar(size), z.multiplyScalar(size)).setPosition(base);
}

/** Pothos trailing over the top: a mound of leaves in the pot, and vines spilling over the front and down the side. */
function buildPothos() {
  const rand = seededRandom(7);
  const range = (a: number, b: number) => a + rand() * (b - a);
  const leaves: Matrix4[] = [];
  const top = HEIGHT + 0.2;
  const pot = new Vector3(0.62, HEIGHT, 0.04);

  // The mound: leaves rising from the soil, turned every way and arching out.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 * 1.6 + range(-0.3, 0.3);
    const out = new Vector3(Math.cos(a), 0, Math.sin(a));
    const lift = range(0.5, 1.3);
    const base = pot.clone().add(new Vector3(0, top - HEIGHT + range(-0.01, 0.06), 0)).addScaledVector(out, range(0.02, 0.07));
    leaves.push(leafMatrix(base, out.clone().multiplyScalar(Math.cos(lift * 0.6)).setY(Math.sin(lift)), out.clone().setY(0.6), range(0.15, 0.21)));
  }

  const paths = [
    // over the front edge and down in front of the right-hand side
    [[0.7, top, 0.1], [0.86, top - 0.06, 0.34], [0.98, HEIGHT - 0.02, 0.46], [1.06, HEIGHT - 0.4, 0.45], [1.08, HEIGHT - 0.85, 0.44], [1.04, HEIGHT - 1.25, 0.43]],
    // a short drape over the front of the top
    [[0.55, top, 0.12], [0.48, top - 0.06, 0.38], [0.42, HEIGHT - 0.02, 0.47], [0.44, HEIGHT - 0.28, 0.46], [0.4, HEIGHT - 0.5, 0.45]],
    // round the corner and down the outside of the right-hand side
    [[0.76, top, -0.02], [1.02, top - 0.05, -0.05], [1.2, HEIGHT - 0.04, 0.0], [1.22, HEIGHT - 0.6, 0.06], [1.2, HEIGHT - 1.2, 0.12], [1.21, HEIGHT - 1.75, 0.16]],
  ];
  const vines = paths.map((p) => new CatmullRomCurve3(p.map(([x, y, z]) => new Vector3(x, y, z))));
  vines.forEach((curve, v) => {
    const length = curve.getLength();
    const count = Math.floor(length / 0.065);
    // Facing away from the shelf: forwards for vines in front, outwards for the one down the side.
    const facing = v === 2 ? new Vector3(1, 0, 0.3) : new Vector3(0.15, 0.1, 1);
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      const at = curve.getPointAt(Math.min(1, t));
      const along = curve.getTangentAt(Math.min(1, t));
      const sideways = new Vector3().crossVectors(along, facing).normalize().multiplyScalar(i % 2 ? 1 : -1);
      // Leaves stand out from the vine on alternate sides and droop towards their tips; smaller towards the end.
      const tip = sideways.multiplyScalar(0.7).addScaledVector(along, 0.6).add(new Vector3(0, -0.25, 0));
      leaves.push(leafMatrix(at, tip, facing, range(0.13, 0.17) * (1 - 0.3 * t)));
    }
  });
  return { leaves, vines: vines.map((curve) => new TubeGeometry(curve, 64, 0.011, 5, false)), pot };
}

const POTHOS = buildPothos();

/** A small upright plant for a shelf: a few leaves rising and arching out of a little pot. */
function sprigMatrices(seed: number, count: number, size: number, potTop: number) {
  const rand = seededRandom(seed);
  const result: Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.5;
    const out = new Vector3(Math.cos(a), 0, Math.sin(a));
    const lift = 0.7 + rand() * 0.7;
    result.push(leafMatrix(new Vector3(0, potTop, 0).addScaledVector(out, 0.02), out.clone().multiplyScalar(Math.cos(lift)).setY(Math.sin(lift)), out.clone().setY(0.8), size * (0.8 + rand() * 0.4)));
  }
  return result;
}

const SPRIG = sprigMatrices(11, 12, 0.17, 0.11);

function Leaves({ matrices }: { matrices: Matrix4[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    matrices.forEach((matrix, i) => {
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, LEAF_TINTS[i % LEAF_TINTS.length]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={mesh} args={[LEAF, leafMaterial, matrices.length]} />;
}

function Pot({ geometry, soilY, soilR }: { geometry: BufferGeometry; soilY: number; soilR: number }) {
  return (
    <>
      <mesh geometry={geometry} material={materials.ceramicWhite} />
      <mesh position-y={soilY} rotation-x={-Math.PI / 2} material={materials.soil}>
        <circleGeometry args={[soilR, 20]} />
      </mesh>
    </>
  );
}

function Pothos() {
  return (
    <group>
      <group position={POTHOS.pot.toArray()}>
        <group scale={1.2}>
          <Pot geometry={POT} soilY={0.17} soilR={0.1} />
        </group>
      </group>
      {POTHOS.vines.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={vineMaterial} />
      ))}
      <Leaves matrices={POTHOS.leaves} />
    </group>
  );
}

function ShelfPlant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} scale={1.35}>
      <Pot geometry={SMALL_POT} soilY={0.105} soilR={0.07} />
      <Leaves matrices={SPRIG} />
    </group>
  );
}

/** A plump little succulent rosette in a pot. */
function Succulent({ position }: { position: [number, number, number] }) {
  const petals = useMemo(() => {
    const result: { rotation: [number, number, number, 'YXZ']; scale: number }[] = [];
    for (let ring = 0; ring < 3; ring++) {
      for (let i = 0; i < 6; i++) result.push({ rotation: [0.9 - ring * 0.35, (i / 6) * Math.PI * 2 + ring * 0.5, 0, 'YXZ'], scale: 1 - ring * 0.25 });
    }
    return result;
  }, []);
  return (
    <group position={position} scale={1.35}>
      <Pot geometry={SMALL_POT} soilY={0.105} soilR={0.07} />
      {petals.map(({ rotation, scale }, i) => (
        <group key={i} position-y={0.11} rotation={rotation}>
          <mesh position-y={0.045 * scale} scale={[0.026 * scale, 0.05 * scale, 0.015 * scale]} material={materials.sageDeep}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const catBlush = new MeshStandardMaterial({ color: '#F4A9B9', roughness: 0.6 });

/** A cream glazed ceramic cat, sitting loaf-like with its tail curled round: closed happy eyes and pink cheeks. */
function CatFigurine({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const glaze = materials.ceramicWhite;
  return (
    <group position={position} rotation-y={rotationY} scale={1.5}>
      <mesh position-y={0.085} scale={[0.11, 0.09, 0.1]} material={glaze}>
        <sphereGeometry args={[1, 28, 20]} />
      </mesh>
      <mesh position={[0, 0.2, 0.025]} scale={[0.085, 0.075, 0.078]} material={glaze}>
        <sphereGeometry args={[1, 28, 20]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* ears */}
          <mesh position={[s * 0.048, 0.268, 0.02]} rotation-z={-s * 0.35} material={glaze}>
            <coneGeometry args={[0.03, 0.055, 16]} />
          </mesh>
          <mesh position={[s * 0.046, 0.263, 0.036]} rotation-z={-s * 0.35} scale={[0.55, 0.6, 0.3]} material={catBlush}>
            <coneGeometry args={[0.03, 0.055, 12]} />
          </mesh>
          {/* closed, smiling eyes */}
          <mesh position={[s * 0.03, 0.205, 0.098]} rotation={[0.25, 0, Math.PI]} material={materials.charcoal}>
            <torusGeometry args={[0.011, 0.0028, 6, 12, Math.PI]} />
          </mesh>
          {/* cheeks */}
          <mesh position={[s * 0.05, 0.185, 0.088]} scale={[0.016, 0.01, 0.006]} material={catBlush}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
          {/* front paws */}
          <mesh position={[s * 0.035, 0.02, 0.085]} scale={[0.026, 0.02, 0.03]} material={glaze}>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.19, 0.103]} scale={[0.008, 0.006, 0.005]} material={catBlush}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      {/* tail curled round the base */}
      <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0.4]} material={glaze}>
        <torusGeometry args={[0.105, 0.02, 10, 28, Math.PI * 0.85]} />
      </mesh>
    </group>
  );
}

/** A soft pastel landscape for the framed print: blush sky, a low sun, rolling green hills and flowers. */
function drawLandscape(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#F9D9DF');
  sky.addColorStop(1, '#FCEBDD');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF4E2';
  ctx.beginPath();
  ctx.arc(w * 0.7, h * 0.36, w * 0.09, 0, Math.PI * 2);
  ctx.fill();
  const hill = (y: number, amp: number, phase: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + Math.sin(x / w * Math.PI * 1.6 + phase) * amp);
    ctx.lineTo(w, h);
    ctx.fill();
  };
  hill(h * 0.55, h * 0.06, 0.4, '#CFE0BE');
  hill(h * 0.66, h * 0.05, 2.2, '#AFCB9A');
  hill(h * 0.8, h * 0.04, 1.1, '#94BA84');
  const rand = seededRandom(5);
  for (let i = 0; i < 36; i++) {
    ctx.fillStyle = rand() < 0.6 ? '#F4A9B9' : '#FFF6EC';
    ctx.beginPath();
    ctx.arc(rand() * w, h * (0.78 + rand() * 0.2), 2.5 + rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A cream frame with a mat and a pastel print, leaning back against the shelf's back. */
function FramedPrint({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const art = useCanvasTexture(drawLandscape, 320, 260);
  const [w, h] = [0.54, 0.44];
  return (
    <group position={position} rotation-y={rotationY}>
      <group rotation-x={-0.12}>
        <RoundedBox args={[w, h, 0.035]} radius={0.014} smoothness={3} position-y={h / 2} material={materials.white} />
        <mesh position={[0, h / 2, 0.018]}>
          <planeGeometry args={[w - 0.06, h - 0.06]} />
          <meshStandardMaterial color={c.warmWhite} {...paperFinish(0.9)} />
        </mesh>
        <mesh position={[0, h / 2, 0.019]}>
          <planeGeometry args={[w - 0.12, h - 0.12]} />
          <meshStandardMaterial map={art} {...paperFinish(0.85)} />
        </mesh>
      </group>
    </group>
  );
}

/** A slim bud vase holding a single pink tulip. */
function TulipVase({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} scale={1.3}>
      <mesh geometry={BUD_VASE} material={materials.ceramicPink} />
      <mesh position-y={0.25} rotation-z={0.08} material={materials.leafDark}>
        <cylinderGeometry args={[0.006, 0.007, 0.2, 6]} />
      </mesh>
      {/* the bloom: a closed, egg-shaped cup */}
      <mesh position={[-0.008, 0.37, 0]} scale={[0.034, 0.046, 0.034]} material={materials.rose}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh position={[0.02, 0.21, 0]} rotation={[0, 0, -0.5]} scale={[0.016, 0.07, 0.006]} material={materials.leaf}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
    </group>
  );
}

function Candle({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.08} material={materials.peach}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 24]} />
      </mesh>
      <mesh position-y={0.175} material={materials.charcoal}>
        <cylinderGeometry args={[0.004, 0.004, 0.03, 6]} />
      </mesh>
    </group>
  );
}

/** A little lidded trinket box. */
function TrinketBox({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={0.3} scale={1.3}>
      <RoundedBox args={[0.16, 0.08, 0.12]} radius={0.02} smoothness={3} position-y={0.04} material={materials.lavenderLight} />
      <RoundedBox args={[0.17, 0.03, 0.13]} radius={0.012} smoothness={3} position-y={0.09} material={materials.lavender} />
    </group>
  );
}

function GraduationCap() {
  return (
    <group position={[-0.45, HEIGHT, 0.05]} rotation-y={0.5}>
      <mesh position-y={0.08} material={materials.charcoal}>
        <cylinderGeometry args={[0.17, 0.19, 0.16, 24]} />
      </mesh>
      <RoundedBox args={[0.55, 0.03, 0.55]} radius={0.01} position-y={0.17} rotation-y={Math.PI / 4} material={materials.charcoal} />
      <mesh position-y={0.195} material={materials.brass}>
        <sphereGeometry args={[0.025, 10, 8]} />
      </mesh>
      <mesh position={[0.2, 0.1, 0]} material={materials.brass}>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
      </mesh>
      <mesh position={[0.2, 0.0, 0]} material={materials.brass}>
        <cylinderGeometry args={[0.025, 0.012, 0.06, 10]} />
      </mesh>
    </group>
  );
}

// Decor sits angled a little towards the overview camera, which looks in from the shelf's front-left.
const TURN = -0.35;

const DECOR_SHADOWS: ContactShadowProps[] = [
  { position: [-0.12, shelfTop(1), 0.06], size: [0.36, 0.34], spread: 0.07, strength: 0.45, shape: 'round' },
  { position: [0.3, shelfTop(1), -0.02], size: [0.54, 0.14], spread: 0.06, strength: 0.4 },
  { position: [0.78, shelfTop(1), 0.05], size: [0.24, 0.24], spread: 0.06, strength: 0.45, shape: 'round' },
  { position: [0.8, shelfTop(3), 0.05], size: [0.24, 0.24], spread: 0.06, strength: 0.45, shape: 'round' },
  { position: [0.62, HEIGHT, 0.04], size: [0.32, 0.32], spread: 0.07, strength: 0.45, shape: 'round' },
  { position: [-0.45, HEIGHT, 0.05], size: [0.42, 0.42], spread: 0.07, strength: 0.4, shape: 'round' },
];

/** Bookshelf, facing local +z. Origin: centre of its base. */
export function Bookshelf() {
  return (
    <group>
      <Carcass />
      <Books />
      {[...LAYOUT.shadows, ...DECOR_SHADOWS].map((props, i) => (
        <ContactShadow key={i} {...props} />
      ))}

      <TrinketBox position={[0.6, STACK_TOPS.bottom, 0.06]} />
      <CatFigurine position={[-0.12, shelfTop(1), 0.06]} rotationY={TURN} />
      <FramedPrint position={[0.3, shelfTop(1), -0.05]} rotationY={TURN * 0.4} />
      <ShelfPlant position={[0.78, shelfTop(1), 0.05]} />
      <TulipVase position={[-0.66, STACK_TOPS.vase, 0.04]} />
      <Candle position={[0.32, STACK_TOPS.candle, 0.04]} />
      <Succulent position={[0.8, shelfTop(3), 0.05]} />

      <GraduationCap />
      <Pothos />
    </group>
  );
}
