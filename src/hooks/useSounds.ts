import { useCallback, useEffect, useRef } from 'react';

/** A soft tick, synthesised so there's no file to fetch: a short sine falling in pitch as it fades. */
export const CLICK_SOUND = {
  /** Peak volume, 0–1. */
  volume: 0.07,
  /** Pitch in Hz at the start and end of the tick. */
  fromHz: 900,
  toHz: 450,
  /** Seconds to rise, which keeps the start from popping, and to fade away. */
  attack: 0.004,
  decay: 0.05,
} as const;

/** Mochi's meow, a recording fetched the first time a visitor clicks on her. */
export const MEOW_SOUND = {
  src: `${import.meta.env.BASE_URL}audio/meow.mp3`,
  /** Playback volume, 0–1. */
  volume: 0.5,
} as const;

/** Buttons that open a panel leave their tick to the panel, so a click never plays two. */
const CLICKABLE = 'button:not([data-opens-panel]), .button:not([data-opens-panel])';

export function playTick(context: BaseAudioContext) {
  const { volume, fromHz, toHz, attack, decay } = CLICK_SOUND;
  const now = context.currentTime;
  const end = now + attack + decay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(fromHz, now);
  oscillator.frequency.exponentialRampToValueAtTime(toHz, end);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(end);
}

/**
 * The studio's little sounds. Ticks on every button click on the page, wherever the button lives,
 * and returns the same tick for whatever opens a panel, since the room's objects aren't page
 * elements. The meow plays well after its click, so `prepareMeow` has to run during the click.
 */
export function useSounds() {
  const audio = useRef<AudioContext | null>(null);
  const meowClip = useRef<Promise<AudioBuffer | null> | null>(null);

  /** Built on the first click, since browsers keep audio suspended until the visitor interacts. */
  const unlock = useCallback(() => {
    if (!audio.current) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audio.current = new AudioContextClass();
    }
    void audio.current.resume();
    return audio.current;
  }, []);

  const tick = useCallback(() => {
    const context = unlock();
    if (context) playTick(context);
  }, [unlock]);

  const prepareMeow = useCallback(() => {
    const context = unlock();
    if (!context) return Promise.resolve(null);
    meowClip.current ??= fetch(MEOW_SOUND.src)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .catch(() => {
        console.warn(`[sounds] Could not load ${MEOW_SOUND.src}.`);
        return null;
      });
    return meowClip.current;
  }, [unlock]);

  const meow = useCallback(() => {
    void prepareMeow().then((clip) => {
      const context = audio.current;
      if (!clip || !context) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = clip;
      gain.gain.value = MEOW_SOUND.volume;
      source.connect(gain).connect(context.destination);
      source.start();
    });
  }, [prepareMeow]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(CLICKABLE)) tick();
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      void audio.current?.close();
      audio.current = null;
      meowClip.current = null;
    };
  }, [tick]);

  return { tick, meow, prepareMeow };
}
