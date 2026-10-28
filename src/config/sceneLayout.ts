export type Vec3 = [number, number, number];

/**
 * World-space layout of the room. 1 unit ≈ 0.5 m. The floor top sits at y = 0, the back
 * wall's inner face at z = -4 and the left wall's inner face at x = -4; the room is open
 * towards +x / +z so the camera can look in.
 */
export const ROOM = {
  half: 4,
  wallHeight: 5.2,
  /** Walls grow outward from their inner faces (z = −4, x = −4), so thickness never eats into the room. */
  wallThickness: 0.46,
  wainscotHeight: 1.7,
} as const;

/**
 * The miniature's base. The wooden floor slab's top is the floor (y = 0); under it sits a cream
 * plinth, which stands on an organic lawn that reaches further out at the front and right,
 * the sides the overview camera sees.
 */
export const DIORAMA = {
  slab: 0.35,
  plinth: { height: 0.38, overhang: 0.1 },
  /** A thin layer of turf on a band of soil, like a model-railway lawn. */
  lawn: { top: -0.6, thickness: 0.1, bevel: 0.035, soil: 0.16, front: 1.45, back: 0.45 },
} as const;

/** Plinth footprint [minX, maxX] (the same along z): the slab under walls and floor, plus a small overhang. */
export const PLINTH_SPAN: [number, number] = [
  -ROOM.half - ROOM.wallThickness - DIORAMA.plinth.overhang,
  ROOM.half + DIORAMA.plinth.overhang,
];

/** Lawn footprint [minX, maxX] (the same along z). */
export const LAWN_SPAN: [number, number] = [PLINTH_SPAN[0] - DIORAMA.lawn.back, PLINTH_SPAN[1] + DIORAMA.lawn.front];

/** The "Emily's Studio" sign on the lawn's front-left edge: where its post stands (x, z) and the board's size. */
export const GARDEN_SIGN = {
  position: [-3.95, 4.65] as [number, number],
  board: { width: 1.36, height: 0.46, arch: 0.12, depth: 0.06 },
  /** Height of the board's bottom edge above the lawn. */
  lift: 0.42,
};

/**
 * The round faux-sheepskin rug under the chair (centred on ANCHORS.rug, clear of the desk and
 * Mochi's bed): a soft cushion (`base` thick) covered in `length`-long silky fur, as `layers` shells.
 */
export const RUG_FUR = {
  radius: 1.25,
  base: 0.04,
  length: 0.12,
  layers: 18,
  color: '#F5E9E5',
  /** Undertone a scattering of strands lean towards. */
  blush: '#F0D3D7',
};

/** Where things standing on the rug rest: on the cushion, sunk a little into the pile. */
export const RUG_TOP = RUG_FUR.base + 0.04;

/** The guitar is turned this far (radians about y) from facing +z, towards the overview camera. */
export const GUITAR_TURN = 0.65;

export const DESK = {
  width: 3.2,
  depth: 1.3,
  height: 1.5,
};

export interface Placement {
  position: Vec3;
  rotationY?: number;
}

/** Where each free-standing piece of furniture sits. Swappable for GLBs via config/models.ts. */
export const PLACEMENTS = {
  desk: { position: [0.6, 0, -3.25] },
  chair: { position: [0.45, 0, -1.85], rotationY: 0.06 },
  floorPlant: { position: [3.3, 0, -3.3] },
  /** The bean bag; turned so its seat faces into the room, towards the overview camera. */
  pouf: { position: [2.75, 0, 0.75], rotationY: Math.PI / 4 },
  bookStack: { position: [1.9, 0, 1.75] },
  mochiBed: { position: [2.85, 0, -1.7], rotationY: 0.55 },
} satisfies Record<string, Placement>;

/** Base positions of the interactive objects and wall-mounted decor. */
export const ANCHORS = {
  computer: [0.35, DESK.height, -3.45] as Vec3,
  mug: [1.78, DESK.height, -2.95] as Vec3,
  envelope: [-0.55, DESK.height, -2.92] as Vec3,
  lamp: [-0.72, DESK.height, -3.62] as Vec3,
  pencilCup: [2.0, DESK.height, -3.62] as Vec3,
  succulent: [1.5, DESK.height, -3.7] as Vec3,
  bookshelf: [-3.5, 0, -0.55] as Vec3,
  gallery: [0.6, 3.75, -4] as Vec3,
  corkboard: [3.05, 3.4, -4] as Vec3,
  /** The inspiration board on the left wall (the résumé pinned to it opens the Résumé section). */
  resumePoster: [-4, 2.85, 1.6] as Vec3,
  window: [-2.45, 3.05, -4] as Vec3,
  rug: [0.3, 0, -1.55] as Vec3,
  /** Floor point under the guitar stand by the left wall, between the bookshelf and the résumé poster. */
  guitar: [-3.3, 0, 1.4] as Vec3,
  /** Floor point for the basket, strawberry plush and slippers, in front of the guitar along the left wall. */
  cozyCorner: [-3.0, 0, 2.75] as Vec3,
};
