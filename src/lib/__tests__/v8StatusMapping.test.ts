import { describe, it, expect } from 'vitest';
import { resolveV8StatusPair, V8_OFFICIAL_BUCKETS } from '../v8StatusMapping';

describe('v8StatusMapping', () => {
  it('mapeia status crus V8 do ciclo de consulta', () => {
    expect(resolveV8StatusPair('SUCCESS').official).toBe('SUCCESS');
    expect(resolveV8StatusPair('CONSENT_APPROVED').official).toBe('CONSENT_APPROVED');
    expect(resolveV8StatusPair('WAITING_CONSULT').official).toBe('WAITING_ANALYSIS');
    expect(resolveV8StatusPair('REJECTED').official).toBe('REJECTED');
    expect(resolveV8StatusPair('FAILED').official).toBe('REJECTED');
  });

  it('mapeia status do ciclo de operação', () => {
    expect(resolveV8StatusPair('paid').official).toBe('PAID');
    expect(resolveV8StatusPair('formalization').official).toBe('IN_PROGRESS');
    expect(resolveV8StatusPair('generating_ccb').official).toBe('IN_PROGRESS');
    expect(resolveV8StatusPair('refunded').official).toBe('CANCELED');
  });

  it('agrupa pendências no bucket PENDENCY', () => {
    expect(resolveV8StatusPair('pending_pix').official).toBe('PENDENCY');
    expect(resolveV8StatusPair('pending_documents').official).toBe('PENDENCY');
    expect(resolveV8StatusPair('awaiting_call').official).toBe('PENDENCY');
    expect(resolveV8StatusPair('pending').official).toBe('PENDENCY');
  });

  it('mapeia status internos LordCred', () => {
    expect(resolveV8StatusPair('temporary_v8').official).toBe('WAITING_ANALYSIS');
    expect(resolveV8StatusPair('active_consult').official).toBe('WAITING_ANALYSIS');
    expect(resolveV8StatusPair('analysis_pending').official).toBe('WAITING_ANALYSIS');
    expect(resolveV8StatusPair('cancelado').official).toBe('CANCELED');
  });

  it('preserva o status interno cru no campo internal', () => {
    expect(resolveV8StatusPair('pending_pix').internal).toBe('pending_pix');
    expect(resolveV8StatusPair('SUCCESS').internal).toBe('SUCCESS');
  });

  it('marca status desconhecidos como neutral', () => {
    const r = resolveV8StatusPair('xyz_unknown');
    expect(r.tone).toBe('neutral');
    expect(r.official).toBe('xyz_unknown');
  });

  it('lida com null/empty', () => {
    expect(resolveV8StatusPair(null).official).toBe('—');
    expect(resolveV8StatusPair('').official).toBe('—');
    expect(resolveV8StatusPair(undefined).official).toBe('—');
  });

  it('todos os buckets oficiais têm tom definido', () => {
    expect(V8_OFFICIAL_BUCKETS).toHaveLength(9);
  });
});
