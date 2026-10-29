import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import type { BoxGeometry, Group } from 'three';
import type { Vec3 } from '../../config/sceneLayout';
import { CLICK_DRAG_TOLERANCE } from '../../config/layout';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { SectionId } from '../../types/portfolio';
import { Tooltip } from '../ui/Tooltip';
import { HIT_MATERIAL, restingHitBox, useHoverGrow } from './useHoverGrow';

const HOVER_SCALE = 0.07;
const HOVER_LIFT: Vec3 = [0, 0.03, 0];

interface InteractiveObjectProps {
  section: SectionId;
  label: string;
  active: boolean;
  onSelect: (section: SectionId) => void;
  position: Vec3;
  rotation?: Vec3;
  /** Where the tooltip floats, relative to the object. */
  labelOffset: Vec3;
  /** How much bigger the object grows on hover (0.04 = 4%). Small, flat things need more to read. */
  hoverScale?: number;
  /** How far (local units) the object rises on hover; flat things on a wall lift out towards the viewer. */
  hoverLift?: Vec3;
  children: ReactNode;
}

/** Shared hover/click behaviour for every object that opens a portfolio section. */
export function InteractiveObject({
  section,
  label,
  active,
  onSelect,
  position,
  rotation,
  labelOffset,
  hoverScale = HOVER_SCALE,
  hoverLift = HOVER_LIFT,
  children,
}: InteractiveObjectProps) {
  const body = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();
  const highlighted = hovered && !active;
  useCursor(hovered);
  useHoverGrow(body, highlighted, { scale: hoverScale, lift: hoverLift, reducedMotion });

  // The pieces never change, so their resting bounds are measured once.
  const [hitBox, setHitBox] = useState<BoxGeometry | null>(null);
  useLayoutEffect(() => {
    const box = body.current && restingHitBox(body.current);
    setHitBox(box);
    return () => box?.dispose();
  }, []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE) return; // the visitor was orbiting, not clicking
    setHovered(false);
    onSelect(section);
  };

  return (
    <group position={position} rotation={rotation}>
      {hitBox && (
        <mesh
          geometry={hitBox}
          material={HIT_MATERIAL}
          userData={{ noShadow: true }}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        />
      )}
      <group ref={body}>{children}</group>
      {highlighted && (
        <Html position={labelOffset} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <Tooltip label={label} />
        </Html>
      )}
    </group>
  );
}
