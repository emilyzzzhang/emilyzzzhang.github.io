import { ProjectCard } from '../components/ui/ProjectCard';
import { projects } from '../data/projects';

export function ProjectsSection() {
  return (
    <div className="section">
      <p className="section__intro">Here are a few things I've built! Feel free to click around and check them out :)</p>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
