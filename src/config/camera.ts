import type { SectionId } from '../types/portfolio';
import { ANCHORS, DESK, PLACEMENTS, type Vec3 } from './sceneLayout';

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

export const CAMERA_ANIMATION = {
  focusDuration: 1.4,
  returnDuration: 1.2,
  introDuration: 2.4,
  ease: 'power3.inOut',
  /** Fraction of the viewport the overview shifts to clear the hero text (right on desktop, down on phones). */
  heroShift: { desktop: 0.12, mobile: 0.08 },
  /** Fraction of the viewport height the scene shifts up while a mobile bottom sheet is open. */
  mobileSheetShift: 0.24,
} as const;

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

/** Moves the camera along its view ray, keeping the target fixed. */
export function scalePreset(preset: CameraPreset, scale: number): CameraPreset {
  const [px, py, pz] = preset.position;
  const [tx, ty, tz] = preset.target;
  return {
    target: preset.target,
    position: [tx + (px - tx) * scale, ty + (py - ty) * scale, tz + (pz - tz) * scale],
  };
}
