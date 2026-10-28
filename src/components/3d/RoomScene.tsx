import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping, PCFShadowMap, type Group, type Light, type Object3D } from 'three';
import { CAMERA, HOME_VIEW } from '../../config/camera';
import type { ReplaceableId } from '../../config/models';
import { ANCHORS, GUITAR_TURN, PLACEMENTS, type Placement, type Vec3 } from '../../config/sceneLayout';
import { SECTIONS } from '../../data/sections';
import type { MochiVisit } from '../../hooks/useMochiVisit';
import type { TimeOfDay } from '../../hooks/useTimeOfDay';
import type { SectionId } from '../../types/portfolio';
import { Bookshelf } from './Bookshelf';
import { CameraController } from './CameraController';
import { Chair } from './Chair';
import { Computer } from './Computer';
import { CozyCorner } from './CozyCorner';
import { ContactShadow, type ContactShadowProps } from './ContactShadow';
import { DayNightProvider } from './dayNight';
import { BookStack, FloorPlant, Pouf, WallDecor } from './Decorations';
import { Desk } from './Desk';
import { DeskLamp, Envelope, Mug, PencilCup, Succulent } from './DeskItems';
import { InteractiveObject } from './InteractiveObject';
import { Lighting } from './Lighting';
import { Mochi } from './Mochi';
import { PlayableGuitar } from './PlayableGuitar';
import { PauseWhenHidden, useAdaptivePixelRatio, ZoomWatcher } from './renderQuality';
import { ReplaceableModel } from './ReplaceableModel';
import { RoomEnvironment } from './RoomEnvironment';
import { SkyParallax } from './SkyParallax';
import { InspirationBoard, MiniResume, RESUME_SPOT } from './InspirationBoard';
import { GalleryFrames } from './WallArt';

export interface RoomSceneProps {
  activeSection: SectionId | null;
  /** The open panel is widened to three quarters of the screen. */
  panelExpanded: boolean;
  onSelect: (section: SectionId) => void;
  /** A click in the room that hit no clickable object. */
  onMiss: () => void;
  /** Mochi's close-up, if one is under way (no section is open then). */
  mochiVisit: MochiVisit | null;
  onMochiClick: () => void;
  timeOfDay: TimeOfDay;
  reducedMotion: boolean;
  lowPower: boolean;
  onReady: () => void;
}

const FACE_PLUS_X: [number, number, number] = [0, Math.PI / 2, 0];
/** Sized so the board fills the wall between the bookshelf and the floating shelf. */
const BOARD_SCALE = 1.14;

const at = ([x, y, z]: Vec3, dx = 0, dz = 0): Vec3 => [x + dx, y, z + dz];

/**
 * Contact shadows for interactive objects and desk items. They live outside InteractiveObject,
 * so the shadow stays on the surface while the hover lift raises the object off it.
 */
const GROUNDING: ContactShadowProps[] = [
  { position: ANCHORS.bookshelf, size: [2.2, 0.7], spread: 0.26, strength: 0.5, corner: 0.03, rotationY: Math.PI / 2 },
  { position: ANCHORS.computer, size: [0.55, 0.32], spread: 0.1, strength: 0.42 },
  { position: at(ANCHORS.computer, 0, 0.5), size: [1.0, 0.36], spread: 0.07, strength: 0.38 },
  { position: ANCHORS.mug, size: [0.34, 0.34], spread: 0.1, strength: 0.42, shape: 'round' },
  { position: ANCHORS.envelope, size: [0.52, 0.36], spread: 0.06, strength: 0.35, rotationY: 0.28 },
  { position: ANCHORS.lamp, size: [0.38, 0.38], spread: 0.1, strength: 0.42, shape: 'round' },
  { position: ANCHORS.pencilCup, size: [0.18, 0.18], spread: 0.08, strength: 0.45, shape: 'round' },
  { position: ANCHORS.succulent, size: [0.16, 0.16], spread: 0.07, strength: 0.45, shape: 'round' },
];
const mochiBed: Placement = PLACEMENTS.mochiBed;

export default function RoomScene({ activeSection, panelExpanded, onSelect, onMiss, mochiVisit, onMochiClick, timeOfDay, reducedMotion, lowPower, onReady }: RoomSceneProps) {
  const mochiFocused = mochiVisit !== null;
  const interactive = (section: SectionId) => ({
    section,
    label: SECTIONS[section].hoverLabel,
    active: activeSection === section,
    onSelect,
  });

  const [zoomedIn, setZoomedIn] = useState(false);
  const dpr = useAdaptivePixelRatio(activeSection !== null || mochiFocused || zoomedIn, lowPower, reducedMotion);

  return (
    <Canvas
      shadows={{ enabled: true, type: PCFShadowMap }}
      // 1.5 for the overview, 2 in close-ups so small text stays crisp (see renderQuality).
      dpr={dpr}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: HOME_VIEW.position }}
      // Neutral tone mapping keeps the pastel palette true to its hex values.
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
      onCreated={onReady}
      onPointerMissed={(e) => e.type === 'click' && onMiss()}
    >
      <DayNightProvider mode={timeOfDay} reducedMotion={reducedMotion}>
        <Lighting lowPower={lowPower} />
        <SkyParallax />
        <CameraController focus={activeSection ?? (mochiFocused ? 'mochi' : null)} panelExpanded={panelExpanded} reducedMotion={reducedMotion} />
        <ZoomWatcher onChange={setZoomedIn} />
        <PauseWhenHidden />

        <ShadowSetup>
          <RoomEnvironment />
          <WallDecor />

          <Placed id="desk">
            <Desk />
          </Placed>
          <Placed id="chair">
            <Chair />
          </Placed>
          <Placed id="floorPlant">
            <FloorPlant />
          </Placed>
          <Placed id="pouf">
            <Pouf />
          </Placed>
          <Placed id="bookStack">
            <BookStack />
          </Placed>

          {GROUNDING.map((props, i) => (
            <ContactShadow key={i} {...props} />
          ))}

          <DeskLamp position={ANCHORS.lamp} />
          <group position={ANCHORS.guitar} rotation-y={GUITAR_TURN}>
            <PlayableGuitar />
          </group>
          <CozyCorner position={ANCHORS.cozyCorner} />
          <PencilCup position={ANCHORS.pencilCup} />
          <Succulent position={ANCHORS.succulent} />

          <Mochi position={mochiBed.position} rotationY={mochiBed.rotationY} reducedMotion={reducedMotion} idle={activeSection === null} visit={mochiVisit} onClick={onMochiClick} />

          <InteractiveObject {...interactive('projects')} position={ANCHORS.computer} labelOffset={[0, 1.5, 0]}>
            <Computer />
          </InteractiveObject>
          <InteractiveObject {...interactive('education')} position={ANCHORS.bookshelf} rotation={FACE_PLUS_X} labelOffset={[0.35, 4.15, 0.2]}>
            <Bookshelf />
          </InteractiveObject>
          <InteractiveObject {...interactive('experience')} position={ANCHORS.gallery} labelOffset={[0, 0.82, 0.25]}>
            <GalleryFrames />
          </InteractiveObject>
          {/* The whole inspiration board opens the résumé pinned to it. */}
          <InteractiveObject {...interactive('resume')} position={ANCHORS.resumePoster} rotation={FACE_PLUS_X} labelOffset={[0, 0.9, 0.2]} hoverLift={[0, 0, 0.04]}>
            <group scale={BOARD_SCALE}>
              <InspirationBoard />
              <group position={RESUME_SPOT.position} rotation-z={RESUME_SPOT.tilt}>
                <MiniResume />
              </group>
            </group>
          </InteractiveObject>
          <InteractiveObject {...interactive('about')} position={ANCHORS.mug} labelOffset={[0, 0.8, 0]}>
            <Mug />
          </InteractiveObject>
          <InteractiveObject {...interactive('contact')} position={ANCHORS.envelope} labelOffset={[0, 0.55, 0]} hoverScale={0.12} hoverLift={[0, 0.06, 0]}>
            <Envelope />
          </InteractiveObject>
        </ShadowSetup>
      </DayNightProvider>
    </Canvas>
  );
}

/** Positions a free-standing object from PLACEMENTS and lets a GLB replace it (config/models.ts). */
function Placed({ id, children }: { id: Exclude<ReplaceableId, 'mochiBed'>; children: ReactNode }) {
  const { position, rotationY = 0 }: Placement = PLACEMENTS[id];
  return (
    <group position={position} rotation-y={rotationY}>
      <ReplaceableModel id={id}>{children}</ReplaceableModel>
    </group>
  );
}

/**
 * Enables shadows on every mesh once, instead of repeating castShadow/receiveShadow props.
 * Lights are left as their components set them: a shadow-casting light renders the whole scene
 * again into its shadow map (six times for a point light), so only the key light and the
 * sunbeam opt in.
 */
function ShadowSetup({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null);

  useLayoutEffect(() => {
    const visit = (obj: Object3D) => {
      if (obj.userData.noShadow) return;
      if (!(obj as Light).isLight) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      obj.children.forEach(visit);
    };
    if (root.current) visit(root.current);
  }, []);

  return <group ref={root}>{children}</group>;
}
