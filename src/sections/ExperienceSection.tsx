import { ExperienceCard } from '../components/ui/ExperienceCard';
import { experience } from '../data/experience';

export function ExperienceSection() {
  return (
    <div className="section">
      <p className="section__intro">Internships and research across extended reality, 3D software, and applied AI.</p>
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
