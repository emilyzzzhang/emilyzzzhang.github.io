import { describe, expect, it } from 'vitest';
import { SNIPPETS, STILL, screenAt } from './ideScreen';

describe('coding screen timeline', () => {
  it('types, runs and clears every snippet in turn, then loops', () => {
    const seen = new Set<number>();
    let prev = screenAt(0);
    let loopedAt = -1;
    for (let t = 0; t < 400; t += 0.05) {
      const s = screenAt(t);
      seen.add(s.snippet);
      if (s.snippet === prev.snippet) {
        // Within a snippet nothing un-types.
        expect(s.typed).toBeGreaterThanOrEqual(prev.typed);
        expect(s.output).toBeGreaterThanOrEqual(prev.output);
      } else if (s.snippet === 0 && loopedAt < 0) {
        loopedAt = t;
      }
      prev = s;
    }
    expect(seen.size).toBe(SNIPPETS.length);
    expect(loopedAt).toBeGreaterThan(0);
  });

  it('reaches the full snippet, command and output before clearing', () => {
    let best = screenAt(0);
    for (let t = 0; screenAt(t).snippet === 0; t += 0.05) best = screenAt(t).output >= best.output ? screenAt(t) : best;
    expect(best.typed).toBe(STILL.typed);
    expect(best.command).toBe(STILL.command);
    expect(best.output).toBe(STILL.output);
  });

  it('keeps every line inside the editor width', () => {
    for (const { code, output } of SNIPPETS) {
      for (const line of code) expect(line.length).toBeLessThanOrEqual(50);
      for (const { text } of output) expect(text.length).toBeLessThanOrEqual(60);
      expect(code.length).toBeLessThanOrEqual(9);
    }
  });
});
