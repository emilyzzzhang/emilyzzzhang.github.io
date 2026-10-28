import { ProjectCard } from '../components/ui/ProjectCard';
import { TypedSection } from '../components/ui/TypedSection';
import { projects } from '../data/projects';

const INTRO = ["Here are a few things I've built! Feel free to click around and check them out :)"];

export function ProjectsSection() {
  return (
    <TypedSection paragraphs={INTRO} paragraphClassName="section__intro">
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </TypedSection>
  );
}
