import { useMemo, useRef } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { AdditiveBlending, BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, MathUtils, type MeshStandardMaterial, type PointsMaterial, type Vector3 } from 'three';
import { LIGHTING, sceneColors } from '../../config/theme';
import { useDayNight } from './dayNight';
import { materials } from './materials';
import { drawGlow, useCanvasTexture } from './textures';

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

/** Fairy lights: a thin wire with emissive bulbs and additive halos that bloom at night. */
export function StringLights({ path, bulbs: count, bulbRadius = 0.045, haloSize = 0.42, drop = 0.05 }: StringLightsProps) {
  const glowMap = useCanvasTexture(drawGlow, 64, 64);
  const bulbMat = useRef<MeshStandardMaterial>(null);
  const haloMat = useRef<PointsMaterial>(null);

  const { bulbs, wire, haloGeometry } = useMemo(() => {
    const curve = new CatmullRomCurve3(path);
    const points = Array.from({ length: count }, (_, i) => curve.getPointAt(count > 1 ? i / (count - 1) : 0.5).setY(curve.getPointAt(count > 1 ? i / (count - 1) : 0.5).y - drop));
    const halo = new BufferGeometry();
    halo.setAttribute('position', new Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z + 0.02]), 3));
    return { bulbs: points, wire: curve, haloGeometry: halo };
  }, [path, count, drop]);

  useDayNight((blend) => {
    const glow = MathUtils.lerp(LIGHTING.day.fairyGlow, LIGHTING.night.fairyGlow, blend);
    if (bulbMat.current) bulbMat.current.emissiveIntensity = 0.4 + glow * 1.8;
    if (haloMat.current) haloMat.current.opacity = glow * 0.75;
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
        <pointsMaterial ref={haloMat} map={glowMap} color={sceneColors.lampGlow} size={haloSize} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}
