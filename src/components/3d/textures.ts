import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { sceneColors as c } from '../../config/theme';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const NO_FONTS: readonly string[] = [];

const HEADING_FONT = '"Nunito", "Helvetica Neue", Arial, sans-serif';

/**
 * Paints a texture procedurally so the room needs no image assets. Repaints once web fonts
 * are ready, since canvas text drawn earlier falls back to a system font. `fonts` (CSS font
 * shorthands) are loaded first: a face nothing on the page uses yet isn't fetched by itself.
 */
export function useCanvasTexture(draw: Draw, width: number, height: number, fonts: readonly string[] = NO_FONTS): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    paint(tex, draw);
    return tex;
  }, [draw, width, height]);

  useEffect(() => {
    let alive = true;
    const loads = document.fonts ? fonts.map((font) => document.fonts.load(font).catch(() => [])) : [];
    Promise.all([...loads, document.fonts?.ready]).then(() => {
      if (!alive) return;
      paint(texture, draw);
      texture.needsUpdate = true;
    });
    return () => {
      alive = false;
      texture.dispose();
    };
  }, [texture, draw, fonts]);

  return texture;
}

function paint(texture: CanvasTexture, draw: Draw) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  draw(ctx, canvas.width, canvas.height);
}

/** Deterministic pseudo-random numbers so procedural details don't change between loads. */
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawHills(ctx: CanvasRenderingContext2D, w: number, h: number, colors: [string, string, string]) {
  const hill = (color: string, base: number, amp: number, phase: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      ctx.lineTo(x, h * base - Math.sin((x / w) * Math.PI * 1.6 + phase) * h * amp);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  };
  hill(colors[0], 0.66, 0.06, 0.4);
  hill(colors[1], 0.76, 0.05, 2.2);
  hill(colors[2], 0.88, 0.04, 4.1);
}

function drawTrees(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const rand = seededRandom(3);
  ctx.fillStyle = color;
  for (let i = 0; i < 7; i++) {
    const x = (0.08 + rand() * 0.84) * w;
    const y = h * (0.7 + rand() * 0.12);
    const s = (8 + rand() * 8) * (w / 512);
    ctx.beginPath();
    ctx.ellipse(x, y - s, s * 0.8, s * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x - r * 1.1, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

export const drawDaySky: Draw = (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#C4DCF0');
  sky.addColorStop(0.5, '#F6DCE3');
  sky.addColorStop(1, '#FFF0E4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.68, h * 0.4, 10, w * 0.68, h * 0.4, w * 0.35);
  glow.addColorStop(0, 'rgba(255, 240, 214, 0.95)');
  glow.addColorStop(1, 'rgba(255, 240, 214, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF4DE';
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.4, w * 0.075, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 253, 251, 0.95)';
  drawCloud(ctx, w * 0.22, h * 0.2, 26 * (w / 512));
  drawCloud(ctx, w * 0.8, h * 0.14, 18 * (w / 512));
  drawCloud(ctx, w * 0.45, h * 0.3, 14 * (w / 512));

  drawHills(ctx, w, h, ['#D3E0D2', '#BCD0BD', '#A9C2AB']);
  drawTrees(ctx, w, h, '#8FAE95');
};

export const drawNightSky: Draw = (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2F2C55');
  sky.addColorStop(0.55, '#6A5A91');
  sky.addColorStop(1, '#C69BB8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const rand = seededRandom(19);
  for (let i = 0; i < 70; i++) {
    const r = rand() * 1.8 + 0.6;
    ctx.fillStyle = `rgba(255, 248, 235, ${0.4 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h * 0.6, r * (w / 512), 0, Math.PI * 2);
    ctx.fill();
  }

  const mx = w * 0.7;
  const my = h * 0.26;
  const mr = w * 0.08;
  const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2);
  halo.addColorStop(0, 'rgba(236, 230, 255, 0.55)');
  halo.addColorStop(1, 'rgba(236, 230, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF6E6';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  // carve a crescent with the sky colour behind it
  ctx.fillStyle = '#3F3866';
  ctx.beginPath();
  ctx.arc(mx + mr * 0.45, my - mr * 0.25, mr * 0.85, 0, Math.PI * 2);
  ctx.fill();

  drawHills(ctx, w, h, ['#5B5482', '#4C4770', '#3D3A5C']);
  drawTrees(ctx, w, h, '#34324F');
  // a few lit windows on the far hills
  for (const [x, y] of [[0.3, 0.71], [0.33, 0.715], [0.78, 0.74]]) {
    ctx.fillStyle = '#FFD9A0';
    ctx.fillRect(x * w, y * h, 5 * (w / 512), 5 * (w / 512));
  }
};

/** A single sleepy "z" for the sprites floating above Mochi. */
export const drawZ: Draw = (ctx, w, h) => {
  ctx.font = `700 ${Math.round(h * 0.8)}px ${HEADING_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = h * 0.12;
  ctx.strokeStyle = 'rgba(255, 253, 251, 0.95)';
  ctx.strokeText('z', w / 2, h / 2);
  ctx.fillStyle = '#C45E86';
  ctx.fillText('z', w / 2, h / 2);
};

/**
 * Light cookie for the window sunbeam: the window's panes with their glazing bars, soft-edged,
 * sized to sit inside the spotlight's round cone.
 */
export const drawSunCookie: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${Math.round(w * 0.006)}px)`;
  ctx.fillStyle = '#fff';
  const pw = w * 0.66;
  const ph = h * 0.6;
  const x0 = (w - pw) / 2;
  const y0 = (h - ph) / 2;
  ctx.fillRect(x0, y0, pw, ph);
  // Glazing bars: a centre upright and a transom just above the middle, as on the window.
  ctx.fillStyle = '#000';
  const bar = w * 0.03;
  ctx.fillRect(w / 2 - bar / 2, y0, bar, ph);
  ctx.fillRect(x0, y0 + ph * 0.41 - bar / 2, pw, bar);
  ctx.filter = 'none';
};

/** A soft light shaft: brightest by the window, fading along its length and at its edges, with a few faint streaks. */
export const drawSunShaft: Draw = (ctx, w, h) => {
  const rand = seededRandom(23);
  const streaks = [0.2, 0.4, 0.6, 0.8].map((c) => c + (rand() - 0.5) * 0.08);
  ctx.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x++) {
    const u = x / w;
    const edge = Math.sin(Math.PI * u) ** 1.5;
    let streak = 0.75;
    for (const c of streaks) streak += 0.25 * Math.exp(-(((u - c) / 0.05) ** 2));
    const along = ctx.createLinearGradient(0, 0, 0, h);
    const a = edge * streak;
    along.addColorStop(0, `rgba(255,255,255,0)`);
    along.addColorStop(0.08, `rgba(255,255,255,${a})`);
    along.addColorStop(0.55, `rgba(255,255,255,${a * 0.45})`);
    along.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = along;
    ctx.fillRect(x, 0, 1, h);
  }
};

/** Soft round falloff used for additive glow halos (fairy lights, lamp, screen backlight). */
export const drawGlow: Draw = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** One abstract print per internship, hung above the desk. */
export const drawArt: Draw[] = [
  // Concentric rings and a visor shape — a nod to XR.
  (ctx, w, h) => {
    ctx.fillStyle = '#EFE8F8';
    ctx.fillRect(0, 0, w, h);
    for (let i = 5; i > 0; i--) {
      ctx.fillStyle = i % 2 ? c.lavender : '#DCD0F0';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.45, i * w * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = c.charcoal;
    roundRect(ctx, w * 0.24, h * 0.38, w * 0.52, h * 0.14, h * 0.07);
    ctx.fillStyle = c.pink;
    roundRect(ctx, w * 0.28, h * 0.405, w * 0.19, h * 0.09, h * 0.045);
    roundRect(ctx, w * 0.53, h * 0.405, w * 0.19, h * 0.09, h * 0.045);
    ctx.fillStyle = c.roseDeep;
    roundRect(ctx, w * 0.2, h * 0.78, w * 0.6, h * 0.035, 8);
  },
  // An isometric cube with layered faces — a nod to 3D scenes and USD layers.
  (ctx, w, h) => {
    ctx.fillStyle = '#FBEDEF';
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.46;
    const s = w * 0.26;
    const face = (pts: number[][], color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };
    face([[cx, cy - s], [cx + s, cy - s / 2], [cx, cy], [cx - s, cy - s / 2]], '#FFFDFB');
    face([[cx - s, cy - s / 2], [cx, cy], [cx, cy + s], [cx - s, cy + s / 2]], c.pink);
    face([[cx, cy], [cx + s, cy - s / 2], [cx + s, cy + s / 2], [cx, cy + s]], c.roseDeep);
    ctx.strokeStyle = 'rgba(58, 52, 64, 0.2)';
    ctx.lineWidth = 3;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s / 2 + (i * s) / 3);
      ctx.lineTo(cx, cy + (i * s) / 3);
      ctx.lineTo(cx + s, cy - s / 2 + (i * s) / 3);
      ctx.stroke();
    }
    ctx.fillStyle = c.lavender;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.18, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
  },
  // Rising bars on a grid — a nod to infrastructure and data.
  (ctx, w, h) => {
    ctx.fillStyle = '#FBEFE6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(58, 52, 64, 0.1)';
    ctx.lineWidth = 2;
    for (let y = h * 0.2; y < h * 0.85; y += h * 0.1) {
      ctx.beginPath();
      ctx.moveTo(w * 0.12, y);
      ctx.lineTo(w * 0.88, y);
      ctx.stroke();
    }
    const bars = [0.3, 0.45, 0.38, 0.6, 0.72];
    const bw = (w * 0.7) / bars.length;
    bars.forEach((v, i) => {
      ctx.fillStyle = i === bars.length - 1 ? c.roseDeep : i % 2 ? c.peachDeep : '#F3D3C1';
      roundRect(ctx, w * 0.15 + i * bw, h * 0.82 - v * h * 0.6, bw * 0.7, v * h * 0.6, 10);
    });
    ctx.fillStyle = c.lavenderDeep;
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.18, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
  },
];

export const drawEnvelope: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#FFFBF7';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(229, 154, 177, 0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(w / 2, h * 0.6);
  ctx.lineTo(w - 4, 4);
  ctx.moveTo(4, h - 4);
  ctx.lineTo(w * 0.4, h * 0.5);
  ctx.moveTo(w - 4, h - 4);
  ctx.lineTo(w * 0.6, h * 0.5);
  ctx.stroke();
  ctx.fillStyle = c.lavender;
  ctx.fillRect(w * 0.78, h * 0.62, w * 0.14, h * 0.26);
  ctx.strokeStyle = '#FFFBF7';
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(w * 0.79, h * 0.635, w * 0.12, h * 0.23);
};
