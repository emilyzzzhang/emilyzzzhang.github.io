import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Mesh } from 'three';
import type { ModelOverride } from '../../config/models';

export default function GltfModel({ override }: { override: ModelOverride }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}${override.url}`);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((obj) => {
      if ((obj as Mesh).isMesh) obj.castShadow = obj.receiveShadow = true;
    });
    return copy;
  }, [scene]);

  return <primitive object={model} scale={override.scale ?? 1} rotation-y={override.rotationY ?? 0} />;
}
