import { describe, it, expect } from 'vitest';
import { summarizeRunAll, type RunAllItemResult } from '@/lib/v8RunAllDrafts';

describe('summarizeRunAll', () => {
  it('texto coerente para mix queued/skipped/error', () => {
    const results: RunAllItemResult[] = [
      { draftId: '1', label: 'Rascunho 1', status: 'queued', queuePosition: 1 },
      { draftId: '2', label: 'Rascunho 2', status: 'skipped', reason: 'Sem CPFs válidos' },
      { draftId: '3', label: 'Rascunho 3', status: 'error', reason: 'erro X' },
    ];
    const s = summarizeRunAll(results);
    expect(s.queued).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.text).toContain('1 enfileirado');
    expect(s.text).toContain('1 pulado');
    expect(s.text).toContain('1 erro');
  });

  it('retorna "Nada a fazer" quando vazio', () => {
    expect(summarizeRunAll([]).text).toBe('Nada a fazer');
  });

  it('só queued => apenas enfileirado', () => {
    const s = summarizeRunAll([
      { draftId: '1', label: 'A', status: 'queued', queuePosition: 1 },
      { draftId: '2', label: 'B', status: 'queued', queuePosition: 2 },
    ]);
    expect(s.queued).toBe(2);
    expect(s.skipped).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.text).toBe('2 enfileirado(s)');
  });
});
