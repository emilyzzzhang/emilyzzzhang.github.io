import { Placeholder } from '../components/ui/Placeholder';
import { education } from '../data/profile';

export function EducationSection() {
  const { institution, degree, period, coursework, interests } = education;

  return (
    <div className="section">
      <article className="card education-card accent-peach">
        <h3>{institution}</h3>
        <p className="education-card__degree">{degree}</p>
        <p className="education-card__meta">{period ?? <Placeholder>Years attended</Placeholder>}</p>
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

      <h3 className="section__subheading">Academic interests</h3>
      <ul className="tags">
        {interests.map((interest) => (
          <li key={interest} className="tag tag--large">
            {interest}
          </li>
        ))}
      </ul>
    </div>
  );
}
