import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SECTIONS } from '../../data/sections';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import type { SectionId } from '../../types/portfolio';

interface InfoPanelProps {
  section: SectionId | null;
  /** Whether the visitor has widened the panel to three quarters of the screen. */
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  renderContent: (section: SectionId) => ReactNode;
}

/**
 * Floating panel (bottom sheet on mobile) that hosts a section. Keeps the last section
 * mounted while its exit animation plays, closes on Escape or a click outside, and returns focus to whatever
 * opened it.
 */
export function InfoPanel({ section, expanded, onToggleExpanded, onClose, renderContent }: InfoPanelProps) {
  // `shown` lags behind `section` on close so the exit animation has content to animate.
  const [shown, setShown] = useState<SectionId | null>(section);
  if (section && section !== shown) setShown(section);
  const leaving = section === null && shown !== null;

  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!section) return;
    opener.current ??= document.activeElement as HTMLElement | null;
    heading.current?.focus({ preventScroll: true });
  }, [section]);

  useEffect(() => {
    if (!section) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [section, onClose]);

  const panel = useRef<HTMLElement>(null);
  useOutsideClick(section !== null, onClose, panel);

  if (!shown) return null;
  const meta = SECTIONS[shown];

  const finishExit = () => {
    if (!leaving) return;
    setShown(null);
    opener.current?.focus?.({ preventScroll: true });
    opener.current = null;
  };

  return (
    <aside
      ref={panel}
      className={`panel${expanded ? ' panel--expanded' : ''}${leaving ? ' panel--leaving' : ''}`}
      role="dialog"
      aria-labelledby="panel-title"
      onAnimationEnd={(e) => e.target === e.currentTarget && finishExit()}
    >
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">{meta.eyebrow}</p>
          <h2 id="panel-title" className="panel__title" ref={heading} tabIndex={-1}>
            {meta.title}
          </h2>
        </div>
        <div className="panel__actions">
          <button
            type="button"
            className="panel__expand"
            onClick={onToggleExpanded}
            aria-pressed={expanded}
            aria-label={expanded ? 'Shrink panel to show more of the room' : 'Expand panel to three quarters of the screen'}
            title={expanded ? 'Shrink' : 'Expand'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d={expanded ? 'M4 14h6v6M20 10h-6V4M10 14l-6 6M14 10l6-6' : 'M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6'}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="panel__close" onClick={onClose} aria-label={`Close ${meta.title} and return to the room`}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>
      <div className="panel__body">{renderContent(shown)}</div>
      <footer className="panel__footer">
        <button type="button" className="button button--ghost" onClick={onClose}>
          ← Back to the room
        </button>
      </footer>
    </aside>
  );
}
