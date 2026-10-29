import { memo, type CSSProperties } from 'react';

/** Stars visible in the viewport at the overview; more are scattered just off-screen for parallax. */
const STAR_COUNT = 700;
/** Faint stars crowded into the Milky Way band, on top of the field. */
const BAND_STAR_COUNT = 380;
/** How far the star field reaches past each edge of the viewport (vw, vh), so turning never shows an edge. */
const MARGIN = { x: 26, y: 22 };
/** Real star colours, weighted towards white: blue-white, white, ivory, pale gold and the odd orange giant. */
const COLORS: [string, number][] = [
  ['#D6E2FF', 0.22],
  ['#EDF1FF', 0.24],
  ['#FFFFFF', 0.24],
  ['#FFF4E2', 0.16],
  ['#FFE6BE', 0.1],
  ['#FFCFA3', 0.04],
];

/**
 * Areas kept clear of anything brighter than a faint pinprick, in viewport percent: the hero
 * introduction (top-left), the navbar (top-right) and the constellation (bottom-left).
 */
const CLEAR: [number, number, number, number][] = [
  [0, 6, 34, 46],
  [48, 0, 100, 11],
  [2, 60, 24, 86],
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

type Magnitude = 'faint' | 'small' | 'medium' | 'bright' | 'brilliant';

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  magnitude: Magnitude;
  /** Twinkle period and phase in seconds; absent for the steady majority. */
  twinkle?: { duration: number; delay: number };
}

function pickColor(rand: () => number) {
  let roll = rand();
  for (const [color, weight] of COLORS) {
    roll -= weight;
    if (roll < 0) return color;
  }
  return COLORS[0][0];
}

/** Like the real sky: a dust of faint pinpricks, fewer small stars, and only a handful of bright ones. */
function makeStar(rand: () => number, x: number, y: number, maxMagnitude: Magnitude = 'brilliant'): Star {
  const roll = rand();
  let magnitude: Magnitude =
    roll < 0.68 ? 'faint' : roll < 0.9 ? 'small' : roll < 0.97 ? 'medium' : roll < 0.994 ? 'bright' : 'brilliant';
  if (maxMagnitude === 'faint') magnitude = 'faint';
  const [size, opacity] = {
    faint: [0.6 + rand() * 0.6, 0.3 + rand() * 0.45],
    small: [1.2 + rand() * 0.6, 0.55 + rand() * 0.35],
    medium: [1.8 + rand() * 0.6, 0.8 + rand() * 0.2],
    bright: [2.4 + rand() * 0.6, 1],
    brilliant: [3 + rand() * 0.8, 1],
  }[magnitude];
  const twinkles = magnitude !== 'faint' && rand() < (magnitude === 'small' ? 0.08 : 0.35);
  return {
    x,
    y,
    size,
    color: pickColor(rand),
    opacity,
    magnitude,
    twinkle: twinkles ? { duration: 4 + rand() * 7, delay: -rand() * 11 } : undefined,
  };
}

function buildSky(): Star[] {
  const rand = mulberry32(2027);
  const stars: Star[] = [];
  let visible = 0;
  while (visible < STAR_COUNT) {
    // Viewport percent, reaching past the edges by MARGIN.
    const x = -MARGIN.x + rand() * (100 + MARGIN.x * 2);
    const y = -MARGIN.y + rand() * (100 + MARGIN.y * 2);
    const clear = CLEAR.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) visible++;
    stars.push(makeStar(rand, x, y, clear ? 'faint' : 'brilliant'));
  }
  return stars;
}

/** Stars in the Milky Way band, in percent of the band: crowded towards its spine, along its whole length. */
function buildBand(): Star[] {
  const rand = mulberry32(1987);
  return Array.from({ length: BAND_STAR_COUNT }, () => {
    // Sum of three uniforms: a soft bell curve across the band.
    const x = ((rand() + rand() + rand()) / 3) * 100;
    return makeStar(rand, x, rand() * 100, rand() < 0.85 ? 'faint' : 'brilliant');
  });
}

const SKY = buildSky();
const BAND = buildBand();

/**
 * The Big Dipper, from the real stars' positions (degrees, flattened onto the sky with x to the
 * right and y down) and sizes from their brightness. Alcor sits just beside Mizar, as it does.
 */
const DIPPER = {
  viewBox: [25, 13.5],
  stars: [
    { name: 'Dubhe', x: 24.1, y: 0.5, size: 3.4 },
    { name: 'Merak', x: 24.3, y: 5.9, size: 2.9 },
    { name: 'Phecda', x: 16.9, y: 8.55, size: 2.9 },
    { name: 'Megrez', x: 13.8, y: 5.25, size: 2.2 },
    { name: 'Alioth', x: 8.2, y: 6.3, size: 3.4 },
    { name: 'Mizar', x: 3.9, y: 7.35, size: 3.1 },
    { name: 'Alcor', x: 3.4, y: 6.7, size: 1.3 },
    { name: 'Alkaid', x: 0.5, y: 12.95, size: 3.3 },
  ],
  /** The handle out from Megrez, then round the bowl. */
  lines: ['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Dubhe', 'Merak', 'Phecda', 'Megrez'],
};
/** Where the constellation sits, in viewport percent (top-left of its box), and how wide it is. */
const DIPPER_AT = { x: 4, y: 63, width: 18 };

/**
 * Occasional meteors, in viewport percent like the stars. Each streaks across once per `cycle`
 * seconds, first after `delay`; the cycles differ so they never fall into a pattern. They glide
 * nearly level, dipping only a little: angles just over 0° drift right, just under 180° drift
 * left. `size` scales the whole streak, so the small ones look farther off. They sit off to the
 * sides, where the room doesn't cover them, and all start clear of the hero and navbar.
 */
const SHOOTING_STARS = [
  { x: 36, y: 14, angle: 168, size: 0.6, cycle: 11, delay: 1 },
  { x: 66, y: 10, angle: 14, size: 1.3, cycle: 12.5, delay: 4 },
  { x: 76, y: 28, angle: 8, size: 0.75, cycle: 13, delay: 7 },
  { x: 74, y: 52, angle: 18, size: 1, cycle: 12, delay: 10 },
  { x: 24, y: 44, angle: 172, size: 1.25, cycle: 11.5, delay: 2.5 },
  { x: 4, y: 34, angle: 12, size: 0.55, cycle: 13, delay: 5.5 },
  { x: 26, y: 70, angle: 164, size: 0.9, cycle: 12.5, delay: 8.5 },
  { x: 90, y: 64, angle: 170, size: 0.7, cycle: 13, delay: 11.5 },
];

/** Viewport percent to percent of the oversized pan, which starts MARGIN before the viewport's edge. */
const panLeft = (x: number) => `${((x + MARGIN.x) / (100 + MARGIN.x * 2)) * 100}%`;
const panTop = (y: number) => `${((y + MARGIN.y) / (100 + MARGIN.y * 2)) * 100}%`;

function StarDot({ x, y, size, color, opacity, magnitude, twinkle }: Omit<Star, 'x' | 'y'> & { x: string; y: string }) {
  return (
    <span
      className={`star star--${magnitude}${twinkle ? ' star--twinkle' : ''}`}
      style={
        {
          left: x,
          top: y,
          width: size,
          height: size,
          color,
          '--star-opacity': opacity,
          ...(twinkle && { animationDuration: `${twinkle.duration}s`, animationDelay: `${twinkle.delay}s` }),
        } as CSSProperties
      }
    />
  );
}

function Constellation() {
  const [w, h] = DIPPER.viewBox;
  const byName = Object.fromEntries(DIPPER.stars.map((s) => [s.name, s]));
  const points = DIPPER.lines.map((name) => `${byName[name].x},${byName[name].y}`).join(' ');
  return (
    <div
      className="constellation"
      style={{ left: panLeft(DIPPER_AT.x), top: panTop(DIPPER_AT.y), width: `${DIPPER_AT.width}vw`, aspectRatio: w / h }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
      {DIPPER.stars.map(({ name, x, y, size }) => (
        <StarDot
          key={name}
          x={`${(x / w) * 100}%`}
          y={`${(y / h) * 100}%`}
          size={size}
          color="#F4F2FF"
          opacity={1}
          magnitude={size > 3 ? 'brilliant' : size > 2 ? 'bright' : 'small'}
        />
      ))}
    </div>
  );
}

/**
 * Night-only starfield behind the transparent 3D canvas, so the room always draws over it: a dense
 * field of stars of every size, a faint Milky Way across the upper right, the Big Dipper low on
 * the left, and the odd shooting star. Fading, twinkling and meteors are pure CSS (see `.stars` in
 * global.css): no per-frame JS. The field also slides as the room is orbited (SkyParallax sets
 * --sky-yaw and --sky-pitch; see `.stars__pan`). It never changes, so it skips the re-render
 * whenever the app's state does (hundreds of stars).
 */
export const StarrySky = memo(function StarrySky() {
  return (
    <div className="stars" aria-hidden="true">
      <div className="stars__pan">
        <div className="milky-way" style={{ left: panLeft(70), top: panTop(20) }}>
          {BAND.map(({ x, y, ...star }, i) => (
            <StarDot key={i} x={`${x}%`} y={`${y}%`} {...star} />
          ))}
        </div>
        {SKY.map(({ x, y, ...star }, i) => (
          <StarDot key={i} x={panLeft(x)} y={panTop(y)} {...star} />
        ))}
        <Constellation />
        {SHOOTING_STARS.map(({ x, y, angle, size, cycle, delay }, i) => (
          <span
            key={`meteor-${i}`}
            className="shooting-star"
            style={
              {
                left: panLeft(x),
                top: panTop(y),
                '--angle': `${angle}deg`,
                '--size': size,
                animationDuration: `${cycle}s`,
                animationDelay: `${delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
});
