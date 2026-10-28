import type { ReactNode } from 'react';

/** Visibly marks content that still needs to be filled in from the data files. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="placeholder">{children}</span>;
}
