import { Placeholder } from '../components/ui/Placeholder';
import { education } from '../data/profile';

export function EducationSection() {
  const { institution, degree, period, logo, coursework } = education;

  return (
    <div className="section">
      <article className="education-entry">
        {logo && <img className="education-entry__logo" src={logo.src} alt={logo.alt} />}
        <div className="education-entry__body">
          <h3>{institution}</h3>
          <p className="education-entry__degree">{degree}</p>
        </div>
        <p className="education-entry__meta">{period ?? <Placeholder>Years attended</Placeholder>}</p>
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
