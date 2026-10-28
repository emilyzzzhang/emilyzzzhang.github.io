import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, MathUtils, MeshStandardMaterial, Vector3, type MeshBasicMaterial, type PointsMaterial } from 'three';
import { Instance, Instances, RoundedBox } from '@react-three/drei';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANCHORS, DIORAMA, ROOM, RUG_FUR } from '../../config/sceneLayout';
import { LIGHTING, sceneColors } from '../../config/theme';
import { useDayNight } from './dayNight';
import { ContactShadow } from './ContactShadow';
import { Garden } from './Garden';
import { FurRug } from './FurRug';
import { linen, materials } from './materials';
import { worldBoxUVs } from './surfaces';
import { drawDaySky, drawGlow, drawNightSky, seededRandom, useCanvasTexture } from './textures';

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
 * Chunky honey-wood cornice capping the walls, like a dollhouse roof edge: a thick flat-topped
 * slab overhanging both faces, with a chamfer underneath stepping back in to the wall. A post of
 * the same wood finishes each wall's exposed end.
 */
const CORNICE = {
  /** Overhang past each wall face, at the slab and at the bottom of the chamfer. */
  overhang: 0.27,
  tuck: 0.03,
  /** Heights above the cap's base: where the chamfer meets the slab's face, and the top. */
  chamfer: 0.17,
  height: 0.42,
  /** Rounding of the slab's top edges. */
  round: 0.06,
  /** How far the cap's base sits below the wall top, hiding the wall's rounded edge. */
  sleeve: 0.1,
};
const POST = 0.12;

/** The cornice cross-section as [outward offset from the wall's centreline, height] pairs, going round once. */
function corniceProfile(): [number, number][] {
  const { overhang, tuck, chamfer, height, round } = CORNICE;
  const outer = t / 2 + overhang;
  const base = t / 2 + tuck;
  const pts: [number, number][] = [];
  const arc = (cx: number, cy: number, from: number, to: number) => {
    for (let k = 0; k <= 4; k++) {
      const a = from + ((to - from) * k) / 4;
      pts.push([cx + round * Math.cos(a), cy + round * Math.sin(a)]);
    }
  };
  pts.push([base, 0], [outer, chamfer]);
  arc(outer - round, height - round, 0, Math.PI / 2);
  arc(-outer + round, height - round, Math.PI / 2, Math.PI);
  pts.push([-outer, chamfer], [-base, 0]);
  return pts;
}

/**
 * The cornice swept along local x from `from` to `to`. At the corner end each profile point is
 * pushed along by its outward offset, giving a 45° mitre that meets the other wall's cap.
 * Wall-local: outward is −z, and the centreline sits at z = −t/2. UVs are world units, grain along the length.
 */
function corniceGeometry(from: number, to: number, mitreEnd: -1 | 1) {
  const profile = corniceProfile();
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const point = (d: number, y: number, end: -1 | 1) => {
    const x = (end === -1 ? from : to) + (end === mitreEnd ? mitreEnd * d : 0);
    return [x, y, -t / 2 - d];
  };
  // Sides: each profile edge becomes its own quad, so creases stay sharp where the profile turns.
  let v = 0;
  for (let i = 0; i < profile.length; i++) {
    const [d0, y0] = profile[i];
    const [d1, y1] = profile[(i + 1) % profile.length];
    const len = Math.hypot(d1 - d0, y1 - y0);
    const base = positions.length / 3;
    for (const [d, y, vv] of [[d0, y0, v], [d1, y1, v + len]] as const) {
      for (const end of [-1, 1] as const) {
        const p = point(d, y, end);
        positions.push(...p);
        uvs.push(p[0], vv);
      }
    }
    index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    v += len;
  }
  // End faces: the profile is convex, so a fan closes it.
  for (const end of [-1, 1] as const) {
    const base = positions.length / 3;
    for (const [d, y] of profile) {
      positions.push(...point(d, y, end));
      uvs.push(d, y);
    }
    for (let i = 1; i < profile.length - 1; i++) {
      if (end === 1) index.push(base, base + i, base + i + 1);
      else index.push(base, base + i + 1, base + i);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  // Smooth across the rounded top edges, crisp at the chamfer and the ends.
  return toCreasedNormals(geometry.toNonIndexed(), 0.6);
}

interface WallProps {
  length: number;
  /** Which end (local −x or +x) meets the other wall; the opposite end is exposed and gets a post. */
  corner: -1 | 1;
  /** How far the wall body runs past its length at the corner (the back wall wraps the corner). */
  cornerReach: number;
}

/**
 * One wall plus its pink wainscot, chair rail and skirting board, built along local +x with its
 * inner face at local z = 0, so thickness grows outward. Finished with a wood cornice and end post.
 */
function Wall({ length, corner, cornerReach }: WallProps) {
  const halfLength = length / 2;
  const free = -corner;
  const cornice = useMemo(() => {
    // The mitre runs through the corner where the two walls' centrelines meet.
    const atCorner = corner * (halfLength + t / 2);
    const atFree = free * (halfLength + POST + 0.04);
    return corniceGeometry(Math.min(atCorner, atFree), Math.max(atCorner, atFree), corner);
  }, [corner, free, halfLength]);
  return (
    <group>
      <RoundedBox args={[length + cornerReach, WALL_H, t]} radius={0.1} position={[(corner * cornerReach) / 2, WALL_H / 2 - SLAB, -t / 2]} material={materials.wallUpper} />
      <mesh geometry={cornice} position-y={wallHeight - CORNICE.sleeve} material={materials.trim} />
      {/* built lying down and stood up so the grain runs up the post */}
      <RoundedBox
        args={[WALL_H - CORNICE.sleeve, POST, t + 0.1]}
        radius={0.04}
        smoothness={3}
        position={[free * (halfLength + POST / 2 - 0.02), (WALL_H - CORNICE.sleeve) / 2 - SLAB, -t / 2]}
        rotation-z={Math.PI / 2}
        material={materials.trim}
      />
      <mesh position={[0, wainscotHeight / 2, 0.025]} material={materials.wallLower}>
        <boxGeometry ref={worldBoxUVs} args={[length, wainscotHeight, 0.05]} />
      </mesh>
      <RoundedBox args={[length, 0.08, 0.1]} radius={0.035} position={[0, wainscotHeight, 0.05]} material={materials.white} />
      <RoundedBox args={[length, 0.2, 0.08]} radius={0.035} position={[0, 0.1, 0.06]} material={materials.white} />
    </group>
  );
}

/**
 * The back wall wraps the corner; the left wall stops flush against it, and the two cornices
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
const curtainLinen = linen('#FAD3DB', [1, 1]);
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

/** The plush rug, with a soft shadow where its fluffy edge meets the boards. */
function Rug() {
  return (
    <group position={ANCHORS.rug}>
      <ContactShadow position={[0, 0, 0]} size={[RUG_FUR.radius * 2, RUG_FUR.radius * 2]} spread={0.14} strength={0.3} shape="round" />
      <FurRug />
    </group>
  );
}

const BULB_COUNT = 26;

/** String lights: emissive bulbs plus one Points cloud of additive halos that bloom at night. */
function FairyLights() {
  const glowMap = useCanvasTexture(drawGlow, 64, 64);
  const bulbMat = useRef<MeshStandardMaterial>(null);
  const haloMat = useRef<PointsMaterial>(null);

  const { bulbs, wire, haloGeometry } = useMemo(() => {
    const points: Vector3[] = [];
    for (let i = 0; i < BULB_COUNT; i++) {
      const u = i / (BULB_COUNT - 1);
      const sag = Math.abs(Math.sin(u * Math.PI * 3)) * 0.28;
      points.push(new Vector3(-half + 0.2 + u * (half * 2 - 0.5), wallHeight - 0.35 - sag, -half + 0.08));
    }
    const halo = new BufferGeometry();
    halo.setAttribute('position', new Float32BufferAttribute(points.flatMap((p) => [p.x, p.y - 0.05, p.z + 0.02]), 3));
    return { bulbs: points, wire: new CatmullRomCurve3(points), haloGeometry: halo };
  }, []);

  useDayNight((blend) => {
    const glow = MathUtils.lerp(LIGHTING.day.fairyGlow, LIGHTING.night.fairyGlow, blend);
    if (bulbMat.current) bulbMat.current.emissiveIntensity = 0.4 + glow * 1.8;
    if (haloMat.current) haloMat.current.opacity = glow * 0.75;
  });

  return (
    <group userData={{ noShadow: true }}>
      <mesh material={materials.woodDark}>
        <tubeGeometry args={[wire, 120, 0.008, 4, false]} />
      </mesh>
      <Instances limit={bulbs.length}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial ref={bulbMat} color={sceneColors.bulb} emissive={sceneColors.bulb} toneMapped={false} />
        {bulbs.map((p, i) => (
          <Instance key={i} position={[p.x, p.y - 0.05, p.z]} />
        ))}
      </Instances>
      <points geometry={haloGeometry}>
        <pointsMaterial ref={haloMat} map={glowMap} color={sceneColors.lampGlow} size={0.42} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}
