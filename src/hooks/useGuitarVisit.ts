import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMERA_ANIMATION } from '../config/cameraAnimation';

/** How long the camera lingers on the guitar once it has arrived, in seconds. */
const LINGER_SECONDS = 3;

/**
 * The tune starting: the camera zooms in on the guitar, lingers while it plays, then zooms back
 * out by itself. Like Mochi's visit, but with nothing to wait on once it arrives.
 */
export function useGuitarVisit(reducedMotion: boolean) {
  const [visiting, setVisiting] = useState(false);
  const timer = useRef(0);
  // Camera moves are instant with reduced motion, so only the linger remains.
  const flight = reducedMotion ? 0 : CAMERA_ANIMATION.focusDuration;

  const end = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisiting(false);
  }, []);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisiting(true);
    timer.current = window.setTimeout(end, (flight + LINGER_SECONDS) * 1000);
  }, [flight, end]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { visiting, start, end };
}
