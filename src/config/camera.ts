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
const [, ry, rz] = ANCHORS.resumePoster;

/** What the camera can close in on: a section's object, or Mochi (no panel) after she wakes. */
export type CameraFocus = SectionId | 'mochi';

const [kx, , kz] = PLACEMENTS.mochiBed.position;

/** Close-up framing for each focusable object. */
export const FOCUS_VIEWS: Record<CameraFocus, CameraPreset> = {
  // Aimed a little above her so the speech bubble over her ears is in frame too.
  mochi: { position: [kx + 1.0, 1.35, kz + 1.7], target: [kx + 0.1, 0.55, kz + 0.1] },
  projects: { position: [cx + 0.8, 3.5, 0.75], target: [cx, DESK.height + 0.7, cz] },
  about: { position: [mx + 1.9, 3.0, mz + 2.6], target: [mx, DESK.height + 0.2, mz] },
  contact: { position: [ex + 0.9, 3.25, ez + 2.6], target: [ex, DESK.height + 0.1, ez] },
  education: { position: [3.2, 2.6, bz + 3.0], target: [bx, 1.85, bz] },
  experience: { position: [gx + 0.4, gy - 0.35, 3.4], target: [gx, gy - 0.1, gz] },
  resume: { position: [1.3, ry + 0.1, rz + 1.3], target: [-4, ry, rz] },
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
  const end = ROOM.half + 0.1 + 0.31;
  return [[back, y, back], [end, y, back], [back, y, end]];
})();
const FRAME_BOTTOM: Vec3[] = (() => {
  const [min, max] = LAWN_SPAN;
  const front = (min + max) / 2 + ((max - min) / 2) * Math.SQRT1_2 ** 0.45;
  return [[front, DIORAMA.lawn.top - DIORAMA.lawn.thickness - DIORAMA.lawn.soil, front]];
})();
/** The gap left above and below the diorama, as a fraction of the viewport height. */
const FRAME_MARGIN = 0.03;

/**
 * Fits the desktop overview into the space below the navigation tabs: how much further back the
 * camera sits (on top of `overviewDistanceScale`) and how far down the view shifts (a fraction of
 * the viewport height, for setViewOffset), so the gap under the tabs matches the gap at the bottom.
 */
export function overviewFit(width: number, height: number, clearTop: number) {
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
  const want = bandTop + 1 - 4 * FRAME_MARGIN;
  // The diorama's height on screen goes roughly as 1 / distance, so a few rounds settle it.
  let scale = 1;
  for (let i = 0; i < 4; i++) {
    const { top, bottom } = project(scale);
    scale *= (top - bottom) / want;
  }
  // Narrower screens already sit further back so the diorama fits across; never come closer
  // than that, or its sides would run off. It is still centred in the band, with the gaps larger.
  if (base > 1) scale = Math.max(scale, 1);
  const { top, bottom } = project(scale);
  const centre = (bandTop - 1) / 2;
  return { scale, shiftY: (centre - (top + bottom) / 2) / 2 };
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
