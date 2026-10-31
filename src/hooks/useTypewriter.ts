import { useCallback, useEffect, useMemo, useState } from 'react';

/** Pacing in ms: a steady hand, a beat at commas, a breath at the end of a sentence and between paragraphs. */
const PACE = { start: 225, char: 4.5, comma: 28.5, stop: 70, paragraph: 108.5 };

/** Letters over which a paragraph eases up to speed, and eases off again before its last word. */
const EASE_IN = 12;
const EASE_OUT = 28;
/** How much slower the very first and very last letters of a paragraph come than the steady pace. */
const EASE_SLOWEST = 3.5;

/** Never quite even, like a person writing: each letter takes a little more or less than the last. */
function pauseAfter(ch: string) {
  if ('.!?'.includes(ch)) return PACE.stop;
  if (',:;'.includes(ch)) return PACE.comma;
  if (ch === ' ') return PACE.char * (1.2 + Math.random() * 1.2);
  return PACE.char * (0.5 + Math.random());
}

/**
 * Slows the pace near a paragraph's start and end, so the text gathers speed and then winds down
 * into its last word instead of stopping dead. `from` / `left` are letters typed / still to type.
 */
function easing(from: number, left: number) {
  const ramp = (n: number, span: number) => (n >= span ? 0 : (1 - n / span) ** 2);
  return 1 + (EASE_SLOWEST - 1) * Math.max(ramp(from, EASE_IN), ramp(left, EASE_OUT));
}

/**
 * Reveals `texts` one character at a time, like someone typing them out, paragraph after
 * paragraph. Returns how many characters are showing (across all texts), whether it's finished,
 * and `skip` to show everything at once. With `instant` (reduced motion) it starts finished.
 */
export function useTypewriter(texts: string[], instant: boolean) {
  const ends = useMemo(() => texts.reduce<number[]>((acc, t) => [...acc, (acc.at(-1) ?? 0) + t.length], []), [texts]);
  const total = ends.at(-1) ?? 0;
  const flat = useMemo(() => texts.join(''), [texts]);
  const [shown, setShown] = useState(instant ? total : 0);

  useEffect(() => {
    if (instant || shown >= total) return;
    const paragraph = ends.findIndex((end) => shown < end);
    const from = shown - (ends[paragraph - 1] ?? 0);
    const delay =
      shown === 0 ? PACE.start : from === 0 ? PACE.paragraph : pauseAfter(flat[shown - 1]) * easing(from, ends[paragraph] - shown);
    const timer = window.setTimeout(() => setShown((n) => n + 1), delay);
    return () => window.clearTimeout(timer);
  }, [shown, total, ends, flat, instant]);

  const skip = useCallback(() => setShown(total), [total]);
  return { shown: instant ? total : shown, done: instant || shown >= total, skip };
}
