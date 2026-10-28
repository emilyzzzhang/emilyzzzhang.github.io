import type { CSSProperties } from 'react';

const STAR_COUNT = 85;
/** Warm ivory, soft champagne and a very pale lavender-white. */
const COLORS = ['#FFF6E6', '#F7E8C9', '#EEE9FF'];

/** Areas kept clear, in viewport percent: the hero introduction (top-left) and the navbar (top-right). */
const CLEAR: [number, number, number, number][] = [
  [0, 6, 34, 46],
  [48, 0, 100, 11],
];

/** Small deterministic PRNG, so the sky is identical on every visit (and three.js stays out of this bundle). */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  /** Twinkle period and phase in seconds; absent for the steady majority. */
  twinkle?: { duration: number; delay: number };
}

function buildSky(): Star[] {
  const rand = mulberry32(2027);
  const stars: Star[] = [];
  while (stars.length < STAR_COUNT) {
    const x = rand() * 100;
    const y = rand() * 100;
    if (CLEAR.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
    const roll = rand();
    // Mostly pinpricks, some small stars, a handful of brighter ones.
    const size = roll < 0.72 ? 1.4 + rand() * 0.6 : roll < 0.93 ? 2.2 + rand() * 0.4 : 2.9 + rand() * 0.5;
    stars.push({
      x,
      y,
      size,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      opacity: size > 2.8 ? 1 : 0.65 + rand() * 0.35,
      twinkle: rand() < 0.17 ? { duration: 5 + rand() * 6, delay: -rand() * 11 } : undefined,
    });
  }
  return stars;
}

const SKY = buildSky();

/**
 * Night-only starfield behind the transparent 3D canvas, so the room always draws over it.
 * Fading and twinkling are pure CSS (see `.stars` in global.css): no per-frame JS.
 */
export function StarrySky() {
  return (
    <div className="stars" aria-hidden="true">
      {SKY.map(({ x, y, size, color, opacity, twinkle }, i) => (
        <span
          key={i}
          className={`star${twinkle ? ' star--twinkle' : ''}${size > 2.8 ? ' star--bright' : ''}`}
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: color,
              '--star-opacity': opacity,
              ...(twinkle && { animationDuration: `${twinkle.duration}s`, animationDelay: `${twinkle.delay}s` }),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
