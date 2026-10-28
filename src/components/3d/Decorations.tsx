import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Euler, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, MeshStandardMaterial, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3, type Group } from 'three';
import { ANCHORS, ROOM } from '../../config/sceneLayout';
import { sceneColors } from '../../config/theme';
import { BAND_COLORS, BOOK_COLORS, BookPieces, type Piece } from './Bookshelf';
import { ContactShadow } from './ContactShadow';
import { Corkboard } from './Corkboard';
import { weldNormals } from './geometry';
import { Monstera } from './Monstera';
import { boucle, materials } from './materials';
import { useCanvasTexture } from './textures';
import { WallShelf } from './WallShelf';

/** Wall-mounted decor. Free-standing pieces are exported below and placed by RoomScene. */
export function WallDecor() {
  return (
    <group>
      <Corkboard position={ANCHORS.corkboard} />
      <group position={[-ROOM.half, 0, 0]} rotation-y={Math.PI / 2}>
        <WallClock position={[0.95, 4.4, 0]} />
        <WallShelf position={[-3.0, 2.55, 0]} />
      </group>
    </group>
  );
}

/** The Monstera in the corner by the desk. Origin: floor under its pot. */
export function FloorPlant() {
  return <Monstera />;
}

// ---------------------------------------------------------------------------------------------
// Bean bag: one soft sculpted shape, slumping wider at the floor and rising to a taller back, with
// a seat scooped into its front, small irregular bulges and wrinkles, pink piping down its sides
// and a pink flower cushion resting in the seat. Its front (local +z) faces the room.

const BAG = { radius: 0.66, height: 1.0 };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where a point on the unit sphere lands on the bean bag, and how much the seat's hollow shades it (0–1). */
function bagPoint(x: number, y: number, z: number, hollow = { depth: 0 }) {
  const angle = Math.atan2(z, x);
  const low = (1 - y) / 2;
  // Wider low down where the filling settles, a little narrower up top, never perfectly round.
  let spread = 1 + 0.15 * low * low - 0.06 * (1 - low);
  spread *= 1 + 0.035 * Math.sin(3 * angle + 0.8) * (1 - Math.abs(y)) + 0.02 * Math.sin(5 * angle + 2.1);
  // Soft wrinkles gathered towards the base.
  spread *= 1 + 0.012 * Math.sin(angle * 15 + y * 6) * smooth(0.45, 1, low);
  // The back stands taller than the front.
  let h = BAG.height / 2 + y * (BAG.height / 2) * (y > 0 ? 1 - 0.5 * z : 1);
  // The seat: a deep, soft scoop in the front of the top.
  if (y > 0) {
    const d = (x / 0.66) ** 2 + ((z - 0.3) / 0.66) ** 2;
    if (d < 1) {
      const dip = (1 - d) ** 1.4 * smooth(0, 0.45, y);
      h -= 0.3 * dip;
      hollow.depth = dip;
    }
  }
  // Flat where it rests on the floor.
  if (h < 0.035) h = 0.035 + (h - 0.035) * 0.1;
  return new Vector3(x * BAG.radius * spread, h - 0.03, z * BAG.radius * spread);
}

/** A point by sphere angles (theta round, phi down from the top). */
const bagAt = (theta: number, phi: number) => bagPoint(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));

const BEAN_BAG = (() => {
  const geometry = new SphereGeometry(1, 96, 64);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const hollow = { depth: 0 };
    const p = bagPoint(pos.getX(i), pos.getY(i), pos.getZ(i), hollow);
    pos.setXYZ(i, p.x, p.y, p.z);
    // Soft occlusion: deeper in the seat's hollow (spreading out towards its rim) and in the crease
    // where the bag meets the floor. A touch warmer than grey, so the shading stays cosy.
    const occlusion = 0.5 * hollow.depth ** 0.55 + 0.14 * (1 - smooth(0.02, 0.16, p.y));
    colors.set([1 - occlusion * 0.9, 1 - occlusion, 1 - occlusion * 0.98], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  weldNormals(geometry);

  // Piping seams down the sides, following the surface just proud of it; none across the seat.
  const outward = (theta: number, phi: number) => {
    const e = 0.002;
    const a = bagAt(theta + e, phi).sub(bagAt(theta - e, phi));
    const b = bagAt(theta, phi + e).sub(bagAt(theta, phi - e));
    return new Vector3().crossVectors(b, a).normalize();
  };
  const seams = [Math.PI / 2 + 1.35, Math.PI / 2 - 1.35, Math.PI / 2 + 2.35, Math.PI / 2 - 2.35].map(
    (theta) =>
      new TubeGeometry(
        new CatmullRomCurve3(Array.from({ length: 48 }, (_, k) => {
          const phi = 0.55 + (k / 47) * 2.1;
          return bagAt(theta, phi).addScaledVector(outward(theta, phi), 0.006);
        })),
        96,
        0.011,
        6,
        false,
      ),
  );

  // The bottom of the seat's scoop, where the cushion rests.
  let seat = bagAt(Math.PI / 2, 0.05);
  for (let phi = 0.05; phi < 0.9; phi += 0.01) {
    const p = bagAt(Math.PI / 2, phi);
    if (p.y < seat.y) seat = p;
  }
  return { geometry, seams, seat };
})();

/** A plump flower cushion: eight puffy petals pinched in between, and a dimpled centre. Face up (+y). */
const FLOWER_CUSHION = (() => {
  const geometry = new SphereGeometry(1, 96, 40);
  const pos = geometry.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const angle = Math.atan2(p.z, p.x);
    const flat = Math.hypot(p.x, p.z);
    const lobe = 0.5 + 0.5 * Math.cos(angle * 8);
    const radial = 0.84 + 0.16 * lobe;
    // Thinner where the petals meet, and dimpled at the centre like a tufted button.
    const thick = 0.36 * (1 - 0.3 * (1 - lobe) * smooth(0.3, 1, flat)) * (1 - 0.35 * Math.exp(-((flat / 0.22) ** 2)));
    pos.setXYZ(i, p.x * 0.27 * radial, p.y * 0.27 * thick * 1.25, p.z * 0.27 * radial);
  }
  geometry.computeVertexNormals();
  return weldNormals(geometry);
})();

/** Sphere UVs: once around the bag's equator, and pole to pole over its height. */
const bagFabric = boucle(sceneColors.peach, [Math.PI * 2 * BAG.radius, 1.6], true);
bagFabric.vertexColors = true;
const piping = new MeshStandardMaterial({ color: '#F2A2B4', roughness: 0.6 });
const cushionFabric = boucle('#F4A8B8', [Math.PI * 2 * 0.25, 0.4], true);
const buttonFabric = boucle('#FFF6EE');

export function Pouf() {
  const { geometry, seams, seat } = BEAN_BAG;
  return (
    <group>
      <ContactShadow position={[0, 0, 0]} size={[1.55, 1.5]} spread={0.3} strength={0.48} shape="round" />
      <mesh geometry={geometry} material={bagFabric} />
      {seams.map((seam, i) => (
        <mesh key={i} geometry={seam} material={piping} />
      ))}
      {/* resting in the seat, leaning back against the rise of the bag */}
      <group position={[seat.x, seat.y + 0.13, seat.z - 0.06]} rotation-x={0.75}>
        <mesh geometry={FLOWER_CUSHION} material={cushionFabric} />
        <mesh position-y={0.07} scale={[1, 0.55, 1]} material={buttonFabric}>
          <sphereGeometry args={[0.045, 20, 14]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A few books left on the floor, drawn like the bookshelf's: soft rounded pastel covers with a
 * paper finish and cream or gold bands across their spines, each a little smaller and turned a
 * touch differently from the one below. Spines face local +z.
 */
const FLOOR_BOOKS = (() => {
  const layers: [string, number, number, number, string][] = [
    // colour, thickness, length, turn, title
    [BOOK_COLORS[0], 0.11, 0.7, 0.1, 'Algorithms'],
    [BOOK_COLORS[8], 0.09, 0.64, -0.15, 'Clean Code'],
    [BOOK_COLORS[3], 0.1, 0.6, 0.28, 'Design Patterns'],
  ];
  const books: Piece[] = [];
  const bands: Piece[] = [];
  const labels: { title: string; centre: Vector3; turn: number; size: [number, number, number] }[] = [];
  const depth = 0.48;
  let y = 0;
  layers.forEach(([color, t, l, turn, title], i) => {
    const d = depth - i * 0.03;
    const rotation = new Euler(0, turn, 0);
    const centre = new Vector3(0, y + t / 2, 0);
    books.push({ position: centre, rotation, scale: new Vector3(l, t, d), color });
    // Two bands across the spine, near each end.
    for (const f of [-0.36, 0.36]) {
      const offset = new Vector3(f * l, 0, d / 2 + 0.002).applyEuler(rotation);
      bands.push({ position: centre.clone().add(offset), rotation, scale: new Vector3(0.026, t * 1.01, 0.006), color: BAND_COLORS[i % 2] });
    }
    labels.push({ title, centre, turn, size: [l, t, d] });
    y += t;
  });
  return { books, bands, labels };
})();

const TITLE_INK = '#5E3A4C';
const TITLE_FONT = '"Nunito", "Helvetica Neue", Arial, sans-serif';

/** The top book's cover: its title with a little sparkle and an underline, printed on transparent paper. */
function coverArt(title: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = TITLE_INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = title.split(' ');
    const size = w * 0.19;
    ctx.font = `800 ${Math.round(size)}px ${TITLE_FONT}`;
    words.forEach((word, i) => ctx.fillText(word, w / 2, h * 0.42 + (i - (words.length - 1) / 2) * size * 1.15));
    ctx.globalAlpha = 0.7;
    ctx.fillRect(w * 0.34, h * 0.62, w * 0.32, w * 0.018);
    // a four-point sparkle above the title
    const [sx, sy, r] = [w * 0.5, h * 0.2, w * 0.06];
    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.quadraticCurveTo(sx, sy, sx + r, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + r);
    ctx.quadraticCurveTo(sx, sy, sx - r, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - r);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
}

/** A spine title, small and centred between the bands. */
function spineArt(title: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = TITLE_INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(h * 0.62)}px ${TITLE_FONT}`;
    ctx.fillText(title.toUpperCase(), w / 2, h * 0.54);
  };
}

const COVER_ART = coverArt(FLOOR_BOOKS.labels[FLOOR_BOOKS.labels.length - 1].title);
const SPINE_ART = FLOOR_BOOKS.labels.map(({ title }) => spineArt(title));

function BookLabels() {
  const top = FLOOR_BOOKS.labels[FLOOR_BOOKS.labels.length - 1];
  const cover = useCanvasTexture(COVER_ART, 384, 512);
  const spines = [useCanvasTexture(SPINE_ART[0], 512, 64), useCanvasTexture(SPINE_ART[1], 512, 64), useCanvasTexture(SPINE_ART[2], 512, 64)];
  return (
    <group>
      {/* Turned a quarter so the title runs across the cover's short edge, with the spine (+z) on its left. */}
      <group position={[top.centre.x, top.centre.y + top.size[1] / 2 + 0.002, top.centre.z]} rotation-y={top.turn + Math.PI / 2}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[top.size[2] * 0.72, top.size[0] * 0.72]} />
          <meshStandardMaterial map={cover} transparent roughness={0.8} depthWrite={false} />
        </mesh>
      </group>
      {FLOOR_BOOKS.labels.map(({ centre, turn, size: [l, t, d] }, i) => (
        <group key={i} position={centre} rotation-y={turn}>
          <mesh position-z={d / 2 + 0.003}>
            <planeGeometry args={[l * 0.56, t * 0.5]} />
            <meshStandardMaterial map={spines[i]} transparent roughness={0.8} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function BookStack() {
  return (
    <group>
      <ContactShadow position={[0, 0, 0]} size={[0.74, 0.52]} spread={0.12} strength={0.5} corner={0.04} rotationY={0.1} />
      <BookPieces books={FLOOR_BOOKS.books} bands={FLOOR_BOOKS.bands} />
      <BookLabels />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Wall clock: a chunky, softly rounded pink bezel round a cream face with raised-looking pink
// numerals, a short brown hour hand, a slim rose-gold minute hand and a gold centre cap.

const CLOCK = { face: 0.258, rim: [0.255, 0.33] as [number, number], depth: 0.075 };

/** The bezel's cross-section, turned round the face: straight walls front and back of a fully rounded lip. */
const clockBezel = (() => {
  const [inner, outer] = CLOCK.rim;
  const r = (outer - inner) / 2;
  const centre = inner + r;
  const lipY = CLOCK.depth - r;
  const points = [new Vector2(outer, 0)];
  // Outer wall up, over the round lip, then down the inner wall: this order keeps every normal facing out.
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    points.push(new Vector2(centre + Math.cos(a) * r, lipY + Math.sin(a) * r));
  }
  points.push(new Vector2(inner, 0));
  return new LatheGeometry(points, 72).rotateX(Math.PI / 2);
})();

/** A clock hand pointing up +y from the pivot: a short tail, tapering to a rounded tip, softly bevelled. */
function clockHand(length: number, base: number, tip: number, tail: number) {
  const shape = new Shape();
  shape.moveTo(-base / 2, -tail);
  shape.lineTo(-tip / 2, length);
  shape.absarc(0, length, tip / 2, Math.PI, 0, true);
  shape.lineTo(base / 2, -tail);
  shape.absarc(0, -tail, base / 2, 0, Math.PI, true);
  return new ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 12 });
}

const HOUR_HAND = clockHand(0.13, 0.03, 0.022, 0.022);
const MINUTE_HAND = clockHand(0.205, 0.016, 0.01, 0.028);

const clockPink = new MeshStandardMaterial({ color: '#F29AAB', roughness: 0.5 });
const hourBrown = new MeshStandardMaterial({ color: '#6E4A3C', roughness: 0.55 });
const minuteRoseGold = new MeshStandardMaterial({ color: '#E8A07F', roughness: 0.4, metalness: 0.3 });

/** The cream face: a soft shadow under the rim, embossed pink 12 · 3 · 6 · 9 and dots at the other hours. */
function drawClockFace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const c = w / 2;
  ctx.fillStyle = '#FBF1EA';
  ctx.fillRect(0, 0, w, h);
  const rimShade = ctx.createRadialGradient(c, c, c * 0.7, c, c, c);
  rimShade.addColorStop(0, 'rgba(214, 160, 150, 0)');
  rimShade.addColorStop(1, 'rgba(214, 160, 150, 0.22)');
  ctx.fillStyle = rimShade;
  ctx.fillRect(0, 0, w, h);

  // A soft drop shadow lifts the markings off the face, like moulded numerals.
  ctx.shadowColor = 'rgba(176, 96, 104, 0.35)';
  ctx.shadowBlur = w * 0.008;
  ctx.shadowOffsetY = w * 0.006;
  ctx.fillStyle = '#EE8A99';
  ctx.font = `800 ${Math.round(w * 0.16)}px "Nunito", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = c + Math.sin(a) * w * 0.355;
    const y = c - Math.cos(a) * w * 0.355;
    if (i % 3 === 0) {
      ctx.fillText(String(i === 0 ? 12 : i), x, y + w * 0.012);
    } else {
      ctx.beginPath();
      ctx.arc(c + Math.sin(a) * w * 0.38, c - Math.cos(a) * w * 0.38, w * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function WallClock({ position }: { position: [number, number, number] }) {
  const hour = useRef<Group>(null);
  const minute = useRef<Group>(null);
  const face = useCanvasTexture(drawClockFace, 512, 512);

  useFrame(() => {
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60;
    const h = (now.getHours() % 12) + m / 60;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
  });

  return (
    <group position={position}>
      <mesh geometry={clockBezel} material={clockPink} />
      <mesh position-z={0.022}>
        <circleGeometry args={[CLOCK.face, 64]} />
        <meshStandardMaterial map={face} roughness={0.75} />
      </mesh>
      <group ref={hour} position-z={0.028}>
        <mesh geometry={HOUR_HAND} material={hourBrown} />
      </group>
      <group ref={minute} position-z={0.04}>
        <mesh geometry={MINUTE_HAND} material={minuteRoseGold} />
      </group>
      {/* a little domed gold cap over the pivot */}
      <mesh position-z={0.05} scale={[1, 1, 0.55]} material={materials.brass}>
        <sphereGeometry args={[0.022, 20, 14]} />
      </mesh>
    </group>
  );
}
