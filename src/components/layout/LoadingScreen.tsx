export function LoadingScreen({ done }: { done: boolean }) {
  return (
    <div className={`loading${done ? ' loading--done' : ''}`} role="status" aria-live="polite" aria-hidden={done}>
      <div className="loading__spinner" aria-hidden="true">
        <span className="loading__ring" />
        <img className="loading__flower" src={`${import.meta.env.BASE_URL}emily-studio-icon.png`} alt="" />
      </div>
      <p>
        {done ? 'Studio ready' : "Emily's Studio is loading"}
        {!done && (
          <span className="loading__dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        )}
      </p>
    </div>
  );
}
