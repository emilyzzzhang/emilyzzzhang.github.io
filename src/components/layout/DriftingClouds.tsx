import type { CSSProperties } from 'react';

/**
 * Two layers of soft clouds drifting across the daytime sky, behind the transparent 3D canvas.
 * The far layer is hazier, fainter and slower; the near layer is a little crisper and faster, which
 * gives the backdrop depth. Each layer holds the same set of clouds twice side by side and slides
 * left by exactly one copy, so it loops seamlessly. Pure CSS (see `.clouds` in global.css): only
 * transforms animate, and the clouds fade out at night. As the room is orbited, the layers also
 * slide with the camera (SkyParallax sets --sky-yaw and --sky-pitch).
 */

interface Cloud {
  /** Left edge and vertical centre within one copy of the layer, in percent. */
  x: number;
  y: number;
  /** Width in vw; height follows from the puff layout. */
  width: number;
}

/** Puffs that make up one cloud: [x%, y%, radius as % of the cloud's width], biggest in the middle. */
const PUFFS: [number, number, number][] = [
  [18, 64, 15],
  [34, 46, 21],
  [52, 40, 25],
  [70, 50, 19],
  [84, 64, 13],
  [50, 70, 30],
];

const puffBackground = PUFFS.map(
  ([x, y, r]) => `radial-gradient(circle at ${x}% ${y}%, rgba(255, 249, 243, 0.95) 0, rgba(255, 246, 240, 0.85) ${r * 0.55}%, rgba(255, 244, 238, 0) ${r}%)`,
).join(', ');

/**
 * Mostly the upper sky and the sides; kept sparse so they never crowd the room. Positions are
 * percent of one copy of the (oversized, see `.clouds__pan`) layer: about 20–80% is on screen.
 */
const FAR: Cloud[] = [
  { x: 4, y: 26, width: 18 },
  { x: 20, y: 25, width: 22 },
  { x: 42, y: 21, width: 18 },
  { x: 58, y: 31, width: 24 },
  { x: 74, y: 24, width: 16 },
  { x: 90, y: 28, width: 20 },
];
const NEAR: Cloud[] = [
  { x: 10, y: 56, width: 22 },
  { x: 24, y: 43, width: 20 },
  { x: 53, y: 64, width: 26 },
  { x: 70, y: 47, width: 18 },
  { x: 88, y: 60, width: 22 },
];

function Layer({ clouds, depth }: { clouds: Cloud[]; depth: 'far' | 'near' }) {
  return (
    // The outer layer follows the camera (parallax); the inner one drifts on its own loop.
    <div className={`clouds__pan clouds__pan--${depth}`}>
      <div className={`clouds__layer clouds__layer--${depth}`}>
        {[0, 1].map((copy) =>
          clouds.map(({ x, y, width }, i) => (
            <span
              key={`${copy}-${i}`}
              className="cloud"
              style={{ left: `${(copy * 100 + x) / 2}%`, top: `${y}%`, width: `${width}vw`, background: puffBackground } as CSSProperties}
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
