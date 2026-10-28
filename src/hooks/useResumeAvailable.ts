import { useEffect, useState } from 'react';
import { RESUME_URL } from '../data/profile';

interface ResponseLike {
  ok: boolean;
  headers: { get(name: string): string | null };
}

/**
 * The dev server and most static hosts answer unknown paths with index.html (200), so a
 * successful status alone doesn't prove the PDF exists — the content type has to match.
 */
export function isPdfResponse(response: ResponseLike): boolean {
  return response.ok && (response.headers.get('content-type') ?? '').includes('application/pdf');
}

export function useResumeAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(RESUME_URL, { method: 'HEAD', signal: controller.signal })
      .then((response) => setAvailable(isPdfResponse(response)))
      .catch(() => setAvailable(false));
    return () => controller.abort();
  }, []);

  return available;
}
