import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { CatmullRomCurve3, Color, MathUtils, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, type Group, type Sprite, type SpriteMaterial } from 'three';
import gsap from 'gsap';
import { CLICK_DRAG_TOLERANCE } from '../../config/layout';
import { MOCHI, MOCHI_COPY } from '../../config/mochi';
import type { MochiVisit } from '../../hooks/useMochiVisit';
import type { Vec3 } from '../../config/sceneLayout';
import { sceneColors } from '../../config/theme';
import { Tooltip } from '../ui/Tooltip';
import { ContactShadow } from './ContactShadow';
import { boucle } from './materials';
import { bodyGeometry, earGeometry, headGeometry, pawGeometry, tailGeometry } from './mochiGeometry';
import { ReplaceableModel } from './ReplaceableModel';
import { drawZ, useCanvasTexture } from './textures';

const { colors, shape, markings } = MOCHI;

/** Head radius; every facial feature is placed relative to it. */
const R = 0.15 * shape.headScale;
const HEAD_REST = { position: new Vector3(0.21, 0.19, 0.13), rotation: { x: 0.18, z: 0.28 } };
const EAR_TILT = 0.32;
const CAT_HEIGHT = 0.16; // top of the cushion
/** Base size relative to the cushion; MOCHI.shape.bodyScale multiplies this. */
const CAT_SCALE = 1.2;
const ZZZ_ORIGIN = new Vector3(0.32, 0.72, 0.14);
/** After a "Meow", hovering stays quiet this long before "Shhh... Mochi is sleeping" can show again. */
const HUSH_MS = 3000;

interface MochiProps {
  position: Vec3;
  rotationY?: number;
  reducedMotion: boolean;
  /** False while a portfolio section is open: hides the floating "z" so close-ups stay clean. */
  idle: boolean;
  /** Her close-up: quiet while the camera zooms in, then she wakes and says a big "Meow" until it zooms back out. */
  visit: MochiVisit | null;
  /** Clicking her asks the camera to zoom in; she wakes once it arrives. */
  onClick: () => void;
}

/**
 * Mochi, curled up asleep on a cushion. Clicking zooms the camera in on her; once it arrives
 * she wakes for a moment — lifts her head, opens her eyes, wiggles her ears, blinks, says
 * "Meow" — and drifts back to sleep. She never opens a section. Appearance lives in config/mochi.ts.
 */
export function Mochi({ position, rotationY = 0, reducedMotion, idle, visit, onClick }: MochiProps) {
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyesOpen = useRef<Group>(null);
  const eyesClosed = useRef<Group>(null);
  const earL = useRef<Group>(null);
  const earR = useRef<Group>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const hoverAmount = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [awake, setAwake] = useState(false);
  const zSprites = useRef<(Sprite | null)[]>([]);
  const zTexture = useCanvasTexture(drawZ, 64, 64);
  const showZzz = idle && !awake && !hovered;
  const meowing = visit === 'meowing';
  // True for the whole close-up and HUSH_MS after, so the sleeping line doesn't follow the meow straight away.
  const visiting = visit !== null;
  const [hushed, setHushed] = useState(false);
  useEffect(() => {
    if (visiting) {
      setHushed(true);
      return;
    }
    const timer = window.setTimeout(() => setHushed(false), HUSH_MS);
    return () => window.clearTimeout(timer);
  }, [visiting]);
  useCursor(hovered);

  const mats = useMemo(() => {
    const fur = (color: string, roughness = 0.95) => new MeshStandardMaterial({ color, roughness });
    return {
      base: fur(colors.furBase),
      secondary: fur(colors.furSecondary),
      earInner: fur(colors.earInner),
      face: fur(colors.faceMarking),
      tail: fur(colors.tail),
      tailTip: fur(markings.tailTip ? colors.tailTip : colors.tail),
      paws: fur(colors.paws),
      eyes: fur(colors.eyes, 0.3),
      pupils: fur(colors.pupils, 0.3),
      nose: fur(colors.nose, 0.5),
      cheeks: fur(colors.cheeks),
      shine: new MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.4 }),
      /** Sculpted body, head, tail and paws: markings come from vertex colours; sheen gives a soft furry rim. */
      fur: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new Color('#FFF4EA') }),
    };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const tailCurve = useMemo(() => {
    const full = new CatmullRomCurve3([
      new Vector3(-0.28, 0.08, -0.08),
      new Vector3(-0.37, 0.06, 0.12),
      new Vector3(-0.21, 0.05, 0.29),
      new Vector3(0.02, 0.05, 0.34),
      new Vector3(0.22, 0.05, 0.3),
    ]);
    const length = MathUtils.clamp(shape.tailLength, 0.5, 1);
    return new CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => full.getPoint((i / 11) * length)));
  }, []);
  const tailRadius = 0.05 * shape.tailFluff;
  const earW = R * 0.4 * shape.earSize;
  const earH = R * 0.62 * shape.earSize * shape.earHeight;
  const geo = useMemo(
    () => ({
      body: bodyGeometry(),
      head: headGeometry(R),
      tail: tailGeometry(tailCurve, tailRadius),
      paw: pawGeometry(),
      ear: earGeometry(earW, earH, 0.45),
      earInner: earGeometry(earW * 0.58, earH * 0.72, 0),
    }),
    [tailCurve, tailRadius, earW, earH],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  // Gentle breathing, floating z's and hover lift. Cheap: a few transforms per frame.
  useFrame(({ clock }, delta) => {
    zSprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const phase = reducedMotion ? 0.45 + i * 0.25 : (clock.elapsedTime * 0.32 + i * 0.5) % 1;
      sprite.position.set(ZZZ_ORIGIN.x + phase * 0.14, ZZZ_ORIGIN.y + phase * 0.3, ZZZ_ORIGIN.z);
      sprite.scale.setScalar(0.09 + phase * 0.06);
      (sprite.material as SpriteMaterial).opacity = reducedMotion ? 0.9 : Math.sin(phase * Math.PI);
    });
    if (torso.current && !reducedMotion) {
      torso.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.7) * 0.025;
    }
    const target = hovered ? 1 : 0;
    if (root.current && Math.abs(hoverAmount.current - target) > 0.001) {
      hoverAmount.current = MathUtils.damp(hoverAmount.current, target, 12, delta);
      root.current.scale.setScalar(1 + hoverAmount.current * 0.03);
    }
  });

  useEffect(() => () => void timeline.current?.kill(), []);

  const wake = () => {
    if (timeline.current?.isActive()) return;
    const [h, open, closed, left, right] = [head.current, eyesOpen.current, eyesClosed.current, earL.current, earR.current];
    if (!h || !open || !closed || !left || !right) return;
    const lift = reducedMotion ? 0 : 1;
    setAwake(true);

    timeline.current = gsap
      .timeline({ onComplete: () => setAwake(false) })
      // lift head and open eyes
      .to(h.position, { y: HEAD_REST.position.y + 0.035 * lift, duration: 0.35, ease: 'power2.out' }, 0)
      .to(h.rotation, { x: HEAD_REST.rotation.x - 0.22 * lift, duration: 0.35, ease: 'power2.out' }, 0)
      .set(closed, { visible: false }, 0.18)
      .set(open, { visible: true }, 0.18)
      .fromTo(open.scale, { y: 0.05 }, { y: 1, duration: 0.18, ease: 'power2.out' }, 0.18)
      // ear wiggle
      .to(left.rotation, { z: EAR_TILT + 0.35, duration: 0.08, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.55)
      .to(right.rotation, { z: -EAR_TILT - 0.35, duration: 0.08, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.62)
      // blink, then a single ear twitch
      .to(open.scale, { y: 0.08, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 1.15)
      .to(right.rotation, { z: -EAR_TILT - 0.25, duration: 0.07, yoyo: true, repeat: 1 }, 1.55)
      // drift back to sleep
      .to(open.scale, { y: 0.05, duration: 0.4, ease: 'power1.in' }, 1.95)
      .set(open, { visible: false }, 2.35)
      .set(closed, { visible: true }, 2.35)
      .to(h.position, { y: HEAD_REST.position.y, duration: 0.6, ease: 'power2.inOut' }, 2.2)
      .to(h.rotation, { x: HEAD_REST.rotation.x, duration: 0.6, ease: 'power2.inOut' }, 2.2);
  };

  // She wakes once the camera has zoomed in on her, not on the click itself.
  useEffect(() => {
    if (meowing) wake();
  }, [meowing]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE) return;
    onClick();
  };

  const outerEar = markings.headCap ? mats.secondary : mats.base;

  return (
    <group position={position} rotation-y={rotationY}>
      <group
        ref={root}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <ReplaceableModel id="mochiBed">
          <CatBed />
        </ReplaceableModel>

        <group position-y={CAT_HEIGHT} scale={CAT_SCALE * shape.bodyScale}>
          {/* soft shadow where she presses into the cushion */}
          <ContactShadow position={[0, 0.002, 0.03]} size={[0.62, 0.5]} spread={0.08} strength={0.35} shape="round" />

          {/* body: one sculpted, curled-up shape (breathing scales it gently) */}
          <group ref={torso}>
            <mesh geometry={geo.body} material={mats.fur} />
          </group>

          {/* front paws tucked under the chin, and a back foot peeking out */}
          <mesh geometry={geo.paw} position={[0.31, 0.04, 0.2]} rotation-y={-0.35} scale={[0.06, 0.05, 0.085]} material={mats.fur} />
          <mesh geometry={geo.paw} position={[0.19, 0.035, 0.25]} rotation-y={-0.15} scale={[0.058, 0.048, 0.08]} material={mats.fur} />
          <mesh geometry={geo.paw} position={[-0.22, 0.04, 0.21]} rotation-y={0.5} scale={[0.07, 0.05, 0.075]} material={mats.fur} />

          {/* tail wrapping round the front, its root tucked into the hips */}
          <mesh geometry={geo.tail} material={mats.fur} />

          {/* head */}
          <group ref={head} position={HEAD_REST.position} rotation={[HEAD_REST.rotation.x, 0, HEAD_REST.rotation.z]}>
            <mesh geometry={geo.head} material={mats.fur} />

            {/* ears: pivot at the base so wiggles rotate naturally */}
            {(
              [
                [-1, earL],
                [1, earR],
              ] as const
            ).map(([side, ref]) => (
              <group key={side} ref={ref} position={[side * R * 0.55, R * 0.56, -R * 0.08]} rotation-z={-side * EAR_TILT}>
                <mesh geometry={geo.ear} material={outerEar} />
                <mesh geometry={geo.earInner} position={[0, earH * 0.14, earW * 0.2]} scale={[1, 1, 0.6]} material={mats.earInner} />
              </group>
            ))}

            {/* nose and rosy cheeks (the muzzle is sculpted into the head) */}
            <mesh position={[0, -R * 0.13, R * 0.97]} scale={[1.3, 0.8, 0.8]} material={mats.nose}>
              <sphereGeometry args={[R * 0.085, 12, 10]} />
            </mesh>
            {markings.cheekBlush &&
              [-1, 1].map((side) => (
                <mesh key={side} position={[side * R * 0.6, -R * 0.24, R * 0.77]} scale={[1, 0.65, 0.4]} material={mats.cheeks}>
                  <sphereGeometry args={[R * 0.14, 12, 10]} />
                </mesh>
              ))}

            {/* closed, sleepy eyes — the default */}
            <group ref={eyesClosed} position={[0, R * 0.08, R * 0.9]}>
              {[-1, 1].map((side) => (
                <mesh key={side} position-x={side * R * 0.38} rotation-z={Math.PI} material={mats.pupils}>
                  <torusGeometry args={[R * 0.15, R * 0.03, 6, 16, Math.PI]} />
                </mesh>
              ))}
            </group>
            {/* open eyes, shown only while awake */}
            <group ref={eyesOpen} position={[0, R * 0.08, R * 0.86]} visible={false}>
              {[-1, 1].map((side) => (
                <group key={side} position-x={side * R * 0.38}>
                  <mesh scale={[1, 1.15, 0.5]} material={mats.eyes}>
                    <sphereGeometry args={[R * 0.15, 16, 12]} />
                  </mesh>
                  <mesh position-z={R * 0.05} scale={[0.6, 1.3, 0.5]} material={mats.pupils}>
                    <sphereGeometry args={[R * 0.08, 12, 10]} />
                  </mesh>
                  <mesh position={[R * 0.04, R * 0.06, R * 0.08]} material={mats.shine}>
                    <sphereGeometry args={[R * 0.03, 8, 6]} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>

      <group visible={showZzz} userData={{ noShadow: true }}>
        {[0, 1].map((i) => (
          <sprite key={i} ref={(s) => void (zSprites.current[i] = s)} raycast={() => null}>
            <spriteMaterial map={zTexture} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
      {(meowing || (hovered && !hushed)) && (
        // In the close-up the bubble sits just above her ears, so it stays clear of the navbar.
        <Html position={meowing ? [0.2, 0.82, 0.1] : [0.2, 1.15, 0.1]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <Tooltip
            speech
            large={meowing}
            label={meowing ? MOCHI_COPY.awakeTooltip : MOCHI_COPY.sleepingTooltip}
            hint={null}
          />
        </Html>
      )}
    </group>
  );
}

/** Bouclé for the bed, tiled to each primitive's UV span (circumferences, and the cushion's diameter). */
const bedFabric = {
  base: boucle(sceneColors.warmWhite, [Math.PI * 2 * 0.61, 0.12], true),
  // The same soft pink as the desk chair.
  rim: boucle(sceneColors.upholstery, [Math.PI * 2 * 0.5, Math.PI * 2 * 0.13], true),
  cushion: boucle(sceneColors.upholstery, [0.88, 0.88], true),
};

/** Round, puffy pink cushion. Origin: floor under its centre. */
function CatBed() {
  return (
    <group>
      <ContactShadow position={[0, 0, 0]} size={[1.24, 1.24]} spread={0.2} strength={0.5} shape="round" />
      <mesh position-y={0.06} material={bedFabric.base}>
        <cylinderGeometry args={[0.6, 0.62, 0.12, 40]} />
      </mesh>
      <mesh position-y={0.17} rotation-x={Math.PI / 2} scale={[1, 1, 0.85]} material={bedFabric.rim}>
        <torusGeometry args={[0.5, 0.13, 16, 44]} />
      </mesh>
      <mesh position-y={0.13} material={bedFabric.cushion}>
        <cylinderGeometry args={[0.44, 0.44, 0.07, 36]} />
      </mesh>
    </group>
  );
}
