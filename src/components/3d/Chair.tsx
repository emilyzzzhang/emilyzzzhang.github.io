import { RoundedBox } from '@react-three/drei';
import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import { RUG_TOP } from '../../config/sceneLayout';
import { sceneColors as c } from '../../config/theme';
import { ContactShadow } from './ContactShadow';
import { boucle, materials } from './materials';

const LEGS = 5;
/** Top of the gas lift; the seat cushion sits on it. */
const SEAT_Y = 0.8;
const SEAT_R = 0.43;
const SEAT_H = 0.28;
const SEAT_DOME = 0.045;

/** The tub: a rounded arched back flowing into two plump arms, wrapped round the seat (back at local +z). */
const TUB = {
  /** Inner face radius at the back; the seat tucks just inside it. */
  radius: 0.4,
  arc: (250 * Math.PI) / 180,
  /** Heights above the tub's base: top of the arched back, and the arms. */
  backHeight: 1.0,
  armHeight: 0.5,
  /** Half-angle of the arched back; the arms take over beyond it. */
  backHalfAngle: (70 * Math.PI) / 180,
  /** Cushion thickness of the back and of the (puffier) arms. */
  backThickness: 0.27,
  armThickness: 0.3,
  /** How far the arms bow outward. */
  flare: 0,
  /** Waist where the back meets each arm, so the arms read as their own pads. */
  pinch: 0.2,
  /** Outward puff of the inner and outer faces. */
  puff: 0.025,
  /** Fraction of the arc used to round each arm's front into a dome. */
  endRound: 0.09,
  /** Backward lean, radians. */
  lean: 0.06,
};
/** The tub's base sits just below the seat cushion, so the cushion nests inside it. */
const TUB_BASE = SEAT_Y - 0.02;

interface Section {
  theta: number;
  /** Radius of the cushion's centreline. */
  centre: number;
  /** Half thickness (also the rim's rounding radius). */
  w: number;
  /** Heights of the underside and the top rim. */
  bottom: number;
  top: number;
  puff: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The tub's cross-section at arc fraction s ∈ [0, 1] (0 and 1 are the arm fronts). */
function section(s: number): Section {
  const { arc, radius, backHeight, armHeight, backHalfAngle, backThickness, armThickness, flare, pinch, puff, endRound } = TUB;
  const theta = (s - 0.5) * arc;
  const a = Math.abs(theta);
  const archT = Math.min(1, a / backHalfAngle);
  const arch = (1 - archT * archT) ** 0.55;
  const arm = smoothstep(backHalfAngle * 0.8, backHalfAngle * 1.2, a);
  const waist = 1 - pinch * Math.exp(-(((a - backHalfAngle) / 0.16) ** 2));
  const e = Math.min(1, Math.min(s, 1 - s) / endRound);
  const round = Math.sqrt(Math.max(0, 1 - (1 - e) ** 2));
  const full = ((backThickness + (armThickness - backThickness) * arm) / 2) * waist;
  // Towards the arm fronts the section shrinks about its middle, closing each arm in a dome.
  const height = armHeight + (backHeight - armHeight) * arch;
  const mid = height / 2;
  return { theta, centre: radius + full + flare * arm, w: full * round, bottom: mid * (1 - round), top: mid + mid * round, puff: puff * round };
}

/** Cross-section outline as [radial offset, height] pairs: over the rim, down the inner face, under, up the outer face. */
function outline({ w, bottom, top, puff }: Section): [number, number][] {
  const pts: [number, number][] = [];
  const face = (side: number, from: number, to: number, n: number) => {
    for (let k = 1; k < n; k++) {
      const t = k / n;
      pts.push([side * (w + puff * Math.sin(Math.PI * t)), from + (to - from) * t]);
    }
  };
  const rim = (from: number, to: number, cy: number, n: number) => {
    for (let k = 0; k <= n; k++) {
      const phi = from + ((to - from) * k) / n;
      pts.push([w * Math.cos(phi), cy + w * Math.sin(phi)]);
    }
  };
  rim(0, Math.PI, top - w, 14);
  face(-1, top - w, bottom + w, 8);
  rim(Math.PI, Math.PI * 2, bottom + w, 8);
  face(1, bottom + w, top - w, 8);
  pts.push(pts[0]);
  return pts;
}

/** One continuous swept mesh, so back and arms read as a single upholstered body. UVs are in world units. */
function tubGeometry(steps = 140) {
  const positions: number[] = [];
  const uvs: number[] = [];
  let ring = 0;
  let along = 0;
  let prev: Section | null = null;
  for (let i = 0; i <= steps; i++) {
    const sec = section(i / steps);
    if (prev) along += Math.abs(sec.theta - prev.theta) * sec.centre;
    prev = sec;
    const pts = outline(sec);
    ring = pts.length;
    let around = 0;
    pts.forEach(([d, y], j) => {
      const r = sec.centre + d;
      positions.push(Math.sin(sec.theta) * r, y, Math.cos(sec.theta) * r);
      if (j > 0) around += Math.hypot(d - pts[j - 1][0], y - pts[j - 1][1]);
      uvs.push(along, around);
    });
  }
  const index: number[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j;
      const b = a + ring;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Thick round cushion with fully rolled edges and a soft dome, lathed from its profile. */
function seatGeometry() {
  const edge = 0.11;
  const profile: Vector2[] = [new Vector2(0, 0)];
  for (let k = 0; k <= 8; k++) {
    const phi = -Math.PI / 2 + (Math.PI / 2) * (k / 8);
    profile.push(new Vector2(SEAT_R - edge + edge * Math.cos(phi), edge + edge * Math.sin(phi)));
  }
  for (let k = 0; k <= 8; k++) {
    const phi = (Math.PI / 2) * (k / 8);
    profile.push(new Vector2(SEAT_R - edge + edge * Math.cos(phi), SEAT_H - edge + edge * Math.sin(phi)));
  }
  for (let k = 1; k <= 6; k++) {
    const x = (SEAT_R - edge) * (1 - k / 6);
    profile.push(new Vector2(x, SEAT_H + SEAT_DOME * Math.sin((Math.PI / 2) * (k / 6))));
  }
  return new LatheGeometry(profile, 56);
}

// Built once and shared; the chair is static for the life of the page.
const tub = tubGeometry();
const seat = seatGeometry();
const seatFabric = boucle(c.pink, [Math.PI * 2 * SEAT_R, SEAT_R * 2 + SEAT_H], true);
const WHEEL_R = 0.058;
/** Where the base rests: on the rug. */
const BASE_Y = RUG_TOP;

/** Cosy bouclé tub chair on a pale swivel base. Origin: floor under the gas lift; faces local −z. */
export function Chair() {
  return (
    <group>
      {/* swivel base: five sturdy legs on chunky wheels resting on the rug */}
      {Array.from({ length: LEGS }, (_, i) => (
        <group key={i} rotation-y={(i / LEGS) * Math.PI * 2}>
          <RoundedBox args={[0.11, 0.075, 0.46]} radius={0.032} smoothness={3} position={[0, BASE_Y + WHEEL_R * 2 + 0.05, 0.24]} rotation-x={0.06} material={materials.white} />
          <mesh position={[0, BASE_Y + WHEEL_R, 0.44]} rotation-z={Math.PI / 2} material={materials.beige}>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.055, 16]} />
          </mesh>
          <mesh position={[0, BASE_Y + WHEEL_R * 2 + 0.008, 0.44]} material={materials.white}>
            <cylinderGeometry args={[0.026, 0.032, 0.04, 12]} />
          </mesh>
          <ContactShadow position={[0, BASE_Y - 0.01, 0.44]} size={[0.09, 0.12]} spread={0.08} strength={0.5} corner={0.04} />
        </group>
      ))}
      <ContactShadow position={[0, BASE_Y - 0.01, 0]} size={[1.1, 1.1]} spread={0.32} strength={0.18} shape="round" />
      <mesh position-y={BASE_Y + 0.17} material={materials.white}>
        <cylinderGeometry args={[0.1, 0.12, 0.09, 24]} />
      </mesh>
      <mesh position-y={(BASE_Y + 0.17 + SEAT_Y) / 2} material={materials.cream}>
        <cylinderGeometry args={[0.055, 0.065, SEAT_Y - BASE_Y - 0.17, 18]} />
      </mesh>
      <mesh position-y={SEAT_Y - 0.03} material={materials.white}>
        <cylinderGeometry args={[0.24, 0.2, 0.05, 24]} />
      </mesh>

      {/* upholstery: the tub body (world-unit UVs, like RoundedBox, so the chair's bouclé fits) and the seat */}
      <group position-y={TUB_BASE} rotation-x={TUB.lean}>
        <mesh geometry={tub} material={materials.fabric} />
      </group>
      <mesh geometry={seat} position-y={SEAT_Y} material={seatFabric} />
    </group>
  );
}
