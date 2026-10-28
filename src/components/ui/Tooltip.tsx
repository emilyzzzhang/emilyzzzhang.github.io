interface TooltipProps {
  label: string;
  hint?: string | null;
  /** Renders the label as a line of dialogue, in a light speech bubble. */
  speech?: boolean;
  /** Bigger text, for a line said in a close-up. */
  large?: boolean;
}

/** Small floating label shown above hovered objects in the room. */
export function Tooltip({ label, hint = 'Click to open', speech = false, large = false }: TooltipProps) {
  const className = `tooltip${speech ? ' tooltip--speech' : ''}${large ? ' tooltip--large' : ''}`;
  return (
    <div className={className} role="tooltip">
      {label}
      {hint && <span className="tooltip__hint">{hint}</span>}
    </div>
  );
}
