import { describe, it, expect } from 'vitest';

/**
 * Lógica isolada de detecção de origem da proposta.
 * Espelha o que o CreateOperationDialog renderiza no header (Etapa 1).
 */
type Origin = 'simulacao' | 'lead' | 'blank';

function detectOrigin(prefill: { consultId?: string | null; leadId?: string | null } | null): Origin {
  if (prefill?.consultId) return 'simulacao';
  if (prefill?.leadId) return 'lead';
  return 'blank';
}

describe('CreateOperationDialog — detecção de origem', () => {
  it('com consultId vinda de simulação V8', () => {
    expect(detectOrigin({ consultId: 'abc-123' })).toBe('simulacao');
  });

  it('com leadId mas sem consultId', () => {
    expect(detectOrigin({ leadId: 'lead-1' })).toBe('lead');
  });

  it('sem prefill = em branco', () => {
    expect(detectOrigin(null)).toBe('blank');
    expect(detectOrigin({})).toBe('blank');
  });

  it('consultId tem prioridade sobre leadId', () => {
    expect(detectOrigin({ consultId: 'c1', leadId: 'l1' })).toBe('simulacao');
  });
});
