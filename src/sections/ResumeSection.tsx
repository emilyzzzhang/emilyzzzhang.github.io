import { RESUME_URL } from '../data/profile';
import type { SectionId } from '../types/portfolio';

interface ResumeSectionProps {
  available: boolean;
  onNavigate: (section: SectionId) => void;
}

export function ResumeSection({ available, onNavigate }: ResumeSectionProps) {
  if (!available) {
    return (
      <div className="section section--resume">
        <div className="resume-empty" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3h11l6 6v19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M19 3v6h6M11 15h10M11 20h10M11 25h6" />
          </svg>
        </div>
        <p>
          <strong>My résumé hasn't been uploaded yet.</strong> Check back soon — in the meantime, most of it lives right here
          in the room.
        </p>
        <div className="button-row">
          <button type="button" className="button" data-opens-panel onClick={() => onNavigate('experience')}>
            See experience
          </button>
          <button type="button" className="button button--ghost" data-opens-panel onClick={() => onNavigate('education')}>
            See education
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section section--resume">
      <div className="button-row">
        <a className="button" href={RESUME_URL} target="_blank" rel="noreferrer">
          Open in a new tab ↗<span className="visually-hidden"> (PDF)</span>
        </a>
        <a className="button button--ghost" href={RESUME_URL} download>
          Download PDF
        </a>
      </div>
      {/* Phone browsers rarely render inline PDFs, so the viewer is desktop-only; the links above work everywhere. */}
      <iframe className="resume-viewer" src={`${RESUME_URL}#view=FitH&navpanes=0`} title="Résumé (PDF)" loading="lazy" />
    </div>
  );
}
