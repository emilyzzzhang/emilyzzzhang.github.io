import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { BoxGeometry, CanvasTexture, SpriteMaterial, SRGBColorSpace, type Group, type Sprite } from 'three';
import { CLICK_DRAG_TOLERANCE } from '../../config/layout';
import type { Vec3 } from '../../config/sceneLayout';
import { useMusic } from '../../hooks/useMusic';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Tooltip } from '../ui/Tooltip';
import { Guitar } from './Guitar';
import { refreshShadows } from './renderQuality';
import { HIT_MATERIAL, useHoverGrow } from './useHoverGrow';

/** Where the tooltip floats, just above the headstock (guitar-local). */
const LABEL_AT: Vec3 = [0, 2.3, 0.1];
const NO_LIFT: Vec3 = [0, 0, 0];

/**
 * The guitar's own meshes don't take pointer events (it is detailed scenery), so a plain box
 * round it, guitar and stand, catches hovers and taps instead: cheap to hit-test and a generous
 * target on touch screens. It draws nothing and casts no shadow.
 */
const HIT_BOX = new BoxGeometry(0.55, 1.95, 0.5).translate(0, 0.975, -0.12);

/**
 * The acoustic guitar on its stand, which plays a little tune: hover for a hint (it grows and
 * sways as if its strings were humming), click to play or pause. While music plays, a few notes
 * drift up beside it. Origin: the floor under the stand, as for <Guitar />.
 */
/**
 * Called when a click on the guitar starts its tune (RoomScene provides it; the app zooms in). A
 * context, since the guitar is built once among the room's furnishings and takes no props.
 */
export const GuitarPlayContext = createContext<() => void>(() => {});

export function PlayableGuitar() {
  const music = useMusic();
  const onPlay = useContext(GuitarPlayContext);
  const body = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();
  const playing = music.status === 'playing' || music.status === 'loading';
  useCursor(hovered);
  const hover = useHoverGrow(body, hovered, { scale: 0.06, lift: NO_LIFT, reducedMotion });

  // A gentle sway while hovered, pivoting on the stand's feet; nothing to do once it has settled.
  useFrame(({ clock, gl }) => {
    const b = body.current;
    if (!b) return;
    const sway = reducedMotion || hover.current < 0.002 ? 0 : Math.sin(clock.elapsedTime * 2.6) * 0.014 * hover.current;
    if (b.rotation.z === sway) return;
    b.rotation.z = sway;
    refreshShadows(gl);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE) return; // the visitor was orbiting, not clicking
    music.toggle();
    if (!playing && music.status !== 'unavailable') onPlay();
    // Touch has no hover to end, so don't leave the tooltip hanging after a tap.
    if ((e.nativeEvent as PointerEvent).pointerType === 'touch') setHovered(false);
  };

  const hint = music.status === 'unavailable' ? 'Music unavailable' : playing ? 'Click to pause' : 'Click to play';

  return (
    <group
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh geometry={HIT_BOX} material={HIT_MATERIAL} userData={{ noShadow: true }} />
      <group ref={body}>
        <Guitar />
      </group>
      {music.status === 'playing' && !reducedMotion && <FloatingNotes />}
      {hovered && (
        <Html position={LABEL_AT} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <Tooltip label="Play a little tune ♫" hint={hint} />
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Floating notes: a handful of sprites (always facing the camera) rising from the guitar's body,
// swaying and fading. Mounted only while music plays.

const NOTES = [
  { glyph: '♪', x: 0.34, phase: 0, size: 0.28 },
  { glyph: '♫', x: -0.3, phase: 0.22, size: 0.32 },
  { glyph: '♪', x: 0.1, phase: 0.45, size: 0.24 },
  { glyph: '♫', x: 0.4, phase: 0.63, size: 0.26 },
  { glyph: '♪', x: -0.16, phase: 0.82, size: 0.3 },
];
/** Seconds for one note to rise and fade. */
const RISE_TIME = 3.4;
const NOTE_INK = '#D9708C';

function noteTexture(glyph: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 104px "Segoe UI Symbol", "Apple Symbols", "Noto Music", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // A soft cream halo keeps the note readable against the pink wall.
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255, 248, 240, 0.85)';
  ctx.strokeText(glyph, 64, 70);
  ctx.fillStyle = NOTE_INK;
  ctx.fillText(glyph, 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const ignoreRaycast = () => null;

function FloatingNotes() {
  const sprites = useRef<(Sprite | null)[]>([]);
  const startedAt = useRef<number | null>(null);
  const materials = useMemo(() => {
    const textures = { '♪': noteTexture('♪'), '♫': noteTexture('♫') };
    return NOTES.map(({ glyph }) => new SpriteMaterial({ map: textures[glyph as keyof typeof textures], transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
  }, []);
  useEffect(
    () => () => {
      const textures = new Set(materials.map((m) => m.map));
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t?.dispose());
    },
    [materials],
  );

  useFrame(({ clock }) => {
    startedAt.current ??= clock.elapsedTime;
    // Ease the whole flurry in over the first second, so notes don't pop into being.
    const intro = Math.min(1, (clock.elapsedTime - startedAt.current) / 1);
    NOTES.forEach(({ x, phase, size }, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const t = (clock.elapsedTime / RISE_TIME + phase) % 1;
      sprite.position.set(x + Math.sin(t * Math.PI * 2 + i) * 0.08, 1.0 + t * 1.0, 0.25);
      sprite.scale.setScalar(size * (0.85 + 0.15 * Math.sin(t * Math.PI)));
      materials[i].opacity = Math.sin(t * Math.PI) * 0.9 * intro;
    });
  });

  return (
    <group userData={{ noShadow: true }}>
      {materials.map((material, i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          material={material}
          raycast={ignoreRaycast}
        />
      ))}
    </group>
  );
}
