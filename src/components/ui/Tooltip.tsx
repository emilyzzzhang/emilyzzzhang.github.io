interface TooltipProps {
  label: string;
  hint?: string | null;
  /** Renders the label as a line of dialogue, in a light speech bubble. */
  speech?: boolean;
}

/** Small floating label shown above hovered objects in the room. */
export function Tooltip({ label, hint = 'Click to open', speech = false }: TooltipProps) {
  return (
    <div className={speech ? 'tooltip tooltip--speech' : 'tooltip'} role="tooltip">
      {label}
      {hint && <span className="tooltip__hint">{hint}</span>}
    </div>
  );
}
