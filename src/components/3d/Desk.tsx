import { RoundedBox } from '@react-three/drei';
import { DESK } from '../../config/sceneLayout';
import { ContactShadow } from './ContactShadow';
import { materials } from './materials';

const TOP = 0.12;
const CABINET_W = 0.95;
const DRAWERS = 3;

/** Wooden desk with a three-drawer cabinet on the right and slim legs on the left. Origin: floor under its centre. */
export function Desk() {
  const { width, depth, height } = DESK;
  const legH = height - TOP;
  const cabinetX = width / 2 - CABINET_W / 2 - 0.08;
  const drawerH = (legH - 0.12) / DRAWERS;

  return (
    <group>
      <RoundedBox args={[width, TOP, depth]} radius={0.055} position-y={height - TOP / 2} material={materials.wood} />

      {[-1, 1].map((side) => (
        // built lying down and stood up so the wood grain runs along the leg
        <RoundedBox
          key={side}
          args={[legH, 0.11, 0.11]}
          radius={0.04}
          position={[-width / 2 + 0.16, legH / 2, side * (depth / 2 - 0.16)]}
          rotation-z={Math.PI / 2}
          material={materials.woodDark}
        />
      ))}
      {/* stretcher between the legs, built along x and turned so its grain runs lengthways */}
      <RoundedBox args={[depth - 0.3, 0.06, 0.06]} radius={0.02} smoothness={2} position={[-width / 2 + 0.16, 0.35, 0]} rotation-y={Math.PI / 2} material={materials.woodDark} />
      {/* back panel */}
      <RoundedBox args={[width - CABINET_W - 0.5, legH * 0.5, 0.04]} radius={0.015} smoothness={2} position={[-0.15, legH * 0.62, -depth / 2 + 0.1]} material={materials.woodDark} />

      {/* grounding where the legs and cabinet meet the floor */}
      {[-1, 1].map((side) => (
        <ContactShadow key={side} position={[-width / 2 + 0.16, 0, side * (depth / 2 - 0.16)]} size={[0.11, 0.11]} spread={0.14} strength={0.55} corner={0.04} />
      ))}
      <ContactShadow position={[cabinetX, 0, 0]} size={[CABINET_W, depth - 0.12]} spread={0.16} strength={0.5} corner={0.06} />

      <group position={[cabinetX, 0, 0]}>
        <RoundedBox args={[CABINET_W, legH, depth - 0.12]} radius={0.06} position-y={legH / 2} material={materials.wood} />
        {Array.from({ length: DRAWERS }, (_, i) => {
          const y = 0.08 + drawerH * i + drawerH / 2;
          return (
            <group key={i} position={[0, y, (depth - 0.12) / 2]}>
              <RoundedBox args={[CABINET_W - 0.12, drawerH - 0.07, 0.06]} radius={0.03} material={materials.white} />
              <mesh position-z={0.06} rotation-x={Math.PI / 2} material={materials.brass}>
                <cylinderGeometry args={[0.035, 0.035, 0.05, 16]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
