import { useEffect, useRef, type RefObject } from 'react';

/** Clicks on these keep their own job (a nav link switches sections); the 3D canvas reports its own misses. */
const IGNORED = 'a, button, input, select, textarea, label, canvas, [role="button"]';

/**
 * Calls `onOutside` for a click on the page outside `inside`, while `active`. A press that
 * started inside (e.g. selecting text) and was released outside doesn't count.
 */
export function useOutsideClick(active: boolean, onOutside: () => void, inside?: RefObject<HTMLElement | null>) {
  const latest = useRef(onOutside);
  latest.current = onOutside;

  useEffect(() => {
    if (!active) return;
    let pressedInside = false;
    const isInside = (target: EventTarget | null) => inside?.current?.contains(target as Node) ?? false;
    const onDown = (e: PointerEvent) => {
      pressedInside = isInside(e.target);
    };
    const onClick = (e: MouseEvent) => {
      if (pressedInside || isInside(e.target) || (e.target as Element).closest(IGNORED)) return;
      latest.current();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('click', onClick);
    };
  }, [active, inside]);
}
