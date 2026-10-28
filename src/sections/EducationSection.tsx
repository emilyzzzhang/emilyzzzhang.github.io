import { Placeholder } from '../components/ui/Placeholder';
import { education } from '../data/profile';

export function EducationSection() {
  const { institution, degree, period, logo, coursework } = education;

  return (
    <div className="section">
      <article className="card education-card accent-peach">
        {logo && <img className="education-card__logo" src={logo.src} alt={logo.alt} />}
        <div className="education-card__body">
          <h3>{institution}</h3>
          <p className="education-card__degree">{degree}</p>
          <p className="education-card__meta">{period ?? <Placeholder>Years attended</Placeholder>}</p>
        </div>
      </article>

      <h3 className="section__subheading">Relevant coursework</h3>
      {coursework.length > 0 ? (
        <ul className="tags">
          {coursework.map((course) => (
            <li key={course} className="tag">
              {course}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          <Placeholder>Add courses in src/data/profile.ts</Placeholder>
        </p>
      )}
    </div>
  );
}
