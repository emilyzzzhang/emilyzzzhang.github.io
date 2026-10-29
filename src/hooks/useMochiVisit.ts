import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMERA_ANIMATION } from '../config/cameraAnimation';
import { MOCHI_VISIT } from '../config/mochi';

/** The camera is flying in to Mochi, or has arrived and she is meowing. */
export type MochiVisit = 'zooming' | 'meowing';

/**
 * A click on Mochi: the camera zooms in, she wakes and meows once it arrives, then it zooms
 * back out by itself. Further clicks are ignored until a short cooldown after the zoom out.
 */
export function useMochiVisit(reducedMotion: boolean) {
  const [phase, setPhase] = useState<MochiVisit | null>(null);
  const visiting = useRef(false);
  /** Visiting, or cooling down after a visit: clicks on her are ignored. */
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  // Camera moves are instant with reduced motion, so only the waits around them remain.
  const flight = useRef((seconds: number) => seconds);
  flight.current = (seconds) => (reducedMotion ? 0 : seconds);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const after = (seconds: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, seconds * 1000));
  };

  const end = useCallback(() => {
    if (!visiting.current) return;
    visiting.current = false;
    clear();
    setPhase(null);
    after(flight.current(CAMERA_ANIMATION.returnDuration) + MOCHI_VISIT.cooldownSeconds, () => {
      busy.current = false;
    });
  }, []);

  /** Returns false when the click is ignored (a visit or its cooldown is under way). */
  const start = useCallback(() => {
    if (busy.current) return false;
    busy.current = visiting.current = true;
    setPhase('zooming');
    after(flight.current(CAMERA_ANIMATION.focusDuration), () => {
      setPhase('meowing');
      after(MOCHI_VISIT.meowSeconds, end);
    });
    return true;
  }, [end]);

  useEffect(() => clear, []);

  return { phase, start, end };
}
