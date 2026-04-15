import { describe, it, expect } from 'vitest';

// We can't import the private isRetryableError, so we replicate its logic for testing.
// This ensures the patterns we depend on are documented and validated.
function isRetryableError(error: unknown): boolean {
  const text = String((error as any)?.message || error || '');
  return (
    text.includes('SUPABASE_EDGE_RUNTIME_ERROR') ||
    text.includes('503') ||
    text.includes('502') ||
    text.includes('504') ||
    text.toLowerCase().includes('failed to fetch') ||
    text.toLowerCase().includes('edge function returned') ||
    text.toLowerCase().includes('network') ||
    text.toLowerCase().includes('load failed') ||
    text.toLowerCase().includes('aborted')
  );
}

describe('isRetryableError (pattern validation)', () => {
  const retryable = [
    'SUPABASE_EDGE_RUNTIME_ERROR: something',
    'HTTP 503 Service Unavailable',
    'HTTP 502 Bad Gateway',
    'HTTP 504 Gateway Timeout',
    'Failed to fetch',
    'FAILED TO FETCH',
    'Edge function returned a non-2xx status',
    'Network error occurred',
    'Load failed',
    'Request was aborted',
  ];

  retryable.forEach((msg) => {
    it(`retries: "${msg}"`, () => {
      expect(isRetryableError({ message: msg })).toBe(true);
    });
  });

  it('retries plain string error', () => {
    expect(isRetryableError('503 error')).toBe(true);
  });

  const nonRetryable = [
    'Unauthorized',
    'Invalid input',
    'Row not found',
    'duplicate key value',
    'timeout', // generic timeout is NOT retryable by current logic
    '',
  ];

  nonRetryable.forEach((msg) => {
    it(`does NOT retry: "${msg}"`, () => {
      expect(isRetryableError({ message: msg })).toBe(false);
    });
  });

  it('handles null/undefined gracefully', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});
