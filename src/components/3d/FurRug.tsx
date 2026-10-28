import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute, MeshPhysicalMaterial, Vector3 } from 'three';
import { ANCHORS, PLACEMENTS, RUG_FUR } from '../../config/sceneLayout';
import { CHAIR_WHEELS } from './Chair';

const { radius, base, length, layers } = RUG_FUR;
const radiusX = radius;
const radiusZ = radius;
/** Fibres per world unit: fine across the combed direction, longer cells along it, for silky strands. */
const DENSITY_ACROSS = 70;
const DENSITY_ALONG = 22;
const RINGS = 26;
const EDGE_RINGS = 7;
const SEGMENTS = 144;

/** The faintest wobble, so the circle reads as natural fur rather than a cut disc. */
const wobble = (theta: number) => 1 + 0.012 * Math.sin(3 * theta + 0.6) + 0.008 * Math.sin(7 * theta + 2.1);

/**
 * The cushion's surface as a polar grid: a flat top easing over a quarter-round edge down to the
 * floor. Each sample is a rest point and its outward normal; fur shells are offset along the normal.
 */
function surface() {
  const points: { p: Vector3; n: Vector3 }[] = [];
  for (let i = 0; i <= RINGS + EDGE_RINGS; i++) {
    for (let j = 0; j <= SEGMENTS; j++) {
      const theta = (j / SEGMENTS) * Math.PI * 2;
      const w = wobble(theta);
      const rx = radiusX * w;
      const rz = radiusZ * w;
      // Radial distance along the major axis, in world units, then scaled per axis.
      let radial: number;
      let y: number;
      let nr: number;
      let ny: number;
      if (i <= RINGS) {
        radial = (i / RINGS) * (1 - base / rx);
        y = base;
        nr = 0;
        ny = 1;
      } else {
        const phi = ((i - RINGS) / EDGE_RINGS) * (Math.PI / 2);
        radial = 1 - base / rx + (Math.sin(phi) * base) / rx;
        y = Math.cos(phi) * base;
        nr = Math.sin(phi);
        ny = Math.cos(phi);
      }
      const cx = Math.cos(theta);
      const sz = Math.sin(theta);
      const p = new Vector3(cx * rx * radial, y, sz * rz * radial);
      const n = new Vector3(cx * nr, ny, sz * nr * (rx / rz)).normalize();
      points.push({ p, n });
    }
  }
  return points;
}

/** The cushion (layer 0) and its fur shells (layers 1..N), merged into one geometry and one draw call. */
function rugGeometry() {
  const grid = surface();
  const cols = SEGMENTS + 1;
  const rows = RINGS + EDGE_RINGS + 1;
  const positions: number[] = [];
  const normals: number[] = [];
  const rest: number[] = [];
  const layer: number[] = [];
  const index: number[] = [];
  for (let l = 0; l <= layers; l++) {
    const h = l / layers;
    const offset = positions.length / 3;
    for (const { p, n } of grid) {
      positions.push(p.x + n.x * h * length, p.y + n.y * h * length, p.z + n.z * h * length);
      normals.push(n.x, n.y, n.z);
      rest.push(p.x, p.y, p.z);
      layer.push(h);
    }
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = offset + i * cols + j;
        const b = a + cols;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aRest', new Float32BufferAttribute(rest, 3));
  geometry.setAttribute('aLayer', new Float32BufferAttribute(layer, 1));
  geometry.setIndex(index);
  return geometry;
}

/** Circles (rug-local x, z, radius, strength) where furniture presses into the pile and shades it. */
function occluders(): number[] {
  const [rx, , rz] = ANCHORS.rug;
  const local = (x: number, z: number) => [x - rx, z - rz];
  const out: number[][] = [];
  const { position: [cx, , cz], rotationY = 0 } = PLACEMENTS.chair;
  out.push([...local(cx, cz), 0.5, 0.35]);
  for (let i = 0; i < CHAIR_WHEELS.count; i++) {
    const a = (i / CHAIR_WHEELS.count) * Math.PI * 2 + rotationY;
    out.push([...local(cx + Math.sin(a) * CHAIR_WHEELS.reach, cz + Math.cos(a) * CHAIR_WHEELS.reach), 0.07, 0.8]);
  }
  return out.flat();
}

const OCCLUDERS = occluders();
const OCCLUDER_COUNT = OCCLUDERS.length / 4;

function furMaterial() {
  const material = new MeshPhysicalMaterial({
    color: RUG_FUR.color,
    roughness: 1,
    // Silky: a soft, fairly tight sheen along the combed fibres.
    sheen: 1,
    sheenRoughness: 0.38,
    sheenColor: new Color('#FFF1EC'),
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOccluders = { value: OCCLUDERS };
    shader.uniforms.uBlush = { value: new Color(RUG_FUR.blush) };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aRest;
        attribute float aLayer;
        varying vec3 vRest;
        varying float vLayer;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRest = aRest;
        vLayer = aLayer;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        varying float vLayer;
        uniform float uOccluders[${OCCLUDER_COUNT * 4}];
        uniform vec3 uBlush;
        float furHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float furNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(furHash(i), furHash(i + vec2(1.0, 0.0)), u.x), mix(furHash(i + vec2(0.0, 1.0)), furHash(i + 1.0), u.x), u.y);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float h = vLayer;
        // Combed fur: strands lie over in a gently swirling flow, like a sheepskin.
        vec2 base2 = vRest.xz + vec2(0.0, vRest.y * 0.6);
        float angle = 0.7 + (furNoise(vRest.xz * 0.9) - 0.5) * 1.6;
        vec2 flow = vec2(cos(angle), sin(angle));
        vec2 across = vec2(-flow.y, flow.x);
        // As a strand rises it travels along the flow, so it reads as lying down rather than standing up.
        vec2 pos = base2 - flow * h * 0.16;
        vec2 q = vec2(dot(pos, across) * ${DENSITY_ACROSS.toFixed(1)}, dot(pos, flow) * ${DENSITY_ALONG.toFixed(1)});
        vec2 cell = floor(q);
        vec2 f = fract(q) - 0.5;
        float r1 = furHash(cell);
        float r2 = furHash(cell + 7.13);
        float r3 = furHash(cell + 3.71);
        float strandLength = 0.78 + 0.22 * r1;
        if (h > 0.0) {
          if (h > strandLength) discard;
          float t = h / strandLength;
          float width = 0.5 * (1.0 - 0.6 * t * t);
          if (abs(f.x - (r2 - 0.5) * 0.3) > width) discard;
        }
        // Gentle self-shadowing only, for a smooth, even surface; a few strands lean blush.
        float depth = h > 0.0 ? h / strandLength : 0.0;
        float ao = mix(0.74, 1.03, smoothstep(0.0, 1.0, depth) * 0.5 + h * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBlush, step(0.82, r3) * 0.35) * ao;
        // Pressed and shaded where furniture stands on the pile.
        float shade = 0.0;
        for (int k = 0; k < ${OCCLUDER_COUNT}; k++) {
          vec2 c = vec2(uOccluders[k * 4], uOccluders[k * 4 + 1]);
          float r = uOccluders[k * 4 + 2];
          float d = length(vRest.xz - c);
          shade = max(shade, (1.0 - smoothstep(r * 0.6, r + 0.12, d)) * uOccluders[k * 4 + 3]);
        }
        diffuseColor.rgb *= 1.0 - 0.42 * shade * (1.0 - h * 0.5);`,
      );
  };
  return material;
}

/** Plush faux-fur rug: a soft cushion with layered fur shells. Origin: the rug's centre on the floor. */
export function FurRug() {
  const geometry = useMemo(rugGeometry, []);
  const material = useMemo(furMaterial, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  // Shells cut fibres with discard, which the shadow pass can't see, so the rug only receives shadows.
  return <mesh geometry={geometry} material={material} receiveShadow userData={{ noShadow: true }} raycast={() => null} />;
}

