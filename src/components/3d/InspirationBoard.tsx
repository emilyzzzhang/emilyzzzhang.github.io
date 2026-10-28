import { useRef } from 'react';
import { Euler, Vector3, type Group } from 'three';
import { sceneColors as c } from '../../config/theme';
import { drawMiniResume, drawNote, drawPolaroid, drawPostcard } from './boardArt';
import { drawGoals, tapeArt, withGrain } from './corkboardArt';
import {
  above,
  ballPin,
  BoardFrame,
  bow,
  cockle,
  CorkFace,
  CorkShadow,
  curl,
  matrixOf,
  PIN_LOOKS,
  PinMeshes,
  sheetCasters,
  sheetGeometries,
  SheetMesh,
  sheetPins,
  sum,
  useLightDirection,
  type Placement,
  type Sheet,
} from './pinboard';

/*
 * The inspiration board on the left wall: the miniature résumé (clickable, so RoomScene mounts
 * it separately inside the résumé's InteractiveObject), a McGill postcard, a Polaroid of Mochi
 * and three handwritten sticky notes, built like the corkboard (see pinboard.tsx).
 * Board-local layout: x across, y up, z out of the wall; sheets sit in the cork's frame.
 */

/** Outer size 1.5 × 1.2, as before: the cork opening plus the rails. */
const BOARD = { w: 1.34, h: 1.04, rail: 0.08, depth: 0.06, cork: 0.045 };

const RESUME_AT: Placement = { x: -0.38, y: 0, z: 0.0045, turn: -0.04 };
/** Where the miniature résumé is pinned (board-local); RoomScene places it alongside the board. */
export const RESUME_SPOT = { position: [RESUME_AT.x, RESUME_AT.y, BOARD.cork + RESUME_AT.z] as [number, number, number], tilt: RESUME_AT.turn };

const tapePink = tapeArt('rgba(236, 150, 170, 0.34)');
const tapeLavender = tapeArt('rgba(170, 150, 220, 0.34)');

/** A strip of washi tape on `base` at (x, y) in its frame, turned `turn` further. */
function tape(base: Placement, thickness: number, x: number, y: number, turn: number, draw = tapeLavender, length = 0.13): Sheet {
  const p = new Vector3(x, y, 0).applyMatrix4(matrixOf(base));
  return {
    size: [length, 0.038],
    at: { x: p.x, y: p.y, z: above(base, thickness), turn: base.turn + turn },
    thickness: 0,
    lift: () => 0,
    draw,
    canvas: [400, 120],
    roughness: 0.6,
    layer: 5,
    alpha: 'translucent',
  };
}

// ---------------------------------------------------------------------------------------------
// The résumé, in its own frame (RESUME_AT places it on the board), taped at its top corners.

const RESUME_SIZE: [number, number] = [0.42, 0.56];
const RESUME_SELF: Placement = { x: 0, y: 0, z: 0, turn: 0 };
const RESUME_SHEETS: Sheet[] = [
  {
    size: RESUME_SIZE,
    at: RESUME_SELF,
    thickness: 0.0012,
    lift: sum(cockle(0.0006, 0.4), curl(0.21, -0.28, -1, 0.85, 0.08, 0.013)),
    draw: withGrain(drawMiniResume, 4),
    canvas: [1152, 1536],
    edge: '#F4EDE2',
    roughness: 0.88,
    layer: 2,
  },
  tape(RESUME_SELF, 0.0012, -0.18, 0.26, 0.7, tapePink),
  tape(RESUME_SELF, 0.0012, 0.18, 0.26, -0.7, tapePink),
];
const RESUME_GEOMETRIES = sheetGeometries(RESUME_SHEETS);

/** The clickable miniature résumé (RoomScene wraps it in the résumé InteractiveObject). */
export function MiniResume() {
  return (
    <group>
      {RESUME_SHEETS.map((sheet, i) => (
        <SheetMesh key={i} sheet={sheet} geometry={RESUME_GEOMETRIES[i]} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Everything else on the board.

const POSTCARD_AT: Placement = { x: 0.42, y: 0.23, z: 0.0045, turn: 0.05 };
/** The Polaroid overlaps the postcard's left edge. */
const POLAROID_AT: Placement = { x: 0.1, y: 0.17, z: above(POSTCARD_AT, 0.0016), turn: -0.08 };

const NOTES: { at: Placement; size: number; color: string; lines: string[]; doodle: 'star' | 'heart' | 'computer'; pin: string; corner: 1 | -1 }[] = [
  { at: { x: 0.03, y: -0.31, z: 0.0045, turn: -0.09 }, size: 0.21, color: '#FFF4DE', lines: ['build something', 'fun!'], doodle: 'star', pin: c.lavenderDeep, corner: 1 },
  { at: { x: 0.3, y: -0.27, z: 0.0045, turn: 0.07 }, size: 0.2, color: '#F6CDD6', lines: ['ship it,', 'then cuddle'], doodle: 'computer', pin: c.sageDeep, corner: -1 },
  { at: { x: 0.54, y: -0.32, z: 0.0045, turn: -0.04 }, size: 0.2, color: '#FBEBA8', lines: ['you got', 'this'], doodle: 'heart', pin: c.roseDeep, corner: 1 },
];

const SHEETS: Sheet[] = [
  {
    size: [0.44, 0.3],
    at: POSTCARD_AT,
    thickness: 0.0016,
    lift: sum(cockle(0.0005, 2.2), bow(0.3, 0.0015)),
    draw: withGrain(drawPostcard, 5, 6),
    canvas: [1320, 900],
    edge: '#F2EBDF',
    roughness: 0.75,
    layer: 2,
    pins: [{ x: 0.17, y: 0.11, look: PIN_LOOKS.brass, tilt: new Euler(0.08, -0.1, 0) }],
  },
  {
    size: [0.3, 0.36],
    at: POLAROID_AT,
    thickness: 0.0018,
    lift: bow(0.36, 0.002),
    draw: withGrain(drawPolaroid, 6, 5),
    canvas: [900, 1080],
    edge: '#F5F1EA',
    roughness: 0.65,
    layer: 3,
  },
  tape(POLAROID_AT, 0.0018, 0, 0.175, 0.06, tapeLavender, 0.11),
  ...NOTES.map(
    ({ at, size, color, lines, doodle, pin, corner }, i): Sheet => ({
      size: [size, size],
      at,
      thickness: 0.0008,
      lift: sum(bow(size, 0.003), curl((corner * size) / 2, -size / 2, -corner, 0.9, size * 0.3, 0.011)),
      draw: withGrain(drawNote(color, lines, doodle), 40 + i),
      canvas: [600, 600],
      edge: color,
      roughness: 0.82,
      layer: 2,
      pins: [{ x: 0, y: size / 2 - 0.035, look: ballPin(pin), tilt: new Euler(0.1 * corner, -0.08, 0) }],
    }),
  ),
  // A ruled index card of goals, tucked just under the Polaroid's corner.
  {
    size: [0.26, 0.16],
    at: { x: 0.06, y: -0.105, z: 0.0045, turn: 0.035 },
    thickness: 0.0012,
    lift: sum(cockle(0.0005, 3.1), curl(-0.13, -0.08, 1, 0.8, 0.05, 0.007)),
    draw: drawGoals,
    canvas: [900, 554],
    edge: '#EFEAE0',
    roughness: 0.85,
    layer: 2,
    pins: [{ x: 0.095, y: 0.058, look: PIN_LOOKS.pearl, tilt: new Euler(-0.08, 0.1, 0) }],
  },
  // A spare strip of washi tape, the way boards collect them.
  tape({ x: -0.38, y: 0.43, z: 0, turn: 0 }, 0, 0, 0, -0.12, tapeLavender, 0.18),
];

const GEOMETRIES = sheetGeometries(SHEETS);
const PINS = sheetPins(SHEETS);
/** The résumé is mounted elsewhere but still shades the cork. */
const CASTERS = [...sheetCasters(SHEETS, GEOMETRIES), ...sheetCasters(RESUME_SHEETS, RESUME_GEOMETRIES, matrixOf(RESUME_AT))];

/** Cork inspiration board in an oak frame. Faces local +z, origin at its centre on the wall. */
export function InspirationBoard() {
  const root = useRef<Group>(null);
  const light = useLightDirection(root);
  return (
    <group ref={root}>
      <BoardFrame {...BOARD} />
      <group position-z={BOARD.cork}>
        <CorkFace w={BOARD.w} h={BOARD.h} />
        {light && <CorkShadow casters={CASTERS} light={light} size={[BOARD.w, BOARD.h]} />}
        {SHEETS.map((sheet, i) => (
          <SheetMesh key={i} sheet={sheet} geometry={GEOMETRIES[i]} />
        ))}
        <PinMeshes pins={PINS} />
      </group>
    </group>
  );
}
