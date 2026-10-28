import type { TimeOfDay } from '../../hooks/useTimeOfDay';

/** Sun/moon switch for the room's lighting. */
export function ModeToggle({ mode, onToggle }: { mode: TimeOfDay; onToggle: () => void }) {
  const night = mode === 'night';
  return (
    <button
      type="button"
      className={`mode-toggle${night ? ' mode-toggle--night' : ''}`}
      onClick={onToggle}
      aria-pressed={night}
      title={night ? 'Switch to day' : 'Switch to night'}
    >
      <span className="visually-hidden">Night mode</span>
      <span className="mode-toggle__thumb" aria-hidden="true">
        <svg className="mode-toggle__sun" viewBox="0 0 24 24" width="18" height="18">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </g>
        </svg>
        <svg className="mode-toggle__moon" viewBox="0 0 24 24" width="18" height="18">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}
