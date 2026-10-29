import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CAMERA_ANIMATION, HOME_VIEW, overviewDistanceScale, scalePreset } from '../../config/camera';

/**
 * Render resolution (device pixel ratio). The overview renders at 1.5, where the room's
 * edges look the same as at 2 for ~40% less GPU work; close-ups (a focused section, or the
 * overview zoomed well in) render at 2, so small text on the boards stays crisp. Phones
 * (lowPower) stay at 1.5 throughout, as before.
 */
export const PIXEL_RATIO = { overview: 1.5, closeUp: 2 } as const;

/**
 * The pixel ratio for the Canvas's `dpr` prop, following the camera but never switching while the
 * view is close: up to the close-up ratio as soon as the camera sets off towards an object, back
 * down only once it has returned to the overview. Moving between close-ups, or coming back and
 * refocusing quickly, never switches. (It has to be the prop: R3F re-applies `dpr` whenever the
 * Canvas re-renders, which would undo a ratio set from inside the scene.)
 */
export function useAdaptivePixelRatio(closeUp: boolean, lowPower: boolean, reducedMotion: boolean) {
  const target = closeUp && !lowPower ? PIXEL_RATIO.closeUp : PIXEL_RATIO.overview;
  const [settled, setSettled] = useState<number>(target);

  useEffect(() => {
    if (target >= settled || reducedMotion) {
      setSettled(target);
      return;
    }
    const timer = window.setTimeout(() => setSettled(target), CAMERA_ANIMATION.returnDuration * 1000);
    return () => window.clearTimeout(timer);
  }, [target, settled, reducedMotion]);

  // Raising takes effect immediately; lowering waits for the timer above. R3F clamps the
  // upper bound to the screen's own ratio.
  return [1, Math.max(target, settled)] as [number, number];
}

/**
 * Stops rendering while the tab is hidden and picks up where it left off. Browsers already
 * stop animation frames in hidden tabs; this makes the pause explicit and, by restoring the
 * clock on return, keeps every clock-driven animation (Mochi, the coding screen, the label
 * markers) from jumping ahead or restarting.
 */
export function PauseWhenHidden() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const clock = useThree((s) => s.clock);

  useEffect(() => {
    let elapsed = 0;
    const onVisibility = () => {
      if (document.hidden) {
        elapsed = clock.getElapsedTime();
        setFrameloop('never');
      } else {
        // setFrameloop restarts the clock at zero; put the animation time back.
        setFrameloop('always');
        clock.elapsedTime = elapsed;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [clock, setFrameloop]);

  return null;
}

/**
 * Zoomed in: the orbit camera closer than `enter` × its overview distance; out again only past
 * `leave`, so hovering around one distance never flips the pixel ratio back and forth.
 */
const ZOOM = { enter: 0.6, leave: 0.7 };

/** Reports when scroll-zooming the overview crosses into (or back out of) close-up range. */
export function ZoomWatcher({ onChange }: { onChange: (zoomedIn: boolean) => void }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const homeDistance = useMemo(() => {
    const home = scalePreset(HOME_VIEW, overviewDistanceScale(size.width / size.height));
    return new Vector3(...home.position).distanceTo(new Vector3(...home.target));
  }, [size.width, size.height]);
  const zoomedIn = useRef(false);

  useFrame(({ camera }) => {
    // Section fly-ins disable orbiting and are handled by the section itself.
    if (!controls?.enabled) return;
    const ratio = camera.position.distanceTo(controls.target) / homeDistance;
    const next = ratio < (zoomedIn.current ? ZOOM.leave : ZOOM.enter);
    if (next !== zoomedIn.current) {
      zoomedIn.current = next;
      onChange(next);
    }
  });

  return null;
}

/**
 * Lighter frames while the visitor drags or zooms the camera. The lights and almost everything
 * they shine on stay put, so the shadow maps (each one the whole room drawn again) are reused
 * rather than redrawn, and the pointer isn't ray-tested against every object for hovers that
 * can't happen mid-drag. Both come back the moment the drag ends, before its click is handled.
 */
export function LightenWhileOrbiting() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);

  useEffect(() => {
    if (!controls) return;
    const mask = raycaster.layers.mask;
    const start = () => {
      gl.shadowMap.autoUpdate = false;
      raycaster.layers.disableAll();
    };
    const end = () => {
      gl.shadowMap.autoUpdate = true;
      raycaster.layers.mask = mask;
    };
    controls.addEventListener('start', start);
    controls.addEventListener('end', end);
    return () => {
      controls.removeEventListener('start', start);
      controls.removeEventListener('end', end);
      end();
    };
  }, [controls, gl, raycaster]);

  return null;
}

/**
 * Reports ready once the room has actually been drawn, not merely when the canvas exists: the
 * first draw compiles every shader, which can hold up the page for a moment. A frame callback
 * runs before that frame renders, so the second one means the first is on screen.
 */
export function ReadyAfterFirstFrame({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) onReady();
  });
  return null;
}
