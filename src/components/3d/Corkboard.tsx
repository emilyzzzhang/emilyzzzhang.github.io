import { useRef } from 'react';
import { Euler, type Group } from 'three';
import { drawCalendar, drawPolaroid, drawQuote, drawSketch, drawSlip, drawTape, drawTodo, drawTulips } from './corkboardArt';
import {
  above,
  BoardFrame,
  bow,
  cockle,
  CorkFace,
  CorkShadow,
  curl,
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
 * The corkboard on the back wall, dressed as a working board: a month calendar, a coding to-do
 * list, a note of encouragement, a polaroid, a torn page of sketches and a taped-up print, with
 * a reminder slip tucked behind the calendar. Board frame: origin at the centre on the wall,
 * facing +z; sheets are placed in the cork's frame (see pinboard.tsx).
 */

const BOARD = { w: 1.25, h: 0.94, rail: 0.055, depth: 0.06, cork: 0.035 };

const CALENDAR_AT: Placement = { x: -0.3, y: 0.2, z: 0.0045, turn: 0.012 };
const TULIPS_AT: Placement = { x: 0.36, y: -0.27, z: 0.0045, turn: 0.04 };

const SHEETS: Sheet[] = [
  // A reminder slip tucked behind the calendar's bottom edge.
  {
    size: [0.18, 0.073],
    at: { x: -0.17, y: -0.045, z: 0.0015, turn: 0.08 },
    thickness: 0,
    lift: cockle(0.0006, 2),
    draw: drawSlip,
    canvas: [640, 260],
    roughness: 0.88,
    layer: 1,
    alpha: 'cut',
  },
  // Month calendar, top left, its bottom-right corner curling.
  {
    size: [0.5, 0.43],
    at: CALENDAR_AT,
    thickness: 0.0012,
    lift: sum(cockle(0.0006, 0.6), curl(0.25, -0.215, -1, 0.8, 0.08, 0.012)),
    draw: drawCalendar,
    canvas: [1200, 1032],
    edge: '#EFE6D6',
    roughness: 0.9,
    layer: 2,
    pins: [{ x: -0.07, y: 0.188, look: PIN_LOOKS.brass, tilt: new Euler(0.08, -0.1, 0) }],
  },
  // A small note of encouragement, just overlapping the calendar's corner.
  {
    size: [0.17, 0.2],
    at: { x: 0.025, y: 0.3, z: above(CALENDAR_AT, 0.0012), turn: -0.03 },
    thickness: 0,
    lift: sum(bow(0.2, 0.003), curl(-0.085, -0.1, 1, 0.9, 0.05, 0.006)),
    draw: drawQuote,
    canvas: [600, 706],
    roughness: 0.85,
    layer: 3,
    alpha: 'cut',
    pins: [{ x: 0, y: 0.078, look: PIN_LOOKS.pearl, tilt: new Euler(-0.1, 0.06, 0) }],
  },
  // The coding to-do list, pinned at the top, its free bottom corner lifting.
  {
    size: [0.3, 0.375],
    at: { x: 0.4, y: 0.15, z: 0.0045, turn: -0.055 },
    thickness: 0.0008,
    lift: sum(bow(0.375, 0.004), curl(0.15, -0.1875, -1, 0.9, 0.075, 0.015)),
    draw: drawTodo,
    canvas: [800, 1000],
    edge: '#E2B4B8',
    roughness: 0.82,
    layer: 2,
    pins: [{ x: -0.005, y: 0.162, look: PIN_LOOKS.pink, tilt: new Euler(0.12, 0.08, 0) }],
  },
  // A sunset polaroid, bottom left.
  {
    size: [0.2, 0.248],
    at: { x: -0.42, y: -0.22, z: 0.0045, turn: 0.035 },
    thickness: 0.0018,
    lift: bow(0.248, 0.002),
    draw: drawPolaroid,
    canvas: [630, 780],
    edge: '#F1ECE3',
    roughness: 0.7,
    layer: 2,
    pins: [{ x: 0.004, y: 0.106, look: PIN_LOOKS.pink, tilt: new Euler(-0.08, -0.12, 0) }],
  },
  // A torn sketch page with the studio ideas, bottom centre.
  {
    size: [0.32, 0.233],
    at: { x: -0.05, y: -0.26, z: 0.0045, turn: -0.02 },
    thickness: 0,
    lift: sum(cockle(0.0008, 1.7), curl(0.16, 0.1165, -1, -0.8, 0.06, 0.006)),
    draw: drawSketch,
    canvas: [990, 720],
    roughness: 0.9,
    layer: 2,
    alpha: 'cut',
    pins: [{ x: -0.1, y: 0.086, look: PIN_LOOKS.brass, tilt: new Euler(0.06, 0.12, 0) }],
  },
  // A tulip print, bottom right, held up by washi tape.
  {
    size: [0.19, 0.2375],
    at: TULIPS_AT,
    thickness: 0.0015,
    lift: bow(0.2375, 0.0025),
    draw: drawTulips,
    canvas: [600, 750],
    edge: '#F1ECE3',
    roughness: 0.6,
    layer: 2,
  },
  {
    size: [0.12, 0.036],
    at: { x: TULIPS_AT.x - 0.004, y: TULIPS_AT.y + 0.112, z: above(TULIPS_AT, 0.0015), turn: TULIPS_AT.turn - 0.08 },
    thickness: 0,
    lift: () => 0,
    draw: drawTape,
    canvas: [400, 120],
    roughness: 0.6,
    layer: 4,
    alpha: 'translucent',
  },
];

const GEOMETRIES = sheetGeometries(SHEETS);
const PINS = sheetPins(SHEETS);
const CASTERS = sheetCasters(SHEETS, GEOMETRIES);

export function Corkboard({ position }: { position: [number, number, number] }) {
  const root = useRef<Group>(null);
  const light = useLightDirection(root);
  return (
    <group ref={root} position={position}>
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
