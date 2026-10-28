import { useMusic } from '../../hooks/useMusic';

/**
 * A small floating player for the guitar's tune: pause or resume, and mute, from anywhere on the
 * page. Appears once the visitor has started the music, and stays until they leave.
 */
export function MusicControl() {
  const { status, muted, toggle, toggleMute } = useMusic();
  if (status === 'idle' || status === 'unavailable') return null;
  const playing = status === 'playing' || status === 'loading';

  return (
    <div className={`music-control${playing && !muted ? ' music-control--playing' : ''}`} role="group" aria-label="Music">
      <span className="music-control__bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="music-control__label">Little tune</span>
      <button type="button" className="music-control__button" onClick={toggle} aria-label={playing ? 'Pause music' : 'Play music'} title={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
          </svg>
        )}
      </button>
      <button type="button" className="music-control__button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute music' : 'Mute music'} title={muted ? 'Unmute' : 'Mute'}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" fill="currentColor" />
          {muted ? (
            <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          )}
        </svg>
      </button>
    </div>
  );
}
