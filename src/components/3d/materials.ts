import { MathUtils, MeshPhysicalMaterial, MeshStandardMaterial, type Mesh, type Object3D } from 'three';
import { sceneColors as c } from '../../config/theme';
import { reflection, surfaces, tiled, type Surface } from './surfaces';

/**
 * Surface tuning in one place. `tile` is the world size (units) one texture tile covers;
 * `relief` is the normal-map strength (0 = flat). Albedo and roughness maps are normalised
 * against each material's base colour and roughness, so these never shift the palette.
 */
export const FINISH = {
  wood: { tile: 2, relief: 0.1 },
  floor: { relief: 0.3, roughness: 0.72 },
  plaster: { tile: 2.2, relief: 0.04 },
  boucle: { tile: 0.32, relief: 0.5 },
  linen: { tile: 0.18, relief: 0.5 },
  grass: { tile: 1.3, relief: 1 },
  glaze: { relief: 0.08, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.14 },
  paper: { relief: 0.18 },
  /** Ceramic env-reflection strength [day, night]; it also lifts their shading a touch, so keep it low. */
  reflection: [0.32, 0.07] as [number, number],
} as const;

const matte = (color: string, roughness = 0.8, metalness = 0) =>
  new MeshStandardMaterial({ color, roughness, metalness });

/** Adds a surface's maps to `material`, keeping its average colour and roughness unchanged. */
function withSurface<M extends MeshStandardMaterial>(material: M, surface: Surface, relief: number): M {
  material.map = surface.map ?? null;
  material.roughnessMap = surface.roughnessMap;
  material.normalMap = surface.normalMap;
  material.normalScale.setScalar(relief);
  material.roughness /= surface.roughnessMean;
  const [r, g, b] = surface.albedoMean;
  material.color.setRGB(material.color.r / r, material.color.g / g, material.color.b / b);
  return material;
}

/**
 * Repeat for a texture over a UV range of `span` world units. Closed shapes (around a cylinder,
 * sphere or torus) need a whole number of tiles or a seam shows.
 */
const repeatFor = (tile: number, span: number, closed: boolean) => (closed ? Math.max(1, Math.round(span / tile)) : span / tile);

/**
 * World units covered by one UV unit, per axis. RoundedBox and worldBoxUVs geometry already use
 * world-unit UVs, so [1, 1]; primitives with 0–1 UVs pass their real size (e.g. circumference).
 */
export type UVSpan = [number, number];

function tiledSurface(surface: Surface, tile: number, [su, sv]: UVSpan, closed: boolean) {
  return tiled(surface, repeatFor(tile, su, closed), repeatFor(tile, sv, closed));
}

const woodSurface = tiled(surfaces.wood, 1 / FINISH.wood.tile, 1 / FINISH.wood.tile);
const wood = (color: string, roughness: number) => withSurface(matte(color, roughness), woodSurface, FINISH.wood.relief);

const plasterSurface = tiled(surfaces.plaster, 1 / FINISH.plaster.tile, 1 / FINISH.plaster.tile);
const plaster = (color: string) => withSurface(matte(color, 0.95), plasterSurface, FINISH.plaster.relief);

/** Soft, matte bouclé upholstery. */
export const boucle = (color: string, span: UVSpan = [1, 1], closed = false) =>
  withSurface(matte(color, 1), tiledSurface(surfaces.boucle, FINISH.boucle.tile, span, closed), FINISH.boucle.relief);

/** Lightly slubbed linen for drapes. */
export const linen = (color: string, span: UVSpan, closed = false) =>
  withSurface(matte(color, 1), tiledSurface(surfaces.linen, FINISH.linen.tile, span, closed), FINISH.linen.relief);


/** Lawn turf; `span` as for the other fabrics (world-unit UVs → [1, 1]). */
export const grassTurf = (color: string, span: UVSpan = [1, 1]) =>
  withSurface(matte(color, 1), tiledSurface(surfaces.grass, FINISH.grass.tile, span, false), FINISH.grass.relief);

/** One tiling shared by every pot and mug: small cylinders, roughly three times wider round than tall. */
const glazeSurface = tiled(surfaces.glaze, 3, 1);

/**
 * Lightly glazed ceramic: a satin body under a thin clear coat, with soft room reflections that
 * dim at night (see blendReflections).
 */
const ceramic = (color: string) => {
  const { roughness, clearcoat, clearcoatRoughness, relief } = FINISH.glaze;
  const material = withSurface(new MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness }), glazeSurface, relief);
  material.envMap = reflection;
  material.envMapIntensity = FINISH.reflection[0];
  material.userData.reflection = FINISH.reflection;
  return material;
};

const paperSurface = tiled(surfaces.paper, 3, 4);
const paperNormalScale: [number, number] = [FINISH.paper.relief, FINISH.paper.relief];

/** Paper tooth for printed planes with their own `map`: spread into <meshStandardMaterial {...paperFinish(0.85)} />. */
export const paperFinish = (roughness: number) => ({
  roughness: roughness / paperSurface.roughnessMean,
  roughnessMap: paperSurface.roughnessMap,
  normalMap: paperSurface.normalMap,
  normalScale: paperNormalScale,
});

/**
 * Shared materials, created once for the whole room. InteractiveObject clones the ones
 * inside its own subtree, so hover glows never leak onto other objects. Clones share textures.
 */
export const materials = {
  wood: wood(c.wood, 0.6),
  woodDark: wood(c.woodDark, 0.65),
  woodLight: wood(c.woodLight, 0.6),
  /** Warm honey oak for the bookshelf, with a deeper, rosier tone for its plank back. */
  oak: wood('#C99263', 0.6),
  oakBack: wood('#B27E57', 0.7),
  /** The corkboard's frame: the room's warm light oak with a finer, more delicate grain. */
  frameOak: withSurface(matte(c.woodLight, 0.55), tiled(surfaces.wood, 1 / 0.7, 1 / 0.7), 0.22),
  /** Pale light oak with a finer, more delicate grain, for the small floating shelf. */
  lightOak: withSurface(matte('#E2C49E', 0.55), tiled(surfaces.wood, 1 / 0.9, 1 / 0.9), 0.16),
  // The floor map carries the plank colours themselves, so it is not normalised against a base colour.
  // The boards lie a hair above the slab's top; from the overview's distance that gap is too thin
  // for the depth buffer, so the offset keeps the slab from flickering through. Contact shadows sit
  // further forward still (-4 units), so they stay on top of the boards.
  floor: Object.assign(withSurface(matte('#FFFFFF', FINISH.floor.roughness), { ...surfaces.floor, albedoMean: [1, 1, 1] }, FINISH.floor.relief), {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  }),
  wallUpper: plaster(c.wallUpper),
  wallLower: plaster(c.blush),
  cream: matte(c.cream, 0.7),
  white: matte(c.warmWhite, 0.5),
  beige: matte(c.beige, 0.8),
  blush: matte(c.blush, 0.8),
  pink: matte(c.pink, 0.75),
  rose: matte(c.rose, 0.7),
  roseDeep: matte(c.roseDeep, 0.65),
  peach: matte(c.peach, 0.8),
  peachDeep: matte(c.peachDeep, 0.8),
  lavender: matte(c.lavender, 0.7),
  lavenderLight: matte(c.lavenderLight, 0.75),
  lavenderDeep: matte(c.lavenderDeep, 0.65),
  sage: matte(c.sage, 0.8),
  sageDeep: matte(c.sageDeep, 0.8),
  charcoal: matte(c.charcoal, 0.5),
  leaf: matte(c.leaf, 0.6),
  leafDark: matte(c.leafDark, 0.6),
  terracotta: matte(c.terracotta, 0.85),
  soil: matte('#7A5A48', 1),
  metal: matte(c.metal, 0.35, 0.5),
  brass: matte(c.brass, 0.35, 0.7),
  /** Pale wooden slab under the floor, framing the room's edge; a shade deeper than the trim so the two read apart. */
  slab: wood('#DDBA94', 0.65),
  /** Pale honey wall cornice and posts, with bolder, larger grain than the furniture. */
  trim: withSurface(matte('#EACDA9', 0.6), tiled(surfaces.wood, 1 / 3, 1 / 3), 0.35),
  /** Guitar woods: honey maple body, dark walnut neck, fretboard and stand. */
  maple: wood('#E3B47C', 0.5),
  walnut: wood('#5A3D2E', 0.55),
  /** Cream plinth under the floor slab. */
  plinth: plaster(c.cream),
  /** Base colours for instanced garden pieces; each instance supplies its own tint. */
  petal: matte('#FFFFFF', 0.65),
  foliage: matte('#FFFFFF', 0.8),
  /** Garden pieces whose colour comes from their vertices (moss on rocks, leaf gradients). */
  rock: new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85, vertexColors: true }),
  plant: new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.55, vertexColors: true }),
  /** Soil band under the lawn's turf. */
  earth: plaster(c.earth),
  /** Desk chair upholstery (RoundedBox, world-unit UVs). */
  fabric: boucle(c.pink),
  /** Matte cream ceramic (no clear coat) with a faint glaze mottle, for the floor plant's pot. */
  potMatte: withSurface(matte(c.warmWhite, 0.78), glazeSurface, 0.05),
  ceramicPink: ceramic(c.pink),
  ceramicWhite: ceramic(c.warmWhite),
  ceramicPeach: ceramic(c.peachDeep),
  ceramicRose: ceramic(c.rose),
  ceramicLavender: ceramic(c.lavender),
  ceramicCream: ceramic('#F3E7D6'),
};

/**
 * Eases ceramic reflections between day and night strengths. Walks the scene because
 * InteractiveObject's hover clones carry their own envMapIntensity (userData is copied with them).
 */
export function blendReflections(root: Object3D, t: number) {
  root.traverse((obj) => {
    const material = (obj as Mesh).material;
    if (!(material instanceof MeshStandardMaterial)) return;
    const strength = material.userData.reflection as [number, number] | undefined;
    if (strength) material.envMapIntensity = MathUtils.lerp(strength[0], strength[1], t);
  });
}
