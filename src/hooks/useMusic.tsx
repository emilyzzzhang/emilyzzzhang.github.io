import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * The guitar's little tune. Drop the track at public/audio/little-tune.mp3; it is fetched only
 * once a visitor asks for music, never on page load, and nothing ever autoplays.
 */
export const MUSIC = {
  src: `${import.meta.env.BASE_URL}audio/little-tune.mp3`,
  /** Playback volume, 0–1. */
  volume: 0.25,
  /** Seconds to fade in on play and out on pause. */
  fade: 0.6,
} as const;

/** idle: never played. unavailable: the track is missing or can't be decoded. */
export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';

interface Music {
  status: MusicStatus;
  muted: boolean;
  /** Play if not playing, otherwise pause. */
  toggle: () => void;
  play: () => void;
  pause: () => void;
  toggleMute: () => void;
}

interface Engine {
  audio: HTMLAudioElement;
  /** Volume runs through a gain node where Web Audio exists: iOS ignores an element's own volume. */
  context?: AudioContext;
  gain?: GainNode;
}

const MusicContext = createContext<Music | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<MusicStatus>('idle');
  const [muted, setMuted] = useState(false);
  const engine = useRef<Engine | null>(null);
  // Read by async callbacks, so it changes the moment the status does, not on the next render.
  const statusRef = useRef(status);
  const setStatus = useCallback((next: MusicStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const pauseTimer = useRef(0);

  /** Built on the first request, inside the visitor's click, so browsers allow it to start. */
  const ensureEngine = () => {
    if (engine.current) return engine.current;
    const audio = new Audio(MUSIC.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      setStatus('unavailable');
      console.warn(`[music] Could not load ${MUSIC.src}. Add the track at public/audio/little-tune.mp3.`);
    });
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(audio).connect(gain).connect(context.destination);
      engine.current = { audio, context, gain };
    } else {
      audio.volume = MUSIC.volume;
      engine.current = { audio };
    }
    return engine.current;
  };

  const fadeTo = ({ context, gain }: Engine, value: number) => {
    if (!context || !gain) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + MUSIC.fade);
  };

  const play = useCallback(() => {
    if (statusRef.current === 'unavailable') return;
    const e = ensureEngine();
    window.clearTimeout(pauseTimer.current);
    if (statusRef.current !== 'playing') setStatus(e.audio.readyState >= 3 ? 'playing' : 'loading');
    void e.context?.resume();
    e.audio
      .play()
      .then(() => {
        // Paused again while the track was still loading: the scheduled pause wins.
        if (statusRef.current === 'paused') return;
        setStatus('playing');
        fadeTo(e, MUSIC.volume);
      })
      .catch((error: DOMException) => {
        // A pause before playback began aborts the request; that's not a failure.
        if (error.name === 'AbortError') return;
        setStatus(error.name === 'NotAllowedError' ? 'paused' : 'unavailable');
      });
  }, [setStatus]);

  const pause = useCallback(() => {
    const e = engine.current;
    if (!e || statusRef.current === 'paused' || statusRef.current === 'idle') return;
    setStatus('paused');
    fadeTo(e, 0);
    window.clearTimeout(pauseTimer.current);
    pauseTimer.current = window.setTimeout(() => e.audio.pause(), e.gain ? MUSIC.fade * 1000 : 0);
  }, [setStatus]);

  const toggle = useCallback(() => {
    if (statusRef.current === 'playing' || statusRef.current === 'loading') pause();
    else play();
  }, [play, pause]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (engine.current) engine.current.audio.muted = !m;
      return !m;
    });
  }, []);

  // Stop and release everything when the app goes away.
  useEffect(
    () => () => {
      window.clearTimeout(pauseTimer.current);
      const e = engine.current;
      if (!e) return;
      e.audio.pause();
      e.audio.removeAttribute('src');
      e.audio.load();
      void e.context?.close();
      engine.current = null;
    },
    [],
  );

  const value = useMemo(() => ({ status, muted, toggle, play, pause, toggleMute }), [status, muted, toggle, play, pause, toggleMute]);
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const music = useContext(MusicContext);
  if (!music) throw new Error('useMusic must be used inside <MusicProvider>');
  return music;
}
