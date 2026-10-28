import { describe, expect, it } from 'vitest';
import { MOCHI } from './mochi';
import { MODEL_OVERRIDES } from './models';
import { LIGHTING } from './theme';

const HEX = /^#[0-9a-f]{6}$/i;

describe('Mochi appearance config', () => {
  it('uses six-digit hex colours', () => {
    for (const [name, value] of Object.entries(MOCHI.colors)) expect(value, name).toMatch(HEX);
  });

  it('keeps shape multipliers in a sensible range', () => {
    for (const [name, value] of Object.entries(MOCHI.shape)) {
      expect(value, name).toBeGreaterThan(0.3);
      expect(value, name).toBeLessThan(2.5);
    }
  });
});

describe('day/night lighting', () => {
  it('defines the same settings for both modes', () => {
    expect(Object.keys(LIGHTING.night).sort()).toEqual(Object.keys(LIGHTING.day).sort());
  });

  it('turns the lamp on only at night', () => {
    expect(LIGHTING.day.lamp).toBe(0);
    expect(LIGHTING.night.lamp).toBe(1);
  });
});

describe('model overrides', () => {
  it('points at files under public/, not absolute URLs', () => {
    for (const override of Object.values(MODEL_OVERRIDES)) expect(override?.url).not.toMatch(/^(\/|https?:)/);
  });
});
