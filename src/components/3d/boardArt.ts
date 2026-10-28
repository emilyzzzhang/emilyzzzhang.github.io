import { MOCHI } from '../../config/mochi';
import { sceneColors as c } from '../../config/theme';
import { experience } from '../../data/experience';
import { education, profile } from '../../data/profile';
import { projects } from '../../data/projects';
import { scrawl } from './corkboardArt';
import { seededRandom } from './textures';

/** Canvas painters for the pinned items on the inspiration board. */
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const HAND = '"Caveat", "Bradley Hand", "Segoe Print", cursive';
const SANS = '"Nunito", "Helvetica Neue", Arial, sans-serif';
const HEADING = '"Nunito", "Helvetica Neue", Arial, sans-serif';
const INK = '#3A3440';

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.35, y - s * 0.9, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.9, x + s * 0.9, y - s * 0.3, x, y + s * 0.35);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** A miniature résumé built from the portfolio's own data. */
export const drawMiniResume: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#FFFBF4';
  ctx.fillRect(0, 0, w, h);
  const pad = w * 0.09;
  let y = h * 0.11;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(w * 0.105)}px ${HEADING}`;
  ctx.fillText(profile.fullName, w / 2, y);
  y += h * 0.045;
  ctx.fillStyle = c.roseDeep;
  ctx.fillRect(w * 0.3, y, w * 0.4, 3);
  ctx.textAlign = 'left';

  const section = (title: string, lines: string[]) => {
    y += h * 0.07;
    ctx.fillStyle = '#A23F66';
    ctx.font = `700 ${Math.round(w * 0.058)}px ${HEADING}`;
    ctx.fillText(title.toUpperCase(), pad, y);
    ctx.fillStyle = 'rgba(58, 52, 64, 0.18)';
    ctx.fillRect(pad, y + 6, w - pad * 2, 1.5);
    ctx.font = `500 ${Math.round(w * 0.047)}px ${SANS}`;
    for (const line of lines) {
      y += h * 0.05;
      ctx.fillStyle = INK;
      ctx.fillText(line, pad, y);
      // a faint "bullet text" line under each entry, as on a real résumé
      ctx.fillStyle = 'rgba(58, 52, 64, 0.16)';
      ctx.fillRect(pad + 4, y + h * 0.017, (w - pad * 2) * 0.82, 3);
    }
  };
  section(
    'Experience',
    experience.map((e) => e.company),
  );
  section('Education', [education.institution, 'BSc Computer Science & AI']);
  const skills = [...new Set(projects.flatMap((p) => p.tags))].slice(0, 6);
  section('Skills', [skills.slice(0, 3).join(' · '), skills.slice(3, 6).join(' · ')]);
};

/** Keepsake postcard: McGill's Arts Building under a soft pink sky, with a handwritten caption. */
export const drawPostcard: Draw = (ctx, w, h) => {
  const border = w * 0.04;
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(0, 0, w, h);
  const iw = w - border * 2;
  const ih = h - border * 2 - h * 0.17;
  ctx.save();
  ctx.translate(border, border);
  ctx.beginPath();
  ctx.rect(0, 0, iw, ih);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, 0, 0, ih);
  sky.addColorStop(0, '#F7D3DD');
  sky.addColorStop(1, '#FCEBDD');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, iw, ih);
  // lawn and path
  ctx.fillStyle = '#B9D0A6';
  ctx.fillRect(0, ih * 0.76, iw, ih * 0.24);
  ctx.fillStyle = '#EADCCB';
  ctx.beginPath();
  ctx.moveTo(iw * 0.44, ih * 0.76);
  ctx.lineTo(iw * 0.56, ih * 0.76);
  ctx.lineTo(iw * 0.7, ih);
  ctx.lineTo(iw * 0.3, ih);
  ctx.fill();
  // the Arts Building: wings, a columned portico, pediment and a little cupola
  const stone = '#E4DDD3';
  const shade = '#C9BFB3';
  ctx.fillStyle = stone;
  ctx.fillRect(iw * 0.14, ih * 0.38, iw * 0.72, ih * 0.38);
  ctx.fillStyle = shade;
  ctx.fillRect(iw * 0.14, ih * 0.38, iw * 0.72, ih * 0.03);
  for (const x of [0.18, 0.27, 0.66, 0.75]) {
    ctx.fillStyle = '#9DAEC3';
    ctx.fillRect(iw * x, ih * 0.47, iw * 0.05, ih * 0.1);
    ctx.fillRect(iw * x, ih * 0.62, iw * 0.05, ih * 0.1);
  }
  ctx.fillStyle = stone;
  ctx.fillRect(iw * 0.36, ih * 0.33, iw * 0.28, ih * 0.43);
  ctx.beginPath();
  ctx.moveTo(iw * 0.34, ih * 0.34);
  ctx.lineTo(iw * 0.5, ih * 0.22);
  ctx.lineTo(iw * 0.66, ih * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade;
  for (let i = 0; i < 5; i++) ctx.fillRect(iw * (0.385 + i * 0.054), ih * 0.37, iw * 0.018, ih * 0.36);
  ctx.fillStyle = stone;
  ctx.fillRect(iw * 0.465, ih * 0.13, iw * 0.07, ih * 0.1);
  ctx.beginPath();
  ctx.arc(iw * 0.5, ih * 0.13, iw * 0.04, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#B8C9A8';
  ctx.fillRect(iw * 0.496, ih * 0.04, iw * 0.008, ih * 0.06);
  // blossom trees either side
  for (const [x, r] of [[0.07, 0.13], [0.94, 0.12], [0.02, 0.09]] as const) {
    ctx.fillStyle = '#8C6A55';
    ctx.fillRect(iw * x - 3, ih * 0.6, 6, ih * 0.18);
    ctx.fillStyle = '#F2B7C8';
    ctx.beginPath();
    ctx.arc(iw * x, ih * 0.55, iw * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(iw * x - iw * r * 0.3, ih * 0.5, iw * r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // caption on the right, clear of the Polaroid pinned over the card's left edge
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#A23F66';
  ctx.font = `600 ${Math.round(h * 0.15)}px ${HAND}`;
  ctx.fillText('McGill', w - border - 4, h - h * 0.1);
  const captionW = ctx.measureText('McGill').width;
  ctx.fillStyle = 'rgba(58, 52, 64, 0.55)';
  ctx.font = `500 ${Math.round(h * 0.06)}px ${SANS}`;
  ctx.fillText('Montréal', w - border - captionW - 16, h - h * 0.095);
};

/** Polaroid of Mochi curled up asleep, painted from her colours and markings in config/mochi.ts. */
export const drawPolaroid: Draw = (ctx, w, h) => {
  const { colors, markings } = MOCHI;
  ctx.fillStyle = '#FFFEFB';
  ctx.fillRect(0, 0, w, h);
  const b = w * 0.07;
  const iw = w - b * 2;
  const ih = iw;
  ctx.save();
  ctx.translate(b, b);
  ctx.beginPath();
  ctx.rect(0, 0, iw, ih);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, ih);
  bg.addColorStop(0, '#F6E6E3');
  bg.addColorStop(1, '#EED7D2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, iw, ih);
  const cx = iw * 0.5;
  const cy = ih * 0.6;
  // cushion
  ctx.fillStyle = '#F2B7C8';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ih * 0.12, iw * 0.44, ih * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F7C7D7';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ih * 0.1, iw * 0.36, ih * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail curling round the front
  ctx.strokeStyle = colors.tail;
  ctx.lineCap = 'round';
  ctx.lineWidth = iw * 0.075;
  ctx.beginPath();
  ctx.arc(cx, cy + ih * 0.02, iw * 0.24, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (markings.tailTip) {
    ctx.strokeStyle = colors.tailTip;
    ctx.beginPath();
    ctx.arc(cx, cy + ih * 0.02, iw * 0.24, Math.PI * 0.78, Math.PI * 0.86);
    ctx.stroke();
  }
  // body
  ctx.fillStyle = colors.furBase;
  ctx.beginPath();
  ctx.ellipse(cx + iw * 0.05, cy - ih * 0.02, iw * 0.26, ih * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  if (markings.backPatch) {
    ctx.fillStyle = colors.furSecondary;
    ctx.beginPath();
    ctx.ellipse(cx + iw * 0.1, cy - ih * 0.1, iw * 0.17, ih * 0.08, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  // head, ears, sleepy face
  const hx = cx - iw * 0.17;
  const hy = cy - ih * 0.08;
  const hr = iw * 0.14;
  for (const side of [-1, 1]) {
    ctx.fillStyle = markings.headCap ? colors.furSecondary : colors.furBase;
    ctx.beginPath();
    ctx.moveTo(hx + side * hr * 0.85, hy - hr * 0.2);
    ctx.lineTo(hx + side * hr * 0.6, hy - hr * 1.25);
    ctx.lineTo(hx + side * hr * 0.05, hy - hr * 0.75);
    ctx.fill();
    ctx.fillStyle = colors.earInner;
    ctx.beginPath();
    ctx.moveTo(hx + side * hr * 0.7, hy - hr * 0.45);
    ctx.lineTo(hx + side * hr * 0.58, hy - hr * 1.0);
    ctx.lineTo(hx + side * hr * 0.25, hy - hr * 0.72);
    ctx.fill();
  }
  ctx.fillStyle = colors.furBase;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  if (markings.headCap) {
    ctx.fillStyle = colors.furSecondary;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, Math.PI * 1.08, Math.PI * 1.92);
    ctx.fill();
  }
  ctx.strokeStyle = colors.pupils;
  ctx.lineWidth = iw * 0.012;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + side * hr * 0.4, hy + hr * 0.05, hr * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  if (markings.cheekBlush) {
    ctx.fillStyle = colors.cheeks;
    ctx.globalAlpha = 0.7;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx + side * hr * 0.6, hy + hr * 0.38, hr * 0.17, hr * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = colors.nose;
  ctx.beginPath();
  ctx.ellipse(hx, hy + hr * 0.3, hr * 0.09, hr * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // a few sleepy "z"s
  ctx.fillStyle = '#A894D4';
  ctx.font = `600 ${Math.round(iw * 0.09)}px ${HAND}`;
  ctx.fillText('z', iw * 0.66, ih * 0.24);
  ctx.font = `600 ${Math.round(iw * 0.065)}px ${HAND}`;
  ctx.fillText('z', iw * 0.75, ih * 0.16);
  ctx.restore();
  // handwritten caption on the thick bottom border
  ctx.fillStyle = '#4A4250';
  ctx.font = `600 ${Math.round(h * 0.11)}px ${HAND}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('mochi', w / 2 - h * 0.05, b + ih + (h - b - ih) / 2);
  ctx.fillStyle = c.roseDeep;
  heart(ctx, w / 2 + h * 0.13, b + ih + (h - b - ih) / 2 + 2, h * 0.045);
  ctx.fill();
};

/** Sticky notes: a short handwritten message with a little doodle. */
export function drawNote(color: string, lines: string[], doodle: 'star' | 'heart' | 'computer'): Draw {
  return (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    // the sticky strip along the top is a touch darker
    ctx.fillStyle = 'rgba(120, 90, 60, 0.07)';
    ctx.fillRect(0, 0, w, h * 0.16);
    // Handwritten, each letter a little different, centred by eye.
    const rand = seededRandom(lines.join('').length * 7 + 3);
    // As large as the longest line allows.
    ctx.font = `600 100px ${HAND}`;
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const size = Math.min(h * 0.2, (100 * w * 0.82) / widest);
    ctx.font = `600 ${Math.round(size)}px ${HAND}`;
    lines.forEach((line, i) => {
      const width = ctx.measureText(line).width;
      scrawl(ctx, line, w / 2 - width / 2 + (rand() - 0.5) * w * 0.03, h * (0.4 + i * 0.21), size, '#4A4250', rand, 600);
    });
    const x = w * 0.5;
    const y = h * 0.82;
    ctx.lineWidth = w * 0.022;
    ctx.lineJoin = 'round';
    if (doodle === 'star') {
      ctx.fillStyle = '#E9B949';
      star(ctx, x, y, h * 0.08);
      ctx.fill();
    } else if (doodle === 'heart') {
      ctx.fillStyle = c.roseDeep;
      heart(ctx, x, y, h * 0.11);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#6E6578';
      ctx.strokeRect(x - w * 0.12, y - h * 0.09, w * 0.24, h * 0.14);
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.05);
      ctx.lineTo(x, y + h * 0.1);
      ctx.moveTo(x - w * 0.07, y + h * 0.1);
      ctx.lineTo(x + w * 0.07, y + h * 0.1);
      ctx.stroke();
      ctx.fillStyle = c.roseDeep;
      heart(ctx, x, y - h * 0.02, h * 0.04);
      ctx.fill();
    }
  };
}
