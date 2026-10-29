import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Mesh } from 'three';
import type { ModelOverride } from '../../config/models';
import { refreshShadows } from './renderQuality';

export default function GltfModel({ override }: { override: ModelOverride }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}${override.url}`);
  const gl = useThree((s) => s.gl);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((obj) => {
      if ((obj as Mesh).isMesh) obj.castShadow = obj.receiveShadow = true;
    });
    return copy;
  }, [scene]);
  // It arrives after the room's first shadows were drawn, in place of the built-in version.
  useLayoutEffect(() => refreshShadows(gl), [gl, model]);

  return <primitive object={model} scale={override.scale ?? 1} rotation-y={override.rotationY ?? 0} />;
}
