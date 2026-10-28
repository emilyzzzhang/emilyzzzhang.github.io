import { useEffect, useRef, useState } from 'react';

export type LoadStage = 'fetching' | 'building';

/*
 * There is no byte-level progress for the lazy three.js chunk, so the bar follows the real
 * stages: it eases towards each stage's cap and only passes it when the next stage actually arrives.
 */
const CAP: Record<LoadStage | 'ready', number> = { fetching: 70, building: 92, ready: 100 };
// Fraction of the remaining distance covered per second; the last stretch to 100 is quick.
const RATE: Record<LoadStage | 'ready', number> = { fetching: 0.35, building: 0.9, ready: 12 };

const messageFor = (pct: number) => (pct < 20 ? "Preparing Emily's Studio" : pct <= 85 ? 'Just a moment' : 'Almost there');

export function LoadingScreen({ done, stage }: { done: boolean; stage: LoadStage }) {
  const bar = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLSpanElement>(null);
  const progress = useRef(0);
  const key = done ? 'ready' : stage;
  // The screen only lifts once the bar has visibly reached the end, not the moment the scene is ready.
  const [filled, setFilled] = useState(false);

  // Written straight to the DOM each frame so the bar never re-renders React.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can predate this effect, so never let time run backwards.
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const gap = CAP[key] - progress.current;
      progress.current = gap < 0.5 ? CAP[key] : progress.current + gap * (1 - Math.exp(-RATE[key] * dt));
      const pct = Math.floor(progress.current);
      bar.current?.style.setProperty('--progress', String(progress.current / 100));
      bar.current?.setAttribute('aria-valuenow', String(pct));
      // Only touch the text when the message actually changes, so screen readers hear each one once.
      const text = messageFor(pct);
      if (message.current && message.current.textContent !== text) message.current.textContent = text;
      if (progress.current < CAP[key]) frame = requestAnimationFrame(tick);
      else if (key === 'ready') setFilled(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key]);

  return (
    <div className={`loading${filled ? ' loading--done' : ''}`} role="status" aria-live="polite" aria-hidden={filled}>
      <p className="loading__title">
        <span ref={message}>{messageFor(0)}</span>
        <span className="loading__dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
      <div ref={bar} className="loading__bar" role="progressbar" aria-label="Loading the 3D studio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
        <span className="loading__track">
          <span className="loading__fill" />
        </span>
        {/* The studio's flower rides the leading edge of the fill. */}
        <span className="loading__runner" aria-hidden="true">
          <img className="loading__bloom" src={`${import.meta.env.BASE_URL}emily-studio-bloom.png`} alt="" />
        </span>
      </div>
    </div>
  );
}
