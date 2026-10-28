/** Brand palette — mirrored as CSS custom properties in styles/variables.css. */
export const palette = {
  cream: '#F8F3EE',
  warmWhite: '#FFFDFB',
  blush: '#F4D7DF',
  rose: '#EFB8C8',
  pink: '#F7C7D7',
  peach: '#F6E3D7',
  wood: '#B88A68',
  beige: '#E9DDD2',
  charcoal: '#3A3440',
  lavender: '#C9B8E8',
  sage: '#B8CBB8',
} as const;

/** Extended tints used only inside the 3D room. */
export const sceneColors = {
  ...palette,
  // Clear, warm blush pinks for the furniture, in the family of the loading spinner's pink
  // (#F48EA3), rather than the UI palette's dustier, mauve-leaning ones.
  pink: '#FCBAC7',
  rose: '#F7A3B5',
  // A clear, pale blush for the lower walls, rather than the UI palette's greyer, dustier one.
  blush: '#FFDCE4',
  wallUpper: '#FFFBF8',
  woodDark: '#9C7254',
  woodLight: '#D3B08F',
  roseDeep: '#F28CA2',
  peachDeep: '#EDC6B0',
  lavenderLight: '#E3D9F4',
  lavenderDeep: '#AE9AD9',
  sageDeep: '#98B39A',
  leaf: '#9DBB9E',
  leafDark: '#7EA284',
  terracotta: '#E6AE96',
  metal: '#E6DED8',
  brass: '#DDBB86',
  grass: '#A3C287',
  earth: '#A98468',
  bulb: '#FFF3DF',
  lampGlow: '#FFCDA0',
} as const;

/**
 * Lighting for each time of day. The scene blends continuously between the two sets, so
 * every value here is a target, not a switch.
 */
export interface LightingState {
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambientIntensity: number;
  /** Key light: soft gold sun by day, lavender-blue moon by night. */
  keyColor: string;
  keyIntensity: number;
  /** Light pouring in through the window. */
  windowColor: string;
  windowIntensity: number;
  fillColor: string;
  fillIntensity: number;
  /** 0 = off, 1 = fully on. Drives the lamp, screen and fairy-light glows. */
  lamp: number;
  fairyGlow: number;
  screenGlow: number;
  /** 0 = off, 1 = full afternoon sun: the window sunbeam, its faint rays and the platform's shadow. */
  sun: number;
}

export const LIGHTING: Record<'day' | 'night', LightingState> = {
  day: {
    hemiSky: '#FFFAF6',
    hemiGround: '#EBCFC8',
    // A little less flat fill than before, so the sunbeam and soft corners read; the sun makes up the difference.
    hemiIntensity: 1.15,
    ambientIntensity: 0.32,
    keyColor: '#FFEEDB',
    keyIntensity: 2.4,
    windowColor: '#FFE8CF',
    windowIntensity: 2.4,
    fillColor: '#FFE1D8',
    fillIntensity: 1.7,
    lamp: 0,
    fairyGlow: 0.25,
    screenGlow: 0.15,
    sun: 1,
  },
  night: {
    hemiSky: '#ABA3DA',
    hemiGround: '#5B4D6E',
    hemiIntensity: 0.62,
    ambientIntensity: 0.22,
    keyColor: '#AEB2EE',
    keyIntensity: 0.6,
    windowColor: '#A8B0F2',
    windowIntensity: 3.6,
    fillColor: '#F3B9CB',
    fillIntensity: 0.55,
    lamp: 1,
    fairyGlow: 1,
    screenGlow: 1,
    sun: 0,
  },
};

/** Afternoon sunlight through the window (scaled by LightingState.sun). */
export const SUNLIGHT = {
  color: '#FFD9A8',
  /** Spot intensity; decay is off, so this behaves like sunlight rather than a bulb. */
  intensity: 3.2,
  /** Opacity of the faint light shaft between the window and the floor. */
  rays: 0.16,
  /** Darkness and colour of the soft shadow the diorama casts on the backdrop (a deep teal-green, to suit it). */
  platformShadow: 0.3,
  platformShadowColor: '#34503f',
};

/** Time constant for the day/night blend (higher = faster; ~2.4 settles in about 1.5 s). */
export const DAY_NIGHT_SPEED = 2.4;
