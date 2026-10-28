import { useEffect, useMemo } from 'react';
import { CustomBlending, PlaneGeometry, ShaderMaterial, SrcColorFactor, Vector2, Vector3, ZeroFactor } from 'three';

/**
 * Tuning for every contact shadow. `tint` is the multiply colour at full strength (display
 * space): a warm rose-brown, so contact darkening never turns grey or black at night.
 */
export const CONTACT = {
  tint: [0.64, 0.54, 0.55] as [number, number, number],
  /** Lift above the receiving surface, enough to beat z-fighting without visibly floating. */
  lift: 0.003,
};

/** One flat quad shared by every contact shadow; each mesh scales it to its footprint. */
const quad = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const ignoreRaycast = () => null;
const tint = new Vector3(...CONTACT.tint);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Distance from the footprint's edge (rounded rectangle, or ellipse when round) drives an
// eased falloff; the result multiplies the colour already on screen.
const fragmentShader = /* glsl */ `
  uniform vec2 halfSize;
  uniform vec2 extent;
  uniform float spread;
  uniform float corner;
  uniform float round;
  uniform float strength;
  uniform vec3 tint;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * extent;
    float box = length(max(abs(p) - halfSize + corner, 0.0)) - corner;
    float ellipse = (length(p / halfSize) - 1.0) * min(halfSize.x, halfSize.y);
    float d = mix(box, ellipse, round);
    float a = pow(1.0 - clamp(d / spread, 0.0, 1.0), 2.2) * strength;
    gl_FragColor = vec4(mix(vec3(1.0), tint, a), 1.0);
  }
`;

export interface ContactShadowProps {
  /** Point on the receiving surface under the footprint's centre. */
  position: [number, number, number];
  /** Footprint width (x) and depth (z) of whatever rests here. */
  size: [number, number];
  /** How far the shadow fades out beyond the footprint, in world units. */
  spread: number;
  /** 0–1: darkness right at the contact edge. */
  strength?: number;
  shape?: 'box' | 'round';
  /** Corner radius for box footprints. */
  corner?: number;
  rotationY?: number;
}

/**
 * Soft contact shadow: a static multiply decal that grounds objects where the shadow map is
 * too coarse (and slightly biased) to darken the seam. No extra render passes.
 */
export function ContactShadow({ position: [x, y, z], size: [w, d], spread, strength = 0.45, shape = 'box', corner = 0.02, rotationY = 0 }: ContactShadowProps) {
  const extent = useMemo(() => new Vector2(w + spread * 2, d + spread * 2), [w, d, spread]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          halfSize: { value: new Vector2(w / 2, d / 2) },
          extent: { value: extent },
          spread: { value: spread },
          corner: { value: Math.min(corner, w / 2, d / 2) },
          round: { value: shape === 'round' ? 1 : 0 },
          strength: { value: strength },
          tint: { value: tint },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: ZeroFactor,
        blendDst: SrcColorFactor,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      }),
    [w, d, spread, strength, shape, corner, extent],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      geometry={quad}
      material={material}
      position={[x, y + CONTACT.lift, z]}
      rotation-y={rotationY}
      scale={[extent.x, 1, extent.y]}
      raycast={ignoreRaycast}
      userData={{ noShadow: true }}
    />
  );
}
