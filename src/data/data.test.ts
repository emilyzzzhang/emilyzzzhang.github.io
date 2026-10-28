import { describe, expect, it } from 'vitest';
import { FOCUS_VIEWS, HOME_VIEW, scalePreset } from '../config/camera';
import { SECTION_IDS } from '../types/portfolio';
import { experience } from './experience';
import { contactLinks, education } from './profile';
import { projects } from './projects';
import { NAV_ORDER, SECTIONS } from './sections';

describe('section wiring', () => {
  it('every section has metadata, a nav entry and a camera focus preset', () => {
    for (const id of SECTION_IDS) {
      expect(SECTIONS[id].id).toBe(id);
      expect(NAV_ORDER).toContain(id);
      expect(FOCUS_VIEWS[id]).toBeDefined();
    }
  });

  it('focus cameras stay inside the open side of the room (walls are at x = -4 and z = -4)', () => {
    for (const id of SECTION_IDS) {
      const [x, y, z] = FOCUS_VIEWS[id].position;
      expect(x).toBeGreaterThan(-4);
      expect(z).toBeGreaterThan(-4);
      expect(y).toBeGreaterThan(0);
    }
  });
});

describe('portfolio content', () => {
  it('lists experience most recent first, as on the résumé', () => {
    expect(experience.map((e) => e.company)).toEqual(['Google', 'Autodesk', 'CIBC', 'McGill University']);
  });

  it('has unique ids', () => {
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(new Set(experience.map((e) => e.id)).size).toBe(experience.length);
  });

  it('only renders links that are real URLs', () => {
    for (const p of projects) {
      for (const url of [p.githubUrl, p.demoUrl]) if (url) expect(url).toMatch(/^https?:\/\//);
    }
    for (const link of contactLinks) {
      if (link.href) expect(link.href).toMatch(/^(https?:\/\/|mailto:)/);
    }
  });

  it('includes the McGill degree', () => {
    expect(education.institution).toBe('McGill University');
    expect(education.degree).toBe('BSc in Computer Science and Artificial Intelligence');
  });
});

describe('scalePreset', () => {
  it('keeps the target and moves the camera along the view ray', () => {
    const scaled = scalePreset(HOME_VIEW, 2);
    expect(scaled.target).toEqual(HOME_VIEW.target);
    const [px, , pz] = HOME_VIEW.position;
    const [tx, , tz] = HOME_VIEW.target;
    expect(scaled.position[0]).toBeCloseTo(tx + (px - tx) * 2);
    expect(scaled.position[2]).toBeCloseTo(tz + (pz - tz) * 2);
  });
});
