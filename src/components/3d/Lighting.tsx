import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { MathUtils, type AmbientLight, type DirectionalLight, type HemisphereLight, type PointLight } from 'three';
import { ANCHORS } from '../../config/sceneLayout';
import { LIGHTING, sceneColors } from '../../config/theme';
import { blendColor, colorPair, useDayNight } from './dayNight';
import { blendReflections } from './materials';
import { Sunlight } from './Sunlight';

const { day: D, night: N } = LIGHTING;
/** Height of the fairy-light strand's warm wash. */
const ROOM_TOP = 4.4;

/**
 * Sun/moon key light with soft shadows, a sky fill, window light, and a warm wash from the
 * fairy lights at night, plus the daytime window sunbeam. Lamp and screen lights live with their objects.
 */
export function Lighting({ lowPower }: { lowPower: boolean }) {
  const hemi = useRef<HemisphereLight>(null);
  const ambient = useRef<AmbientLight>(null);
  const key = useRef<DirectionalLight>(null);
  const windowLight = useRef<PointLight>(null);
  const fill = useRef<PointLight>(null);
  const fairyWash = useRef<PointLight>(null);
  const scene = useThree((s) => s.scene);

  const colors = useMemo(
    () => ({
      hemiSky: colorPair(D.hemiSky, N.hemiSky),
      hemiGround: colorPair(D.hemiGround, N.hemiGround),
      key: colorPair(D.keyColor, N.keyColor),
      window: colorPair(D.windowColor, N.windowColor),
      fill: colorPair(D.fillColor, N.fillColor),
    }),
    [],
  );

  useDayNight((t) => {
    const mix = (a: number, b: number) => MathUtils.lerp(a, b, t);
    if (hemi.current) {
      blendColor(hemi.current.color, colors.hemiSky, t);
      blendColor(hemi.current.groundColor, colors.hemiGround, t);
      hemi.current.intensity = mix(D.hemiIntensity, N.hemiIntensity);
    }
    if (ambient.current) ambient.current.intensity = mix(D.ambientIntensity, N.ambientIntensity);
    if (key.current) {
      blendColor(key.current.color, colors.key, t);
      key.current.intensity = mix(D.keyIntensity, N.keyIntensity);
    }
    if (windowLight.current) {
      blendColor(windowLight.current.color, colors.window, t);
      windowLight.current.intensity = mix(D.windowIntensity, N.windowIntensity);
    }
    if (fill.current) {
      blendColor(fill.current.color, colors.fill, t);
      fill.current.intensity = mix(D.fillIntensity, N.fillIntensity);
    }
    if (fairyWash.current) fairyWash.current.intensity = mix(D.fairyGlow, N.fairyGlow) * 1.8;
    blendReflections(scene, t);
  });

  const shadowSize = lowPower ? 1024 : 2560;
  const [wx, wy, wz] = ANCHORS.window;

  return (
    <>
      <hemisphereLight ref={hemi} />
      <ambientLight ref={ambient} color={sceneColors.cream} />
      <directionalLight
        ref={key}
        castShadow
        position={[7, 11, 6]}
        shadow-mapSize={[shadowSize, shadowSize]}
        // Fitted to the whole diorama (lawn to wall caps) as seen from the light, so no texels are
        // wasted and near/far stay tight for depth precision.
        shadow-camera-left={-7.9}
        shadow-camera-right={7.9}
        shadow-camera-top={9.6}
        shadow-camera-bottom={-6.9}
        shadow-camera-near={4.5}
        shadow-camera-far={20.5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
      <pointLight ref={windowLight} position={[wx, wy, wz + 0.8]} distance={7} decay={1.4} />
      <pointLight ref={fill} position={[2.5, 4, 1.5]} distance={8} decay={1.5} />
      <pointLight ref={fairyWash} position={[0, ROOM_TOP, -3.4]} color={sceneColors.bulb} intensity={0} distance={6} decay={1.6} />
      <Sunlight lowPower={lowPower} />
    </>
  );
}
