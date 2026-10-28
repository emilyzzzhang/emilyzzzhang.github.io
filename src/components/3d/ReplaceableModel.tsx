import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Mesh } from 'three';
import { MODEL_OVERRIDES, type ModelOverride, type ReplaceableId } from '../../config/models';

interface ReplaceableModelProps {
  id: ReplaceableId;
  /** The code-built version, used when no GLB is configured or it fails to load. */
  children: ReactNode;
}

/** Renders a configured GLB in place of a primitive object, falling back to the primitive. */
export function ReplaceableModel({ id, children }: ReplaceableModelProps) {
  const override = MODEL_OVERRIDES[id];
  if (!override) return <>{children}</>;
  return (
    <ModelErrorBoundary fallback={children}>
      <Suspense fallback={children}>
        <GltfModel override={override} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

function GltfModel({ override }: { override: ModelOverride }) {
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

class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Model override failed to load; using the built-in version.', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
