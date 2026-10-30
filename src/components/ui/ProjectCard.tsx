import { useState } from 'react';
import type { Project } from '../../types/portfolio';

export function ProjectCard({ project }: { project: Project }) {
  const { title, description, tags, githubUrl, demoUrl, image, accent, isPlaceholder } = project;
  const [imageFailed, setImageFailed] = useState(false);
  const titleId = `project-${project.id}`;
  const showImage = image && !imageFailed;

  return (
    <article className={`card project-card accent-${accent}${isPlaceholder ? ' is-placeholder' : ''}`} aria-labelledby={titleId}>
      <div className="project-card__image">
        {showImage ? (
          <img src={`${import.meta.env.BASE_URL}${image.src}`} alt={image.alt} loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="project-card__art" aria-hidden="true">
            <span className="project-card__monogram">{title.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="project-card__content">
        <div className="project-card__heading">
          <h3 id={titleId}>{title}</h3>
          {isPlaceholder && <span className="badge">Placeholder</span>}
        </div>
        <p>{description}</p>
        <ul className="tags" aria-label="Technologies">
          {tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>
        {(githubUrl || demoUrl) && (
          <div className="project-card__links">
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noreferrer">
                GitHub ↗<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            )}
            {demoUrl && (
              <a href={demoUrl} target="_blank" rel="noreferrer">
                Live demo ↗<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
