import { profile } from '../../data/profile';

export function Hero({ dimmed }: { dimmed: boolean }) {
  return (
    <section className={`hero${dimmed ? ' hero--dimmed' : ''}`} aria-labelledby="hero-title">
      <h1 id="hero-title" className="hero__title">
        {profile.heroTitle}
      </h1>
      <p className="hero__role">{profile.heroIntro}</p>
    </section>
  );
}
