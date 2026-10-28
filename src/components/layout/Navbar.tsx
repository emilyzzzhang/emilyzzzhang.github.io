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

export function Navbar({ activeSection, onOpen, timeOfDay, onToggleTime }: NavbarProps) {
  return (
    <header className="navbar">
      <nav aria-label="Portfolio sections">
        <ul className="navbar__links">
          {NAV_ORDER.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="navbar__link"
                aria-current={activeSection === id ? 'true' : undefined}
                onClick={() => onOpen(id)}
              >
                {SECTIONS[id].navLabel}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <ModeToggle mode={timeOfDay} onToggle={onToggleTime} />
    </header>
  );
}
