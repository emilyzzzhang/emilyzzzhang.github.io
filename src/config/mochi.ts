/**
 * Mochi's look, in one place.
 *
 * PLACEHOLDER APPEARANCE — these defaults describe a generic cream-and-peach cat. To match
 * the real Mochi, open a reference photo next to the running site and adjust:
 *
 *   1. `colors.furBase`      — the main body colour (sample the cat's flank or chest).
 *   2. `colors.furSecondary` — patches/saddle/cap colour; then toggle the `markings` that
 *                              match where those patches actually are.
 *   3. `colors.eyes`         — iris colour (only visible during the wake-up animation).
 *   4. `colors.nose`         — nose leather (pink, dark grey, brown…).
 *   5. `shape.earSize` / `shape.earHeight` — big upright ears vs. small rounded ones.
 *   6. `shape.tailFluff`     — thin short-hair tail (≈0.8) vs. a big plume (≈1.4).
 *
 * Colours are hex strings; shape values are multipliers where 1 is the default.
 */
export interface MochiAppearance {
  colors: {
    furBase: string;
    furSecondary: string;
    /** Inside of the ears. */
    earInner: string;
    /** Muzzle / chin patch around the nose. Set equal to furBase to hide it. */
    faceMarking: string;
    tail: string;
    /** Only used when markings.tailTip is true. */
    tailTip: string;
    paws: string;
    eyes: string;
    pupils: string;
    nose: string;
    /** Rosy cheek tint — purely stylistic. */
    cheeks: string;
  };
  shape: {
    /** Overall size of the curled-up body. */
    bodyScale: number;
    headScale: number;
    /** Ear width/base. */
    earSize: number;
    /** Ear height relative to width: ~0.8 = rounded/folded, ~1.3 = tall and pointy. */
    earHeight: number;
    /** 0.6–1: how far the tail wraps around the body. */
    tailLength: number;
    /** Tail thickness: 0.8 = sleek short hair, 1.4 = fluffy plume. */
    tailFluff: number;
  };
  markings: {
    /** Saddle patch across the back in furSecondary. */
    backPatch: boolean;
    /** Cap of furSecondary over the top of the head (also colours the outer ears). */
    headCap: boolean;
    /** Tail tip in tailTip colour. */
    tailTip: boolean;
    /** Faint stripes across the back in furSecondary (tabby). */
    tabbyStripes: boolean;
    cheekBlush: boolean;
  };
}

export const MOCHI: MochiAppearance = {
  colors: {
    furBase: '#FBF5EE',
    furSecondary: '#EDC3A2',
    earInner: '#F4C3CF',
    faceMarking: '#FFFDFB',
    tail: '#EDC3A2',
    tailTip: '#FBF5EE',
    paws: '#FFFDFB',
    eyes: '#9CC7A4',
    pupils: '#2E2A33',
    nose: '#EE9FB4',
    cheeks: '#F6B8C8',
  },
  shape: {
    bodyScale: 1,
    headScale: 1,
    earSize: 1,
    earHeight: 1,
    tailLength: 1,
    tailFluff: 1,
  },
  markings: {
    backPatch: true,
    headCap: true,
    tailTip: true,
    tabbyStripes: false,
    cheekBlush: true,
  },
};

export const MOCHI_COPY = {
  sleepingTooltip: 'Shhh... Mochi is sleeping',
  awakeTooltip: 'Meow',
};
