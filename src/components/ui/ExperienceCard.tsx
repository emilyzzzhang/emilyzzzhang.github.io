import type { Experience } from '../../types/portfolio';
import { Placeholder } from './Placeholder';

export function ExperienceCard({ item }: { item: Experience }) {
  const { company, role, focus, summary, period, location, highlights, tags, accent } = item;

  return (
    <article className={`card experience-card accent-${accent}`}>
      <header className="experience-card__header">
        <div>
          <h3>{company}</h3>
          <p className="experience-card__role">
            {role} · <span>{focus}</span>
          </p>
        </div>
        {(period || location) && <p className="experience-card__meta">{[period, location].filter(Boolean).join(' · ')}</p>}
      </header>
      <p>{summary}</p>
      {highlights.length > 0 ? (
        <ul className="experience-card__highlights">
          {highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : (
        <p>
          <Placeholder>Add highlights in src/data/experience.ts</Placeholder>
        </p>
      )}
      <ul className="tags" aria-label="Focus areas">
        {tags.map((tag) => (
          <li key={tag} className="tag">
            {tag}
          </li>
        ))}
      </ul>
    </article>
  );
}
