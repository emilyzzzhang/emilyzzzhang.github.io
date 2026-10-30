import { Component, type ReactNode } from 'react';
import { NAV_ORDER, SECTIONS } from '../../data/sections';
import type { SectionId } from '../../types/portfolio';

/** Shown instead of the 3D room when WebGL is unavailable or the scene fails to load. */
export function SceneFallback({ onOpen }: { onOpen: (section: SectionId) => void }) {
  return (
    <div className="scene-fallback">
      <div className="scene-fallback__card">
        <div className="scene-fallback__art" aria-hidden="true" />
        <h2>The 3D room couldn't open on this device</h2>
        <p>Everything inside it is still here — pick a corner of the room to visit:</p>
        <ul className="scene-fallback__links">
          {NAV_ORDER.map((id) => (
            <li key={id}>
              <button type="button" className="button button--ghost" data-opens-panel onClick={() => onOpen(id)}>
                {SECTIONS[id].navLabel}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface BoundaryProps {
  onError: () => void;
  children: ReactNode;
}

/** Catches WebGL context errors and failed scene-chunk loads so the HTML portfolio keeps working. */
export class SceneErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D scene failed to load:', error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
