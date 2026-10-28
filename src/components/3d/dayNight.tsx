import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MathUtils } from 'three';
import { DAY_NIGHT_SPEED } from '../../config/theme';
import type { TimeOfDay } from '../../hooks/useTimeOfDay';

/** 0 = full day, 1 = full night. A ref, so blending never re-renders React. */
const BlendContext = createContext<RefObject<number> | null>(null);

interface DayNightProviderProps {
  mode: TimeOfDay;
  reducedMotion: boolean;
  children: ReactNode;
}

/** Eases a single shared value between day and night that lights and glows read each frame. */
export function DayNightProvider({ mode, reducedMotion, children }: DayNightProviderProps) {
  const blend = useRef(mode === 'night' ? 1 : 0);
  const target = mode === 'night' ? 1 : 0;

  // Negative priority: runs before the consumers below, without taking over rendering.
  useFrame((_, delta) => {
    if (blend.current === target) return;
    const next = reducedMotion ? target : MathUtils.damp(blend.current, target, DAY_NIGHT_SPEED, delta);
    blend.current = Math.abs(next - target) < 0.002 ? target : next;
  }, -2);

  return <BlendContext.Provider value={blend}>{children}</BlendContext.Provider>;
}

/** Calls `apply(blend)` on frames where the day/night blend changed (and once on mount). */
export function useDayNight(apply: (blend: number) => void) {
  const blend = useContext(BlendContext);
  if (!blend) throw new Error('useDayNight must be used inside <DayNightProvider>');
  const last = useRef(Number.NaN);

  useFrame(() => {
    if (blend.current === last.current) return;
    last.current = blend.current;
    apply(blend.current);
  });
}

/** A day/night colour pair, pre-parsed so blending allocates nothing per frame. */
export function colorPair(day: string, night: string): [Color, Color] {
  return [new Color(day), new Color(night)];
}

export function blendColor(target: Color, [day, night]: [Color, Color], t: number) {
  target.lerpColors(day, night, t);
}
