/**
 * Camera flight timings and framing shifts. This lives apart from camera.ts, which imports three.js,
 * so hooks in the initial bundle can use it without pulling three.js out of the lazy scene chunk.
 */
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
