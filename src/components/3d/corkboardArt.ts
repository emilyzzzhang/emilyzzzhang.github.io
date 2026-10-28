import { seededRandom } from './textures';

/**
 * Canvas painters for the corkboard on the back wall: the cork itself, a printed weekly planner
 * written in by hand, a coding to-do sticky note, and a small reminder slip.
 */
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
type Ctx = CanvasRenderingContext2D;

const HAND = '"Caveat", "Bradley Hand", "Segoe Print", cursive';
const SANS = '"Nunito", "Helvetica Neue", Arial, sans-serif';

/** Faces these textures use; the hook loads them before the final repaint. */
export const CORKBOARD_FONTS = ['500 40px "Caveat"', '600 40px "Caveat"', '800 40px "Nunito"', '700 40px "Nunito"', '600 40px "Nunito"'] as const;

const PRINT = '#6E5A64';
const PRINT_SOFT = '#B09AA4';
const RULE = '#E4D8CC';
/** Blue-black gel pen, soft graphite, and a pink fineliner. */
const INK = '#3B3A57';
const PENCIL = 'rgba(92, 88, 98, 0.72)';
const PINK_PEN = '#D9708C';

// ---------------------------------------------------------------------------------------------
// Hand-drawn marks. Every one takes the painter's random stream, so no two come out the same.

/** Handwriting: each letter nudged a little in size, baseline and tilt. Returns where the text ends. */
export function scrawl(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, rand: () => number, weight = 500) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  let cx = x;
  for (const ch of text) {
    ctx.font = `${weight} ${size * (0.95 + rand() * 0.1)}px ${HAND}`;
    ctx.save();
    ctx.translate(cx, y + (rand() - 0.5) * size * 0.07);
    ctx.rotate(-0.03 + (rand() - 0.5) * 0.07);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += ctx.measureText(ch).width * (0.96 + rand() * 0.05);
  }
  ctx.restore();
  return cx;
}

/** A pen line through `points`, wavering slightly, with soft round ends. */
function stroke(ctx: Ctx, points: [number, number][], width: number, color: string, rand: () => number, wobble = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  const j = () => (rand() - 0.5) * wobble;
  ctx.moveTo(points[0][0] + j(), points[0][1] + j());
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    ctx.quadraticCurveTo((x0 + x1) / 2 + j() * 2, (y0 + y1) / 2 + j() * 2, x1 + j(), y1 + j());
  }
  ctx.stroke();
  ctx.restore();
}

/** A quick tick: a short dip then a long flick up, never twice the same. */
function check(ctx: Ctx, x: number, y: number, s: number, color: string, rand: () => number) {
  const dip: [number, number] = [x + s * (0.3 + rand() * 0.1), y + s * (0.42 + rand() * 0.08)];
  stroke(ctx, [[x, y + s * (rand() * 0.1)], dip, [x + s * (0.95 + rand() * 0.2), y - s * (0.55 + rand() * 0.2)]], s * (0.11 + rand() * 0.03), color, rand, s * 0.05);
}

/** A hand-drawn box whose corners don't quite meet. */
function box(ctx: Ctx, x: number, y: number, s: number, color: string, rand: () => number) {
  const c = (dx: number, dy: number): [number, number] => [x + dx * s + (rand() - 0.5) * s * 0.08, y + dy * s + (rand() - 0.5) * s * 0.08];
  stroke(ctx, [c(0.02, 0), c(1, 0.02), c(0.98, 1), c(0, 0.97), c(0.03, 0.08)], s * 0.075, color, rand, s * 0.03);
}

/** Highlighter: a translucent, slightly skewed swipe, darker where it overlaps itself. */
function highlight(ctx: Ctx, x: number, y: number, w: number, h: number, rand: () => number, color = 'rgba(246, 150, 182, 0.38)') {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  for (let pass = 0; pass < 2; pass++) {
    const dy = (rand() - 0.5) * h * 0.18;
    ctx.beginPath();
    ctx.moveTo(x + rand() * 6, y + dy + rand() * 4);
    ctx.lineTo(x + w + rand() * 10, y + dy - 3 + rand() * 4);
    ctx.lineTo(x + w + 4 + rand() * 8, y + dy + h - rand() * 4);
    ctx.lineTo(x - 4 + rand() * 6, y + dy + h + 2 - rand() * 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function heart(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.35, y - s * 0.9, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.9, x + s * 0.9, y - s * 0.3, x, y + s * 0.35);
}

/** Paper tooth: per-pixel grain and a few faint fibres, laid over everything (ink sits in the paper too). */
function grain(ctx: Ctx, w: number, h: number, seed: number, amount: number) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#8A7A70';
  ctx.lineWidth = 1;
  for (let i = 0; i < (w * h) / 6000; i++) {
    const [x, y, a, l] = [rand() * w, rand() * h, rand() * Math.PI, 6 + rand() * 18];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rand() * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.9;
  }
  ctx.putImageData(image, 0, 0);
}

/** A soft, barely-there darkening towards the sheet's edges, as on handled paper. */
function handled(ctx: Ctx, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  g.addColorStop(0, 'rgba(160, 130, 110, 0)');
  g.addColorStop(1, `rgba(160, 130, 110, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------------------------
// Cork.

/** Fine natural cork: warm tan with soft mottling and thousands of granules, light and dark. */
export const drawCork: Draw = (ctx, w, h) => {
  const rand = seededRandom(5);
  ctx.fillStyle = '#D1A87E';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const [x, y, r] = [rand() * w, rand() * h, 40 + rand() * 120];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(236, 204, 165, 0.18)' : 'rgba(168, 120, 80, 0.14)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tones = ['#B98B5E', '#A97C52', '#DDB991', '#E8CBA4', '#C4996C', '#9B6E45', '#D7B086'];
  const scale = w / 1024;
  for (let i = 0; i < 30000 * scale * scale; i++) {
    ctx.globalAlpha = 0.45 + rand() * 0.5;
    ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, (0.6 + rand() * 1.8) * scale, (0.5 + rand() * 1.2) * scale, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Small dark pits between the granules.
  ctx.fillStyle = '#7A5234';
  for (let i = 0; i < 900 * scale * scale; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.35;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, (0.8 + rand() * 1.6) * scale, (0.6 + rand()) * scale, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------------------------------------
// Month calendar: October 2026, written in through the month. Canvas 1200 × 1032.

/** Ragged, torn edges: cut a deckled band off each listed side of the canvas's alpha. */
function tear(ctx: Ctx, w: number, h: number, sides: ('top' | 'right' | 'bottom' | 'left')[], depth: number, rand: () => number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const edge = (len: number) => {
    const pts: number[] = [];
    for (let t = 0; t <= len; t += 6) pts.push(depth * (0.25 + rand() * 0.5 + 0.25 * Math.sin(t * 0.03 + rand())));
    return pts;
  };
  for (const side of sides) {
    const horizontal = side === 'top' || side === 'bottom';
    const len = horizontal ? w : h;
    const d = edge(len);
    ctx.beginPath();
    d.forEach((v, i) => {
      const t = Math.min(len, i * 6);
      if (side === 'top') ctx.lineTo(t, v);
      if (side === 'bottom') ctx.lineTo(t, h - v);
      if (side === 'left') ctx.lineTo(v, t);
      if (side === 'right') ctx.lineTo(w - v, t);
    });
    if (side === 'top') ctx.lineTo(w, 0), ctx.lineTo(0, 0);
    if (side === 'bottom') ctx.lineTo(w, h), ctx.lineTo(0, h);
    if (side === 'left') ctx.lineTo(0, h), ctx.lineTo(0, 0);
    if (side === 'right') ctx.lineTo(w, h), ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function coffeeCup(ctx: Ctx, x: number, y: number, s: number, color: string, rand: () => number) {
  // cup body, handle, saucer and two curls of steam
  stroke(ctx, [[x, y], [x + s * 0.08, y + s * 0.62], [x + s * 0.5, y + s * 0.7], [x + s * 0.82, y + s * 0.6], [x + s * 0.9, y]], s * 0.07, color, rand, s * 0.03);
  stroke(ctx, [[x - s * 0.02, y], [x + s * 0.92, y + s * 0.02]], s * 0.07, color, rand, s * 0.02);
  stroke(ctx, [[x + s * 0.88, y + s * 0.12], [x + s * 1.15, y + s * 0.2], [x + s * 1.08, y + s * 0.42], [x + s * 0.82, y + s * 0.45]], s * 0.06, color, rand, s * 0.02);
  stroke(ctx, [[x - s * 0.15, y + s * 0.82], [x + s * 0.5, y + s * 0.9], [x + s * 1.1, y + s * 0.8]], s * 0.06, color, rand, s * 0.02);
  for (const dx of [0.3, 0.58]) {
    stroke(ctx, [[x + s * dx, y - s * 0.15], [x + s * (dx + 0.08), y - s * 0.35], [x + s * (dx - 0.04), y - s * 0.55], [x + s * (dx + 0.05), y - s * 0.75]], s * 0.05, color, rand, s * 0.02);
  }
}

function paw(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.2, s * 0.32, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-0.36, -0.18], [-0.13, -0.42], [0.13, -0.42], [0.36, -0.18]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, s * 0.12, s * 0.15, dx * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const drawCalendar: Draw = (ctx, w, h) => {
  const rand = seededRandom(17);
  const s = w / 1200;
  ctx.save();
  ctx.scale(s, s);
  const [W, H] = [1200, 1032];
  ctx.fillStyle = '#FBF6EA';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = PRINT;
  ctx.font = `700 78px Georgia, "Times New Roman", serif`;
  ctx.fillText('October 2026', 90, 152);
  ctx.fillStyle = '#EBA3B7';
  ctx.fillRect(92, 172, 96, 5);

  const [x0, y0, cw] = [80, 215, 148.5];
  const rowH = 148;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  ctx.font = `600 36px Georgia, serif`;
  ctx.textAlign = 'center';
  days.forEach((d, i) => {
    ctx.fillStyle = i >= 5 ? PRINT_SOFT : PRINT;
    ctx.fillText(d, x0 + cw * i + cw / 2, y0 + 38);
  });
  ctx.textAlign = 'left';
  const top = y0 + 62;
  // Weekends tinted, then the grid.
  ctx.fillStyle = 'rgba(247, 214, 223, 0.28)';
  ctx.fillRect(x0 + cw * 5, top, cw * 2, rowH * 5);
  ctx.fillStyle = RULE;
  for (let r = 0; r <= 5; r++) ctx.fillRect(x0, top + r * rowH, cw * 7, 2.5);
  for (let c = 0; c <= 7; c++) ctx.fillRect(x0 + c * cw, top, 2.5, rowH * 5);
  ctx.fillStyle = PRINT;
  ctx.fillRect(x0, y0 + 56, cw * 7, 3);

  // 1 October 2026 is a Thursday.
  const cell = (d: number) => {
    const i = d + 2;
    return [x0 + (i % 7) * cw, top + Math.floor(i / 7) * rowH] as const;
  };
  // A pink-highlighted day, coloured in with a marker.
  const [hx, hy] = cell(8);
  highlight(ctx, hx + 10, hy + 12, cw - 22, rowH - 24, rand, 'rgba(243, 160, 184, 0.26)');
  ctx.font = `700 33px ${SANS}`;
  for (let d = 1; d <= 31; d++) {
    const [cx, cy] = cell(d);
    ctx.fillStyle = (d + 2) % 7 >= 5 ? PRINT_SOFT : PRINT;
    ctx.fillText(String(d), cx + 12, cy + 38);
  }

  const at = (d: number, dx: number, dy: number) => {
    const [cx, cy] = cell(d);
    return [cx + dx, cy + dy] as const;
  };
  // Today, ringed in pencil.
  const [tx, ty] = at(27, 26, 25);
  const ring: [number, number][] = [];
  for (let i = 0; i <= 13; i++) {
    const a = -2.2 + (i / 12) * Math.PI * 2.1;
    ring.push([tx + Math.cos(a) * (27 + rand() * 3), ty + Math.sin(a) * (22 + rand() * 3)]);
  }
  stroke(ctx, ring, 3, PENCIL, rand, 1.5);

  ctx.fillStyle = PINK_PEN;
  heart(ctx, ...at(3, 95, 95), 30);
  ctx.fill();
  // Exam prep across the 5th–6th, with an arrow.
  scrawl(ctx, 'exam', ...at(5, 20, 82), 50, INK, rand);
  scrawl(ctx, 'prep!', ...at(5, 28, 122), 50, INK, rand);
  const [ax, ay] = at(5, 20, 138);
  stroke(ctx, [[ax, ay], [ax + 130, ay - 4], [ax + 250, ay - 10]], 3, INK, rand, 2);
  stroke(ctx, [[ax + 232, ay - 22], [ax + 252, ay - 10], [ax + 234, ay + 4]], 3, INK, rand, 1);
  const [mx, my] = at(9, 22, 86);
  check(ctx, scrawl(ctx, 'mtg', mx, my, 50, INK, rand) + 6, my - 18, 26, INK, rand);
  scrawl(ctx, '10am', ...at(9, 18, 132), 48, INK, rand);
  scrawl(ctx, 'coffee', ...at(15, 12, 86), 48, INK, rand);
  coffeeCup(ctx, ...at(15, 54, 110), 32, INK, rand);
  scrawl(ctx, 'project', ...at(19, 10, 86), 46, INK, rand);
  scrawl(ctx, 'deadline', ...at(19, 10, 128), 46, INK, rand);
  ctx.strokeStyle = '#E58A3A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const [sx, sy] = at(19, 128, 56);
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 6 : 14;
    ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.stroke();
  const [ix, iy] = at(23, 10, 86);
  check(ctx, scrawl(ctx, 'interview', ix, iy, 46, INK, rand) + 4, iy - 18, 26, INK, rand);
  scrawl(ctx, '11am', ...at(23, 26, 132), 46, INK, rand);
  scrawl(ctx, 'fam', ...at(28, 30, 86), 52, INK, rand);
  ctx.fillStyle = PINK_PEN;
  heart(ctx, ...at(28, 48, 120), 24);
  ctx.fill();
  heart(ctx, ...at(28, 82, 118), 24);
  ctx.fill();
  scrawl(ctx, 'ship v2.1!', ...at(29, 8, 86), 44, INK, rand);

  handled(ctx, W, H, 0.09);
  ctx.restore();
  grain(ctx, w, h, 3, 9);
};

// ---------------------------------------------------------------------------------------------
// A little pink note of encouragement, its bottom edge torn off a pad. Canvas 600 × 706.

export const drawQuote: Draw = (ctx, w, h) => {
  const rand = seededRandom(61);
  const s = w / 600;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#F2C2C8';
  ctx.fillRect(0, 0, 600, 706);
  ctx.textAlign = 'left';
  const lines = ['small', 'progress', 'is still', 'progress'];
  lines.forEach((line, i) => {
    ctx.font = `500 90px ${HAND}`;
    const width = ctx.measureText(line).width;
    scrawl(ctx, line, 300 - width / 2 + (rand() - 0.5) * 12, 160 + i * 112, 90, INK, rand);
  });
  stroke(ctx, (() => {
    const pts: [number, number][] = [];
    for (let t = 0; t <= 1; t += 0.1) pts.push([240 + t * 26, 630 - Math.sin(t * Math.PI) * 18]);
    return pts;
  })(), 3, INK, rand, 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  heart(ctx, 250, 630, 34);
  ctx.stroke();
  heart(ctx, 352, 626, 30);
  ctx.stroke();
  handled(ctx, 600, 706, 0.08);
  ctx.restore();
  tear(ctx, w, h, ['bottom'], 22 * s, rand);
  grain(ctx, w, h, 9, 7);
};

// ---------------------------------------------------------------------------------------------
// Coding to-do sticky note. Canvas 800 × 1000; the pin goes through the top centre.

export const drawTodo: Draw = (ctx, w, h) => {
  const rand = seededRandom(29);
  const s = w / 800;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#EFC3C6';
  ctx.fillRect(0, 0, 800, 1000);
  const shade = ctx.createLinearGradient(0, 0, 0, 1000);
  shade.addColorStop(0, 'rgba(196, 140, 142, 0.12)');
  shade.addColorStop(0.2, 'rgba(196, 140, 142, 0.02)');
  shade.addColorStop(1, 'rgba(255, 240, 238, 0.14)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 800, 1000);

  scrawl(ctx, 'TO-DO', 88, 205, 122, INK, rand, 600);
  stroke(ctx, [[80, 236], [300, 242], [520, 234]], 4, INK, rand, 3);

  const items = ['Fix bugs', 'Coffee break', 'Ship it!', 'Pet Mochi', 'Plan next week'];
  items.forEach((text, i) => {
    const y = 380 + i * 134 + (rand() - 0.5) * 8;
    const x = 82 + (rand() - 0.5) * 6;
    box(ctx, x - 20, y - 62, 64, INK, rand);
    if (i < 2) check(ctx, x - 12, y - 40, 70, INK, rand);
    const end = scrawl(ctx, text, x + 70, y, 94, INK, rand);
    if (text === 'Coffee break') coffeeCup(ctx, end + 22, y - 40, 46, INK, rand);
    if (text === 'Ship it!') {
      // Rescheduled: "fri" scratched out, "mon" written after it.
      const fri = scrawl(ctx, 'fri', end + 22, y - 4, 64, INK, rand);
      stroke(ctx, [[end + 20, y - 22], [fri + 6, y - 26]], 4, INK, rand, 2);
      stroke(ctx, [[end + 22, y - 14], [fri + 4, y - 20]], 4, INK, rand, 2);
      scrawl(ctx, 'mon', fri + 14, y - 4, 64, PINK_PEN, rand, 600);
    }
    if (text === 'Pet Mochi') paw(ctx, end + 50, y - 28, 52, INK);
    if (text === 'Plan next week') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      heart(ctx, end + 32, y - 28, 34);
      ctx.stroke();
    }
  });

  // Testing the pen in the corner: a few loose loops.
  const loops: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 7;
    loops.push([590 + t * 110 + Math.cos(a) * 18, 950 + Math.sin(a) * 13 - t * 6]);
  }
  stroke(ctx, loops, 3, 'rgba(59, 58, 87, 0.7)', rand, 1);

  handled(ctx, 800, 1000, 0.08);
  ctx.restore();
  grain(ctx, w, h, 8, 7);
};

// ---------------------------------------------------------------------------------------------
// Polaroid: a pink sunset over trees and rooftops, captioned underneath. Canvas 630 × 780.

export const drawPolaroid: Draw = (ctx, w, h) => {
  const rand = seededRandom(71);
  const s = w / 630;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#FBF8F1';
  ctx.fillRect(0, 0, 630, 780);
  const [px, py, pw, ph] = [42, 42, 546, 520];
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, py, 0, py + ph);
  sky.addColorStop(0, '#9C8DB8');
  sky.addColorStop(0.35, '#D7A1B8');
  sky.addColorStop(0.6, '#F2B7A6');
  sky.addColorStop(0.75, '#F7CFA6');
  sky.addColorStop(1, '#6E5466');
  ctx.fillStyle = sky;
  ctx.fillRect(px, py, pw, ph);
  // Streaks of pink cloud.
  for (let i = 0; i < 26; i++) {
    const [cx, cy] = [px + rand() * pw, py + 60 + rand() * 230];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    g.addColorStop(0, `rgba(${rand() > 0.5 ? '250, 190, 200' : '240, 160, 180'}, 0.45)`);
    g.addColorStop(1, 'rgba(250, 190, 200, 0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(2.6, 0.45);
    ctx.translate(-cx, -cy);
    ctx.fillRect(cx - 90, cy - 90, 180, 180);
    ctx.restore();
  }
  // Rooftops and trees in silhouette, a soft haze between the layers.
  ctx.fillStyle = '#7A5E72';
  for (let x = px; x < px + pw; x += 40 + rand() * 40) {
    const bh = 60 + rand() * 90;
    ctx.fillRect(x, py + ph - 110 - bh, 30 + rand() * 40, bh + 120);
  }
  ctx.fillStyle = '#4D3B4A';
  for (let i = 0; i < 36; i++) {
    const x = px + rand() * pw;
    const r = 18 + rand() * 34;
    const y = py + ph - 70 - rand() * 80 * (Math.abs(x - px - pw * 0.3) / pw);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(px, py + ph - 70, pw, 70);
  ctx.fillStyle = 'rgba(247, 200, 170, 0.35)';
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.45, py + ph);
  ctx.lineTo(px + pw * 0.55, py + ph - 70);
  ctx.lineTo(px + pw * 0.6, py + ph - 70);
  ctx.lineTo(px + pw * 0.8, py + ph);
  ctx.fill();
  // A faint gloss across the print.
  const gloss = ctx.createLinearGradient(px, py, px + pw, py + ph);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  scrawl(ctx, 'good views', 90, 650, 74, INK, rand);
  const end = scrawl(ctx, 'better days', 150, 735, 74, INK, rand);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  heart(ctx, end + 28, 712, 32);
  ctx.stroke();
  handled(ctx, 630, 780, 0.06);
  ctx.restore();
  grain(ctx, w, h, 14, 6);
};

// ---------------------------------------------------------------------------------------------
// A torn page of sketches: a laptop doodle, scribbled notes and a list of ideas. Canvas 990 × 720.

export const drawSketch: Draw = (ctx, w, h) => {
  const rand = seededRandom(83);
  const s = w / 990;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#F8F2E5';
  ctx.fillRect(0, 0, 990, 720);
  // Scribbled notes, too quick to read.
  for (let i = 0; i < 5; i++) {
    const y = 120 + i * 46;
    const len = 90 + rand() * 80;
    const pts: [number, number][] = [];
    for (let t = 0; t <= len; t += 12) pts.push([70 + t, y + Math.sin(t * 0.3 + i) * 6]);
    stroke(ctx, pts, 3, PENCIL, rand, 3);
  }
  // Laptop, in pencil: a screen in a bezel, then the base in perspective.
  const L = (pts: [number, number][]) => stroke(ctx, pts, 3.5, 'rgba(70, 66, 78, 0.85)', rand, 2.5);
  L([[310, 200], [560, 196], [566, 390], [306, 394], [310, 200]]);
  L([[330, 218], [544, 215], [548, 372], [326, 376], [330, 218]]);
  L([[306, 394], [250, 470], [622, 466], [566, 390]]);
  L([[250, 470], [252, 482], [620, 478], [622, 466]]);
  for (let r = 0; r < 3; r++) L([[300 + r * 6, 412 + r * 16], [560 - r * 4, 410 + r * 16]]);
  L([[400, 458], [470, 457]]);
  // A tiny leaf sprig.
  L([[150, 610], [180, 560]]);
  for (const [dx, dy, a] of [[-14, -20, -0.6], [12, -30, 0.5], [-4, -46, -0.2]]) {
    ctx.save();
    ctx.translate(180 + dx, 560 + dy + 30);
    ctx.rotate(a);
    ctx.strokeStyle = 'rgba(70, 66, 78, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -16, 9, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  scrawl(ctx, 'studio', 660, 190, 70, INK, rand);
  scrawl(ctx, 'ideas:', 660, 258, 70, INK, rand);
  ['- lighting', '- bookshelf', '- plants', '- ??'].forEach((line, i) => scrawl(ctx, line, 670, 350 + i * 80, 62, INK, rand));
  handled(ctx, 990, 720, 0.08);
  ctx.restore();
  tear(ctx, w, h, ['top', 'right'], 18 * s, rand);
  grain(ctx, w, h, 22, 7);
};

// ---------------------------------------------------------------------------------------------
// A small print of pale pink tulips, white-bordered. Canvas 600 × 750.

export const drawTulips: Draw = (ctx, w, h) => {
  const rand = seededRandom(97);
  const s = w / 600;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#FBF9F5';
  ctx.fillRect(0, 0, 600, 750);
  const [px, py, pw, ph] = [34, 34, 532, 682];
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, py, 0, py + ph);
  bg.addColorStop(0, '#F3E6E4');
  bg.addColorStop(0.6, '#E7E2D2');
  bg.addColorStop(1, '#B9C9A6');
  ctx.fillStyle = bg;
  ctx.fillRect(px, py, pw, ph);
  // Out-of-focus blooms and leaves behind.
  for (let i = 0; i < 18; i++) {
    const [cx, cy, r] = [px + rand() * pw, py + rand() * ph, 40 + rand() * 80];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(240, 196, 204, 0.5)' : 'rgba(170, 196, 150, 0.45)');
    g.addColorStop(1, 'rgba(240, 196, 204, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const tulips: [number, number, number][] = [
    [190, 250, 1],
    [380, 220, 0.95],
    [290, 400, 1.1],
    [150, 520, 0.9],
    [430, 480, 1],
  ];
  for (const [tx, ty, k] of tulips) {
    // stem and a long leaf
    ctx.strokeStyle = '#8FAF7C';
    ctx.lineWidth = 10 * k;
    ctx.beginPath();
    ctx.moveTo(tx, ty + 40 * k);
    ctx.quadraticCurveTo(tx + 10, ty + 300, tx - 10 + rand() * 20, py + ph + 20);
    ctx.stroke();
    ctx.fillStyle = 'rgba(132, 168, 112, 0.85)';
    ctx.beginPath();
    ctx.ellipse(tx + 26 * k, ty + 220 * k, 18 * k, 110 * k, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // three cupped petals, shaded pale to blush at the base
    for (const [dx, rot, light] of [[-24, -0.18, 0.92], [24, 0.18, 0.92], [0, 0, 1]] as const) {
      const g = ctx.createLinearGradient(tx, ty - 60 * k, tx, ty + 50 * k);
      g.addColorStop(0, `rgba(253, 236, 238, ${light})`);
      g.addColorStop(1, `rgba(236, 168, 184, ${light})`);
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(tx + dx * k, ty);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 34 * k, 60 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  handled(ctx, 600, 750, 0.06);
  ctx.restore();
  grain(ctx, w, h, 31, 6);
};

/** Gingham washi tape in `stripe` over translucent white, its ends snipped in zigzags. Canvas 400 × 120. */
export function tapeArt(stripe: string): Draw {
  return (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 248, 248, 0.82)';
    ctx.fillRect(0, 0, w, h);
    const step = w / 20;
    ctx.fillStyle = stripe;
    for (let x = 0; x < w; x += step * 2) ctx.fillRect(x, 0, step, h);
    for (let y = 0; y < h; y += step * 2) ctx.fillRect(0, y, w, step);
    ctx.globalCompositeOperation = 'destination-out';
    for (const side of [0, 1]) {
      ctx.beginPath();
      const x = side ? w : 0;
      const dir = side ? -1 : 1;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += h / 6) ctx.lineTo(x + dir * ((y / (h / 6)) % 2 ? 10 : 0), y);
      ctx.lineTo(x, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };
}

export const drawTape = tapeArt('rgba(236, 150, 170, 0.34)');

/** `draw`, then paper grain over the result (for painters that don't add their own). */
export const withGrain =
  (draw: Draw, seed: number, amount = 7): Draw =>
  (ctx, w, h) => {
    draw(ctx, w, h);
    grain(ctx, w, h, seed, amount);
  };

// ---------------------------------------------------------------------------------------------
// A ruled index card of goals for the year. Canvas 900 × 554.

export const drawGoals: Draw = (ctx, w, h) => {
  const rand = seededRandom(53);
  const s = w / 900;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#FDFBF6';
  ctx.fillRect(0, 0, 900, 554);
  ctx.fillStyle = 'rgba(226, 120, 140, 0.55)';
  ctx.fillRect(0, 126, 900, 3);
  ctx.fillStyle = 'rgba(140, 180, 220, 0.45)';
  for (let y = 222; y < 554; y += 96) ctx.fillRect(0, y, 900, 2);
  scrawl(ctx, '2026 goals', 56, 104, 110, INK, rand, 600);
  const goals: [string, boolean][] = [
    ['graduate!', true],
    ['land a SWE role', true],
    ['ship portfolio v2', false],
    ['visit Tokyo', false],
  ];
  goals.forEach(([goal, done], i) => {
    const y = 210 + i * 96;
    box(ctx, 58, y - 56, 56, INK, rand);
    if (done) check(ctx, 64, y - 36, 62, INK, rand);
    const end = scrawl(ctx, goal, 146, y, 86, INK, rand);
    if (goal === 'visit Tokyo') {
      ctx.fillStyle = PINK_PEN;
      heart(ctx, end + 38, y - 28, 32);
      ctx.fill();
    }
  });
  handled(ctx, 900, 554, 0.07);
  ctx.restore();
  grain(ctx, w, h, 57, 6);
};

// ---------------------------------------------------------------------------------------------
// A reminder slip torn from a notepad, its ripped top edge cut out of the canvas's alpha.

export const drawSlip: Draw = (ctx, w, h) => {
  const rand = seededRandom(43);
  const s = w / 640;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#FAF1DA';
  ctx.fillRect(0, 0, 640, 260);
  ctx.fillStyle = 'rgba(160, 190, 220, 0.5)';
  for (const y of [148, 222]) ctx.fillRect(0, y, 640, 2);
  scrawl(ctx, 'Mochi vet!', 30, 136, 84, INK, rand, 600);
  scrawl(ctx, 'Thu · 4pm', 42, 218, 66, INK, rand);
  handled(ctx, 640, 260, 0.1);

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= 640; x += 8) ctx.lineTo(x, 6 + rand() * 12 + Math.sin(x * 0.05) * 3);
  ctx.lineTo(640, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  grain(ctx, w, h, 12, 7);
};
