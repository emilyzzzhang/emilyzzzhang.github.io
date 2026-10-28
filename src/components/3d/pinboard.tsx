import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { RoundedBox } from '@react-three/drei';
import {
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  LatheGeometry,
  MathUtils,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
  type Group,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shadowDecalMaterial } from './ContactShadow';
import { CORKBOARD_FONTS, drawCork } from './corkboardArt';
import { useDayNight } from './dayNight';
import { KEY_LIGHT } from './Lighting';
import { materials, paperFinish } from './materials';
import { paintProjectedShadow, type Caster } from './projectedShadow';
import { reflection } from './surfaces';
import { useCanvasTexture } from './textures';

/*
 * Shared construction for the room's cork boards. Papers are thin curved sheets (front, back
 * and edges), never flat cards; pins are turned metal tacks or glossy map pins; their soft
 * shadows on the cork are projected from the real geometry along the key light.
 *
 * Everything on a board is placed in its cork's frame: z = 0 on the cork's face, facing +z.
 */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// Paper.

export type Lift = (x: number, y: number) => number;

/**
 * A corner lifting off the board: rising smoothly across a band `reach` wide from the corner
 * (cx, cy), measured along the inward diagonal (dx, dy), so it bends like paper, not a dome.
 */
export const curl = (cx: number, cy: number, dx: number, dy: number, reach: number, height: number): Lift => {
  const l = Math.hypot(dx, dy);
  return (x, y) => {
    const t = Math.max(0, 1 - ((x - cx) * dx + (y - cy) * dy) / l / reach);
    return height * t ** 2.3;
  };
};

/**
 * A sheet `thickness` thick whose back rests on z = lift(x, y): a printed front (group 0, UVs
 * 0–1), a plain back (group 1) and edges (group 2), all one mesh.
 */
function paperGeometry(w: number, h: number, thickness: number, lift: Lift, segX: number, segY: number) {
  const front = new PlaneGeometry(w, h, segX, segY);
  const back = new PlaneGeometry(w, h, segX, segY);
  const fp = front.attributes.position;
  const bp = back.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const z = lift(fp.getX(i), fp.getY(i));
    fp.setZ(i, z + thickness);
    bp.setZ(i, z);
  }
  const index = back.index!.array;
  for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  front.computeVertexNormals();
  back.computeVertexNormals();

  // Edges: walk the border clockwise (seen from the front) and join front to back.
  const at = (ix: number, iy: number) => ix + iy * (segX + 1);
  const ring: number[] = [];
  for (let ix = 0; ix < segX; ix++) ring.push(at(ix, 0));
  for (let iy = 0; iy < segY; iy++) ring.push(at(segX, iy));
  for (let ix = segX; ix > 0; ix--) ring.push(at(ix, segY));
  for (let iy = segY; iy > 0; iy--) ring.push(at(0, iy));
  const positions: number[] = [];
  const v = (attr: typeof fp, i: number) => [attr.getX(i), attr.getY(i), attr.getZ(i)];
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length];
    const [fa, fb, ba, bb] = [v(fp, a), v(fp, b), v(bp, a), v(bp, b)];
    positions.push(...fa, ...fb, ...ba, ...fb, ...bb, ...ba);
  });
  const edge = new BufferGeometry();
  edge.setAttribute('position', new Float32BufferAttribute(positions, 3));
  edge.setAttribute('uv', new Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  edge.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  edge.computeVertexNormals();
  return mergeGeometries([front, back, edge], true);
}

export interface Placement {
  x: number;
  y: number;
  /** Height of the sheet's back above the cork. */
  z: number;
  turn: number;
}

export const matrixOf = ({ x, y, z, turn }: Placement, tilt = new Euler()) =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(tilt.x, tilt.y, turn)), new Vector3(1, 1, 1));

/** A gentle cockle, never dipping below the sheet's resting height. */
export const cockle = (amount: number, phase: number): Lift => (x, y) => amount * (0.5 + 0.5 * Math.sin(x * 13 + phase) * Math.sin(y * 9 + 1.2 + phase));
export const sum = (...lifts: Lift[]): Lift => (x, y) => lifts.reduce((total, lift) => total + lift(x, y), 0);
/** Held at the top (by a pin or glue), bowing gently away from the board towards the bottom. */
export const bow = (h: number, amount: number): Lift => (_, y) => amount * smooth(0.15, 1, (h / 2 - y) / h) ** 2;

/** A thin sheet with no visible thickness, for torn or cut edges cut out of the texture's alpha. */
function sheetGeometry(w: number, h: number, lift: Lift, segX: number, segY: number) {
  const geometry = new PlaneGeometry(w, h, segX, segY);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, lift(pos.getX(i), pos.getY(i)));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// Pushpins: brass thumbtacks (flat head, rolled rim, low dome) and round-headed map pins.

const pinProfile = (points: [number, number][]) => points.map(([r, y]) => new Vector2(r, y));
const POINT = pinProfile([
  [0, -0.007],
  [0.0011, -0.005],
  [0.0014, 0.0035],
  [0, 0.0036],
]);
const TACK_GEO = new LatheGeometry(
  pinProfile([
    [0, -0.007],
    [0.0012, -0.005],
    [0.0015, 0],
    [0.0015, 0.0025],
    [0.004, 0.003],
    [0.0125, 0.0032],
    [0.0138, 0.0042],
    [0.0135, 0.0055],
    [0.012, 0.0062],
    [0.008, 0.0074],
    [0.004, 0.0081],
    [0, 0.0083],
  ]),
  32,
).rotateX(Math.PI / 2);
TACK_GEO.computeVertexNormals();
/** A steel point (group 0) under a glossy round head (group 1). */
const BALL_GEO = mergeGeometries(
  [new LatheGeometry(POINT, 12).rotateX(Math.PI / 2), new SphereGeometry(0.0105, 24, 16).scale(1, 1, 0.92).translate(0, 0, 0.0125)],
  true,
);

/** Polished metal with small, bright highlights from the room's reflection; dimmed at night. */
const metal = (color: string) => {
  const material = new MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.26, envMap: reflection, envMapIntensity: 1 });
  material.userData.reflection = [1, 0.35];
  return material;
};
/** Glossy plastic map-pin heads. */
const plastic = (color: string) => {
  const material = new MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMap: reflection, envMapIntensity: 0.6 });
  material.userData.reflection = [0.6, 0.2];
  return material;
};
const steel = metal('#D6D3D0');
export interface PinLook {
  geometry: BufferGeometry;
  material: MeshStandardMaterial | MeshStandardMaterial[];
}
/** A round-headed map pin in `color`. */
export const ballPin = (color: string): PinLook => ({ geometry: BALL_GEO, material: [steel, plastic(color)] });
export const PIN_LOOKS = {
  brass: { geometry: TACK_GEO, material: metal('#D9B26A') } as PinLook,
  pink: ballPin('#E8A9C1'),
  pearl: ballPin('#F7F1EA'),
};

export interface PinSpec {
  /** In the sheet's own frame. */
  x: number;
  y: number;
  look: PinLook;
  tilt: Euler;
}

// ---------------------------------------------------------------------------------------------
// Sheets.

export interface Sheet {
  size: [number, number];
  at: Placement;
  /** Paper thickness; 0 for torn sheets drawn as a single surface. */
  thickness: number;
  lift: Lift;
  draw: Draw;
  /** Canvas resolution, matching the sheet's proportions. */
  canvas: [number, number];
  /** Colour of the paper's edges and back. */
  edge?: string;
  roughness: number;
  /** Stacking order where sheets overlap (1 = lowest); also sets its depth offset. */
  layer: number;
  /** Cut-out (torn) edges in the texture's alpha, or a translucent sheet like tape. */
  alpha?: 'cut' | 'translucent';
  pins?: PinSpec[];
}

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Height above the cork of a sheet resting on `below`: its height, thickness and cockle, plus a clear margin. */
export const above = (below: Placement, thickness: number) => below.z + thickness + 0.0006 + 0.0025;

// ---------------------------------------------------------------------------------------------
// Building a board's sheets.

/** Each sheet's geometry (curved paper with edges, or a single surface for torn sheets and tape). */
export function sheetGeometries(sheets: Sheet[]) {
  return sheets.map(({ size: [w, h], thickness, lift, edge }) => {
    const [segX, segY] = [Math.max(4, Math.round(w * 60)), Math.max(4, Math.round(h * 60))];
    return edge ? paperGeometry(w, h, thickness, lift, segX, segY) : sheetGeometry(w, h, lift, segX, segY);
  });
}

/** Every pin on `sheets`, pushed through its paper at the sheet's surface, placed in the cork's frame. */
export function sheetPins(sheets: Sheet[], frame = new Matrix4()) {
  return sheets.flatMap(({ at, thickness, lift, pins = [] }) =>
    pins.map(({ x, y, look, tilt }) => {
      const p = new Vector3(x, y, thickness + lift(x, y)).applyMatrix4(matrixOf(at));
      return { matrix: frame.clone().multiply(matrixOf({ x: p.x, y: p.y, z: p.z, turn: at.turn }, tilt)), ...look };
    }),
  );
}

/** Shadow casters for `sheets` (tape is see-through enough not to cast) and their pins. */
export function sheetCasters(sheets: Sheet[], geometries: BufferGeometry[], frame = new Matrix4()): Caster[] {
  return [
    ...sheets.flatMap((sheet, i) => (sheet.alpha === 'translucent' ? [] : [{ geometry: geometries[i], matrix: frame.clone().multiply(matrixOf(sheet.at)) }])),
    ...sheetPins(sheets, frame).map(({ geometry, matrix }) => ({ geometry, matrix })),
  ];
}

// ---------------------------------------------------------------------------------------------
// Shadows on the cork.

/** [day, night] darkness of the papers' shadows on the cork, their tight core and soft halo, and resolution. */
const CORK_SHADOW = {
  strength: [0.6, 0.36] as [number, number],
  layers: [
    { blur: 0.0035, alpha: 0.6 },
    { blur: 0.014, alpha: 0.35 },
  ],
  pxPerUnit: 900,
};

const unitQuad = new PlaneGeometry(1, 1);
const ignoreRaycast = () => null;

/** The key light's direction in `root`'s frame, once mounted (wherever on the walls it hangs). */
export function useLightDirection(root: RefObject<Group | null>) {
  const [light, setLight] = useState<Vector3 | null>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    root.current.updateWorldMatrix(true, false);
    const toLocal = root.current.getWorldQuaternion(new Quaternion()).invert();
    setLight(new Vector3(...KEY_LIGHT).normalize().applyQuaternion(toLocal));
  }, [root]);
  return light;
}

/** Soft shadows of `casters` on a cork face `size` across, as a multiply decal just above it. */
export function CorkShadow({ casters, light, size: [w, h] }: { casters: Caster[]; light: Vector3; size: [number, number] }) {
  const { texture } = useMemo(
    () => paintProjectedShadow(casters, light, { layers: CORK_SHADOW.layers, pxPerUnit: CORK_SHADOW.pxPerUnit, bounds: [-w / 2, -h / 2, w / 2, h / 2] }),
    [casters, light, w, h],
  );
  const material = useMemo(() => shadowDecalMaterial(texture, CORK_SHADOW.strength[0]), [texture]);
  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );
  useDayNight((t) => {
    material.uniforms.strength.value = MathUtils.lerp(CORK_SHADOW.strength[0], CORK_SHADOW.strength[1], t);
  });
  if (light.z < 0.05) return null;
  return <mesh geometry={unitQuad} material={material} position-z={0.0004} scale={[w, h, 1]} raycast={ignoreRaycast} userData={{ noShadow: true }} />;
}

// ---------------------------------------------------------------------------------------------
// Materials and meshes.

/**
 * Papers lie a few thousandths above one another; from across the room that is close to the depth
 * buffer's resolution, so each layer also gets a slope-scaled offset (`layer` 1 = lowest).
 */
const layered = (layer: number) => ({ polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -4 * layer });

const edgeMaterials = new Map<string, MeshStandardMaterial>();
/** Shared edge-and-back material per paper colour and layer. */
function edgeMaterial(color: string, layer: number) {
  const key = `${color}:${layer}`;
  if (!edgeMaterials.has(key)) edgeMaterials.set(key, new MeshStandardMaterial({ color, roughness: 0.9, ...layered(layer) }));
  return edgeMaterials.get(key)!;
}

function usePaperMaterial(map: Texture, { roughness, layer, alpha }: Sheet) {
  const material = useMemo(() => {
    // paperFinish is shaped for JSX props, so its normal scale arrives as a tuple.
    const { normalScale, ...finish } = paperFinish(roughness);
    return new MeshStandardMaterial({
      map,
      ...finish,
      normalScale: new Vector2(...normalScale),
      alphaTest: alpha === 'cut' ? 0.5 : 0,
      transparent: alpha === 'translucent',
      depthWrite: alpha !== 'translucent',
      ...layered(layer),
    });
  }, [map, roughness, layer, alpha]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** One sheet at its placement, its art painted onto the front. */
export function SheetMesh({ sheet, geometry }: { sheet: Sheet; geometry: BufferGeometry }) {
  const map = useCanvasTexture(sheet.draw, sheet.canvas[0], sheet.canvas[1], CORKBOARD_FONTS);
  const face = usePaperMaterial(map, sheet);
  const { x, y, z, turn } = sheet.at;
  const material = sheet.edge ? [face, edgeMaterial(sheet.edge, sheet.layer), edgeMaterial(sheet.edge, sheet.layer)] : face;
  return <mesh geometry={geometry} material={material} position={[x, y, z]} rotation-z={turn} />;
}

export function PinMeshes({ pins }: { pins: ReturnType<typeof sheetPins> }) {
  return (
    <>
      {pins.map(({ matrix, geometry, material }, i) => (
        <mesh key={i} geometry={geometry} material={material} matrix={matrix} matrixAutoUpdate={false} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Frame and cork.

export interface BoardSize {
  /** The cork's visible width and height, inside the rails. */
  w: number;
  h: number;
  rail: number;
  depth: number;
  /** Height of the cork's face above the wall. */
  cork: number;
}

/** A light-oak frame round the cork: a backing board, then four softly rounded rails, grain along each. */
export function BoardFrame({ w, h, rail, depth, cork }: BoardSize) {
  const z = depth / 2;
  return (
    <group>
      {/* backing board, hidden behind the cork and stopping short of it (a shared face would z-fight) */}
      <RoundedBox args={[w + 0.02, h + 0.02, cork - 0.006]} radius={0.006} position-z={(cork - 0.006) / 2} material={materials.frameOak} />
      {[1, -1].map((side) => (
        <RoundedBox key={`h${side}`} args={[w + rail * 2, rail, depth]} radius={0.014} smoothness={5} position={[0, side * (h / 2 + rail / 2), z]} material={materials.frameOak} />
      ))}
      {[1, -1].map((side) => (
        <RoundedBox key={`v${side}`} args={[h, rail, depth]} radius={0.014} smoothness={5} position={[side * (w / 2 + rail / 2), 0, z]} rotation-z={Math.PI / 2} material={materials.frameOak} />
      ))}
    </group>
  );
}

/** Fine natural cork, slightly larger than the opening so its edges tuck under the rails. */
export function CorkFace({ w, h }: { w: number; h: number }) {
  const cork = useCanvasTexture(drawCork, 1536, Math.round((1536 * h) / w));
  return (
    <mesh>
      <planeGeometry args={[w + 0.01, h + 0.01]} />
      <meshStandardMaterial map={cork} bumpMap={cork} bumpScale={1.2} roughness={0.95} />
    </mesh>
  );
}
