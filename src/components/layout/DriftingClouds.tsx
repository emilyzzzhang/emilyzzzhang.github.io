import type { CSSProperties } from 'react';

/**
 * Two layers of soft clouds drifting across the daytime sky, behind the transparent 3D canvas.
 * The far layer is hazier, fainter and slower; the near layer is a little crisper and faster, which
 * gives the backdrop depth. Each layer holds the same set of clouds twice side by side and slides
 * left by exactly one copy, so it loops seamlessly. Pure CSS (see `.clouds` in global.css): only
 * transforms animate, and the clouds fade out at night. As the room is orbited, the layers also
 * slide with the camera (SkyParallax sets --sky-yaw and --sky-pitch).
 */

type Shape = 'cumulus' | 'heap' | 'wisp';

interface Cloud {
  /** Left edge and vertical centre within one copy of the layer, in percent. */
  x: number;
  y: number;
  /** Width in vw; height follows from the shape's aspect ratio. */
  width: number;
  shape: Shape;
}

/**
 * Puffs that make up a cloud: [x%, y%, radius as % of the cloud's width], overlapping into lumpy
 * tops; `base` is the flat ellipse they sit on ([width%, height%, y%] of the cloud's box).
 */
const SHAPES: Record<Shape, { aspect: number; puffs: [number, number, number][]; base: [number, number, number] }> = {
  // Long and low, like the banks along the bottom of the painted sky.
  cumulus: {
    aspect: 2.4,
    puffs: [
      [20, 55, 9],
      [32, 42, 11],
      [45, 34, 13],
      [58, 38, 12],
      [70, 46, 10],
      [81, 56, 8],
      [28, 66, 12],
      [50, 62, 15],
      [72, 66, 11],
    ],
    base: [38, 20, 72],
  },
  // Taller, piled up in the middle, like the big cloud at the top right.
  heap: {
    aspect: 1.8,
    puffs: [
      [22, 62, 10],
      [34, 46, 13],
      [48, 32, 15],
      [60, 26, 12],
      [70, 42, 13],
      [80, 58, 10],
      [50, 62, 17],
    ],
    base: [36, 18, 74],
  },
  // Small and scattered, like the little puffs dotted between the big ones.
  wisp: {
    aspect: 3.2,
    puffs: [
      [26, 58, 9],
      [42, 48, 12],
      [58, 52, 10],
      [74, 60, 8],
    ],
    base: [30, 18, 70],
  },
};

/**
 * Lit like the painted sky: a cream highlight up and to the left (towards the sun) on each puff,
 * peach bodies fading to pink at their edges, and a soft lavender shadow along the underside.
 * Sizes are ellipses in % of the box, so a puff stays round whatever the shape's aspect ratio.
 * Earlier gradients paint on top, so highlights come first and the shadow sits over the bodies.
 */
function cloudBackground({ aspect, puffs, base: [bw, bh, by] }: (typeof SHAPES)[Shape]) {
  const highlights = puffs.map(([x, y, r]) => {
    const h = r * 0.7;
    return `radial-gradient(ellipse ${h}% ${h * aspect}% at ${x - r * 0.25}% ${y - r * 0.35 * aspect}%, rgba(255, 238, 204, 0.85) 0, rgba(255, 238, 204, 0) 100%)`;
  });
  const shadow = `radial-gradient(ellipse ${bw * 1.05}% ${bh * 0.7}% at 50% ${by + bh * 0.4}%, rgba(220, 170, 204, 0.6) 0, rgba(220, 170, 204, 0) 100%)`;
  const body = (w: number, h: number, x: number, y: number) =>
    `radial-gradient(ellipse ${w}% ${h}% at ${x}% ${y}%, rgba(252, 214, 186, 0.96) 0, rgba(247, 198, 188, 0.92) 62%, rgba(238, 190, 204, 0) 100%)`;
  const bodies = puffs.map(([x, y, r]) => body(r, r * aspect, x, y));
  return [...highlights, shadow, ...bodies, body(bw, bh, 50, by)].join(', ');
}

const BACKGROUNDS = Object.fromEntries(
  Object.entries(SHAPES).map(([shape, def]) => [shape, cloudBackground(def)]),
) as Record<Shape, string>;

/**
 * Mostly the upper sky and the sides, big clouds mixed with small wisps; the room draws over the
 * middle, so they never crowd it. Positions are percent of one copy of the (oversized, see
 * `.clouds__pan`) layer: about 20–80% is on screen.
 */
const FAR: Cloud[] = [
  { x: 4, y: 26, width: 23, shape: 'cumulus' },
  { x: 14, y: 16, width: 13, shape: 'wisp' },
  { x: 20, y: 25, width: 29, shape: 'cumulus' },
  { x: 33, y: 36, width: 16, shape: 'wisp' },
  { x: 42, y: 21, width: 21, shape: 'heap' },
  { x: 50, y: 12, width: 12, shape: 'wisp' },
  { x: 58, y: 31, width: 31, shape: 'cumulus' },
  { x: 66, y: 18, width: 14, shape: 'wisp' },
  { x: 74, y: 24, width: 20, shape: 'heap' },
  { x: 82, y: 38, width: 17, shape: 'wisp' },
  { x: 90, y: 28, width: 26, shape: 'cumulus' },
];
const NEAR: Cloud[] = [
  { x: 3, y: 48, width: 18, shape: 'wisp' },
  { x: 10, y: 56, width: 29, shape: 'cumulus' },
  { x: 24, y: 43, width: 23, shape: 'heap' },
  { x: 38, y: 68, width: 21, shape: 'wisp' },
  { x: 53, y: 64, width: 34, shape: 'cumulus' },
  { x: 62, y: 40, width: 16, shape: 'wisp' },
  { x: 70, y: 47, width: 22, shape: 'heap' },
  { x: 80, y: 70, width: 20, shape: 'wisp' },
  { x: 88, y: 60, width: 29, shape: 'cumulus' },
];

function Layer({ clouds, depth }: { clouds: Cloud[]; depth: 'far' | 'near' }) {
  return (
    // The outer layer follows the camera (parallax); the inner one drifts on its own loop.
    <div className={`clouds__pan clouds__pan--${depth}`}>
      <div className={`clouds__layer clouds__layer--${depth}`}>
        {[0, 1].map((copy) =>
          clouds.map(({ x, y, width, shape }, i) => (
            <span
              key={`${copy}-${i}`}
              className="cloud"
              style={
                {
                  left: `${(copy * 100 + x) / 2}%`,
                  top: `${y}%`,
                  width: `${width}vw`,
                  aspectRatio: SHAPES[shape].aspect,
                  background: BACKGROUNDS[shape],
                } as CSSProperties
              }
            />
          )),
        )}
      </div>
    </div>
  );
}

export function DriftingClouds() {
  return (
    <div className="clouds" aria-hidden="true">
      <Layer clouds={FAR} depth="far" />
      <Layer clouds={NEAR} depth="near" />
    </div>
  );
}
