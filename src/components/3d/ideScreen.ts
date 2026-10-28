import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { seededRandom } from './textures';

/**
 * The monitor's looping "someone is coding" screen: a small VS Code-like editor that types a
 * snippet, then a terminal that runs it. Everything is a pure function of playback time, so the
 * state machine needs no timers, and the canvas is repainted only when what's visible changes.
 */

type Lang = 'ts' | 'py';

interface Snippet {
  file: string;
  lang: Lang;
  code: string[];
  command: string;
  output: { text: string; tone?: 'ok' | 'dim' }[];
}

export const SNIPPETS: Snippet[] = [
  {
    file: 'mochi.py',
    lang: 'py',
    code: [
      'import random',
      '',
      'def mochi_status() -> str:',
      '    naps = random.randint(9, 14)',
      '    return f"{naps} naps today. Still tired."',
      '',
      'print("Mochi:", mochi_status())',
    ],
    command: 'python mochi.py',
    output: [{ text: 'Mochi: 12 naps today. Still tired.', tone: 'ok' }],
  },
  {
    file: 'coffee.ts',
    lang: 'ts',
    code: [
      "// emily's morning boot sequence",
      "const coffee = await brew({ size: 'large' });",
      '',
      'if (coffee.cups < 2) {',
      "  throw new Error('emily.exe is not responding');",
      '}',
      '',
      'console.log(`focus: ${coffee.cups * 100}%`);',
    ],
    command: 'npx tsx coffee.ts',
    output: [
      { text: 'brewing... (2 cups)', tone: 'dim' },
      { text: 'focus: 200%', tone: 'ok' },
    ],
  },
  {
    file: 'commit.py',
    lang: 'py',
    code: [
      'class Mochi:',
      '    def walk_across(self, msg: str) -> str:',
      '        return msg + "jjjjjjkkkkk;;;;;"',
      '',
      'commit = Mochi().walk_across("fix bug")',
      'print(f"git commit -m \'{commit}\'")',
    ],
    command: 'python commit.py',
    output: [
      { text: "git commit -m 'fix bugjjjjjjkkkkk;;;;;'" },
      { text: '1 file changed, 0 bugs fixed', tone: 'dim' },
    ],
  },
  {
    file: 'debug.ts',
    lang: 'ts',
    code: [
      'export function debug(bug: Bug) {',
      '  explainToMochi(bug); // fluffy rubber duck',
      '',
      '  return mochi.isAsleep',
      "    ? 'figured it out myself'",
      "    : 'mochi sat on the keyboard';",
      '}',
    ],
    command: 'npm test',
    output: [
      { text: ' ✓ debug.test.ts (1 test) 3ms', tone: 'ok' },
      { text: '   fixed by: talking to a cat', tone: 'dim' },
      { text: '      Tests  1 passed (1)', tone: 'ok' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// Timeline: per snippet, when each code character, command character and output line appears.

/** Seconds for each phase that isn't per-character. */
const PACE = {
  pauseBeforeRun: 1.0,
  commandChar: 0.07,
  thinking: 0.5,
  outputLine: 0.24,
  hold: 2.8,
  fade: 0.6,
};

interface Timeline {
  /** Time at which code character i (in the joined code, newlines included) appears. */
  codeTimes: number[];
  codeDone: number;
  commandStart: number;
  commandDone: number;
  outputStart: number;
  holdStart: number;
  fadeStart: number;
  end: number;
}

function buildTimeline(snippet: Snippet, seed: number): Timeline {
  const rand = seededRandom(seed);
  const text = snippet.code.join('\n');
  const codeTimes: number[] = [];
  let t = 0.6; // a beat of blinking cursor before typing starts
  for (const ch of text) {
    if (ch === '\n') t += 0.25 + rand() * 0.35;
    else if (ch === ' ') t += 0.03 + rand() * 0.03;
    else t += 0.04 + rand() * 0.05 + (rand() < 0.04 ? 0.45 : 0);
    codeTimes.push(t);
  }
  const codeDone = t;
  const commandStart = codeDone + PACE.pauseBeforeRun;
  const commandDone = commandStart + snippet.command.length * PACE.commandChar;
  const outputStart = commandDone + PACE.thinking;
  const holdStart = outputStart + snippet.output.length * PACE.outputLine;
  const fadeStart = holdStart + PACE.hold;
  return { codeTimes, codeDone, commandStart, commandDone, outputStart, holdStart, fadeStart, end: fadeStart + PACE.fade };
}

const TIMELINES = SNIPPETS.map((s, i) => buildTimeline(s, 101 + i));
const CYCLE = TIMELINES.reduce((sum, tl) => sum + tl.end, 0);

export interface ScreenState {
  snippet: number;
  /** Code characters typed so far. */
  typed: number;
  /** Command characters typed; -1 before the prompt appears. */
  command: number;
  output: number;
  /** Where the cursor is, and whether it's lit this instant. */
  cursor: 'code' | 'command' | 'none';
  cursorOn: boolean;
  /** 1 normally, easing to 0 as the screen clears for the next snippet. */
  alpha: number;
}

const countUntil = (times: number[], t: number) => {
  let n = 0;
  while (n < times.length && times[n] <= t) n++;
  return n;
};

/** Everything visible at playback time `time` (seconds, looping). */
export function screenAt(time: number): ScreenState {
  let t = ((time % CYCLE) + CYCLE) % CYCLE;
  let snippet = 0;
  while (t >= TIMELINES[snippet].end) t -= TIMELINES[snippet++].end;
  const tl = TIMELINES[snippet];
  const typing = t < tl.codeDone;
  const typed = countUntil(tl.codeTimes, t);
  const command = t < tl.commandStart ? -1 : Math.min(SNIPPETS[snippet].command.length, Math.floor((t - tl.commandStart) / PACE.commandChar));
  const output = t < tl.outputStart ? 0 : Math.min(SNIPPETS[snippet].output.length, 1 + Math.floor((t - tl.outputStart) / PACE.outputLine));
  const cursor = t < tl.commandStart ? 'code' : t < tl.outputStart ? 'command' : 'none';
  // Solid while keys are going, blinking (~1 Hz) while idle.
  const recentlyTyped = typing && t - (tl.codeTimes[typed - 1] ?? 0) < 0.5;
  const cursorOn = recentlyTyped || (cursor === 'command' && t < tl.commandDone) || Math.floor(t * 2) % 2 === 0;
  const alpha = t < tl.fadeStart ? 1 : 1 - (t - tl.fadeStart) / PACE.fade;
  return { snippet, typed, command, output, cursor, cursorOn, alpha };
}

/** The finished state of the first snippet: what reduced-motion visitors see. */
export const STILL: ScreenState = {
  snippet: 0,
  typed: SNIPPETS[0].code.join('\n').length,
  command: SNIPPETS[0].command.length,
  output: SNIPPETS[0].output.length,
  cursor: 'none',
  cursorOn: false,
  alpha: 1,
};

// ---------------------------------------------------------------------------------------------
// Drawing.

const W = 1024;
const H = 640;
const MONO = '"SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const UI = '"Nunito", "Helvetica Neue", Arial, sans-serif';
const COLORS = {
  bg: '#26232B',
  chrome: '#1F1C24',
  tab: '#2F2B35',
  terminal: '#1C1A21',
  gutter: '#6F6879',
  text: '#F3E9DC',
  keyword: '#C9B8E8',
  string: '#B8D3B4',
  type: '#F7BFD2',
  call: '#F6CFAE',
  number: '#F7BFD2',
  comment: '#857D90',
  prompt: '#EFA7BF',
  ok: '#B8D3B4',
  dim: '#9C93A8',
  cursor: '#F3E9DC',
};
const EDITOR = { top: 62, left: 92, line: 37, font: 27 };
const TERM = { top: 452, line: 33, font: 23, left: 28 };

const KEYWORDS: Record<Lang, Set<string>> = {
  ts: new Set(['import', 'from', 'export', 'function', 'return', 'const', 'let', 'new', 'number', 'if', 'for', 'await', 'throw']),
  py: new Set(['import', 'from', 'def', 'return', 'for', 'in', 'if', 'print', 'str', 'f', 'class', 'self']),
};

/** Splits one line into coloured tokens: comments, strings, numbers, keywords, Types and calls. */
function tokenize(line: string, lang: Lang): [string, string][] {
  const comment = lang === 'ts' ? '\\/\\/.*' : '#.*';
  const pattern = new RegExp(`(${comment})|("[^"]*"?|'[^']*'?|\\x60[^\\x60]*\\x60?)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][A-Za-z0-9_]*)|(\\s+|.)`, 'g');
  const tokens: [string, string][] = [];
  for (const m of line.matchAll(pattern)) {
    const [text, isComment, isString, isNumber, word] = m;
    let color = COLORS.text;
    if (isComment) color = COLORS.comment;
    else if (isString) color = COLORS.string;
    else if (isNumber) color = COLORS.number;
    else if (word) {
      const next = line[(m.index ?? 0) + word.length];
      if (KEYWORDS[lang].has(word)) color = COLORS.keyword;
      else if (/^[A-Z]/.test(word)) color = COLORS.type;
      else if (next === '(') color = COLORS.call;
    }
    tokens.push([text, color]);
  }
  return tokens;
}

function paint(ctx: CanvasRenderingContext2D, s: ScreenState) {
  const snippet = SNIPPETS[s.snippet];
  // Window chrome and editor background.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.chrome;
  ctx.fillRect(0, 0, W, 46);
  ['#F08FA8', '#F2D58A', '#A9CF9F'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(26 + i * 24, 23, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = COLORS.tab;
  ctx.fillRect(110, 6, 210, 40);
  ctx.fillStyle = COLORS.prompt;
  ctx.fillRect(110, 6, 210, 3);
  ctx.font = `500 21px ${UI}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(snippet.file, 128, 27);

  ctx.save();
  ctx.globalAlpha = s.alpha;
  // Code, typed up to s.typed characters.
  ctx.font = `${EDITOR.font}px ${MONO}`;
  const charW = ctx.measureText('M').width;
  let remaining = s.typed;
  let cursorX = EDITOR.left;
  let cursorY = EDITOR.top + EDITOR.line / 2;
  snippet.code.forEach((full, i) => {
    const y = EDITOR.top + i * EDITOR.line + EDITOR.line / 2;
    if (remaining < 0) return;
    ctx.fillStyle = COLORS.gutter;
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), EDITOR.left - 26, y);
    ctx.textAlign = 'left';
    const shown = full.slice(0, Math.max(0, remaining));
    let x = EDITOR.left;
    for (const [text, color] of tokenize(shown, snippet.lang)) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += charW * text.length;
    }
    if (remaining >= 0) {
      cursorX = x;
      cursorY = y;
    }
    remaining -= full.length + 1;
  });
  if (s.cursor === 'code' && s.cursorOn) {
    ctx.fillStyle = COLORS.cursor;
    ctx.fillRect(cursorX + 1, cursorY - EDITOR.font * 0.55, 3, EDITOR.font * 1.1);
  }
  ctx.restore();

  // Terminal panel.
  const top = TERM.top - 44;
  ctx.fillStyle = COLORS.terminal;
  ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(243, 233, 220, 0.12)';
  ctx.fillRect(0, top, W, 2);
  ctx.font = `600 17px ${UI}`;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('TERMINAL', TERM.left, top + 22);
  ctx.fillStyle = COLORS.prompt;
  ctx.fillRect(TERM.left, top + 36, 86, 2);

  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.font = `${TERM.font}px ${MONO}`;
  const termCharW = ctx.measureText('M').width;
  const lineY = (i: number) => TERM.top + i * TERM.line + TERM.line / 2;
  const prompt = '~/studio $ ';
  ctx.fillStyle = COLORS.prompt;
  ctx.fillText(prompt, TERM.left, lineY(0));
  const typedCommand = s.command < 0 ? '' : snippet.command.slice(0, s.command);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(typedCommand, TERM.left + termCharW * prompt.length, lineY(0));
  if (s.cursor === 'command' && s.cursorOn) {
    ctx.fillRect(TERM.left + termCharW * (prompt.length + typedCommand.length) + 1, lineY(0) - TERM.font * 0.5, termCharW * 0.9, TERM.font);
  }
  snippet.output.slice(0, s.output).forEach(({ text, tone }, i) => {
    ctx.fillStyle = tone === 'ok' ? COLORS.ok : tone === 'dim' ? COLORS.dim : COLORS.text;
    ctx.fillText(text, TERM.left, lineY(i + 1));
  });
  ctx.restore();
}

const stateKey = (s: ScreenState) => `${s.snippet}|${s.typed}|${s.command}|${s.output}|${s.cursor}|${s.cursorOn}|${s.alpha.toFixed(2)}`;

/**
 * A CanvasTexture that plays the coding loop. Driven from useFrame with accumulated frame time,
 * so it pauses with the render loop when the tab is hidden and repaints only on visible changes.
 */
export function useIdeScreen(reducedMotion: boolean): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
  const time = useRef(0);
  const last = useRef('');

  const draw = (s: ScreenState) => {
    const key = stateKey(s);
    if (key === last.current) return;
    last.current = key;
    const ctx = (texture.image as HTMLCanvasElement).getContext('2d');
    if (!ctx) return;
    paint(ctx, s);
    texture.needsUpdate = true;
  };

  useEffect(() => {
    if (reducedMotion) draw(STILL);
    // Repaint once web fonts are in, since earlier frames fell back to system fonts.
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      last.current = '';
      draw(reducedMotion ? STILL : screenAt(time.current));
    });
    return () => {
      alive = false;
    };
    // draw is stable in behaviour; it only closes over refs and the texture.
  }, [reducedMotion]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    // Clamp so a long stall (e.g. a backgrounded tab) resumes where it left off instead of skipping ahead.
    time.current += Math.min(delta, 0.1);
    draw(screenAt(time.current));
  });

  return texture;
}
