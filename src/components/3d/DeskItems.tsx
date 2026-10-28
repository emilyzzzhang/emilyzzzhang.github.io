import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { AdditiveBlending, BufferGeometry, Color, CubicBezierCurve3, Float32BufferAttribute, LatheGeometry, MathUtils, MeshStandardMaterial, Object3D, Quaternion, SplineCurve, TubeGeometry, Vector2, Vector3, type PointLight, type Sprite, type SpotLight, type SpriteMaterial } from 'three';
import { LIGHTING, sceneColors } from '../../config/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useDayNight } from './dayNight';
import { boucle, materials, paperFinish } from './materials';
import { drawEnvelope, drawGlow, useCanvasTexture } from './textures';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

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

// ---------------------------------------------------------------------------------------------
// Coffee mug: a round-bellied pink mug turned from one smooth profile (foot, belly, rolled rim and
// the inside wall), a cappuccino with a cocoa dusting just below the rim, a chunky loop handle,
// a little cream bear on the front, and a crocheted coaster. Soft wisps of steam curl up off it.

const MUG = { height: 0.22, wall: 0.012, coffee: 0.19 };

/** The outside of the mug, foot to rim: narrow at the foot, swelling into a round belly, gently in at the lip. */
const MUG_OUTSIDE = new SplineCurve([
  new Vector2(0.078, 0.004),
  new Vector2(0.104, 0.022),
  new Vector2(0.124, 0.06),
  new Vector2(0.132, 0.11),
  new Vector2(0.128, 0.16),
  new Vector2(0.12, 0.2),
  new Vector2(0.116, MUG.height),
]);

/** The outside radius at height `y`, read off the profile. */
function mugRadius(y: number) {
  const points = MUG_OUTSIDE.getSpacedPoints(80);
  const i = points.findIndex((p) => p.y >= y);
  if (i <= 0) return points[Math.max(0, i)].x;
  const [p, q] = [points[i - 1], points[i]];
  return MathUtils.lerp(p.x, q.x, (y - p.y) / (q.y - p.y));
}

/**
 * One closed profile: from the centre of the base out round the foot, up the outside, over the
 * rolled rim and back down the inside to the centre of the floor, so every normal faces outwards.
 */
const mugBody = (() => {
  const { height: H, wall: T } = MUG;
  const outside = MUG_OUTSIDE.getSpacedPoints(40);
  const inside = outside
    .filter((p) => p.y > 0.03)
    .reverse()
    .map((p) => new Vector2(p.x - T, p.y));
  const rimR = outside[outside.length - 1].x - T / 2;
  return new LatheGeometry(
    [
      new Vector2(0, 0),
      new Vector2(0.07, 0),
      ...outside,
      ...arc(rimR, H, T / 2, 0, Math.PI, 6).slice(1, -1),
      ...inside,
      ...arc(0.04, 0.03, 0.012, 0, -Math.PI / 2, 4).map((p) => new Vector2(Math.min(p.x, inside[inside.length - 1].x), p.y)),
      new Vector2(0, 0.018),
    ],
    48,
  );
})();

/** A chunky loop, its ends sunk into the belly. */
const mugHandle = new TubeGeometry(
  new CubicBezierCurve3(new Vector3(0.112, 0.175, 0), new Vector3(0.235, 0.205, 0), new Vector3(0.245, 0.03, 0), new Vector3(0.118, 0.055, 0)),
  32,
  0.021,
  12,
  false,
);

/** Cappuccino from above: a creamy foam with a darker ring where it meets the cup, cocoa dusted over the middle. */
const drawCappuccino: Draw = (ctx, w, h) => {
  const c = w / 2;
  const foam = ctx.createRadialGradient(c, c, 0, c, c, c);
  foam.addColorStop(0, '#E9D2B6');
  foam.addColorStop(0.72, '#E2C4A2');
  foam.addColorStop(0.9, '#C99B72');
  foam.addColorStop(1, '#8E6043');
  ctx.fillStyle = foam;
  ctx.fillRect(0, 0, w, h);
  // A dusting of cocoa, heaviest in the middle.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const r = Math.pow(rand(), 0.8) * c * 0.62;
    const a = rand() * Math.PI * 2;
    ctx.fillStyle = `rgba(${110 + rand() * 30}, ${62 + rand() * 20}, ${40 + rand() * 15}, ${0.25 + rand() * 0.5})`;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 0.6 + rand() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
};

const MUG_PARTS = {
  bear: new MeshStandardMaterial({ color: '#FFF3E2', roughness: 0.45 }),
  muzzle: new MeshStandardMaterial({ color: '#FFF9F0', roughness: 0.45 }),
  eye: new MeshStandardMaterial({ color: '#3A2A26', roughness: 0.3 }),
  cheek: new MeshStandardMaterial({ color: '#E8A9C1', roughness: 0.6 }),
  coaster: boucle('#F1E4D2', [1.2, 1.2], true),
};

/** A pip on the bear, sat on the mug's curve: `x` across, `y` up, `lift` out from the glaze. */
function onMug(x: number, y: number, lift: number): [number, number, number] {
  const r = mugRadius(y);
  return [x, y, Math.sqrt(Math.max(0, r * r - x * x)) + lift];
}

/** The little bear moulded on the front: a round head with ears, a muzzle, button eyes, blushing cheeks and two paws. */
function MugBear() {
  const pip = (key: string, at: [number, number, number], scale: [number, number, number], material: MeshStandardMaterial) => (
    <mesh key={key} position={at} scale={scale} material={material}>
      <sphereGeometry args={[1, 20, 14]} />
    </mesh>
  );
  return (
    <group>
      {pip('head', onMug(0, 0.112, -0.012), [0.05, 0.044, 0.026], MUG_PARTS.bear)}
      {pip('ear-l', onMug(-0.036, 0.15, -0.008), [0.017, 0.017, 0.012], MUG_PARTS.bear)}
      {pip('ear-r', onMug(0.036, 0.15, -0.008), [0.017, 0.017, 0.012], MUG_PARTS.bear)}
      {pip('muzzle', onMug(0, 0.1, 0.009), [0.021, 0.015, 0.01], MUG_PARTS.muzzle)}
      {pip('nose', onMug(0, 0.105, 0.018), [0.006, 0.0045, 0.004], MUG_PARTS.eye)}
      {pip('eye-l', onMug(-0.019, 0.12, 0.011), [0.0055, 0.0065, 0.004], MUG_PARTS.eye)}
      {pip('eye-r', onMug(0.019, 0.12, 0.011), [0.0055, 0.0065, 0.004], MUG_PARTS.eye)}
      {pip('cheek-l', onMug(-0.032, 0.1, 0.008), [0.009, 0.006, 0.003], MUG_PARTS.cheek)}
      {pip('cheek-r', onMug(0.032, 0.1, 0.008), [0.009, 0.006, 0.003], MUG_PARTS.cheek)}
      {pip('paw-l', onMug(-0.03, 0.055, -0.004), [0.02, 0.016, 0.014], MUG_PARTS.bear)}
      {pip('paw-r', onMug(0.03, 0.055, -0.004), [0.02, 0.016, 0.014], MUG_PARTS.bear)}
    </group>
  );
}

/** A round crocheted coaster with a scalloped edge. */
function Coaster() {
  const SCALLOPS = 22;
  return (
    <group>
      <mesh position-y={0.007} material={MUG_PARTS.coaster}>
        <cylinderGeometry args={[0.18, 0.18, 0.014, 40]} />
      </mesh>
      {Array.from({ length: SCALLOPS }, (_, i) => {
        const a = (i / SCALLOPS) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.18, 0.007, Math.sin(a) * 0.18]} scale={[0.022, 0.009, 0.022]} material={MUG_PARTS.coaster}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Wisps of steam: each rises, swells, curls and thins out, out of step with the others. Bright
 * white and fairly dense, so it still reads against the cream walls behind the desk.
 */
const STEAM = { wisps: 10, cycle: 3.6, rise: 0.6, opacity: 0.55 };

function Steam({ y }: { y: number }) {
  const glow = useCanvasTexture(drawGlow, 64, 64);
  const wisps = useRef<(Sprite | null)[]>([]);
  // Each wisp's own offset in the cycle, sway and spin, fixed so they never fall into step.
  const seeds = useMemo(
    () => Array.from({ length: STEAM.wisps }, (_, i) => ({ offset: i / STEAM.wisps, sway: 0.7 + ((i * 0.37) % 0.6), turn: i * 1.9 })),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    wisps.current.forEach((wisp, i) => {
      if (!wisp) return;
      const { offset, sway, turn } = seeds[i];
      const k = (t / STEAM.cycle + offset) % 1;
      // Slows as it rises, like warm air losing its lift.
      const height = STEAM.rise * (1 - (1 - k) ** 1.6);
      // Two slow sines make a lazy curl rather than a regular wobble; it drifts more the higher it gets.
      const drift = 0.015 + k * 0.06;
      wisp.position.set(
        Math.sin(t * 0.9 * sway + turn) * drift + Math.sin(t * 0.37 + turn * 2) * drift * 0.6,
        y + 0.02 + height,
        Math.cos(t * 0.7 * sway + turn) * drift * 0.6,
      );
      const size = 0.08 + k * 0.23;
      wisp.scale.set(size, size * 1.5, 1);
      const material = wisp.material as SpriteMaterial;
      material.rotation = turn + Math.sin(t * 0.5 + turn) * 0.6;
      // Fades in quickly off the surface, then thins away slowly.
      material.opacity = STEAM.opacity * Math.min(1, k / 0.15) * (1 - k) ** 1.4;
    });
  });

  return seeds.map((_, i) => (
    <sprite key={i} ref={(s) => void (wisps.current[i] = s)} userData={{ noShadow: true }}>
      <spriteMaterial map={glow} color="#FFFFFF" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </sprite>
  ));
}

/** Coffee mug with gently rising steam. Local origin: base centre. */
export function Mug() {
  const reducedMotion = useReducedMotion();
  const cappuccino = useCanvasTexture(drawCappuccino, 256, 256);
  const coffeeRadius = mugRadius(MUG.coffee) - MUG.wall;

  return (
    // Turned so the bear faces the camera and the handle sits off to the right.
    <group rotation-y={0.5}>
      <Coaster />
      <group position-y={0.014}>
        <mesh geometry={mugBody} material={materials.ceramicPink} />
        <mesh geometry={mugHandle} material={materials.ceramicPink} />
        <mesh position-y={MUG.coffee} rotation-x={-Math.PI / 2} userData={{ noShadow: true }}>
          <circleGeometry args={[coffeeRadius, 40]} />
          <meshStandardMaterial map={cappuccino} roughness={0.85} />
        </mesh>
        <MugBear />
        {!reducedMotion && <Steam y={MUG.coffee} />}
      </group>
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

// ---------------------------------------------------------------------------------------------
// Pencil cup: a hollow glazed cup with a rolled rim, holding a loose handful of things at their
// own heights and angles: wooden pencils sharpened to a graphite point, a cream pen with a brass
// clip, and a pastel highlighter.

const CUP = { height: 0.24, foot: 0.088, lip: 0.1, wall: 0.01 };

/** Foot, tapering outside, rolled rim, inside wall and floor, as one profile so the cup is open and hollow. */
const pencilCup = (() => {
  const { height: H, foot, lip, wall: T } = CUP;
  return new LatheGeometry(
    [
      new Vector2(0, 0),
      ...arc(foot - 0.006, 0.006, 0.006, -Math.PI / 2, 0, 3),
      new Vector2(lip, H),
      ...arc(lip - T / 2, H, T / 2, 0, Math.PI, 6).slice(1, -1),
      new Vector2(lip - T, H),
      new Vector2(foot - T, 0.016),
      new Vector2(0, 0.016),
    ],
    TURNS,
  );
})();

const STATIONERY = {
  lacquer: (color: string) => new MeshStandardMaterial({ color, roughness: 0.42 }),
  /** Bare, freshly shaved cedar where a pencil's been sharpened. */
  shaving: new MeshStandardMaterial({ color: '#E2C29C', roughness: 0.85 }),
  graphite: new MeshStandardMaterial({ color: '#45454C', roughness: 0.35, metalness: 0.4 }),
  /** Glossy cream plastic, smoother than the lacquered pencils. */
  penBody: new MeshStandardMaterial({ color: '#F4ECDF', roughness: 0.25 }),
  brass: new MeshStandardMaterial({ color: sceneColors.brass, roughness: 0.3, metalness: 0.85 }),
  /** Soft-touch matte plastic for the highlighter. */
  highlighter: new MeshStandardMaterial({ color: '#C8EBD8', roughness: 0.7 }),
  highlighterCap: new MeshStandardMaterial({ color: '#9FDABF', roughness: 0.55 }),
};

/** A hexagonal pencil, point up: lacquered body, a shaved cone of bare wood, and a graphite tip. */
function Pencil({ length, paint }: { length: number; paint: MeshStandardMaterial }) {
  const R = 0.011;
  const cone = 0.032;
  const body = length - cone;
  return (
    <group>
      <mesh position-y={body / 2} material={paint}>
        <cylinderGeometry args={[R, R, body, 6]} />
      </mesh>
      <mesh position-y={body + cone / 2} material={STATIONERY.shaving}>
        <coneGeometry args={[R * 0.97, cone, 18]} />
      </mesh>
      <mesh position-y={length - 0.006} material={STATIONERY.graphite}>
        <coneGeometry args={[0.0042, 0.011, 12]} />
      </mesh>
    </group>
  );
}

/** A cream pen, cap up: a slightly fatter cap with a brass band, a domed end and a brass pocket clip. */
function Pen({ length }: { length: number }) {
  const R = 0.0095;
  const cap = 0.075;
  const body = length - cap;
  return (
    <group>
      <mesh position-y={body / 2} material={STATIONERY.penBody}>
        <cylinderGeometry args={[R, R * 0.9, body, 20]} />
      </mesh>
      <mesh position-y={body + cap / 2} material={STATIONERY.penBody}>
        <cylinderGeometry args={[R * 1.12, R * 1.12, cap, 20]} />
      </mesh>
      <mesh position-y={body + 0.003} rotation-x={Math.PI / 2} material={STATIONERY.brass}>
        <torusGeometry args={[R * 1.12, 0.0018, 6, 20]} />
      </mesh>
      <mesh position-y={length} scale={[1, 0.6, 1]} material={STATIONERY.penBody}>
        <sphereGeometry args={[R * 1.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* the clip: a thin strip standing off the cap, ending in a little rounded bead */}
      <mesh position={[R * 1.12 + 0.0022, length - 0.028, 0]} material={STATIONERY.brass}>
        <boxGeometry args={[0.0025, 0.05, 0.005]} />
      </mesh>
      <mesh position={[R * 1.12 + 0.0026, length - 0.052, 0]} material={STATIONERY.brass}>
        <sphereGeometry args={[0.0035, 10, 8]} />
      </mesh>
      <mesh position={[R * 1.12 + 0.0012, length - 0.004, 0]} material={STATIONERY.brass}>
        <boxGeometry args={[0.0045, 0.006, 0.005]} />
      </mesh>
    </group>
  );
}

/** A chunky, slightly flattened highlighter, cap up, with a moulded clip in the cap's deeper pastel. */
function Highlighter({ length }: { length: number }) {
  const R = 0.017;
  const cap = 0.07;
  const body = length - cap;
  return (
    <group scale={[1, 1, 0.72]}>
      <mesh position-y={body / 2} material={STATIONERY.highlighter}>
        <cylinderGeometry args={[R, R * 0.94, body, 16]} />
      </mesh>
      <mesh position-y={body + cap / 2} material={STATIONERY.highlighterCap}>
        <cylinderGeometry args={[R * 1.05, R * 1.05, cap, 16]} />
      </mesh>
      <mesh position-y={length} scale={[1, 0.45, 1]} material={STATIONERY.highlighterCap}>
        <sphereGeometry args={[R * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[R * 1.05 + 0.003, length - 0.03, 0]} material={STATIONERY.highlighterCap}>
        <boxGeometry args={[0.006, 0.05, 0.012]} />
      </mesh>
    </group>
  );
}

/**
 * What's in the cup, each stood on the floor towards one side and leaning across towards the other,
 * so nothing is upright and nothing pokes through the wall: `turn` is the direction it leans,
 * `tilt` how far, and `reach` how far from the middle its foot sits.
 */
const CUP_CONTENTS = [
  { item: <Pencil length={0.36} paint={STATIONERY.lacquer(sceneColors.lavenderDeep)} />, turn: 0.3, tilt: 0.2, reach: 0.04 },
  { item: <Pencil length={0.33} paint={STATIONERY.lacquer('#D9B48A')} />, turn: 2.2, tilt: 0.14, reach: 0.045 },
  { item: <Pencil length={0.3} paint={STATIONERY.lacquer(sceneColors.roseDeep)} />, turn: 4.3, tilt: 0.26, reach: 0.035 },
  { item: <Pen length={0.33} />, turn: 1.2, tilt: 0.09, reach: 0.03 },
  { item: <Highlighter length={0.28} />, turn: 3.3, tilt: 0.19, reach: 0.04 },
];

export function PencilCup({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={pencilCup} material={materials.ceramicPeach} />
      {CUP_CONTENTS.map(({ item, turn, tilt, reach }, i) => (
        <group key={i} rotation-y={turn} position-y={CUP.wall + 0.006}>
          <group position-x={-reach} rotation-z={-tilt}>
            {item}
          </group>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Cactus: a ribbed column with a little pup at its side, in a cream pot with a rolled rim and real
// wall thickness, standing in sandy soil with a few pebbles. The ribs are carved into a turned
// shape and coloured per vertex (darker in the grooves, fresher at the crown); the spines are one
// small cloud of points along the ridges, so they cost almost nothing to draw.

const POT = { height: 0.14, foot: 0.08, lip: 0.1, wall: 0.011, soil: 0.118 };

const cactusPot = (() => {
  const { height: H, foot, lip, wall: T } = POT;
  return new LatheGeometry(
    [
      new Vector2(0, 0),
      ...arc(foot - 0.008, 0.008, 0.008, -Math.PI / 2, 0, 3),
      new Vector2(lip, H - 0.004),
      ...arc(lip - T / 2, H - 0.004, T / 2, 0, Math.PI, 8).slice(1, -1),
      new Vector2(lip - T, H - 0.004),
      new Vector2(foot - T, 0.02),
      new Vector2(0, 0.02),
    ],
    TURNS,
  );
})();

/** A cactus column's radius at height `y`: a slightly narrower foot, straight sides, a domed crown. */
function columnRadius(y: number, height: number, radius: number) {
  const shoulder = height - radius;
  if (y > shoulder) return radius * Math.sqrt(Math.max(0, 1 - ((y - shoulder) / radius) ** 2));
  return radius * (0.86 + 0.14 * Math.min(1, y / (radius * 0.8)));
}

/** How far a rib stands out at angle `a`: rounded ribs between sharp grooves. 1 on a ridge, 0 in a groove. */
const ribAt = (a: number, ribs: number) => Math.abs(Math.cos((ribs * a) / 2));

const CACTUS_GREEN = { groove: new Color('#4F7F55'), ridge: new Color('#7FAE74'), crown: new Color('#A6C98A') };

/** A ribbed column turned from its profile, then carved and coloured rib by rib. */
function cactusColumn(height: number, radius: number, ribs: number) {
  const profile = Array.from({ length: 33 }, (_, i) => {
    const y = (i / 32) * height;
    return new Vector2(columnRadius(y, height, radius) + 0.0001, y);
  });
  const geometry = new LatheGeometry(profile, ribs * 8);
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const rib = ribAt(Math.atan2(x, z), ribs);
    const carve = 1 - 0.13 * (1 - rib);
    position.setX(i, x * carve);
    position.setZ(i, z * carve);
    // Grooves darker, ridges lighter, fresher growth at the crown, and a little unevenness throughout.
    color.copy(CACTUS_GREEN.groove).lerp(CACTUS_GREEN.ridge, rib);
    color.lerp(CACTUS_GREEN.crown, MathUtils.smoothstep(y / height, 0.72, 1) * 0.7);
    const speckle = 1 + Math.sin(x * 913 + y * 377 + z * 541) * 0.05;
    colors.push(color.r * speckle, color.g * speckle, color.b * speckle);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Tufts of spines along every ridge, staggered rib to rib, plus a few at the crown. */
function cactusSpines(height: number, radius: number, ribs: number) {
  const points: number[] = [];
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2;
    for (let y = 0.03 + (k % 2) * 0.011; y < height - 0.006; y += 0.022) {
      const r = columnRadius(y, height, radius) + 0.003;
      points.push(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  }
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
}

const CACTUS = { height: 0.2, radius: 0.05, ribs: 10 };
const PUP = { height: 0.075, radius: 0.028, ribs: 8 };

const cactusParts = {
  column: cactusColumn(CACTUS.height, CACTUS.radius, CACTUS.ribs),
  columnSpines: cactusSpines(CACTUS.height, CACTUS.radius, CACTUS.ribs),
  pup: cactusColumn(PUP.height, PUP.radius, PUP.ribs),
  pupSpines: cactusSpines(PUP.height, PUP.radius, PUP.ribs),
  skin: new MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
};

/** Sandy soil from above: warm sand with darker grains and pale flecks. */
const drawSandySoil: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#D8C3A0';
  ctx.fillRect(0, 0, w, h);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const shade = rand();
    ctx.fillStyle = shade < 0.5 ? `rgba(150, 118, 84, ${0.25 + rand() * 0.35})` : `rgba(250, 240, 222, ${0.3 + rand() * 0.4})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
};

/** A few smooth pebbles on the soil: [angle, distance from centre, size, colour]. */
const PEBBLES: [number, number, number, string][] = [
  [1.4, 0.066, 0.01, '#CFC6BA'],
  [2.3, 0.07, 0.008, '#A89E94'],
  [3.3, 0.066, 0.011, '#E8E0D4'],
  [4.4, 0.069, 0.009, '#B9AFA4'],
  [5.5, 0.067, 0.01, '#DCD3C7'],
];

function Spines({ geometry }: { geometry: BufferGeometry }) {
  const dot = useCanvasTexture(drawGlow, 32, 32);
  return (
    <points geometry={geometry}>
      <pointsMaterial map={dot} color="#FFF8EA" size={0.008} transparent depthWrite={false} />
    </points>
  );
}

export function Succulent({ position }: { position: [number, number, number] }) {
  const soil = useCanvasTexture(drawSandySoil, 128, 128);
  // The inside wall runs straight from the floor to the lip, so the soil just fits it at its height.
  const soilRadius = MathUtils.lerp(POT.foot, POT.lip, (POT.soil - 0.02) / (POT.height - 0.024)) - POT.wall - 0.001;
  return (
    <group position={position}>
      <mesh geometry={cactusPot} material={materials.ceramicWhite} />
      <mesh position-y={POT.soil} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[soilRadius, 32]} />
        <meshStandardMaterial map={soil} roughness={1} />
      </mesh>
      {PEBBLES.map(([a, d, size, color], i) => (
        <mesh key={i} position={[Math.cos(a) * d, POT.soil + size * 0.3, Math.sin(a) * d]} rotation-y={a * 2} scale={[size, size * 0.55, size * 0.8]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      ))}
      <group position-y={POT.soil - 0.01}>
        <mesh geometry={cactusParts.column} material={cactusParts.skin} />
        <Spines geometry={cactusParts.columnSpines} />
        <group position={[0.05, 0, 0.03]} rotation={[0.15, 0.6, -0.25]}>
          <mesh geometry={cactusParts.pup} material={cactusParts.skin} />
          <Spines geometry={cactusParts.pupSpines} />
        </group>
      </group>
    </group>
  );
}
