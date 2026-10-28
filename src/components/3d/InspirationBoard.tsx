import { useMemo, type ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';
import { sceneColors as c } from '../../config/theme';
import { drawCork, drawMiniResume, drawNote, drawPolaroid, drawPostcard } from './boardArt';
import { ContactShadow } from './ContactShadow';
import { materials, paperFinish } from './materials';
import { useCanvasTexture } from './textures';

/** Board-local layout: x across, y up, z out of the wall. The cork face sits at CORK_Z. */
const BOARD = { width: 1.5, height: 1.2, rail: 0.08, depth: 0.06 };
const CORK_Z = 0.045;
/** Each overlapping layer of paper sits this much further out, so layers never z-fight. */
const LAYER = 0.007;
const PAPER = 0.004;

/** Where the miniature résumé is pinned (board-local); RoomScene places it alongside the board. */
export const RESUME_SPOT = { position: [-0.38, 0.0, CORK_Z + 0.007] as [number, number, number], tilt: -0.04 };
const RESUME_SIZE: [number, number] = [0.42, 0.56];

const tape = new MeshStandardMaterial({ color: '#EFB2C4', transparent: true, opacity: 0.82, roughness: 0.8 });
const tapeLavender = new MeshStandardMaterial({ color: '#CDBDEA', transparent: true, opacity: 0.82, roughness: 0.8 });
const curlBack = (color: string) => new MeshStandardMaterial({ color, roughness: 0.9, side: DoubleSide });

/** A lifted corner flap: a triangle at the paper's bottom-right, bent up about its diagonal. */
function curlGeometry(w: number, h: number, size: number) {
  const s = size;
  const mid = new Vector3(w / 2 - s / 2, -h / 2 + s / 2, 0);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([s / 2, -s / 2, 0, -s / 2, -s / 2, 0, s / 2, s / 2, 0], 3));
  geometry.computeVertexNormals();
  geometry.applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(1, 1, 0).normalize(), -0.75));
  geometry.translate(mid.x, mid.y, mid.z + 0.001);
  return geometry;
}

interface PaperProps {
  size: [number, number];
  map: Texture;
  edge: string;
  curl?: number;
  children?: ReactNode;
}

/** A sheet with a little thickness: a coloured slab and its printed face. */
function Paper({ size: [w, h], map, edge, curl, children }: PaperProps) {
  const curlGeo = useMemo(() => (curl ? curlGeometry(w, h, curl) : null), [w, h, curl]);
  const curlMat = useMemo(() => curlBack(edge), [edge]);
  return (
    <group>
      <mesh position-z={PAPER / 2}>
        <boxGeometry args={[w, h, PAPER]} />
        <meshStandardMaterial color={edge} roughness={0.9} />
      </mesh>
      <mesh position-z={PAPER + 0.0008}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} {...paperFinish(0.85)} />
      </mesh>
      {curlGeo && <mesh geometry={curlGeo} position-z={PAPER + 0.001} material={curlMat} />}
      {children}
    </group>
  );
}

function Pin({ position, color }: { position: [number, number]; color: string }) {
  return (
    <group position={[position[0], position[1], PAPER + 0.004]}>
      <mesh rotation-x={Math.PI / 2} position-z={0.008} material={materials.metal}>
        <cylinderGeometry args={[0.004, 0.004, 0.016, 6]} />
      </mesh>
      <mesh position-z={0.022} scale={[1, 1, 0.75]}>
        <sphereGeometry args={[0.02, 14, 10]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Tape({ position, angle, lavender = false, length = 0.13 }: { position: [number, number]; angle: number; lavender?: boolean; length?: number }) {
  return (
    <mesh position={[position[0], position[1], PAPER + 0.003]} rotation-z={angle} material={lavender ? tapeLavender : tape}>
      <planeGeometry args={[length, 0.04]} />
    </mesh>
  );
}

/**
 * A soft shadow on the cork under a pinned item. ContactShadow lies flat in its own xz-plane,
 * so it is stood up to face out of the board.
 */
function PaperShadow({ position: [x, y], size, tilt, depth }: { position: [number, number]; size: [number, number]; tilt: number; depth: number }) {
  return (
    <group rotation-x={Math.PI / 2}>
      <ContactShadow position={[x, depth, -(y - 0.012)]} size={size} spread={0.035} strength={0.32} rotationY={tilt} corner={0.004} />
    </group>
  );
}

/** The clickable miniature résumé (RoomScene wraps it in the résumé InteractiveObject). */
export function MiniResume() {
  const map = useCanvasTexture(drawMiniResume, 384, 512);
  const [w, h] = RESUME_SIZE;
  return (
    <Paper size={RESUME_SIZE} map={map} edge="#F4EDE2" curl={0.045}>
      <Tape position={[-w / 2 + 0.03, h / 2 - 0.02]} angle={0.7} />
      <Tape position={[w / 2 - 0.03, h / 2 - 0.02]} angle={-0.7} />
    </Paper>
  );
}

interface ItemLayout {
  position: [number, number];
  size: [number, number];
  tilt: number;
  layer: number;
}

const POSTCARD: ItemLayout = { position: [0.42, 0.23], size: [0.44, 0.3], tilt: 0.05, layer: 0 };
const POLAROID: ItemLayout = { position: [0.1, 0.17], size: [0.3, 0.36], tilt: -0.08, layer: 1 };
const NOTES: (ItemLayout & { color: string; lines: string[]; doodle: 'star' | 'heart' | 'computer'; pin: string })[] = [
  { position: [0.03, -0.31], size: [0.21, 0.21], tilt: -0.09, layer: 0, color: '#FFF4DE', lines: ['build something', 'fun!'], doodle: 'star', pin: c.lavenderDeep },
  { position: [0.3, -0.27], size: [0.2, 0.2], tilt: 0.07, layer: 1, color: '#F6CDD6', lines: ['ship it,', 'then cuddle'], doodle: 'computer', pin: c.sageDeep },
  { position: [0.56, -0.32], size: [0.2, 0.2], tilt: -0.04, layer: 0, color: '#FBEBA8', lines: ['you got', 'this'], doodle: 'heart', pin: c.roseDeep },
];

const z = (layer: number) => CORK_Z + 0.002 + layer * LAYER;

/** Cork inspiration board in an oak frame, with a postcard, a Polaroid of Mochi and sticky notes. Faces local +z. */
export function InspirationBoard() {
  const cork = useCanvasTexture(drawCork, 512, 400);
  const postcard = useCanvasTexture(drawPostcard, 440, 300);
  const polaroid = useCanvasTexture(drawPolaroid, 300, 360);
  const noteMaps = [
    useCanvasTexture(useMemo(() => drawNote(NOTES[0].color, NOTES[0].lines, NOTES[0].doodle), []), 200, 200),
    useCanvasTexture(useMemo(() => drawNote(NOTES[1].color, NOTES[1].lines, NOTES[1].doodle), []), 200, 200),
    useCanvasTexture(useMemo(() => drawNote(NOTES[2].color, NOTES[2].lines, NOTES[2].doodle), []), 200, 200),
  ];

  const { width: W, height: H, rail: R, depth: D } = BOARD;
  const [rx, ry] = RESUME_SPOT.position;
  return (
    <group>
      {/* oak frame: top and bottom rails, then sides butted between them, grain along each */}
      {[1, -1].map((side) => (
        <RoundedBox key={`h${side}`} args={[W, R, D]} radius={0.022} smoothness={3} position={[0, side * (H / 2 - R / 2), D / 2]} material={materials.trim} />
      ))}
      {[1, -1].map((side) => (
        <RoundedBox key={`v${side}`} args={[H - R * 2, R, D]} radius={0.022} smoothness={3} position={[side * (W / 2 - R / 2), 0, D / 2]} rotation-z={Math.PI / 2} material={materials.trim} />
      ))}
      <mesh position-z={CORK_Z}>
        <planeGeometry args={[W - R * 2 + 0.01, H - R * 2 + 0.01]} />
        <meshStandardMaterial map={cork} roughness={1} />
      </mesh>

      {/* shadows of everything pinned, including the résumé */}
      <PaperShadow position={[rx, ry]} size={RESUME_SIZE} tilt={RESUME_SPOT.tilt} depth={CORK_Z} />
      {[POSTCARD, POLAROID, ...NOTES].map(({ position, size, tilt, layer }, i) => (
        <PaperShadow key={i} position={position} size={size} tilt={tilt} depth={z(layer) - 0.001} />
      ))}

      <group position={[...POSTCARD.position, z(POSTCARD.layer)]} rotation-z={POSTCARD.tilt}>
        <Paper size={POSTCARD.size} map={postcard} edge="#F2EBDF">
          <Pin position={[POSTCARD.size[0] / 2 - 0.05, POSTCARD.size[1] / 2 - 0.04]} color={c.peachDeep} />
        </Paper>
      </group>
      <group position={[...POLAROID.position, z(POLAROID.layer)]} rotation-z={POLAROID.tilt}>
        <Paper size={POLAROID.size} map={polaroid} edge="#F5F1EA">
          <Tape position={[0, POLAROID.size[1] / 2 - 0.005]} angle={0.06} lavender length={0.11} />
        </Paper>
      </group>
      {NOTES.map((note, i) => (
        <group key={i} position={[...note.position, z(note.layer)]} rotation-z={note.tilt}>
          <Paper size={note.size} map={noteMaps[i]} edge={note.color} curl={0.04}>
            <Pin position={[0, note.size[1] / 2 - 0.035]} color={note.pin} />
          </Paper>
        </group>
      ))}
      {/* a spare strip of washi tape, the way boards collect them */}
      <group position={[-0.38, 0.43, z(0)]}>
        <Tape position={[0, 0]} angle={-0.12} lavender length={0.18} />
      </group>
    </group>
  );
}
