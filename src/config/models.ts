/**
 * Optional Blender/GLB replacements for code-built furniture.
 *
 * Every object listed in `ReplaceableId` is rendered through <ReplaceableModel>. With no
 * override it renders the primitive version; add an entry below to swap in a GLB served
 * from public/models/. If the file is missing or fails to load, the primitive is used, so
 * the room never breaks. Export models with the origin at the object's base centre,
 * facing +z, in metres ×2 (1 scene unit ≈ 0.5 m) — or correct it with `scale`/`rotationY`.
 */
export type ReplaceableId = 'desk' | 'chair' | 'floorPlant' | 'pouf' | 'bookStack' | 'mochiBed';

export interface ModelOverride {
  /** Path relative to public/, e.g. 'models/chair.glb'. */
  url: string;
  scale?: number;
  rotationY?: number;
}

export const MODEL_OVERRIDES: Partial<Record<ReplaceableId, ModelOverride>> = {
  // chair: { url: 'models/chair.glb' },
  // floorPlant: { url: 'models/monstera.glb', scale: 1.1 },
};
