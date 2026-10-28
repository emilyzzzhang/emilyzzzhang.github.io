import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import { DoubleSide, MathUtils, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3, type Group } from 'three';
import { ContactShadow, shadowDecalMaterial } from './ContactShadow';
import { useDayNight } from './dayNight';
import { KEY_LIGHT } from './Lighting';
import { materials } from './materials';
import { paintProjectedShadow, type Caster } from './projectedShadow';
import { PERLITE, POT, POT_AT, POTHOS, SHELF, SHELF_TOP, SOIL, VASE, VASE_AT } from './pothos';

const stemMaterial = new MeshStandardMaterial({ color: '#8FAE7C', roughness: 0.55 });
const leafMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: DoubleSide });
const soilMaterial = new MeshStandardMaterial({ color: '#5C4434', roughness: 1 });

/**
 * The plant's shadow on the wall. Leaves and vines are far finer than the key light's shadow map
 * can resolve, so their shadow is cast here instead: everything on the shelf is projected along
 * the key light onto the wall, blurred, and multiplied in as a decal. `strength` is [day, night].
 */
const WALL_SHADOW = { strength: [0.3, 0.16] as [number, number], blur: 0.01, pxPerUnit: 480, lift: 0.002 };

const ignoreRaycast = () => null;

const CASTERS: Caster[] = [
  { geometry: POTHOS.leaves },
  { geometry: POTHOS.stems },
  { geometry: POTHOS.daisy },
  { geometry: POT, matrix: new Matrix4().makeTranslation(POT_AT) },
  { geometry: VASE, matrix: new Matrix4().makeTranslation(VASE_AT) },
];

const unitQuad = new PlaneGeometry(1, 1);

/** `light` points towards the key light, in the shelf's frame. */
function WallShadow({ light }: { light: Vector3 }) {
  const { texture, centre, size } = useMemo(
    () => paintProjectedShadow(CASTERS, light, { layers: [{ blur: WALL_SHADOW.blur, alpha: 1 }], pxPerUnit: WALL_SHADOW.pxPerUnit }),
    [light],
  );
  const material = useMemo(() => shadowDecalMaterial(texture, WALL_SHADOW.strength[0]), [texture]);
  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );
  useDayNight((t) => {
    material.uniforms.strength.value = MathUtils.lerp(WALL_SHADOW.strength[0], WALL_SHADOW.strength[1], t);
  });

  return (
    <mesh
      geometry={unitQuad}
      material={material}
      position={[centre[0], centre[1], WALL_SHADOW.lift]}
      scale={[size[0], size[1], 1]}
      raycast={ignoreRaycast}
      userData={{ noShadow: true }}
    />
  );
}

/**
 * A light-oak floating shelf with a trailing pothos in a handmade pink pot, and a daisy in a
 * cream bud vase. Faces local +z, with the wall at z = 0.
 */
export function WallShelf({ position }: { position: [number, number, number] }) {
  const root = useRef<Group>(null);
  const [light, setLight] = useState<Vector3 | null>(null);

  // The key light's direction, brought into the shelf's frame (wherever on the walls it hangs).
  useLayoutEffect(() => {
    if (!root.current) return;
    root.current.updateWorldMatrix(true, false);
    const toLocal = root.current.getWorldQuaternion(new Quaternion()).invert();
    setLight(new Vector3(...KEY_LIGHT).normalize().applyQuaternion(toLocal));
  }, []);

  return (
    <group ref={root} position={position}>
      <RoundedBox
        args={[SHELF.width, SHELF.thickness, SHELF.depth]}
        radius={SHELF.radius}
        smoothness={5}
        position-z={SHELF.gap + SHELF.depth / 2}
        material={materials.lightOak}
      />
      <ContactShadow position={[POT_AT.x, SHELF_TOP, POT_AT.z]} size={[0.21, 0.21]} spread={0.07} strength={0.45} shape="round" />
      <ContactShadow position={[VASE_AT.x, SHELF_TOP, VASE_AT.z]} size={[0.09, 0.09]} spread={0.05} strength={0.42} shape="round" />
      <group position={POT_AT}>
        <mesh geometry={POT} material={materials.ceramicPink} />
        <mesh geometry={SOIL} material={soilMaterial} />
        <mesh geometry={PERLITE} material={materials.cream} />
      </group>
      <mesh geometry={VASE} position={VASE_AT} material={materials.ceramicCream} />
      <mesh geometry={POTHOS.stems} material={stemMaterial} />
      <mesh geometry={POTHOS.leaves} material={leafMaterial} />
      <mesh geometry={POTHOS.daisy} material={materials.plant} />
      {light && light.z > 0.05 && <WallShadow light={light} />}
    </group>
  );
}
