import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CatmullRomCurve3, Color, DoubleSide, ExtrudeGeometry, MeshStandardMaterial, Path, Quaternion, Shape, ShapeGeometry, TubeGeometry, Vector2, Vector3, type Group, type Material } from 'three';
import { ContactShadow } from './ContactShadow';
import { materials } from './materials';

// ---------------------------------------------------------------------------------------------
// Proportions (guitar-local: body bottom at y = 0, body centre plane at z = 0, front faces +z).

const BODY_TOP = 1.07;
const BODY_DEPTH = 0.15;
const BEVEL = 0.03;
/** Front and back faces of the body. */
const FRONT = BODY_DEPTH / 2 + BEVEL;
const HOLE = { y: 0.73, r: 0.085 };
const NUT_Y = 1.66;
const SADDLE_Y = 0.22;
const SCALE = NUT_Y - SADDLE_Y;
const NECK = { from: 0.98, width: 0.078, thickness: 0.06 };
const FRET_TOP = 0.93;
const HEAD = { length: 0.24, tilt: 0.24 };
const STRINGS = 6;
/** Backward lean on the stand, radians. */
const LEAN = 0.22;
/** Height of the body's bottom above the floor, held by the stand's cradle. */
const LIFT = 0.12;
/** Where the stand's neck yoke holds the neck (guitar-local height). */
const NECK_REST = 1.25;

const PINK_RIBBON = '#DE96B2';
const SOUND_HOLE = '#2A1E19';

/**
 * The right half of the body's silhouette, bottom to top, as hand-placed control points for one
 * smooth curve: a chubby lower bout, a soft shallow waist and rounded shoulders, with no corners
 * where two circles would meet.
 */
const SILHOUETTE: [number, number][] = [
  [0.21, 0.02],
  [0.31, 0.1],
  [0.345, 0.25],
  [0.32, 0.4],
  [0.255, 0.52],
  [0.228, 0.62],
  [0.25, 0.74],
  [0.245, 0.87],
  [0.19, 0.98],
  [0.1, 1.05],
];

/** The body outline, once round: up the right side and down the left, sampled from one smooth closed curve. */
function outline(samples = 160): [number, number][] {
  const right = SILHOUETTE.map(([x, y]) => new Vector3(x, y, 0));
  const left = [...SILHOUETTE].reverse().map(([x, y]) => new Vector3(-x, y, 0));
  const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), ...right, new Vector3(0, BODY_TOP, 0), ...left], true, 'centripetal');
  return curve.getSpacedPoints(samples).slice(0, -1).map((p): [number, number] => [p.x, p.y]);
}

/** Height of the body's underside at x (the lowest outline point there), for seating it on the stand. */
function undersideAt(x: number) {
  let best = Infinity;
  for (const [ox, oy] of OUTLINE) if (oy < 0.4 && Math.abs(ox - x) < 0.02) best = Math.min(best, oy);
  return best;
}

// ---------------------------------------------------------------------------------------------
// Geometry, built once and shared.

const OUTLINE = outline();

/** The body: the outline extruded with rounded sides, and a real sound hole through the top. */
function bodyGeometry() {
  const shape = new Shape(OUTLINE.map(([x, y]) => new Vector2(x, y)));
  shape.holes.push(new Path().absarc(0, HOLE.y, HOLE.r, 0, Math.PI * 2, true));
  const geometry = new ExtrudeGeometry(shape, { depth: BODY_DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 5, curveSegments: 40 }).translate(
    0,
    0,
    -BODY_DEPTH / 2,
  );
  // Extrude UVs put the grain across the body; swap them so it runs lengthways, as on a real top.
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geometry;
}

/** Cream binding following the edge of the top (and the back). */
function bindingGeometry(z: number) {
  const curve = new CatmullRomCurve3(
    OUTLINE.map(([x, y]) => new Vector3(x, y, z)),
    true,
  );
  return new TubeGeometry(curve, 220, 0.009, 6, true);
}

/** A teardrop pickguard hugging the sound hole on the treble side. */
function pickguardShape() {
  const s = new Shape();
  s.moveTo(0.05, 0.6);
  s.bezierCurveTo(0.15, 0.53, 0.23, 0.6, 0.21, 0.69);
  s.bezierCurveTo(0.2, 0.75, 0.15, 0.77, 0.1, 0.72);
  s.absarc(0, HOLE.y, HOLE.r + 0.022, -0.1, -1.1, true);
  s.closePath();
  return s;
}

/** Headstock: slightly flared, with a soft rounded crown (base at the origin, pointing +y). */
function headShape() {
  const s = new Shape();
  s.moveTo(-0.045, 0);
  s.lineTo(-0.062, HEAD.length - 0.03);
  s.quadraticCurveTo(-0.06, HEAD.length + 0.01, 0, HEAD.length - 0.005);
  s.quadraticCurveTo(0.06, HEAD.length + 0.01, 0.062, HEAD.length - 0.03);
  s.lineTo(0.045, 0);
  s.closePath();
  return s;
}

const BODY = bodyGeometry();
const BINDING_FRONT = bindingGeometry(FRONT - 0.004);
const BINDING_BACK = bindingGeometry(-FRONT + 0.004);
const PICKGUARD = new ShapeGeometry(pickguardShape(), 24);
const HEADSTOCK = new ExtrudeGeometry(headShape(), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });

const darkMat = new MeshStandardMaterial({ color: SOUND_HOLE, roughness: 1, side: DoubleSide });
const pickguardMat = new MeshStandardMaterial({ color: '#F3E6D2', roughness: 0.45 });
const ribbonMat = new MeshStandardMaterial({ color: PINK_RIBBON, roughness: 0.75 });
const stringMat = new MeshStandardMaterial({ color: new Color('#EDE6DF'), roughness: 0.3, metalness: 0.6 });

/** Fret positions (equal temperament) down from the nut, stopping where the fretboard ends. */
const FRETS = Array.from({ length: 20 }, (_, n) => NUT_Y - SCALE * (1 - 2 ** (-(n + 1) / 12))).filter((y) => y > FRET_TOP + 0.01);
const MARKERS = [3, 5, 7, 9].map((n) => (FRETS[n - 2] + FRETS[n - 1]) / 2);

// ---------------------------------------------------------------------------------------------

const UP = new Vector3(0, 1, 0);

/** A round rod between two points (strings, stand rails). */
function Rod({ from, to, radius, material, segments = 8 }: { from: Vector3; to: Vector3; radius: number; material: Material; segments?: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = to.clone().sub(from);
    return { position: from.clone().add(to).multiplyScalar(0.5), quaternion: new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), length: dir.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <cylinderGeometry args={[radius, radius, length, segments]} />
    </mesh>
  );
}

/** Guitar-local point → stand space (the guitar is lifted and leaned back). */
function toStand(y: number, z: number) {
  const c = Math.cos(LEAN);
  const s = Math.sin(LEAN);
  return new Vector3(0, y * c + z * s + LIFT, -y * s + z * c);
}

function GuitarBody() {
  const stringPoints = useMemo(
    () =>
      Array.from({ length: STRINGS }, (_, i) => {
        const k = i - (STRINGS - 1) / 2;
        return { from: new Vector3(k * 0.011, SADDLE_Y + 0.004, FRONT + 0.03), to: new Vector3(k * 0.0076, NUT_Y - 0.004, FRONT + 0.021), x: k };
      }),
    [],
  );
  const neckLength = NUT_Y - NECK.from;
  const boardLength = NUT_Y - FRET_TOP;
  return (
    <group>
      {/* body, binding, recessed sound hole with rosette, pickguard */}
      <mesh geometry={BODY} material={materials.maple} />
      <mesh geometry={BINDING_FRONT} material={materials.cream} />
      <mesh geometry={BINDING_BACK} material={materials.cream} />
      <mesh position={[0, HOLE.y, FRONT - 0.035]} material={darkMat}>
        <circleGeometry args={[HOLE.r + 0.01, 32]} />
      </mesh>
      {[
        [0.012, 0.0045, materials.cream],
        [0.03, 0.006, materials.walnut],
        [0.043, 0.0035, materials.cream],
      ].map(([offset, tube, material]) => (
        <mesh key={offset as number} position={[0, HOLE.y, FRONT - 0.001]} material={material as Material}>
          <torusGeometry args={[HOLE.r + (offset as number), tube as number, 6, 56]} />
        </mesh>
      ))}
      <mesh geometry={PICKGUARD} position-z={FRONT + 0.0015} material={pickguardMat} />

      {/* bridge with saddle and pins */}
      <RoundedBox args={[0.22, 0.045, 0.016]} radius={0.007} smoothness={2} position={[0, SADDLE_Y - 0.012, FRONT + 0.008]} material={materials.walnut} />
      <mesh position={[0, SADDLE_Y + 0.002, FRONT + 0.02]} material={materials.cream}>
        <boxGeometry args={[0.075, 0.006, 0.012]} />
      </mesh>
      {stringPoints.map(({ x }) => (
        <mesh key={x} position={[x * 0.011, SADDLE_Y - 0.022, FRONT + 0.018]} material={materials.cream}>
          <sphereGeometry args={[0.0055, 8, 6]} />
        </mesh>
      ))}

      {/* neck, fretboard, frets, markers and nut */}
      <RoundedBox args={[NECK.width, neckLength, NECK.thickness]} radius={0.022} smoothness={3} position={[0, NECK.from + neckLength / 2, FRONT - NECK.thickness / 2]} material={materials.walnut} />
      <mesh position={[0, FRET_TOP + boardLength / 2, FRONT + 0.006]} material={materials.walnut}>
        <boxGeometry args={[NECK.width + 0.006, boardLength, 0.012]} />
      </mesh>
      {FRETS.map((y) => (
        <mesh key={y} position={[0, y, FRONT + 0.013]} material={materials.metal}>
          <boxGeometry args={[NECK.width + 0.004, 0.004, 0.004]} />
        </mesh>
      ))}
      {MARKERS.map((y) => (
        <mesh key={y} position={[0, y, FRONT + 0.0125]} material={materials.cream}>
          <circleGeometry args={[0.009, 12]} />
        </mesh>
      ))}
      <mesh position={[0, NUT_Y, FRONT + 0.014]} material={materials.cream}>
        <boxGeometry args={[NECK.width + 0.006, 0.012, 0.018]} />
      </mesh>

      {/* headstock, angled back, with six small metal tuning pegs */}
      <group position={[0, NUT_Y + 0.005, FRONT - 0.02]} rotation-x={-HEAD.tilt}>
        <mesh geometry={HEADSTOCK} position-z={-0.01} material={materials.walnut} />
        {[-1, 1].flatMap((side) =>
          [0.06, 0.11, 0.16].map((y) => (
            <group key={`${side}${y}`} position={[side * 0.062, y, 0.006]}>
              <mesh position-x={side * 0.018} rotation-z={Math.PI / 2} material={materials.metal}>
                <cylinderGeometry args={[0.006, 0.006, 0.036, 8]} />
              </mesh>
              <mesh position-x={side * 0.04} rotation-z={Math.PI / 2} scale={[1, 0.45, 1]} material={materials.metal}>
                <sphereGeometry args={[0.016, 10, 8]} />
              </mesh>
              <mesh position={[-side * 0.03, 0, 0.022]} material={materials.metal}>
                <cylinderGeometry args={[0.005, 0.005, 0.02, 8]} />
              </mesh>
            </group>
          )),
        )}
      </group>

      {/* strings, from the saddle to the nut */}
      <group userData={{ noShadow: true }}>
        {stringPoints.map(({ from, to, x }) => (
          <Rod key={x} from={from} to={to} radius={0.0018} material={stringMat} segments={4} />
        ))}
      </group>

      {/* a small blush-pink ribbon tied round the neck under the headstock */}
      <group position={[0, NUT_Y - 0.05, FRONT - 0.024]}>
        <mesh rotation-x={Math.PI / 2} scale={[0.9, 0.78, 1]} material={ribbonMat}>
          <torusGeometry args={[0.05, 0.007, 6, 28]} />
        </mesh>
        <group position={[0.055, 0, 0.022]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position-x={side * 0.026} rotation={[0, side * 0.5, side * 0.35]} scale={[1, 0.62, 0.45]} material={ribbonMat}>
              <torusGeometry args={[0.024, 0.0075, 6, 18]} />
            </mesh>
          ))}
          <mesh material={ribbonMat}>
            <sphereGeometry args={[0.011, 10, 8]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.014, -0.045, 0.004]} rotation-z={side * 0.3} material={ribbonMat}>
              <boxGeometry args={[0.013, 0.075, 0.003]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/**
 * A-frame stand: two walnut rails rising from behind to a neck yoke, and a cradle at the front
 * with padded cups the body actually sits in. Positions come from the guitar's lean, so it rests.
 */
function Stand() {
  const parts = useMemo(() => {
    const yoke = toStand(NECK_REST, FRONT - NECK.thickness - 0.012);
    const hub = new Vector3(0, yoke.y, -0.37);
    const rearFeet = [-1, 1].map((side) => new Vector3(side * 0.28, 0.01, -0.55));
    const frontFeet = [-1, 1].map((side) => new Vector3(side * 0.22, 0.01, 0.01));
    const cradleY = toStand(-0.03, 0).y - 0.01;
    return { yoke, hub, rearFeet, frontFeet, cradleY };
  }, []);
  const { yoke, hub, rearFeet, frontFeet, cradleY } = parts;
  const bar = (x: number) => new Vector3(x, cradleY, 0.005);
  return (
    <group>
      {/* rails to the top, and the arm reaching forward to the neck yoke */}
      {rearFeet.map((foot) => (
        <Rod key={foot.x} from={foot} to={new Vector3(Math.sign(foot.x) * 0.04, hub.y, hub.z)} radius={0.017} material={materials.walnut} />
      ))}
      <Rod from={new Vector3(-0.05, hub.y, hub.z)} to={new Vector3(0.05, hub.y, hub.z)} radius={0.02} material={materials.walnut} />
      <Rod from={hub} to={new Vector3(0, yoke.y, yoke.z - 0.02)} radius={0.016} material={materials.walnut} />
      {/* cradle: crossbar with feet, tied back to the rails */}
      <Rod from={bar(-0.24)} to={bar(0.24)} radius={0.018} material={materials.walnut} />
      {frontFeet.map((foot, i) => (
        <group key={i}>
          <Rod from={foot} to={bar(foot.x)} radius={0.016} material={materials.walnut} />
          <Rod from={bar(foot.x)} to={rearFeet[i]} radius={0.014} material={materials.walnut} />
          <mesh position={[foot.x, 0.008, foot.z]} material={materials.charcoal}>
            <cylinderGeometry args={[0.026, 0.028, 0.016, 12]} />
          </mesh>
          <ContactShadow position={[foot.x, 0, foot.z]} size={[0.06, 0.06]} spread={0.05} strength={0.5} shape="round" />
        </group>
      ))}
      {rearFeet.map((foot) => (
        <group key={foot.x}>
          <mesh position={[foot.x, 0.008, foot.z]} material={materials.charcoal}>
            <cylinderGeometry args={[0.026, 0.028, 0.016, 12]} />
          </mesh>
          <ContactShadow position={[foot.x, 0, foot.z]} size={[0.06, 0.06]} spread={0.05} strength={0.5} shape="round" />
        </group>
      ))}
    </group>
  );
}

/** Padded supports, placed in the guitar's own (leaned) frame so the guitar sits right on them. */
function Supports() {
  return (
    <group>
      {[-1, 1].map((side) => {
        const x = side * 0.17;
        // The body's underside at this x, so the pad meets it.
        const contact = undersideAt(Math.abs(x) - 0.03);
        return (
          <group key={side} position={[x, contact, 0]}>
            <RoundedBox args={[0.07, 0.026, FRONT * 2 + 0.03]} radius={0.012} smoothness={2} position-y={-0.013} material={materials.beige} />
            <RoundedBox args={[0.08, 0.03, FRONT * 2 + 0.06]} radius={0.01} smoothness={2} position-y={-0.041} material={materials.walnut} />
            {/* little lip in front of the body */}
            <RoundedBox args={[0.06, 0.06, 0.02]} radius={0.008} smoothness={2} position={[0, 0.0, FRONT + 0.022]} material={materials.beige} />
          </group>
        );
      })}
      {/* neck yoke: a padded U the neck rests in */}
      <group position={[0, NECK_REST, FRONT - NECK.thickness - 0.012]}>
        <RoundedBox args={[0.13, 0.05, 0.024]} radius={0.01} smoothness={2} material={materials.beige} />
        {[-1, 1].map((side) => (
          <RoundedBox key={side} args={[0.022, 0.05, 0.085]} radius={0.009} smoothness={2} position={[side * (NECK.width / 2 + 0.014), 0, 0.045]} material={materials.beige} />
        ))}
      </group>
    </group>
  );
}

function Undecorated({ children }: { children: ReactNode }) {
  // The guitar is scenery: it should never catch clicks meant for the room's objects.
  const root = useRef<Group>(null);
  useLayoutEffect(() => {
    root.current?.traverse((obj) => {
      obj.raycast = () => {};
    });
  }, []);
  return <group ref={root}>{children}</group>;
}

/** Acoustic guitar on an A-frame stand. Origin: floor under the stand's cradle; the guitar faces local +z. */
export function Guitar() {
  return (
    <Undecorated>
      <ContactShadow position={[0, 0, -0.25]} size={[0.6, 0.6]} spread={0.25} strength={0.22} shape="round" />
      <Stand />
      <group position-y={LIFT} rotation-x={-LEAN}>
        <GuitarBody />
        <Supports />
      </group>
    </Undecorated>
  );
}
