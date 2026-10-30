import type { Experience } from '../../types/portfolio';

/** One job as an entry in the journal: written straight on the page, its note on ruled lines. */
export function ExperienceCard({ item }: { item: Experience }) {
  const { company, role, focus, summary, location, tags } = item;

  return (
    <article className="experience-entry">
      <header className="experience-entry__header">
        <h3 className="experience-entry__company">{company}</h3>
        {location && <p className="experience-entry__meta">{location}</p>}
      </header>
      <p className="experience-entry__role">
        {role} · <span>{focus}</span>
      </p>
      <p className="experience-entry__notes">{summary}</p>
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
