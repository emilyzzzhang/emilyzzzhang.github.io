import { describe, expect, it } from 'vitest';
import { isPdfResponse } from './useResumeAvailable';

const response = (ok: boolean, type: string | null) => ({ ok, headers: { get: () => type } });

describe('isPdfResponse', () => {
  it('accepts a served PDF', () => {
    expect(isPdfResponse(response(true, 'application/pdf'))).toBe(true);
  });

  it('rejects the SPA fallback page that dev servers return for missing files', () => {
    expect(isPdfResponse(response(true, 'text/html'))).toBe(false);
  });

  it('rejects errors and missing content types', () => {
    expect(isPdfResponse(response(false, 'application/pdf'))).toBe(false);
    expect(isPdfResponse(response(true, null))).toBe(false);
  });
});
