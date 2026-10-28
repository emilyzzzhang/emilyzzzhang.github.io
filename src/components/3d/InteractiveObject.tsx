import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { Color, MathUtils, MeshStandardMaterial, type Group, type InstancedMesh, type Material, type Mesh } from 'three';
import type { Vec3 } from '../../config/sceneLayout';
import { CLICK_DRAG_TOLERANCE } from '../../config/layout';
import { sceneColors } from '../../config/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { SectionId } from '../../types/portfolio';
import { Tooltip } from '../ui/Tooltip';

/**
 * How much a hovered object brightens, as a share of its own colour. Brightening in its own hue
 * (rather than adding a fixed tint) keeps wood looking like wood and white looking white.
 */
const GLOW_STRENGTH = 0.22;
const HOVER_SCALE = 0.04;
const HOVER_LIFT: Vec3 = [0, 0.03, 0];

interface InteractiveObjectProps {
  section: SectionId;
  label: string;
  active: boolean;
  /** Idle "clickable" hint; hidden while any section is open so close-ups stay clean. */
  showMarker: boolean;
  onSelect: (section: SectionId) => void;
  position: Vec3;
  rotation?: Vec3;
  /** Where the tooltip and the idle "clickable" marker float, relative to the object. */
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
  showMarker,
  onSelect,
  position,
  rotation,
  labelOffset,
  hoverScale = HOVER_SCALE,
  hoverLift = HOVER_LIFT,
  children,
}: InteractiveObjectProps) {
  const body = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const glowMaterials = useRef<{ material: MeshStandardMaterial; color: Color }[]>([]);
  const glow = useRef(0);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();
  const highlighted = hovered && !active;
  useCursor(hovered);

  // Give this object private copies of its shared materials so the hover glow stays local.
  useLayoutEffect(() => {
    const clones = new Map<Material, MeshStandardMaterial>();
    const privateCopy = (mesh: Mesh, material: Material) => {
      if (!(material instanceof MeshStandardMaterial)) return material;
      if (material.emissive.getHex() !== 0) return material; // already glowing (bulbs, lights)
      // Colour carried per instance or per vertex: the material's own colour is only white, so glowing it would wash them out.
      if ((mesh as InstancedMesh).instanceColor || material.vertexColors) return material;
      let clone = clones.get(material);
      if (!clone) {
        clone = material.clone();
        clones.set(material, clone);
      }
      return clone;
    };
    body.current?.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      // Multi-material meshes (e.g. a paper's printed face, back and edges) glow part by part.
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => privateCopy(mesh, m)) : privateCopy(mesh, mesh.material);
    });
    glowMaterials.current = [...clones.values()].map((material) => ({ material, color: material.color.clone() }));
    return () => clones.forEach((m) => m.dispose());
  }, []);

  useFrame(({ clock }, delta) => {
    const target = highlighted ? 1 : 0;
    if (Math.abs(glow.current - target) > 0.001) {
      glow.current = reducedMotion ? target : MathUtils.damp(glow.current, target, 12, delta);
      for (const { material, color } of glowMaterials.current) material.emissive.copy(color).multiplyScalar(glow.current * GLOW_STRENGTH);
      if (body.current) {
        body.current.scale.setScalar(1 + glow.current * hoverScale);
        body.current.position.set(hoverLift[0] * glow.current, hoverLift[1] * glow.current, hoverLift[2] * glow.current);
      }
    }
    if (marker.current && !reducedMotion) {
      marker.current.position.y = labelOffset[1] + Math.sin(clock.elapsedTime * 2 + labelOffset[0] * 5) * 0.05;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE) return; // the visitor was orbiting, not clicking
    setHovered(false);
    onSelect(section);
  };

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <group ref={body}>{children}</group>
      {showMarker && !hovered && (
        <mesh ref={marker} position={labelOffset} userData={{ noShadow: true }}>
          <sphereGeometry args={[0.055, 16, 12]} />
          <meshBasicMaterial color={sceneColors.roseDeep} toneMapped={false} />
        </mesh>
      )}
      {highlighted && (
        <Html position={labelOffset} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <Tooltip label={label} />
        </Html>
      )}
    </group>
  );
}
