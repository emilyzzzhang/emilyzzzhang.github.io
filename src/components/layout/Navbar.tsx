import { useEffect, useRef, useState } from 'react';
import { NAV_ORDER, SECTIONS } from '../../data/sections';
import type { TimeOfDay } from '../../hooks/useTimeOfDay';
import type { SectionId } from '../../types/portfolio';
import { ModeToggle } from '../ui/ModeToggle';

interface NavbarProps {
  activeSection: SectionId | null;
  onOpen: (section: SectionId) => void;
  timeOfDay: TimeOfDay;
  onToggleTime: () => void;
}

/**
 * The top bar: a little Menu button in the top left that opens the list of sections, and the
 * day/night switch in the top right. The room's objects open the sections too; this is the quick way
 * to any of them.
 */
export function Navbar({ activeSection, onOpen, timeOfDay, onToggleTime }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // Anything outside the menu (the room included) or Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="navbar">
      <div className="section-menu" ref={menu}>
        <button
          type="button"
          className={`section-menu__button${open ? ' section-menu__button--open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="section-menu"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
          Menu
        </button>
        <nav id="section-menu" className={`section-menu__list${open ? ' section-menu__list--open' : ''}`} aria-label="Portfolio sections" inert={!open}>
          <ul>
            {NAV_ORDER.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="section-menu__item"
                  aria-current={activeSection === id ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false);
                    onOpen(id);
                  }}
                >
                  {SECTIONS[id].navLabel}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <ModeToggle mode={timeOfDay} onToggle={onToggleTime} />
    </header>
  );
}
