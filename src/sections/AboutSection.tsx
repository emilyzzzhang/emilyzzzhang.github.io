import { profile } from '../data/profile';

export function AboutSection() {
  return (
    <div className="section section--about">
      {profile.about.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <h3 className="section__subheading">What I'm into</h3>
      <ul className="tags">
        {profile.interests.map((interest) => (
          <li key={interest} className="tag tag--large">
            {interest}
          </li>
        ))}
      </ul>
    </div>
  );
}
