import { useMemo, useRef } from 'react';
import { Instance, Instances, RoundedBox, RoundedBoxGeometry } from '@react-three/drei';
import { AddOperation, AdditiveBlending, Color, MathUtils, type MeshBasicMaterial, type PointLight } from 'three';
import { LIGHTING, sceneColors } from '../../config/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useDayNight } from './dayNight';
import { useIdeScreen } from './ideScreen';
import { materials } from './materials';
import { reflection } from './surfaces';
import { drawGlow, useCanvasTexture } from './textures';

const SCREEN_W = 1.62;
const SCREEN_H = 1.0;
const SCREEN_Y = 0.75;

const KEY_ROWS = 4;
const KEY_COLS = 12;
const KEY = 0.062;
const keys = Array.from({ length: KEY_ROWS * KEY_COLS }, (_, i) => {
  const row = Math.floor(i / KEY_COLS);
  const col = i % KEY_COLS;
  return [(col - (KEY_COLS - 1) / 2) * (KEY + 0.012) + (row % 2) * 0.02, (row - (KEY_ROWS - 1) / 2) * (KEY + 0.012)] as const;
});

/** Decorative glow planes must not catch pointer events meant for the objects around them. */
const ignoreRaycast = () => null;

/** The dark editor reads fine by day at nearly full strength; at night it glows softly. */
const SCREEN_DAY = new Color('#F2EDEF');
const SCREEN_NIGHT = new Color('#FFFFFF');
/** Strength of the faint room reflection on the screen glass, by day and by night. */
const GLASS = { day: 0.09, night: 0.03 };

/** Monitor (playing a looping coding session), keyboard and mouse. Local origin: desk-top point under the monitor stand. */
export function Computer() {
  const screen = useIdeScreen(useReducedMotion());
  const glowMap = useCanvasTexture(drawGlow, 64, 64);
  const screenMat = useRef<MeshBasicMaterial>(null);
  const backlight = useRef<MeshBasicMaterial>(null);
  const glass = useRef<MeshBasicMaterial>(null);
  const light = useRef<PointLight>(null);
  const keyColors = useMemo(() => keys.map((_, i) => (i % 7 === 3 ? sceneColors.rose : sceneColors.pink)), []);

  useDayNight((blend) => {
    const glow = MathUtils.lerp(LIGHTING.day.screenGlow, LIGHTING.night.screenGlow, blend);
    screenMat.current?.color.lerpColors(SCREEN_DAY, SCREEN_NIGHT, blend);
    // A dark editor throws less light than the old pale screen, so keep the spill gentle.
    if (backlight.current) backlight.current.opacity = glow * 0.35;
    if (glass.current) glass.current.opacity = MathUtils.lerp(GLASS.day, GLASS.night, blend);
    if (light.current) light.current.intensity = glow * 0.8;
  });

  return (
    <group>
      {/* monitor */}
      <RoundedBox args={[0.55, 0.04, 0.32]} radius={0.02} position-y={0.02} material={materials.white} />
      <RoundedBox args={[0.1, 0.42, 0.07]} radius={0.035} position={[0, 0.23, -0.06]} material={materials.white} />
      <RoundedBox args={[SCREEN_W, SCREEN_H, 0.07]} radius={0.05} position-y={SCREEN_Y} material={materials.white} />
      <mesh position={[0, SCREEN_Y, 0.037]}>
        <planeGeometry args={[SCREEN_W - 0.1, SCREEN_H - 0.1]} />
        <meshBasicMaterial ref={screenMat} map={screen} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-4} />
      </mesh>
      {/* Screen and glass sit just proud of the bezel; polygon offsets keep them from z-fighting it at grazing angles. */}
      {/* glass: adds only a faint reflection of the room on top of the screen */}
      <mesh position={[0, SCREEN_Y, 0.039]} userData={{ noShadow: true }}>
        <planeGeometry args={[SCREEN_W - 0.1, SCREEN_H - 0.1]} />
        <meshBasicMaterial ref={glass} color="#000000" envMap={reflection} combine={AddOperation} transparent opacity={GLASS.day} blending={AdditiveBlending} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-8} />
      </mesh>
      {/* soft bias-light glow on the wall behind the monitor */}
      <mesh position={[0, SCREEN_Y, -0.5]} userData={{ noShadow: true }} raycast={ignoreRaycast}>
        <planeGeometry args={[2.8, 1.9]} />
        <meshBasicMaterial ref={backlight} map={glowMap} color={sceneColors.rose} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, SCREEN_Y, 0.6]} color={sceneColors.lavenderLight} intensity={0} distance={2.6} decay={1.8} />
      {/* sticky notes on the bezel, overlapping the screen's edge: offset further than the screen and glass so those never show through them */}
      <mesh position={[SCREEN_W / 2 - 0.02, SCREEN_Y + 0.3, 0.045]} rotation-z={0.12}>
        <planeGeometry args={[0.14, 0.14]} />
        <meshStandardMaterial color="#FFF1C9" roughness={0.9} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-16} />
      </mesh>
      <mesh position={[SCREEN_W / 2 - 0.06, SCREEN_Y + 0.14, 0.044]} rotation-z={-0.08}>
        <planeGeometry args={[0.12, 0.12]} />
        <meshStandardMaterial color={sceneColors.rose} roughness={0.9} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-16} />
      </mesh>

      {/* keyboard */}
      <group position={[0, 0, 0.5]}>
        <RoundedBox args={[1.0, 0.045, 0.36]} radius={0.02} position-y={0.0225} material={materials.white} />
        <Instances limit={keys.length + 1}>
          <RoundedBoxGeometry args={[KEY, 0.025, KEY]} radius={0.008} smoothness={2} bevelSegments={2} />
          <meshStandardMaterial roughness={0.6} />
          {keys.map(([x, z], i) => (
            <Instance key={i} position={[x, 0.055, z - 0.03]} color={keyColors[i]} />
          ))}
          <Instance position={[0, 0.055, 0.135]} scale={[6, 1, 0.8]} color={sceneColors.warmWhite} />
        </Instances>
      </group>

      {/* mouse pad and mouse */}
      <group position={[0.85, 0, 0.5]}>
        <RoundedBox args={[0.5, 0.012, 0.4]} radius={0.005} position-y={0.006} material={materials.peach} />
        <mesh position-y={0.04} scale={[0.065, 0.035, 0.1]} material={materials.white}>
          <sphereGeometry args={[1, 20, 14]} />
        </mesh>
      </group>
    </group>
  );
}
