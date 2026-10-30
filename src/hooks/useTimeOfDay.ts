import { useCallback, useEffect, useState } from 'react';

export type TimeOfDay = 'day' | 'night';

// A new key since night became the default: the old one saved 'day' for everyone who ever visited.
const STORAGE_KEY = 'mochi-studio:time-of-day-v2';

function readStored(): TimeOfDay {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'day' ? 'day' : 'night';
  } catch {
    return 'night';
  }
}

/** Day/night preference, remembered per visitor and mirrored on <html data-mode> for CSS. */
export function useTimeOfDay() {
  const [mode, setMode] = useState<TimeOfDay>(readStored);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === 'day' ? 'night' : 'day')), []);
  return [mode, toggle] as const;
}
