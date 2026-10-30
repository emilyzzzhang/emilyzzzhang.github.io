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
          <path d="M2.5 8.6c3-.6 6.4-.2 9.7-.8M8.7 4.6c1.3 1.3 2.6 2.3 3.6 3.3-1.2 1-2.4 2.3-3.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}
