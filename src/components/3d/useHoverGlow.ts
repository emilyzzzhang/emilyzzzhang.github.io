import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MathUtils, MeshStandardMaterial, type Group, type InstancedMesh, type Material, type Mesh } from 'three';
import type { Vec3 } from '../../config/sceneLayout';
import { refreshShadows } from './renderQuality';

/**
 * How much a hovered object brightens, as a share of its own colour. Brightening in its own hue
 * (rather than adding a fixed tint) keeps wood looking like wood and white looking white.
 */
const GLOW_STRENGTH = 0.22;

interface HoverGlowOptions {
  /** How much bigger the object grows at full glow (0.04 = 4%). */
  scale: number;
  /** How far (local units) it rises at full glow. */
  lift: Vec3;
  reducedMotion: boolean;
}

/**
 * The hover glow shared by everything clickable in the room: the object under `body` brightens
 * in its own colours, grows and lifts a little as `highlighted` eases to 1, and back. Returns the
 * eased glow (0–1) for any extra animation. Idle objects cost nothing per frame.
 */
export function useHoverGlow(body: RefObject<Group | null>, highlighted: boolean, { scale, lift, reducedMotion }: HoverGlowOptions) {
  const glowMaterials = useRef<{ material: MeshStandardMaterial; color: Color }[]>([]);
  const glow = useRef(0);

  // Give this object private copies of its shared materials so the glow stays local.
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
  }, [body]);

  useFrame(({ gl }, delta) => {
    const target = highlighted ? 1 : 0;
    if (Math.abs(glow.current - target) <= 0.001) return;
    refreshShadows(gl); // it grows and lifts
    glow.current = reducedMotion ? target : MathUtils.damp(glow.current, target, 12, delta);
    for (const { material, color } of glowMaterials.current) material.emissive.copy(color).multiplyScalar(glow.current * GLOW_STRENGTH);
    if (body.current) {
      body.current.scale.setScalar(1 + glow.current * scale);
      body.current.position.set(lift[0] * glow.current, lift[1] * glow.current, lift[2] * glow.current);
    }
  });

  return glow;
}
