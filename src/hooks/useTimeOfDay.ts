import { useCallback, useEffect, useState } from 'react';

export type TimeOfDay = 'day' | 'night';

const STORAGE_KEY = 'mochi-studio:time-of-day';

function readStored(): TimeOfDay {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'night' ? 'night' : 'day';
  } catch {
    return 'day';
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
