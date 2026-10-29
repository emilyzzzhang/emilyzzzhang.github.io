import { Component, lazy, Suspense, type ReactNode } from 'react';
import { MODEL_OVERRIDES, type ReplaceableId } from '../../config/models';

// The GLTF loader is only downloaded when a model override is actually configured.
const GltfModel = lazy(() => import('./GltfModel'));

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
