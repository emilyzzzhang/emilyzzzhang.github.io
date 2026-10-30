import { TypedSection } from '../components/ui/TypedSection';
import { profile } from '../data/profile';

export function AboutSection() {
  return (
    <TypedSection className="section section--about" paragraphs={profile.about} follow>
      <h3 className="section__subheading">What I'm into</h3>
      <ul className="tags">
        {profile.interests.map((interest) => (
          <li key={interest} className="tag">
            {interest}
          </li>
        ))}
      </ul>
    </TypedSection>
  );
}
