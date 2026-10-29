import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, BoxGeometry, MathUtils, Matrix4, MeshBasicMaterial, Vector3, type Group, type InstancedMesh, type Mesh } from 'three';
import type { Vec3 } from '../../config/sceneLayout';
import { refreshShadows } from './renderQuality';

/** How quickly the hover eases in and out (higher is snappier). */
export const HOVER_SPEED = 18;

/** Draws nothing: hit boxes only catch the pointer. */
export const HIT_MATERIAL = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });

interface HoverGrowOptions {
  /** How much bigger the object grows at full hover (0.04 = 4%). */
  scale: number;
  /** How far (local units) it rises at full hover. */
  lift: Vec3;
  reducedMotion: boolean;
}

/**
 * The hover cue shared by everything clickable in the room: the object under `body` grows and
 * lifts a little as `highlighted` eases to 1, and back, keeping its own colours. Returns the eased
 * hover (0–1) for any extra animation. Idle objects cost nothing per frame.
 */
export function useHoverGrow(body: RefObject<Group | null>, highlighted: boolean, { scale, lift, reducedMotion }: HoverGrowOptions) {
  const hover = useRef(0);

  useFrame(({ gl }, delta) => {
    const target = highlighted ? 1 : 0;
    if (Math.abs(hover.current - target) <= 0.001) return;
    refreshShadows(gl); // it grows and lifts
    hover.current = reducedMotion ? target : MathUtils.damp(hover.current, target, HOVER_SPEED, delta);
    if (body.current) {
      body.current.scale.setScalar(1 + hover.current * scale);
      body.current.position.set(lift[0] * hover.current, lift[1] * hover.current, lift[2] * hover.current);
    }
  });

  return hover;
}

/**
 * A box around `body`'s meshes in its own space, to catch the pointer in its place: placed beside
 * `body` (whose rest transform is the identity) it covers the object at rest. Hovering the box
 * instead of the meshes keeps the hover steady while the object grows and lifts (an edge that
 * slipped out from under the cursor would un-hover it, shrink it back and re-hover it, over and
 * over), and is one cheap ray test instead of one per mesh. Meshes that opt out of raycasting
 * (glows, overlays) are left out.
 */
export function restingHitBox(body: Group): BoxGeometry | null {
  body.updateWorldMatrix(true, true);
  const toBody = new Matrix4().copy(body.matrixWorld).invert();
  const bounds = new Box3();
  const part = new Box3();
  const toBox = new Matrix4();
  body.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || Object.hasOwn(mesh, 'raycast')) return;
    const instanced = mesh as InstancedMesh;
    if (instanced.isInstancedMesh) instanced.computeBoundingBox();
    else if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = instanced.isInstancedMesh ? instanced.boundingBox : mesh.geometry.boundingBox;
    if (local) bounds.union(part.copy(local).applyMatrix4(toBox.multiplyMatrices(toBody, mesh.matrixWorld)));
  });
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  return new BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z);
}
