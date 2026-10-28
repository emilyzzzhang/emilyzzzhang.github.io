import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Matrix4, MathUtils, Object3D, PlaneGeometry, ShaderMaterial, Vector2, Vector3, type MeshBasicMaterial, type SpotLight } from 'three';
import { HOME_VIEW } from '../../config/camera';
import { ANCHORS, DIORAMA, LAWN_SPAN } from '../../config/sceneLayout';
import { LIGHTING, SUNLIGHT } from '../../config/theme';
import { useDayNight } from './dayNight';
import { drawSunCookie, drawSunShaft, useCanvasTexture } from './textures';

/**
 * Afternoon sun falling in through the window, down into the room and slightly to the right.
 * The window is painted onto a solid wall, so the beam starts just inside the glass (in front
 * of the sill) rather than outside, where the wall would block it.
 */
const [wx, wy, wz] = ANCHORS.window;
const SOURCE = new Vector3(wx, wy + 0.05, wz + 0.55);
/**
 * Where the beam's axis meets the floor: the open boards between the bookshelf and the rug,
 * where warm light reads best (mid-tone wood) and the overview camera sees it clearly.
 */
const LANDING = new Vector3(-2.0, 0, -0.85);
const SUN_DIRECTION = LANDING.clone().sub(SOURCE).normalize();
/** Cone half-angle: wide enough that the window-shaped patch on the floor is about window-sized. */
const SUN_ANGLE = 0.3;

const ignoreRaycast = () => null;
const mix = (key: 'sun', t: number) => MathUtils.lerp(LIGHTING.day[key], LIGHTING.night[key], t);

/** Daytime sunlight: a shadow-casting window sunbeam, a faint light shaft, and a soft shadow under the platform. All fade out at night. */
export function Sunlight({ lowPower }: { lowPower: boolean }) {
  return (
    <>
      <Sunbeam lowPower={lowPower} />
      <SunShaft />
      <PlatformShadow />
    </>
  );
}

function Sunbeam({ lowPower }: { lowPower: boolean }) {
  const cookie = useCanvasTexture(drawSunCookie, 256, 256);
  const spot = useRef<SpotLight>(null);
  const target = useMemo(() => {
    const t = new Object3D();
    t.position.copy(LANDING);
    return t;
  }, []);

  useDayNight((t) => {
    const light = spot.current;
    if (!light) return;
    light.intensity = SUNLIGHT.intensity * mix('sun', t);
    // No point re-rendering this shadow map at night, when the beam is off. It still has to be
    // rendered once (needsUpdate): loading straight into night would otherwise leave lit
    // materials sampling a shadow map that was never created.
    const on = light.intensity > 0;
    light.shadow.autoUpdate = on;
    if (!on) light.shadow.needsUpdate = true;
  });

  const shadowSize = lowPower ? 512 : 1024;
  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={spot}
        position={SOURCE}
        target={target}
        color={SUNLIGHT.color}
        intensity={0}
        angle={SUN_ANGLE}
        // A firmer edge and tighter shadow filtering, so the window's patch and its bars read clearly.
        penumbra={0.22}
        decay={0}
        map={cookie}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-near={0.3}
        shadow-camera-far={7}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={2}
      />
    </>
  );
}

/** A barely-there shaft of light from the window to the sunlit patch, turned to face the overview camera. */
function SunShaft() {
  const texture = useCanvasTexture(drawSunShaft, 128, 256);
  const material = useRef<MeshBasicMaterial>(null);
  const { position, quaternion, length } = useMemo(() => {
    const along = SUN_DIRECTION.clone().negate();
    const mid = SOURCE.clone().lerp(LANDING, 0.5);
    const toCamera = new Vector3(...HOME_VIEW.position).sub(mid);
    const facing = toCamera.addScaledVector(along, -toCamera.dot(along)).normalize();
    const side = new Vector3().crossVectors(along, facing);
    const basis = new Matrix4().makeBasis(side, along, facing);
    return { position: mid, quaternion: new Object3D().quaternion.setFromRotationMatrix(basis), length: SOURCE.distanceTo(LANDING) };
  }, []);

  useDayNight((t) => {
    if (material.current) material.current.opacity = SUNLIGHT.rays * mix('sun', t);
  });

  return (
    <mesh position={position} quaternion={quaternion} raycast={ignoreRaycast}>
      <planeGeometry args={[1.9, length]} />
      <meshBasicMaterial ref={material} map={texture} color={SUNLIGHT.color} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/** The diorama's footprint: its lawn, whose underside is the lowest point of the model. */
const BASE_BOTTOM = DIORAMA.lawn.top - DIORAMA.lawn.thickness - DIORAMA.lawn.soil;
const PLATFORM = LAWN_SPAN[1] - LAWN_SPAN[0];
const PLATFORM_CENTRE = (LAWN_SPAN[0] + LAWN_SPAN[1]) / 2;
/** Matches the lawn's rounded outline. */
const PLATFORM_CORNER = 1.6;
/** The platform's shadow drifts away from the sun (towards the front-right), as if lit from the window side. */
const PLATFORM_SHADOW_OFFSET = new Vector2(0.3, 0.38);
/** How far the shadow fades out past the lawn: wide and soft, so the base settles into the backdrop. */
const PLATFORM_SHADOW_SPREAD = 2.2;

const platformQuad = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/**
 * Soft shadow on the backdrop under the diorama, so it reads as a model sitting on a
 * surface. The canvas is transparent, so this blends over the page background (alpha, not multiply).
 */
function PlatformShadow() {
  const extent = PLATFORM + PLATFORM_SHADOW_SPREAD * 2;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          halfSize: { value: new Vector2(PLATFORM / 2, PLATFORM / 2) },
          extent: { value: extent },
          spread: { value: PLATFORM_SHADOW_SPREAD },
          strength: { value: 0 },
          corner: { value: PLATFORM_CORNER },
          color: { value: new Color(SUNLIGHT.platformShadowColor) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec2 halfSize;
          uniform float extent;
          uniform float spread;
          uniform float strength;
          uniform float corner;
          uniform vec3 color;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * extent;
            float d = length(max(abs(p) - halfSize + corner, 0.0)) - corner;
            float f = 1.0 - clamp(d / spread, 0.0, 1.0);
            float a = f * f * strength;
            gl_FragColor = vec4(color, a);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    [extent],
  );

  useDayNight((t) => {
    material.uniforms.strength.value = SUNLIGHT.platformShadow * mix('sun', t);
  });

  return (
    <mesh
      geometry={platformQuad}
      material={material}
      position={[PLATFORM_CENTRE + PLATFORM_SHADOW_OFFSET.x, BASE_BOTTOM - 0.02, PLATFORM_CENTRE + PLATFORM_SHADOW_OFFSET.y]}
      scale={[extent, 1, extent]}
      raycast={ignoreRaycast}
      renderOrder={-1}
    />
  );
}
