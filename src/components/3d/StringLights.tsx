import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import { AdditiveBlending, BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, MathUtils, type MeshStandardMaterial, type PointsMaterial, type Vector3 } from 'three';
import { LIGHTING, sceneColors } from '../../config/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useDayNight } from './dayNight';
import { materials } from './materials';
import { useCanvasTexture } from './textures';

/** Bright white bulbs wrapped in warm light, like the desk lamp: a soft warm-white halo, and a wider, faintly peach wash. */
const BULB = { halo: '#FFE9D2', wash: '#FFD6B8' };

/**
 * How the glow follows day and night: barely there by day, a warm fade at night. `fairyGlow` runs
 * from LIGHTING.day to LIGHTING.night; the glows ease in on its square so daytime stays faint.
 */
/** `haloScale` / `washScale` are multiples of the `haloSize` prop. */
const GLOW = { bulbBase: 0.4, bulbRange: 1.8, halo: 0.6, haloScale: 2, wash: 0.3, washScale: 7 };

/** A gentle shimmer: each halo drifts a little brighter and dimmer on its own slow, uneven rhythm. */
const SHIMMER = { depth: 0.14, speed: 0.8 };

/** The warm fade snug round each bulb: bright at the middle, falling off smoothly to nothing. */
function drawHalo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.15, 'rgba(255, 255, 255, 0.6)');
  g.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
  g.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The light a bulb spills onto the wall: strongest beside the bulb, dimming gradually, like real light falling off. */
function drawWash(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  g.addColorStop(0.2, 'rgba(255, 255, 255, 0.36)');
  g.addColorStop(0.45, 'rgba(255, 255, 255, 0.16)');
  g.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

interface StringLightsProps {
  /** Points the wire passes through; it is smoothed into a curve between them. */
  path: Vector3[];
  /** How many bulbs hang along the wire, evenly spaced. */
  bulbs: number;
  bulbRadius?: number;
  /** World size of each bulb's glow halo at night. */
  haloSize?: number;
  /** How far each bulb hangs below the wire. */
  drop?: number;
}

/**
 * Fairy lights: a thin wire with bright white bulbs, each wrapped in a warm halo and a wider, fainter
 * wash of warm light. No lights or shadows per bulb: the glow is the bulbs' own emission plus two clouds
 * of additive points sharing one geometry, whose colours shimmer gently (one small buffer update a frame).
 */
export function StringLights({ path, bulbs: count, bulbRadius = 0.045, haloSize = 0.42, drop = 0.05 }: StringLightsProps) {
  const haloMap = useCanvasTexture(drawHalo, 64, 64);
  const washMap = useCanvasTexture(drawWash, 64, 64);
  const reducedMotion = useReducedMotion();
  const bulbMat = useRef<MeshStandardMaterial>(null);
  const haloMat = useRef<PointsMaterial>(null);
  const washMat = useRef<PointsMaterial>(null);

  const { bulbs, wire, haloGeometry, phases } = useMemo(() => {
    const curve = new CatmullRomCurve3(path);
    const points = Array.from({ length: count }, (_, i) => {
      const p = curve.getPointAt(count > 1 ? i / (count - 1) : 0.5);
      return p.setY(p.y - drop);
    });
    const halo = new BufferGeometry();
    halo.setAttribute('position', new Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z + 0.02]), 3));
    // White here; each layer's own colour tints it, so the shimmer below only has to scale brightness.
    halo.setAttribute('color', new Float32BufferAttribute(points.flatMap(() => [1, 1, 1]), 3));
    // Each bulb's own rhythm: two slow waves at unrelated rates, so neighbours never pulse together.
    const rhythm = points.map((_, i) => ({ a: (i * 2.39) % (Math.PI * 2), b: (i * 4.17) % (Math.PI * 2), rate: 0.8 + ((i * 0.618) % 1) * 0.6 }));
    return { bulbs: points, wire: curve, haloGeometry: halo, phases: rhythm };
  }, [path, count, drop]);

  useDayNight((blend) => {
    const glow = MathUtils.lerp(LIGHTING.day.fairyGlow, LIGHTING.night.fairyGlow, blend);
    if (bulbMat.current) bulbMat.current.emissiveIntensity = GLOW.bulbBase + glow * GLOW.bulbRange;
    if (haloMat.current) haloMat.current.opacity = glow * glow * GLOW.halo;
    if (washMat.current) washMat.current.opacity = glow * glow * GLOW.wash;
  });

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime * SHIMMER.speed;
    const colors = haloGeometry.getAttribute('color') as Float32BufferAttribute;
    for (let i = 0; i < phases.length; i++) {
      const { a, b, rate } = phases[i];
      const k = 1 + SHIMMER.depth * (0.6 * Math.sin(t * rate + a) + 0.4 * Math.sin(t * rate * 2.3 + b));
      colors.setXYZ(i, k, k, k);
    }
    colors.needsUpdate = true;
  });

  return (
    <group userData={{ noShadow: true }}>
      <mesh material={materials.woodDark}>
        <tubeGeometry args={[wire, Math.max(120, count * 6), 0.008, 4, false]} />
      </mesh>
      <Instances limit={bulbs.length}>
        <sphereGeometry args={[bulbRadius, 10, 8]} />
        <meshStandardMaterial ref={bulbMat} color={sceneColors.bulb} emissive={sceneColors.bulb} toneMapped={false} />
        {bulbs.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <points geometry={haloGeometry}>
        <pointsMaterial ref={haloMat} map={haloMap} color={BULB.halo} vertexColors size={haloSize * GLOW.haloScale} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </points>
      <points geometry={haloGeometry}>
        {/* Blended normally, not added: on the pale walls a tint shows where extra light would just wash out to white. */}
        <pointsMaterial ref={washMat} map={washMap} color={BULB.wash} vertexColors size={haloSize * GLOW.washScale} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}
