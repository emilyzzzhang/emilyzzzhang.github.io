import { profile } from '../../data/profile';

export function Hero({ dimmed, onExplore }: { dimmed: boolean; onExplore: () => void }) {
  return (
    <section className={`hero${dimmed ? ' hero--dimmed' : ''}`} aria-labelledby="hero-title" inert={dimmed}>
      <h1 id="hero-title" className="hero__title">
        {profile.heroTitle}
      </h1>
      <p className="hero__role">{profile.heroIntro}</p>
      <button type="button" className="hero__explore" onClick={onExplore}>
        Explore My Studio
        <svg className="hero__explore-arrow" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}
