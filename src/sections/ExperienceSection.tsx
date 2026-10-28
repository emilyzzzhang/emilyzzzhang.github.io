import { ExperienceCard } from '../components/ui/ExperienceCard';
import { experience } from '../data/experience';

export function ExperienceSection() {
  return (
    <div className="section">
      <ol className="timeline">
        {experience.map((item) => (
          <li key={item.id} className="timeline__item">
            <ExperienceCard item={item} />
          </li>
        ))}
      </ol>
    </div>
  );
}
