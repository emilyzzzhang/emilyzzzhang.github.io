import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { AdditiveBlending, CubicBezierCurve3, LatheGeometry, MathUtils, MeshStandardMaterial, Object3D, Quaternion, TubeGeometry, Vector2, Vector3, type Mesh, type PointLight, type SpotLight, type SpriteMaterial } from 'three';
import { LIGHTING, sceneColors } from '../../config/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useDayNight } from './dayNight';
import { materials, paperFinish } from './materials';
import { drawEnvelope, drawGlow, useCanvasTexture } from './textures';

// ---------------------------------------------------------------------------------------------
// Desk lamp: a soft, rounded base, one seamless gooseneck stem curving over, and a dome shade with
// a rolled lip and a warm cream lining. Every piece is turned (lathe) or swept (tube) from a smooth
// profile, so there are no hard joins between primitives.

const TURNS = 40;

/** Points round a quarter-ish arc, for rounding the corners of lathe profiles. */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 6) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return new Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
}

const BASE = { radius: 0.2, height: 0.062 };
const STEM_RADIUS = 0.025;
const SHADE = { radius: 0.22, depth: 0.19, lip: 0.016 };

/** A low puck: a crisp-but-soft foot, a generous rounded top edge and a faintly domed top. */
const lampBase = (() => {
  const { radius: R, height: H } = BASE;
  return new LatheGeometry(
    [new Vector2(0, 0), ...arc(R - 0.008, 0.008, 0.008, -Math.PI / 2, 0, 3), ...arc(R - 0.024, H - 0.024, 0.024, 0, Math.PI / 2, 8), new Vector2(0.09, H + 0.004), new Vector2(0, H + 0.005)],
    TURNS,
  );
})();

/** A little rounded collar the stem rises out of. */
const lampCollar = new LatheGeometry(
  [new Vector2(0, 0), new Vector2(0.044, 0), ...arc(0.032, 0.03, 0.012, 0, Math.PI / 2, 5), new Vector2(STEM_RADIUS, 0.044), new Vector2(0, 0.044)],
  TURNS,
);

/** The gooseneck: straight up out of the collar, then over in one smooth arc, ending down-and-forward. */
const STEM_CURVE = new CubicBezierCurve3(new Vector3(0, BASE.height, 0), new Vector3(0, 0.86, 0), new Vector3(0, 0.94, 0.3), new Vector3(0, 0.8, 0.43));
const lampStem = new TubeGeometry(STEM_CURVE, 64, STEM_RADIUS, 12, false);

/**
 * The shade's profile with its apex at the origin and its opening towards -y: the lining from the
 * apex down to the rim, round the rolled lip, then the outside back up to the apex. Walking it in
 * this order makes every lathe normal face the right way (into the cavity inside, outwards outside).
 */
function shadeProfile() {
  const { radius: R, depth: D, lip: T } = SHADE;
  const steps = 18;
  const lining: Vector2[] = [];
  const shell: Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    lining.push(new Vector2((R - T) * Math.sin(a) + 0.0001, -T - (D - T) * (1 - Math.cos(a))));
  }
  shell.push(lining[lining.length - 1], ...arc(R - T / 2, -D, T / 2, Math.PI, 2 * Math.PI, 6).slice(1));
  for (let i = steps; i >= 0; i--) {
    const a = (i / steps) * (Math.PI / 2);
    shell.push(new Vector2(R * Math.sin(a) + 0.0001, -D * (1 - Math.cos(a))));
  }
  return { lining, shell };
}

const SHADE_PROFILE = shadeProfile();
const shadeShell = new LatheGeometry(SHADE_PROFILE.shell, TURNS);
const shadeLining = new LatheGeometry(SHADE_PROFILE.lining, TURNS);

/** Where the shade hangs: at the stem's end, its opening facing along the stem's last direction. */
const SHADE_POSE = (() => {
  const tip = STEM_CURVE.getPoint(1);
  const facing = STEM_CURVE.getTangent(1);
  return { position: tip, quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), facing) };
})();

/** The lamp body: a soft satin blush pink, like painted metal. */
const lampBody = new MeshStandardMaterial({ color: sceneColors.rose, roughness: 0.5 });

/** Gooseneck desk lamp, reaching out over the desk. Off by day; at night the shade glows and pools warm light below. */
export function DeskLamp({ position }: { position: [number, number, number] }) {
  const glowMap = useCanvasTexture(drawGlow, 64, 64);
  const bulb = useRef<MeshStandardMaterial>(null);
  const lining = useRef<MeshStandardMaterial>(null);
  const halo = useRef<SpriteMaterial>(null);
  const spot = useRef<SpotLight>(null);
  const bounce = useRef<PointLight>(null);
  // The spotlight aims at an object placed below the shade, so it follows the lamp's pose.
  const spotTarget = useMemo(() => new Object3D(), []);

  useDayNight((blend) => {
    const on = MathUtils.lerp(LIGHTING.day.lamp, LIGHTING.night.lamp, blend);
    if (bulb.current) bulb.current.emissiveIntensity = 0.25 + on * 2.5;
    if (lining.current) lining.current.emissiveIntensity = on * 0.9;
    if (halo.current) halo.current.opacity = on * 0.7;
    if (spot.current) spot.current.intensity = on * 9;
    if (bounce.current) bounce.current.intensity = on * 0.8;
  });

  return (
    // Reaching forward over the desk and a little left, clear of the monitor, so the overview camera sees the stem's curve side-on.
    <group position={position} rotation-y={-0.35}>
      <mesh geometry={lampBase} material={lampBody} />
      <mesh geometry={lampCollar} material={lampBody} position-y={BASE.height} />
      <mesh geometry={lampStem} material={lampBody} />
      <group position={SHADE_POSE.position} quaternion={SHADE_POSE.quaternion}>
        {/* a small rounded cap where the stem meets the shade */}
        <mesh position-y={0.006} scale={[1, 0.7, 1]} material={lampBody}>
          <sphereGeometry args={[0.042, 20, 14]} />
        </mesh>
        <mesh geometry={shadeShell} material={lampBody} />
        <mesh geometry={shadeLining} userData={{ noShadow: true }}>
          <meshStandardMaterial ref={lining} color={sceneColors.bulb} emissive={sceneColors.lampGlow} emissiveIntensity={0} roughness={0.7} />
        </mesh>
        <mesh position-y={-0.09} userData={{ noShadow: true }}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial ref={bulb} color={sceneColors.bulb} emissive={sceneColors.lampGlow} toneMapped={false} />
        </mesh>
        <sprite position-y={-0.12} scale={0.75} userData={{ noShadow: true }}>
          <spriteMaterial ref={halo} map={glowMap} color={sceneColors.lampGlow} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </sprite>
        <primitive object={spotTarget} position-y={-1.5} />
        <spotLight ref={spot} position-y={-0.06} target={spotTarget} color={sceneColors.lampGlow} intensity={0} angle={0.75} penumbra={0.85} distance={3.2} decay={1.6} />
        <pointLight ref={bounce} position-y={-0.25} color={sceneColors.lampGlow} intensity={0} distance={1.8} decay={2} />
      </group>
    </group>
  );
}

/** Coffee mug with gently rising steam. Local origin: base centre. */
export function Mug() {
  const reducedMotion = useReducedMotion();
  const puffs = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    puffs.current.forEach((puff, i) => {
      if (!puff) return;
      const phase = (t * 0.45 + i / 3) % 1;
      puff.position.set(Math.sin(t + i * 2) * 0.03, 0.3 + phase * 0.35, 0);
      puff.scale.setScalar(0.02 + phase * 0.035);
      (puff.material as MeshStandardMaterial).opacity = Math.sin(phase * Math.PI) * 0.35;
    });
  });

  return (
    <group rotation-y={-0.6}>
      <mesh position-y={0.008} material={materials.woodLight}>
        <cylinderGeometry args={[0.17, 0.17, 0.016, 28]} />
      </mesh>
      <mesh position-y={0.136} material={materials.ceramicPink}>
        <cylinderGeometry args={[0.12, 0.11, 0.24, 28]} />
      </mesh>
      <mesh position-y={0.24} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.105, 24]} />
        <meshStandardMaterial color="#8A5E46" roughness={0.3} />
      </mesh>
      <mesh position={[0.125, 0.14, 0]} material={materials.ceramicPink}>
        <torusGeometry args={[0.06, 0.018, 10, 20]} />
      </mesh>
      {!reducedMotion &&
        [0, 1, 2].map((i) => (
          <mesh key={i} ref={(m) => void (puffs.current[i] = m)} userData={{ noShadow: true }}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
    </group>
  );
}

/** Sealed envelope lying on the desk. Local origin: base centre. */
export function Envelope() {
  const paper = useCanvasTexture(drawEnvelope, 256, 180);
  const w = 0.52;
  const d = 0.36;
  return (
    <group rotation-y={0.28}>
      <RoundedBox args={[w, 0.024, d]} radius={0.008} position-y={0.012} material={materials.white} />
      <mesh position-y={0.0245} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - 0.01, d - 0.01]} />
        <meshStandardMaterial map={paper} {...paperFinish(0.9)} />
      </mesh>
      <mesh position={[0, 0.03, -d / 2 + d * 0.6]} material={materials.roseDeep}>
        <cylinderGeometry args={[0.045, 0.048, 0.014, 20]} />
      </mesh>
    </group>
  );
}

const PENCILS: [string, number, number][] = [
  [sceneColors.roseDeep, 0.12, 0.3],
  [sceneColors.lavenderDeep, -0.15, 1.6],
  ['#F2D58A', 0.05, 3.4],
];

export function PencilCup({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.12} material={materials.ceramicPeach}>
        <cylinderGeometry args={[0.1, 0.09, 0.24, 20]} />
      </mesh>
      {PENCILS.map(([color, tilt, turn], i) => (
        <group key={i} rotation-y={turn} position-y={0.06}>
          <group rotation-z={tilt} position-x={0.03}>
            <mesh position-y={0.2}>
              <cylinderGeometry args={[0.014, 0.014, 0.36, 6]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            <mesh position-y={0.4} material={materials.woodLight}>
              <coneGeometry args={[0.014, 0.04, 6]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

export function Succulent({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.07} material={materials.ceramicWhite}>
        <cylinderGeometry args={[0.1, 0.08, 0.14, 18]} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 0.9) * 0.05, 0.16, Math.sin(i * 0.9) * 0.05]} rotation={[Math.cos(i * 0.9) * 0.7, 0, -Math.sin(i * 0.9) * 0.7]} scale={[0.035, 0.07, 0.035]} material={materials.sageDeep}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}
