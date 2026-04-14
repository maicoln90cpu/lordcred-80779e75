import { describe, it, expect } from 'vitest';
import { isDisconnectError, type InvokeResult } from '../invokeEdgeWithRetry';

describe('isDisconnectError', () => {
  it('detects disconnected error in data', () => {
    const result: InvokeResult<any> = { data: { error: 'Instance disconnected' }, error: null };
    expect(isDisconnectError(result)).toBe(true);
  });
  it('detects not connected in error message', () => {
    const result: InvokeResult<any> = { data: null, error: { message: 'not connected' } };
    expect(isDisconnectError(result)).toBe(true);
  });
  it('detects chip token not found', () => {
    const result: InvokeResult<any> = { data: null, error: 'chip token not found' };
    expect(isDisconnectError(result)).toBe(true);
  });
  it('returns false for normal error', () => {
    const result: InvokeResult<any> = { data: null, error: { message: 'timeout' } };
    expect(isDisconnectError(result)).toBe(false);
  });
  it('returns false for no error', () => {
    const result: InvokeResult<any> = { data: null, error: null };
    expect(isDisconnectError(result)).toBe(false);
  });
});
