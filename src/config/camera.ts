import { PerspectiveCamera, Vector3 } from 'three';
import type { SectionId } from '../types/portfolio';
import { ANCHORS, DESK, DIORAMA, LAWN_SPAN, PLACEMENTS, ROOM, type Vec3 } from './sceneLayout';

export interface CameraPreset {
  position: Vec3;
  target: Vec3;
}

/**
 * `near` is as far out as the closest close-up allows (~1.3 from its target): depth precision
 * scales with it, and phones pull the overview back to ~50 units, where a 0.1 near plane let the
 * slab flicker through the floor.
 */
export const CAMERA = { fov: 32, near: 0.5, far: 120 } as const;

/**
 * Three-quarter, isometric-inspired overview, framing the whole diorama including its lawn, with a
 * little room above the entablature's top corner.
 */
export const HOME_VIEW: CameraPreset = {
  position: [15.42, 11.07, 15.56],
  target: [0.2, 1.25, 0.1],
};

/** Where the camera starts before gliding into HOME_VIEW on first load. */
export const INTRO_VIEW: CameraPreset = {
  position: [20.73, 16.05, 18.51],
  target: [0.2, 0.95, 0.1],
};

const [cx, , cz] = ANCHORS.computer;
const [mx, , mz] = ANCHORS.mug;
const [ex, , ez] = ANCHORS.envelope;
const [bx, , bz] = ANCHORS.bookshelf;
const [gx, gy, gz] = ANCHORS.gallery;
const [, , rz] = ANCHORS.resumePoster;

/** What the camera can close in on: a section's object, or Mochi or the guitar (no panel beside either). */
export type CameraFocus = SectionId | 'mochi' | 'guitar';

const [kx, , kz] = PLACEMENTS.mochiBed.position;
const [ux, , uz] = ANCHORS.guitar;

/** Close-up framing for each focusable object. */
export const FOCUS_VIEWS: Record<CameraFocus, CameraPreset> = {
  // Aimed a little above her so the speech bubble over her ears is in frame too.
  mochi: { position: [kx + 1.0, 1.35, kz + 1.7], target: [kx + 0.1, 0.55, kz + 0.1] },
  // Nearly face on (the guitar is turned GUITAR_TURN towards the room), looking over the basket in front.
  guitar: { position: [ux + 2.3, 1.8, uz + 3.0], target: [ux, 1.05, uz] },
  projects: { position: [cx + 0.8, 3.5, 0.75], target: [cx, DESK.height + 0.7, cz] },
  about: { position: [mx + 1.9, 3.0, mz + 2.6], target: [mx, DESK.height + 0.2, mz] },
  contact: { position: [ex + 0.9, 3.25, ez + 2.6], target: [ex, DESK.height + 0.1, ez] },
  education: { position: [3.2, 2.6, bz + 3.0], target: [bx, 1.85, bz] },
  experience: { position: [gx + 0.3, gy - 0.27, 1.2], target: [gx, gy - 0.1, gz] },
  // Lower and further forward than the poster, so the guitar and the basket corner below it share the frame.
  resume: { position: [-0.2, 2.55, rz + 1.05], target: [-3.6, 1.7, rz + 0.45] },
};

/** OrbitControls limits keep the camera outside the walls and above the floor. */
export const CONTROLS = {
  minDistance: 6,
  minPolarAngle: 0.45,
  maxPolarAngle: 1.32,
  minAzimuthAngle: 0.08,
  maxAzimuthAngle: 1.5,
  dampingFactor: 0.08,
  rotateSpeed: 0.55,
  zoomSpeed: 0.7,
} as const;

// Kept free of three.js so the eagerly-loaded app shell can read it (see cameraAnimation.ts).
export { CAMERA_ANIMATION } from './cameraAnimation';

/** How much further back the overview sits on narrow/portrait screens. */
export function overviewDistanceScale(aspect: number): number {
  return aspect >= 1.6 ? 1 : Math.min(2.4, 1.6 / aspect);
}

/** Close-ups pull back a little on phones so the object isn't cropped. */
export const MOBILE_FOCUS_SCALE = 1.35;

/**
 * Desktop close-ups sit this much further back than the presets, so the focused object is seen
 * within the room rather than filling the frame beside the panel.
 */
export const DESKTOP_FOCUS_SCALE = 1.9;

/**
 * The diorama's highest and lowest points from the overview: the entablature's top corners (its
 * top is 0.48 above the wall, and it reaches 0.31 past each face; see RoomEnvironment), and the
 * soil under the front of the lawn's rounded outline (a superellipse, exponent 2 / 0.45).
 */
const FRAME_TOP: Vec3[] = (() => {
  const y = ROOM.wallHeight + 0.48;
  const back = -(ROOM.half + ROOM.wallThickness + 0.31);
  const end = ROOM.half - 0.02 + 0.31;
  return [[back, y, back], [end, y, back], [back, y, end]];
})();
const FRAME_BOTTOM: Vec3[] = (() => {
  const [min, max] = LAWN_SPAN;
  const front = (min + max) / 2 + ((max - min) / 2) * Math.SQRT1_2 ** 0.45;
  return [[front, DIORAMA.lawn.top - DIORAMA.lawn.thickness - DIORAMA.lawn.soil, front]];
})();
/**
 * How close (px) the cornice's top comes to the screen's top edge, in the overview and explore mode.
 * The top bar holds only the corner buttons, and the cornice peaks between them, so it can rise right up.
 */
const TOP_CLEARANCE = 20;
/** The gap left above and below the diorama in the overview, as a fraction of the viewport height. */
const FRAME_MARGIN = 0.015;

/**
 * Fits the desktop overview, lawn and all, from TOP_CLEARANCE down to the screen's foot: how much
 * further back the camera sits (on top of `overviewDistanceScale`) and how far down the view shifts
 * (a fraction of the viewport height, for setViewOffset), with the cornice TOP_CLEARANCE from the top.
 */
export function overviewFit(width: number, height: number) {
  const { scale, project, bandTop } = fitDiorama(width, height, TOP_CLEARANCE, FRAME_MARGIN);
  const { top } = project(scale);
  return { scale, shiftY: (bandTop - top) / 2 };
}

/**
 * Explore mode's viewpoint: the overview's corner-on angle, but lower (about 15° above the floor
 * rather than 24°), so the walls face the visitor and less of the floor shows. Kept just inside
 * CONTROLS.maxPolarAngle, so handing the camera back to OrbitControls doesn't nudge it.
 */
export const EXPLORE_VIEW: CameraPreset = {
  position: [15.42, 7.8, 15.56],
  target: [0.2, 2.0, 0.1],
};

/** How much of the screen the room fills in explore mode, across or down, whichever is tighter. */
const EXPLORE_COVER = 0.93;
/** How far right of centre the room sits in explore mode, as a fraction of the viewport width. */
const EXPLORE_NUDGE_RIGHT = 0.04;

/** The room's box, slab to cornice, wall back faces to open ends (the lawn may run off-screen). */
const ROOM_BOX: Vec3[] = (() => {
  const lo = -(ROOM.half + ROOM.wallThickness + 0.31);
  const hi = ROOM.half + DIORAMA.openReach + 0.31;
  const top = ROOM.wallHeight + 0.48;
  const bottom = -DIORAMA.slab;
  return [lo, hi].flatMap((x) => [lo, hi].flatMap((z) => [[x, bottom, z], [x, top, z]] as Vec3[]));
})();

/**
 * Explore mode's framing: how far along EXPLORE_VIEW's ray the camera sits (as for scalePreset)
 * so the room fills EXPLORE_COVER of the screen, and the view shift (fractions of the viewport,
 * for setViewOffset) that centres it across, nudged EXPLORE_NUDGE_RIGHT right, with its cornice
 * TOP_CLEARANCE from the top of the screen.
 */
export function exploreFit(width: number, height: number) {
  const camera = new PerspectiveCamera(CAMERA.fov, width / height, CAMERA.near, CAMERA.far);
  const measure = (scale: number) => {
    const { position, target } = scalePreset(EXPLORE_VIEW, scale);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
    // The room, and the front corner of the lawn below it, so the garden's tip stays in view.
    const points = [...ROOM_BOX, ...FRAME_BOTTOM].map((p) => new Vector3(...p).project(camera));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.max(...ys), bottom: Math.min(...ys) };
  };
  // Normalised device coordinates span 2 each way; the room's size on screen goes roughly as 1 / distance.
  let scale = 1;
  for (let i = 0; i < 4; i++) {
    const { left, right, top, bottom } = measure(scale);
    scale *= Math.max((right - left) / 2, (top - bottom) / 2) / EXPLORE_COVER;
  }
  const { left, right, top } = measure(scale);
  const want = 1 - (2 * TOP_CLEARANCE) / height;
  return {
    scale,
    shift: { x: (left + right) / 4 - EXPLORE_NUDGE_RIGHT, y: (want - top) / 2 },
  };
}

/**
 * How far back (on top of `overviewDistanceScale`) the camera must sit for the diorama to fill the
 * band from `clearTop` px below the screen's top edge to its foot, less `margin` above and below;
 * never closer than narrow screens need to fit it across. Also returns the projection used to measure it.
 */
function fitDiorama(width: number, height: number, clearTop: number, margin: number) {
  const aspect = width / height;
  const base = overviewDistanceScale(aspect);
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
  const project = (scale: number) => {
    const { position, target } = scalePreset(HOME_VIEW, base * scale);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
    const y = (p: Vec3) => new Vector3(...p).project(camera).y;
    return { top: Math.max(...FRAME_TOP.map(y)), bottom: Math.min(...FRAME_BOTTOM.map(y)) };
  };
  // The free band in normalised device coordinates, from the tabs' bottom edge down to the screen's.
  const bandTop = 1 - (2 * clearTop) / height;
  const want = bandTop + 1 - 4 * margin;
  // The diorama's height on screen goes roughly as 1 / distance, so a few rounds settle it.
  let scale = 1;
  for (let i = 0; i < 4; i++) {
    const { top, bottom } = project(scale);
    scale *= (top - bottom) / want;
  }
  // Narrower screens already sit further back so the diorama fits across; never come closer
  // than that, or its sides would run off. It is still centred in the band, with the gaps larger.
  if (base > 1) scale = Math.max(scale, 1);
  return { scale, project, bandTop };
}

/** Moves the camera along its view ray, keeping the target fixed. */
export function scalePreset(preset: CameraPreset, scale: number): CameraPreset {
  const [px, py, pz] = preset.position;
  const [tx, ty, tz] = preset.target;
  return {
    target: preset.target,
    position: [tx + (px - tx) * scale, ty + (py - ty) * scale, tz + (pz - tz) * scale],
  };
}
