import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type { Group } from 'three';
import { ANCHORS, ROOM } from '../../config/sceneLayout';
import { sceneColors } from '../../config/theme';
import { ContactShadow } from './ContactShadow';
import { Monstera } from './Monstera';
import { boucle, materials } from './materials';
import { Corkboard } from './WallArt';

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

/** Sphere UVs: once around the 0.6-radius equator, and pole to pole over the squashed half-ellipse. */
const poufFabric = boucle(sceneColors.peach, [Math.PI * 2 * 0.6, 1.5], true);

export function Pouf() {
  return (
    <group>
      <ContactShadow position={[0, 0, 0]} size={[0.8, 0.8]} spread={0.3} strength={0.42} shape="round" />
      <mesh position-y={0.34} scale={[0.6, 0.34, 0.6]} material={poufFabric}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      <mesh position-y={0.34} rotation-x={Math.PI / 2} material={materials.rose}>
        <torusGeometry args={[0.6, 0.025, 8, 40]} />
      </mesh>
      <mesh position-y={0.67} material={materials.rose}>
        <sphereGeometry args={[0.04, 12, 10]} />
      </mesh>
    </group>
  );
}

const STACK: [keyof typeof materials, number, number][] = [
  ['rose', 0.12, 0.1],
  ['white', 0.1, -0.15],
  ['lavender', 0.11, 0.3],
];

export function BookStack() {
  let y = 0;
  return (
    <group>
      <ContactShadow position={[0, 0, 0]} size={[0.7, 0.5]} spread={0.12} strength={0.5} corner={0.025} rotationY={STACK[0][2]} />
      {STACK.map(([mat, t, rot], i) => {
        const yPos = y + t / 2;
        y += t;
        return <RoundedBox key={i} args={[0.7 - i * 0.06, t, 0.5]} radius={0.025} position-y={yPos} rotation-y={rot} material={materials[mat]} />;
      })}
    </group>
  );
}

function WallClock({ position }: { position: [number, number, number] }) {
  const hour = useRef<Group>(null);
  const minute = useRef<Group>(null);

  useFrame(() => {
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60;
    const h = (now.getHours() % 12) + m / 60;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
  });

  return (
    <group position={position}>
      <mesh rotation-x={Math.PI / 2} position-z={0.03} material={materials.white}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 40]} />
      </mesh>
      <mesh position-z={0.04} material={materials.rose}>
        <torusGeometry args={[0.3, 0.032, 10, 40]} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.23, Math.cos((i / 12) * Math.PI * 2) * 0.23, 0.058]} material={i % 3 ? materials.blush : materials.roseDeep}>
          <circleGeometry args={[i % 3 ? 0.012 : 0.02, 8]} />
        </mesh>
      ))}
      <group ref={hour} position-z={0.062}>
        <mesh position-y={0.065} material={materials.charcoal}>
          <boxGeometry args={[0.025, 0.13, 0.008]} />
        </mesh>
      </group>
      <group ref={minute} position-z={0.068}>
        <mesh position-y={0.095} material={materials.roseDeep}>
          <boxGeometry args={[0.018, 0.19, 0.008]} />
        </mesh>
      </group>
      <mesh position-z={0.075} material={materials.brass}>
        <sphereGeometry args={[0.018, 10, 8]} />
      </mesh>
    </group>
  );
}

const VINES = [
  { x: -0.18, length: 6 },
  { x: 0.02, length: 9 },
  { x: 0.2, length: 5 },
];

/** Floating shelf with a trailing pothos and a candle. Faces local +z. */
function WallShelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.0, 0.06, 0.32]} radius={0.025} position-z={0.16} material={materials.white} />
      <ContactShadow position={[-0.15, 0.03, 0.17]} size={[0.18, 0.18]} spread={0.07} strength={0.45} shape="round" />
      <ContactShadow position={[0.28, 0.03, 0.16]} size={[0.14, 0.14]} spread={0.06} strength={0.45} shape="round" />
      <group position={[-0.15, 0.03, 0.17]}>
        <mesh position-y={0.11} material={materials.ceramicPink}>
          <cylinderGeometry args={[0.12, 0.09, 0.22, 20]} />
        </mesh>
        {VINES.map(({ x, length }) =>
          Array.from({ length }, (_, i) => (
            <mesh
              key={`${x}-${i}`}
              position={[x + Math.sin(i * 1.3) * 0.04, 0.2 - i * 0.11, 0.06 + (i % 2) * 0.03]}
              rotation={[0.3, i, 0.6 * (i % 2 ? 1 : -1)]}
              scale={[0.055, 0.02, 0.04]}
              material={i % 3 ? materials.leaf : materials.sageDeep}
            >
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          )),
        )}
      </group>
      <group position={[0.28, 0.03, 0.16]}>
        <mesh position-y={0.09} material={materials.lavenderLight}>
          <cylinderGeometry args={[0.07, 0.07, 0.18, 18]} />
        </mesh>
        <mesh position-y={0.2} material={materials.charcoal}>
          <cylinderGeometry args={[0.004, 0.004, 0.04, 4]} />
        </mesh>
      </group>
    </group>
  );
}
