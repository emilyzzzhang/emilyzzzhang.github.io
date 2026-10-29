import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import gsap from 'gsap';
import {
  CAMERA_ANIMATION,
  CONTROLS,
  DESKTOP_FOCUS_SCALE,
  EXPLORE_VIEW,
  exploreFit,
  FOCUS_VIEWS,
  HOME_VIEW,
  INTRO_VIEW,
  MOBILE_FOCUS_SCALE,
  overviewDistanceScale,
  overviewFit,
  scalePreset,
  type CameraFocus,
  type CameraPreset,
} from '../../config/camera';
import { MOBILE_BREAKPOINT, PANEL_GUTTER, panelWidth } from '../../config/layout';

interface ViewShift {
  x: number;
  y: number;
}

const NO_SHIFT: ViewShift = { x: 0, y: 0 };

interface CameraControllerProps {
  focus: CameraFocus | null;
  panelExpanded: boolean;
  /** Explore mode: with the hero text away, the overview gives way to the whole diorama, centred. */
  exploring: boolean;
  reducedMotion: boolean;
}

/**
 * Owns the camera: the intro glide, fly-to-object on selection, and the return to the
 * overview. OrbitControls is disabled while a section is focused so the two never fight.
 *
 * While a panel is open the projection is shifted (setViewOffset) so the focused object
 * sits beside the panel — left of a side panel, or above a mobile bottom sheet.
 */
export function CameraController({ focus, panelExpanded, exploring, reducedMotion }: CameraControllerProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const shift = useRef<ViewShift>(NO_SHIFT);
  const firstRun = useRef(true);

  const isMobile = size.width < MOBILE_BREAKPOINT;
  const overviewScale = overviewDistanceScale(size.width / size.height);
  // On desktop the overview is fitted into the space under the tabs, with equal gaps above and below.
  const fit = useMemo(() => (isMobile ? null : overviewFit(size.width, size.height, navbarHeight())), [isMobile, size.width, size.height]);
  const home = scalePreset(HOME_VIEW, overviewScale * (fit?.scale ?? 1));
  const homeDistance = new Vector3(...home.position).distanceTo(new Vector3(...home.target));
  const explore = useMemo(() => exploreFit(size.width, size.height, navbarHeight()), [size.width, size.height]);
  const exploreView = scalePreset(EXPLORE_VIEW, explore.scale);

  // Latest values for callbacks that must not re-run effects on every resize.
  const latest = useRef({ size, isMobile, home, fit, explore, exploreView, reducedMotion });
  latest.current = { size, isMobile, home, fit, explore, exploreView, reducedMotion };

  const applyShift = useCallback(() => {
    const { x, y } = shift.current;
    const { width, height } = latest.current.size;
    if (Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4) camera.clearViewOffset();
    else camera.setViewOffset(width, height, x * width, y * height, width, height);
  }, [camera]);

  // Re-apply after resizes, since setViewOffset stores absolute pixel sizes.
  useEffect(applyShift, [applyShift, size.width, size.height]);

  const flyTo = useCallback(
    (to: CameraPreset, toShift: ViewShift, duration: number, onComplete?: () => void) => {
      const orbit = controls.current;
      if (!orbit) return;
      tween.current?.kill();

      const fromPos = camera.position.clone();
      const fromTarget = orbit.target.clone();
      const fromShift = { ...shift.current };
      const toPos = new Vector3(...to.position);
      const toTarget = new Vector3(...to.target);

      // OrbitControls.update() would clamp close-ups to minDistance, so drive the camera directly.
      const step = (t: number) => {
        camera.position.lerpVectors(fromPos, toPos, t);
        orbit.target.lerpVectors(fromTarget, toTarget, t);
        camera.lookAt(orbit.target);
        shift.current = { x: MathUtils.lerp(fromShift.x, toShift.x, t), y: MathUtils.lerp(fromShift.y, toShift.y, t) };
        applyShift();
      };

      if (latest.current.reducedMotion || duration === 0) {
        step(1);
        onComplete?.();
        return;
      }
      const progress = { t: 0 };
      tween.current = gsap.to(progress, {
        t: 1,
        duration,
        ease: CAMERA_ANIMATION.ease,
        onUpdate: () => step(progress.t),
        onComplete,
      });
    },
    [camera, applyShift],
  );

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const { home, isMobile: mobile, size: viewport, fit, explore, exploreView } = latest.current;
    // Where the camera rests when nothing is focused: beside the hero text, or centred while exploring.
    const overview = exploring ? exploreView : home;
    const restShift = exploring ? explore.shift : overviewShift(mobile, fit?.shiftY);
    const enableOrbit = () => {
      orbit.enabled = true;
      orbit.update();
    };

    if (focus) {
      orbit.enabled = false;
      const preset = scalePreset(FOCUS_VIEWS[focus], mobile ? MOBILE_FOCUS_SCALE : DESKTOP_FOCUS_SCALE);
      // Mochi has no panel beside her, so she stays centred.
      const toShift = focus === 'mochi' ? NO_SHIFT : panelShift(viewport.width, mobile, panelExpanded);
      flyTo(preset, toShift, CAMERA_ANIMATION.focusDuration);
    } else if (firstRun.current) {
      // Glide in from further out on first load.
      orbit.enabled = false;
      const intro = scalePreset(INTRO_VIEW, overviewScale);
      camera.position.set(...intro.position);
      orbit.target.set(...intro.target);
      camera.lookAt(orbit.target);
      flyTo(overview, restShift, CAMERA_ANIMATION.introDuration, enableOrbit);
    } else {
      orbit.enabled = false;
      flyTo(overview, restShift, CAMERA_ANIMATION.returnDuration, enableOrbit);
    }
    firstRun.current = false;
    // overviewScale is read only for the intro; re-running on every resize would yank the camera.
  }, [focus, panelExpanded, exploring, isMobile, camera, flyTo]);

  useEffect(
    () => () => {
      tween.current?.kill();
      camera.clearViewOffset();
    },
    [camera],
  );

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={CONTROLS.dampingFactor}
      rotateSpeed={CONTROLS.rotateSpeed}
      zoomSpeed={CONTROLS.zoomSpeed}
      minDistance={CONTROLS.minDistance}
      maxDistance={homeDistance * 1.3}
      minPolarAngle={CONTROLS.minPolarAngle}
      maxPolarAngle={CONTROLS.maxPolarAngle}
      minAzimuthAngle={CONTROLS.minAzimuthAngle}
      maxAzimuthAngle={CONTROLS.maxAzimuthAngle}
    />
  );
}

/**
 * Nudges the overview right of the hero text on desktop (and by `fitY`, from overviewFit, down into
 * the space under the tabs), or below the hero text on phones.
 */
function overviewShift(mobile: boolean, fitY = 0): ViewShift {
  return mobile ? { x: 0, y: -CAMERA_ANIMATION.heroShift.mobile } : { x: -CAMERA_ANIMATION.heroShift.desktop, y: fitY };
}

/** The navigation bar's height in pixels, from the stylesheet (--navbar-height). */
function navbarHeight() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 72;
}

function panelShift(viewportWidth: number, mobile: boolean, expanded: boolean): ViewShift {
  if (mobile) return { x: 0, y: CAMERA_ANIMATION.mobileSheetShift };
  const covered = panelWidth(viewportWidth, expanded) + PANEL_GUTTER;
  return { x: covered / 2 / viewportWidth, y: 0 };
}
