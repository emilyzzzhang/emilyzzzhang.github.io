import { ProjectCard } from '../components/ui/ProjectCard';
import { projects } from '../data/projects';

export function ProjectsSection() {
  return (
    <div className="section">
      <p className="section__intro">A few things I've built, from multiplayer games to an AI-powered journaling app. Each card links to the code.</p>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
